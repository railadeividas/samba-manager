package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"samba-manager/internal/auth"
	"samba-manager/internal/config"
	"samba-manager/internal/system"
)

const (
	defaultBinPath    = "/usr/local/bin/samba-manager"
	defaultConfigPath = "/etc/samba-manager/config.yaml"
	unitPath          = "/etc/systemd/system/samba-manager.service"
)

const unitTemplate = `[Unit]
Description=Samba Manager
Documentation=https://github.com/railadeividas/samba-manager
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=%s serve --config %s
Restart=on-failure
RestartSec=3
# Samba Manager needs root to manage users, groups and Samba itself.
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
LockPersonality=true
RestrictRealtime=true

[Install]
WantedBy=multi-user.target
`

// copyFile replaces dst atomically (safe while dst is running).
func copyFile(src, dst string, mode os.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(dst), ".samba-manager-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := io.Copy(tmp, in); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmp.Name(), mode); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), dst)
}

func isSystemd() bool {
	fi, err := os.Stat("/run/systemd/system")
	return err == nil && fi.IsDir()
}

// runInstall installs or upgrades this binary as a systemd service.
// It is safe to run again: existing config and state are never overwritten.
func runInstall(args []string) error {
	flags := flag.NewFlagSet("install", flag.ExitOnError)
	binPath := flags.String("bin", defaultBinPath, "where to install the binary")
	cfgPath := flags.String("config", defaultConfigPath, "config file to create if missing")
	port := flags.String("port", "", "web UI port for a new config (default 8080)")
	host := flags.String("host", "", "address to listen on for a new config (default 0.0.0.0)")
	noStart := flags.Bool("no-start", false, "do not start/restart the service")
	force := flags.Bool("force", false, "continue even if required dependencies are missing")
	flags.Parse(args)

	if os.Geteuid() != 0 {
		return fmt.Errorf("install must run as root (try: sudo %s install)", os.Args[0])
	}

	// 1. dependencies
	fmt.Println("Checking dependencies...")
	cfg, _, err := config.Load(*cfgPath)
	if err != nil {
		cfg = config.Default()
	}
	failed := 0
	for _, c := range runChecks(cfg) {
		if c.level == levelFail && c.name != "smb.conf" {
			fmt.Printf("  missing: %-12s %s\n", c.name, c.detail)
			failed++
		}
	}
	if failed > 0 && !*force {
		fmt.Printf("\nInstall the dependencies first, then run install again:\n  %s\n(or use --force to install anyway)\n", distroHint())
		return fmt.Errorf("%d required dependency check(s) failed", failed)
	}

	// 2. binary
	self, err := os.Executable()
	if err != nil {
		return err
	}
	self, _ = filepath.EvalSymlinks(self)
	if dst, _ := filepath.EvalSymlinks(*binPath); dst != self {
		fmt.Printf("Installing binary to %s\n", *binPath)
		if err := copyFile(self, *binPath, 0o755); err != nil {
			return fmt.Errorf("cannot install binary: %w", err)
		}
	}

	// 3. config (never overwritten)
	if _, err := os.Stat(*cfgPath); os.IsNotExist(err) {
		c := config.Default()
		if *port != "" {
			c.Manager.Port = *port
		}
		if *host != "" {
			c.Manager.Host = *host
		}
		if err := config.Save(c, *cfgPath); err != nil {
			return fmt.Errorf("cannot write config: %w", err)
		}
		fmt.Printf("Created config %s\n", *cfgPath)
		cfg = c
	} else {
		fmt.Printf("Keeping existing config %s\n", *cfgPath)
		cfg, _, err = config.Load(*cfgPath)
		if err != nil {
			return err
		}
	}

	// 4. state, share root and the first admin password
	if err := os.MkdirAll(cfg.State.Dir, 0o700); err != nil {
		return err
	}
	for _, root := range cfg.Samba.AllowedRoots {
		_ = os.MkdirAll(root, 0o755)
	}
	if _, generated, err := auth.New(auth.Options{Username: cfg.Auth.Username, Password: cfg.Auth.Password, StateDir: cfg.State.Dir}); err != nil {
		return err
	} else if generated != "" {
		fmt.Println("\n  ================================================================")
		fmt.Printf("   Admin login:  %s / %s\n", cfg.Auth.Username, generated)
		fmt.Println("   Shown only once - change it in the web UI after signing in.")
		fmt.Println("  ================================================================")
	}

	// 5. service
	if !isSystemd() {
		fmt.Printf("\nsystemd was not detected, so no service was installed.\nStart it manually with:\n  %s serve --config %s\n", *binPath, *cfgPath)
		return nil
	}
	if err := os.WriteFile(unitPath, []byte(fmt.Sprintf(unitTemplate, *binPath, *cfgPath)), 0o644); err != nil {
		return fmt.Errorf("cannot write %s: %w", unitPath, err)
	}
	run := system.ExecRunner{}
	ctx := context.Background()
	if _, err := run.Run(ctx, "", "systemctl", "daemon-reload"); err != nil {
		return err
	}
	if *noStart {
		_, err = run.Run(ctx, "", "systemctl", "enable", "samba-manager")
		fmt.Println("\nInstalled. Start it with: systemctl start samba-manager")
		return err
	}
	if _, err := run.Run(ctx, "", "systemctl", "enable", "samba-manager"); err != nil {
		return err
	}
	if _, err := run.Run(ctx, "", "systemctl", "restart", "samba-manager"); err != nil {
		return err
	}
	// make sure Samba itself comes up at boot
	ctl := system.DetectController("systemd", run, nil)
	if st, _ := ctl.Status(ctx); !st.Active {
		_ = ctl.Restart(ctx)
	}
	fmt.Printf("\nSamba Manager %s is running on port %s.\n", version, cfg.Manager.Port)
	fmt.Println("Logs: journalctl -u samba-manager -f")
	return nil
}

// runUninstall removes the service and binary; --purge also removes config and state.
func runUninstall(args []string) error {
	flags := flag.NewFlagSet("uninstall", flag.ExitOnError)
	binPath := flags.String("bin", defaultBinPath, "installed binary")
	cfgPath := flags.String("config", defaultConfigPath, "config file")
	purge := flags.Bool("purge", false, "also delete the config file and the state directory (users list, backups, admin password)")
	flags.Parse(args)

	if os.Geteuid() != 0 {
		return fmt.Errorf("uninstall must run as root")
	}
	cfg, _, err := config.Load(*cfgPath)
	if err != nil {
		cfg = config.Default()
	}
	if isSystemd() {
		run := system.ExecRunner{}
		ctx := context.Background()
		_, _ = run.Run(ctx, "", "systemctl", "disable", "--now", "samba-manager")
		_ = os.Remove(unitPath)
		_, _ = run.Run(ctx, "", "systemctl", "daemon-reload")
	}
	if err := os.Remove(*binPath); err == nil {
		fmt.Printf("Removed %s\n", *binPath)
	}
	if *purge {
		_ = os.RemoveAll(filepath.Dir(*cfgPath))
		_ = os.RemoveAll(cfg.State.Dir)
		fmt.Println("Removed config and state.")
	} else {
		fmt.Printf("Kept %s and %s (use --purge to delete them). Samba and your shares were not touched.\n", *cfgPath, cfg.State.Dir)
	}
	return nil
}
