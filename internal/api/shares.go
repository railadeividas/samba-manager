package api

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strings"
)

// GetShares returns all Samba shares
func (h *APIHandler) GetShares(w http.ResponseWriter, r *http.Request) {
	shares, err := readSambaConfig()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(shares)
}

// GetShare returns a specific share by name
func (h *APIHandler) GetShare(w http.ResponseWriter, r *http.Request) {
	shareName := getRouteParam(regexp.MustCompile(`^/shares/([^/]+)$`), r.URL.Path, 1)

	shares, err := readSambaConfig()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	share, exists := shares[shareName]
	if !exists {
		writeError(w, "Share not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(map[string]Share{shareName: share})
}

// CreateUpdateShare creates or updates a share
func (h *APIHandler) CreateUpdateShare(w http.ResponseWriter, r *http.Request) {
	shareName := getRouteParam(regexp.MustCompile(`^/shares/([^/]+)$`), r.URL.Path, 1)

	var shareData Share
	err := json.NewDecoder(r.Body).Decode(&shareData)
	if err != nil {
		writeError(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	shares, err := readSambaConfig()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Create directory if path provided
	err = createShareDirectory(shareData)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Update share config
	shares[shareName] = shareData

	err = writeSambaConfig(shares)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(APIResponse{
		Status:  "success",
		Message: "Share created/updated successfully",
	})
}

// DeleteShare deletes a share
func (h *APIHandler) DeleteShare(w http.ResponseWriter, r *http.Request) {
	shareName := getRouteParam(regexp.MustCompile(`^/shares/([^/]+)$`), r.URL.Path, 1)

	shares, err := readSambaConfig()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if _, exists := shares[shareName]; !exists {
		writeError(w, "Share not found", http.StatusNotFound)
		return
	}

	delete(shares, shareName)

	err = writeSambaConfig(shares)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(APIResponse{
		Status:  "success",
		Message: "Share deleted successfully",
	})
}

// readSambaConfig reads and parses the Samba configuration file
func readSambaConfig() (SharesConfig, error) {
	shares := make(SharesConfig)

	configPath := GetConfigPath()

	// Check if file exists
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("Samba config file not found at %s", configPath)
	}

	// Read the file
	file, err := os.Open(configPath)
	if err != nil {
		return nil, fmt.Errorf("Failed to open Samba config: %v", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	var currentShare string

	// Regular expressions
	shareRegex := regexp.MustCompile(`^\[([^\]]+)\]$`)
	paramRegex := regexp.MustCompile(`^([^=]+)=(.*)$`)

	// Parse line by line
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip comments and empty lines
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}

		// Check if it's a share definition
		if match := shareRegex.FindStringSubmatch(line); match != nil {
			currentShare = match[1]
			if currentShare != "global" && currentShare != "printers" && currentShare != "print$" {
				shares[currentShare] = make(Share)
			}
			continue
		}

		// If we're in a share section, parse parameters
		if currentShare != "" && currentShare != "global" && currentShare != "printers" && currentShare != "print$" {
			if match := paramRegex.FindStringSubmatch(line); match != nil {
				paramName := strings.TrimSpace(match[1])
				paramValue := strings.TrimSpace(match[2])
				shares[currentShare][paramName] = paramValue
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("Error reading Samba config: %v", err)
	}

	return shares, nil
}

// writeSambaConfig writes the shares configuration to the Samba config file
func writeSambaConfig(shares SharesConfig) error {
	configPath := GetConfigPath()

	// Read current config to preserve global settings
	file, err := os.Open(configPath)
	if err != nil {
		return fmt.Errorf("Failed to open Samba config: %v", err)
	}

	var newConfig []string
	scanner := bufio.NewScanner(file)
	inCustomShare := false
	shareRegex := regexp.MustCompile(`^\[([^\]]+)\]$`)

	// Preserve global and default sections
	for scanner.Scan() {
		line := scanner.Text()
		if match := shareRegex.FindStringSubmatch(strings.TrimSpace(line)); match != nil {
			shareName := match[1]
			if shareName != "global" && shareName != "printers" && shareName != "print$" {
				inCustomShare = true
			} else {
				inCustomShare = false
				newConfig = append(newConfig, line)
			}
		} else if !inCustomShare {
			newConfig = append(newConfig, line)
		}
	}
	file.Close()

	// Add custom shares
	for shareName, params := range shares {
		newConfig = append(newConfig, fmt.Sprintf("\n[%s]", shareName))
		for paramName, paramValue := range params {
			newConfig = append(newConfig, fmt.Sprintf("    %s = %s", paramName, paramValue))
		}
	}

	// Write the new config
	err = os.WriteFile(configPath, []byte(strings.Join(newConfig, "\n")+"\n"), 0644)
	if err != nil {
		return fmt.Errorf("Failed to write Samba config: %v", err)
	}

	// Restart Samba service
	cmd := exec.Command("systemctl", "restart", "smbd")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("Failed to restart Samba service: %v", err)
	}

	return nil
}

// createShareDirectory creates the directory for a share if it doesn't exist
func createShareDirectory(shareData Share) error {
	path, exists := shareData["path"]
	if !exists {
		return nil // No path defined, nothing to create
	}

	err := os.MkdirAll(path, 0755)
	if err != nil {
		return fmt.Errorf("Failed to create directory: %v", err)
	}

	return nil
}
