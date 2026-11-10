package main

import (
	"context"
	"crypto/tls"
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"samba-manager/internal/api"
	"samba-manager/internal/auth"
	"samba-manager/internal/config"
	"samba-manager/internal/smbconf"
	"samba-manager/internal/state"
	"samba-manager/internal/system"
)

// The web UI is built into gui/build (see the makefile / Dockerfile). The
// directory always exists (with a placeholder) so the Go code builds without it.
//
//go:embed all:gui/build
var reactApp embed.FS

func runServe(args []string) error {
	flags := flag.NewFlagSet("serve", flag.ExitOnError)
	cfgPath := flags.String("config", "", "path to config.yaml (default: $SAMBA_MANAGER_CONFIG or the standard locations)")
	flags.Parse(args)

	log.Printf("Starting Samba Manager %s", version)
	cfg, used, err := config.Load(*cfgPath)
	if err != nil {
		return err
	}
	if used != "" {
		log.Printf("Using config %s", used)
	}
	if os.Geteuid() != 0 {
		log.Printf("WARNING: not running as root - creating users, groups and share directories will fail")
	}

	if err := os.MkdirAll(cfg.State.Dir, 0o700); err != nil {
		return fmt.Errorf("cannot create state directory %s: %w", cfg.State.Dir, err)
	}

	authn, generated, err := auth.New(auth.Options{
		Username: cfg.Auth.Username, Password: cfg.Auth.Password, StateDir: cfg.State.Dir,
	})
	if err != nil {
		return err
	}
	if generated != "" {
		log.Printf("================================================================")
		log.Printf(" No admin password was configured. A random one was generated:")
		log.Printf("   username: %s", authn.Username())
		log.Printf("   password: %s", generated)
		log.Printf(" It is stored hashed and shown only this once. Change it in the UI.")
		log.Printf("================================================================")
	}
	if authn.Insecure {
		log.Printf("WARNING: the admin password is the default \"admin\". Change it now (Settings > Account or set auth.password).")
	}

	st, err := state.Open(cfg.State.Dir)
	if err != nil {
		return fmt.Errorf("cannot read state: %w", err)
	}
	runner := system.ExecRunner{}
	users := system.DetectUserBackend(runner)

	// make sure the directories Samba and the shares need exist
	for _, d := range append([]string{"/run/samba", "/var/log/samba", "/var/cache/samba", cfg.Samba.LogDir}, cfg.Samba.AllowedRoots...) {
		_ = os.MkdirAll(d, 0o755)
	}
	_ = os.MkdirAll("/var/lib/samba/private", 0o700)

	if created, err := smbconf.EnsureDefault(cfg.Samba.ConfigPath, smbconf.DefaultOptions{
		Workgroup: cfg.Samba.Workgroup, NetBIOS: cfg.Samba.NetBIOSName, Fruit: system.HasVFSModule("fruit"),
	}); err != nil {
		return fmt.Errorf("cannot create %s: %w", cfg.Samba.ConfigPath, err)
	} else if created {
		log.Printf("Created default Samba configuration at %s", cfg.Samba.ConfigPath)
	}

	if os.Geteuid() == 0 {
		if n := st.Restore(context.Background(), users); n > 0 {
			log.Printf("Restored %d user/group account(s) from %s", n, cfg.State.Dir)
		}
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	var sup *system.Supervisor
	if cfg.Supervisor.Enabled {
		sup = buildSupervisor(cfg)
		sup.Start(ctx)
	}

	store := &smbconf.Store{
		Path: cfg.Samba.ConfigPath, BackupDir: filepath.Join(cfg.State.Dir, "backups"), Runner: runner,
	}
	svc := system.DetectController(cfg.Samba.ServiceMode, runner, sup)
	log.Printf("Service control: %s, user management: %s", svc.Name(), users.Name())

	apiServer := &api.Server{
		Cfg: cfg, Store: store, Svc: svc, Users: users, State: st, Auth: authn, Run: runner, Version: version,
	}

	reactFS, err := fs.Sub(reactApp, "gui/build")
	if err != nil {
		return err
	}
	mux := http.NewServeMux()
	mux.Handle("/api/", authn.Middleware(http.StripPrefix("/api", apiServer.Handler())))
	mux.HandleFunc("/healthz", healthz(svc))
	mux.Handle("/", spaHandler(reactFS))

	server := &http.Server{
		Addr:              net.JoinHostPort(cfg.Manager.Host, cfg.Manager.Port),
		Handler:           securityHeaders(mux),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      90 * time.Second,
		IdleTimeout:       60 * time.Second,
		TLSConfig:         &tls.Config{MinVersion: tls.VersionTLS12},
	}

	errCh := make(chan error, 1)
	go func() {
		scheme := "http"
		if cfg.Manager.TLS.Cert != "" {
			scheme = "https"
		}
		log.Printf("Listening on %s://%s", scheme, server.Addr)
		if cfg.Manager.TLS.Cert != "" {
			errCh <- server.ListenAndServeTLS(cfg.Manager.TLS.Cert, cfg.Manager.TLS.Key)
		} else {
			errCh <- server.ListenAndServe()
		}
	}()

	select {
	case err := <-errCh:
		stop()
		if sup != nil {
			sup.Wait()
		}
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
	}

	log.Printf("Shutting down...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
	if sup != nil {
		sup.Wait()
	}
	return nil
}

func buildSupervisor(cfg *config.Config) *system.Supervisor {
	daemons := []system.Daemon{
		{Name: "smbd", Cmd: "smbd", Args: []string{"--foreground", "--no-process-group"}},
	}
	if cfg.Supervisor.NMBD {
		daemons = append(daemons, system.Daemon{Name: "nmbd", Cmd: "nmbd", Args: []string{"--foreground", "--no-process-group"}})
	}
	if cfg.Supervisor.WSDD {
		if system.HaveCommand("wsdd2") {
			daemons = append(daemons, system.Daemon{Name: "wsdd2", Cmd: "wsdd2"})
		} else {
			log.Printf("WARNING: wsdd requested but wsdd2 is not installed")
		}
	}
	if cfg.Supervisor.Avahi {
		if system.HaveCommand("avahi-daemon") && system.HaveCommand("dbus-daemon") {
			daemons = append(daemons, avahiDaemons()...)
		} else {
			log.Printf("WARNING: avahi requested but avahi-daemon/dbus-daemon are not installed")
		}
	}
	return system.NewSupervisor(daemons...)
}

// avahiDaemons advertises SMB over mDNS so macOS Finder lists the server.
func avahiDaemons() []system.Daemon {
	return []system.Daemon{
		{Name: "dbus", Cmd: "dbus-daemon", Args: []string{"--system", "--nofork", "--nopidfile"}, Pre: func() error {
			_ = os.MkdirAll("/run/dbus", 0o755)
			_ = os.Remove("/run/dbus/pid")
			_ = os.Remove("/run/dbus/system_bus_socket")
			if err := os.MkdirAll("/etc/avahi/services", 0o755); err != nil {
				return err
			}
			return os.WriteFile("/etc/avahi/services/smb.service", []byte(avahiService), 0o644)
		}},
		{Name: "avahi", Cmd: "avahi-daemon", Args: []string{"--no-chroot", "--no-drop-root"}, Pre: func() error {
			time.Sleep(time.Second) // give dbus a moment to create its socket
			return nil
		}},
	}
}

const avahiService = `<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">%h</name>
  <service><type>_smb._tcp</type><port>445</port></service>
  <service><type>_device-info._tcp</type><port>0</port><txt-record>model=RackMac</txt-record></service>
</service-group>
`

// healthz reports liveness. With ?strict=1 it also requires smbd to run.
func healthz(svc system.ServiceController) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		st, _ := svc.Status(r.Context())
		code := http.StatusOK
		if r.URL.Query().Get("strict") == "1" && !st.Active {
			code = http.StatusServiceUnavailable
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		samba := "stopped"
		if st.Active {
			samba = "running"
		}
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "samba": samba})
	}
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "same-origin")
		next.ServeHTTP(w, r)
	})
}

