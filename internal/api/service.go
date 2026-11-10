package api

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"samba-manager/internal/system"
)

// ServiceStatusResponse is the Samba service status.
type ServiceStatusResponse struct {
	Service  string         `json:"service"`
	Active   bool           `json:"active"`
	Status   string         `json:"status"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

func formatUptime(d time.Duration) string {
	days := int(d.Hours() / 24)
	hours := int(d.Hours()) % 24
	minutes := int(d.Minutes()) % 60
	switch {
	case days > 0:
		return fmt.Sprintf("%dd %dh %dm", days, hours, minutes)
	case hours > 0:
		return fmt.Sprintf("%dh %dm", hours, minutes)
	default:
		return fmt.Sprintf("%dm", minutes)
	}
}

func (s *Server) getStatus(w http.ResponseWriter, r *http.Request) error {
	st, err := s.Svc.Status(r.Context())
	if err != nil {
		return err
	}
	uptime := map[string]string{"uptime": "N/A", "since": ""}
	if st.Active && !st.Since.IsZero() {
		uptime["uptime"] = formatUptime(time.Since(st.Since))
		uptime["since"] = st.Since.Format("Jan 2, 2006 15:04:05")
	}
	status := "stopped"
	if st.Active {
		status = "running"
	}
	writeJSON(w, http.StatusOK, ServiceStatusResponse{
		Service: "smbd",
		Active:  st.Active,
		Status:  status,
		Metadata: map[string]any{
			"uptime":  uptime,
			"backend": st.Backend,
		},
	})
	return nil
}

func (s *Server) restart(w http.ResponseWriter, r *http.Request) error {
	if err := s.Svc.Restart(r.Context()); err != nil {
		return fmt.Errorf("failed to restart service: %w", err)
	}
	ok(w, "Service restarted successfully", "")
	return nil
}

func (s *Server) reloadService(w http.ResponseWriter, r *http.Request) error {
	if err := s.Svc.Reload(r.Context()); err != nil {
		return fmt.Errorf("failed to reload service: %w", err)
	}
	ok(w, "Configuration reloaded", "")
	return nil
}

// Info describes the server for the UI.
type Info struct {
	Version          string   `json:"version"`
	Hostname         string   `json:"hostname"`
	AllowedRoots     []string `json:"allowedRoots"`
	ServiceBackend   string   `json:"serviceBackend"`
	UserBackend      string   `json:"userBackend"`
	ACLSupported     bool     `json:"aclSupported"`
	FruitSupported   bool     `json:"fruitSupported"`
	InsecurePassword bool     `json:"insecurePassword"`
	Username         string   `json:"username"`
}

func (s *Server) getInfo(w http.ResponseWriter, r *http.Request) error {
	host, _ := os.Hostname()
	writeJSON(w, http.StatusOK, Info{
		Version:          s.Version,
		Hostname:         host,
		AllowedRoots:     s.Cfg.Samba.AllowedRoots,
		ServiceBackend:   s.Svc.Name(),
		UserBackend:      s.Users.Name(),
		ACLSupported:     system.HaveCommand("setfacl") && system.HaveCommand("getfacl"),
		FruitSupported:   system.HasVFSModule("fruit"),
		InsecurePassword: s.Auth.Insecure,
		Username:         s.Auth.Username(),
	})
	return nil
}

type adminPasswordRequest struct {
	Current string `json:"current"`
	New     string `json:"new"`
}

func (s *Server) changeAdminPassword(w http.ResponseWriter, r *http.Request) error {
	var req adminPasswordRequest
	if err := decode(w, r, &req); err != nil {
		return err
	}
	if err := s.Auth.ChangePassword(req.Current, req.New); err != nil {
		msg := err.Error()
		if strings.Contains(msg, "incorrect") {
			return forbidden("%s", msg)
		}
		return badRequest("%s", msg)
	}
	ok(w, "Admin password changed. Please sign in again.", "")
	return nil
}
