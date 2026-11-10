// Package api implements the JSON HTTP API used by the web UI.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"samba-manager/internal/auth"
	"samba-manager/internal/config"
	"samba-manager/internal/smbconf"
	"samba-manager/internal/state"
	"samba-manager/internal/system"
)

// Server holds everything the handlers need.
type Server struct {
	Cfg     *config.Config
	Store   *smbconf.Store
	Svc     system.ServiceController
	Users   system.UserBackend
	State   *state.State
	Auth    *auth.Auth
	Run     system.Runner
	Version string
}

// APIResponse is the standard response body.
type APIResponse struct {
	Status  string `json:"status,omitempty"`
	Message string `json:"message,omitempty"`
	Warning string `json:"warning,omitempty"`
	Error   string `json:"error,omitempty"`
}

// httpError is an error that knows its HTTP status.
type httpError struct {
	code int
	msg  string
}

func (e *httpError) Error() string { return e.msg }

func badRequest(format string, a ...any) error {
	return &httpError{http.StatusBadRequest, fmt.Sprintf(format, a...)}
}
func notFound(format string, a ...any) error {
	return &httpError{http.StatusNotFound, fmt.Sprintf(format, a...)}
}
func conflict(format string, a ...any) error {
	return &httpError{http.StatusConflict, fmt.Sprintf(format, a...)}
}
func forbidden(format string, a ...any) error {
	return &httpError{http.StatusForbidden, fmt.Sprintf(format, a...)}
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, msg string, code int) {
	writeJSON(w, code, APIResponse{Error: msg})
}

// fail writes err with the right status code.
func fail(w http.ResponseWriter, err error) {
	var he *httpError
	var ve *smbconf.ValidationError
	switch {
	case errors.As(err, &he):
		writeError(w, he.msg, he.code)
	case errors.As(err, &ve):
		writeError(w, ve.Error(), http.StatusBadRequest)
	default:
		writeError(w, err.Error(), http.StatusInternalServerError)
	}
}

func ok(w http.ResponseWriter, msg, warning string) {
	writeJSON(w, http.StatusOK, APIResponse{Status: "success", Message: msg, Warning: warning})
}

// decode reads a JSON body (max 1 MiB).
func decode(w http.ResponseWriter, r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		return badRequest("Invalid JSON format")
	}
	return nil
}

// reload asks Samba to re-read its configuration. A failure is returned as a
// warning text: the configuration was saved, it just is not live yet.
func (s *Server) reload(ctx context.Context) string {
	if err := s.Svc.Reload(ctx); err != nil {
		return "Configuration saved, but Samba could not be reloaded: " + err.Error()
	}
	return ""
}

// Handler returns the router for all API routes (mount it under /api).
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	h := func(pattern string, fn func(http.ResponseWriter, *http.Request) error) {
		mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
			if err := fn(w, r); err != nil {
				fail(w, err)
			}
		})
	}

	// service
	h("GET /status", s.getStatus)
	h("POST /restart", s.restart)
	h("POST /reload", s.reloadService)
	h("GET /info", s.getInfo)
	h("POST /auth/password", s.changeAdminPassword)

	// shares
	h("GET /shares", s.getShares)
	h("GET /shares/{name}", s.getShare)
	h("POST /shares/{name}", s.saveShare)
	h("DELETE /shares/{name}", s.deleteShare)
	h("GET /shares/{name}/acl", s.getShareACLs)

	// users & groups
	h("GET /users", s.getUsers)
	h("POST /users/{name}", s.createUser)
	h("DELETE /users/{name}", s.deleteUser)
	h("POST /users/{name}/password", s.changePassword)
	h("POST /users/{name}/home", s.createHome)
	h("GET /groups", s.getGroups)
	h("POST /groups/{name}", s.createGroup)
	h("DELETE /groups/{name}", s.deleteGroup)
	h("POST /groups/{name}/users/{user}", s.addUserToGroup)
	h("DELETE /groups/{name}/users/{user}", s.removeUserFromGroup)

	// smb.conf
	h("GET /config", s.getConfig)
	h("POST /config", s.updateConfig)
	h("GET /config/sections/{name}", s.getSection)
	h("POST /config/sections/{name}", s.updateSection)
	h("DELETE /config/sections/{name}", s.deleteSection)
	h("GET /config/raw", s.getRawConfig)
	h("POST /config/raw", s.saveRawConfig)
	h("GET /config/backups", s.listBackups)
	h("GET /config/backups/{name}", s.getBackup)
	h("POST /config/backups/{name}/restore", s.restoreBackup)

	// monitoring
	h("GET /storage-filesystems", s.getFileSystems)
	h("GET /storage-shares", s.getShareSizes)
	h("GET /sessions", s.getSessions)
	h("GET /logs", s.getLogs)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		mux.ServeHTTP(w, r)
	})
}

// listContains reports whether a comma separated Samba list names the entry.
func listEntries(v string) []string {
	var out []string
	for _, e := range strings.Split(v, ",") {
		if e = strings.TrimSpace(e); e != "" {
			out = append(out, e)
		}
	}
	return out
}
