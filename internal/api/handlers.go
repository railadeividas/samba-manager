package api

import (
	"encoding/json"
	"net/http"
	"regexp"
)

// Constants for Samba configuration and commands
const (
	SAMBA_CONF_PATH   = "/etc/samba/smb.conf"
	SMB_PASSWD_CMD    = "smbpasswd"
	SMB_USER_ADD_CMD  = "pdbedit"
	SMB_USER_DEL_CMD  = "pdbedit"
	SMB_USER_LIST_CMD = "pdbedit"
)

// Share represents a Samba share configuration
type Share map[string]string

// SharesConfig represents all shares in the Samba configuration
type SharesConfig map[string]Share

// APIResponse represents a standard API response
type APIResponse struct {
	Status  string `json:"status,omitempty"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

// UserListResponse represents the response for user listing
type UserListResponse struct {
	Users []string `json:"users"`
	Error string   `json:"error,omitempty"`
}

// ServiceStatusResponse represents the Samba service status
type ServiceStatusResponse struct {
	Service string `json:"service"`
	Active  bool   `json:"active"`
	Status  string `json:"status"`
	Error   string `json:"error,omitempty"`
}

// PasswordRequest represents a password change request
type PasswordRequest struct {
	Password string `json:"password"`
}

// Helper function to write error responses
func writeError(w http.ResponseWriter, message string, statusCode int) {
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(APIResponse{
		Error: message,
	})
}

// Helper function to get a route parameter from the URL path
func getRouteParam(pattern *regexp.Regexp, path string, index int) string {
	matches := pattern.FindStringSubmatch(path)
	if len(matches) > index {
		return matches[index]
	}
	return ""
}
