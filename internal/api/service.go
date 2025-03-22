package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"time"
	"regexp"
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
	// Check if service is active
	cmdStatus := exec.Command("systemctl", "is-active", "smbd")
	outputStatus, _ := cmdStatus.CombinedOutput()
	isActive := strings.TrimSpace(string(outputStatus)) == "active"

	// Add uptime data to the response
	uptimeData := map[string]string{
		"uptime": "N/A",
		"since": "",
	}

	// If service is active, get uptime information
	if isActive {
		// Get the service start time
		cmdUptime := exec.Command("systemctl", "show", "smbd", "--property=ActiveEnterTimestamp")
		outputUptime, err := cmdUptime.CombinedOutput()
		if err == nil {
			// Parse the output to get the timestamp
			timestampLine := strings.TrimSpace(string(outputUptime))
			re := regexp.MustCompile(`ActiveEnterTimestamp=(.+)`)
			matches := re.FindStringSubmatch(timestampLine)

			if len(matches) > 1 {
				// Parse the timestamp
				startTimeStr := matches[1]
				// Format: "Day YYYY-MM-DD HH:MM:SS UTC"
				layout := "Mon 2006-01-02 15:04:05 MST"
				startTime, err := time.Parse(layout, startTimeStr)

				if err == nil {
					// Calculate uptime
					uptime := time.Since(startTime)
					days := int(uptime.Hours() / 24)
					hours := int(uptime.Hours()) % 24
					minutes := int(uptime.Minutes()) % 60

					// Format uptime string
					if days > 0 {
						uptimeData["uptime"] = fmt.Sprintf("%dd %dh %dm", days, hours, minutes)
					} else if hours > 0 {
						uptimeData["uptime"] = fmt.Sprintf("%dh %dm", hours, minutes)
					} else {
						uptimeData["uptime"] = fmt.Sprintf("%dm", minutes)
					}

					// Format the uptime since date in more readable format
					uptimeData["since"] = startTime.Format("Jan 2, 2006 15:04:05")
				}
			}
		}
	}

	// Create metadata to include uptime information
	metadata := map[string]interface{}{
		"uptime": uptimeData,
	}

	return ServiceStatusResponse{
		Service: "smbd",
		Active:  isActive,
		Status:  map[bool]string{true: "running", false: "stopped"}[isActive],
		Metadata: metadata,
	}, nil
}

// restartSambaService restarts the Samba service and refreshes ACLs
func restartSambaService() error {
	// Refresh ACLs first
	if err := refreshShareACLs(); err != nil {
		return fmt.Errorf("Failed to refresh ACLs: %v", err)
	}

	// Then restart the service
	cmd := exec.Command("systemctl", "restart", "smbd")
	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("Failed to restart service: %v", err)
	}

	return nil
}