// spaHandler serves the built React app; unknown paths fall back to index.html
// so client-side routes work on reload.
func spaHandler(fsys fs.FS) http.Handler {
	files := http.FileServer(http.FS(fsys))
	index := func(w http.ResponseWriter) {
		data, err := fs.ReadFile(fsys, "index.html")
		if err != nil {
			http.Error(w, "The web UI is not built into this binary (run `make build`).", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		w.Write(data)
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if p == "" || p == "index.html" {
			index(w)
			return
		}
		if f, err := fsys.Open(p); err == nil {
			info, serr := f.Stat()
			f.Close()
			if serr == nil && !info.IsDir() {
				if strings.HasPrefix(p, "static/") {
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
				}
				files.ServeHTTP(w, r)
				return
			}
		}
		if strings.HasPrefix(r.URL.Path, "/api/") || path.Ext(p) != "" {
			http.NotFound(w, r)
			return
		}
		index(w)
	})
}

// runHealthcheck is used by the container HEALTHCHECK.
func runHealthcheck(args []string) error {
	flags := flag.NewFlagSet("healthcheck", flag.ExitOnError)
	cfgPath := flags.String("config", "", "path to config.yaml")
	flags.Parse(args)
	cfg, _, err := config.Load(*cfgPath)
	if err != nil {
		return err
	}
	scheme := "http"
	client := &http.Client{Timeout: 5 * time.Second}
	if cfg.Manager.TLS.Cert != "" {
		scheme = "https"
		client.Transport = &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}} //nolint:gosec // loopback probe
	}
	resp, err := client.Get(fmt.Sprintf("%s://127.0.0.1:%s/healthz?strict=1", scheme, cfg.Manager.Port))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unhealthy: HTTP %d", resp.StatusCode)
	}
	return nil
}
