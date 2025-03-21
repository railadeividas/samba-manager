package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
)

// GetServiceStatus returns the Samba service status
func (h *APIHandler) GetServiceStatus(w http.ResponseWriter, r *http.Request) {
	status, err := getSambaServiceStatus()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(status)
}

// RestartService restarts the Samba service
func (h *APIHandler) RestartService(w http.ResponseWriter, r *http.Request) {
	err := restartSambaService()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(APIResponse{
		Status:  "success",
		Message: "Service restarted successfully",
	})
}

// getSambaServiceStatus returns the Samba service status
func getSambaServiceStatus() (ServiceStatusResponse, error) {
	cmd := exec.Command("systemctl", "is-active", "smbd")
	output, _ := cmd.CombinedOutput()
	isActive := strings.TrimSpace(string(output)) == "active"

	return ServiceStatusResponse{
		Service: "smbd",
		Active:  isActive,
		Status:  map[bool]string{true: "running", false: "stopped"}[isActive],
	}, nil
}

// restartSambaService restarts the Samba service
func restartSambaService() error {
	cmd := exec.Command("systemctl", "restart", "smbd")
	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("Failed to restart service: %v", err)
	}

	return nil
}
