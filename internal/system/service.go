package system

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// ServiceStatus describes the smbd service.
type ServiceStatus struct {
	Active  bool
	Since   time.Time
	Backend string
	Unit    string
}

// ServiceController starts, stops and reloads Samba, whatever way the host
// manages services (systemd on a VM, a built-in supervisor in a container).
type ServiceController interface {
	Name() string
	Status(ctx context.Context) (ServiceStatus, error)
	// Reload applies smb.conf changes without disconnecting clients.
	Reload(ctx context.Context) error
	// Restart restarts smbd (drops client connections).
	Restart(ctx context.Context) error
}

// DetectController returns the controller for mode "systemd", "process" or "auto".
func DetectController(mode string, r Runner, sup *Supervisor) ServiceController {
	switch mode {
	case "systemd":
		return newSystemd(r)
	case "process":
		return &processController{r: r, sup: sup}
	}
	if sup == nil && isSystemdHost() {
		return newSystemd(r)
	}
	return &processController{r: r, sup: sup}
}

func isSystemdHost() bool {
	_, err := os.Stat("/run/systemd/system")
	return err == nil
}

// ---- systemd ----

type systemdController struct {
	r    Runner
	unit string
}

func newSystemd(r Runner) *systemdController {
	unit := "smbd"
	// Debian/Ubuntu call it smbd, RHEL/Fedora/Arch call it smb.
	if out, err := r.Run(context.Background(), "", "systemctl", "list-unit-files", "--no-legend", "smbd.service", "smb.service"); err == nil {
		if !strings.Contains(out, "smbd.service") && strings.Contains(out, "smb.service") {
			unit = "smb"
		}
	}
	return &systemdController{r: r, unit: unit}
}

func (c *systemdController) Name() string { return "systemd" }

func (c *systemdController) Status(ctx context.Context) (ServiceStatus, error) {
	st := ServiceStatus{Backend: "systemd", Unit: c.unit}
	out, _ := c.r.Run(ctx, "", "systemctl", "is-active", c.unit)
	st.Active = strings.TrimSpace(out) == "active"
	if st.Active {
		if ts, err := c.r.Run(ctx, "", "systemctl", "show", c.unit, "--property=ActiveEnterTimestamp", "--value"); err == nil {
			st.Since = parseSystemdTime(strings.TrimSpace(ts))
		}
	}
	return st, nil
}

func parseSystemdTime(s string) time.Time {
	for _, layout := range []string{"Mon 2006-01-02 15:04:05 MST", "Mon 2006-01-02 15:04:05 -07", "Mon 2006-01-02 15:04:05"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return time.Time{}
}

func (c *systemdController) Reload(ctx context.Context) error {
	st, _ := c.Status(ctx)
	if !st.Active {
		return c.Restart(ctx)
	}
	_, err := c.r.Run(ctx, "", "smbcontrol", "all", "reload-config")
	return err
}

func (c *systemdController) Restart(ctx context.Context) error {
	_, err := c.r.Run(ctx, "", "systemctl", "restart", c.unit)
	return err
}

// ---- process (container / minimal VM) ----

type processController struct {
	r   Runner
	sup *Supervisor
}

func (c *processController) Name() string { return "process" }

func (c *processController) Status(ctx context.Context) (ServiceStatus, error) {
	st := ServiceStatus{Backend: "process", Unit: "smbd"}
	if pid := FindProcess("smbd"); pid > 0 {
		st.Active = true
		if fi, err := os.Stat("/proc/" + strconv.Itoa(pid)); err == nil {
			st.Since = fi.ModTime()
		}
	}
	return st, nil
}

func (c *processController) Reload(ctx context.Context) error {
	if FindProcess("smbd") == 0 {
		return fmt.Errorf("smbd is not running")
	}
	_, err := c.r.Run(ctx, "", "smbcontrol", "all", "reload-config")
	return err
}

func (c *processController) Restart(ctx context.Context) error {
	if c.sup != nil {
		return c.sup.Restart("smbd")
	}
	if pid := FindProcess("smbd"); pid > 0 {
		_ = syscall.Kill(pid, syscall.SIGTERM)
		for i := 0; i < 50 && FindProcess("smbd") > 0; i++ {
			time.Sleep(200 * time.Millisecond)
		}
	}
	_, err := c.r.Run(ctx, "", "smbd", "--daemon")
	return err
}

// FindProcess returns the lowest pid whose command name is name, or 0.
func FindProcess(name string) int {
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return 0
	}
	best := 0
	for _, e := range entries {
		pid, err := strconv.Atoi(e.Name())
		if err != nil {
			continue
		}
		comm, err := os.ReadFile("/proc/" + e.Name() + "/comm")
		if err != nil || strings.TrimSpace(string(comm)) != name {
			continue
		}
		if best == 0 || pid < best {
			best = pid
		}
	}
	return best
}

// HasVFSModule reports whether a Samba VFS module (e.g. "fruit") is installed.
func HasVFSModule(name string) bool {
	for _, pattern := range []string{
		"/usr/lib/*/samba/vfs/" + name + ".so",
		"/usr/lib/samba/vfs/" + name + ".so",
		"/usr/lib64/samba/vfs/" + name + ".so",
		"/usr/local/samba/lib/vfs/" + name + ".so",
	} {
		if m, _ := filepath.Glob(pattern); len(m) > 0 {
			return true
		}
	}
	return false
}
