package api

import (
	"encoding/json"
	"net/http"
	"os"
	"sync"
)

var (
	configPath string
	configMu   sync.RWMutex
)

// SetConfigPath sets the Samba configuration file path
func SetConfigPath(path string) {
	configMu.Lock()
	defer configMu.Unlock()
	configPath = path
}

// GetConfigPath gets the Samba configuration file path
func GetConfigPath() string {
	configMu.RLock()
	defer configMu.RUnlock()
	if configPath == "" {
		return SAMBA_CONF_PATH // Return default if not set
	}
	return configPath
}

// RawConfigResponse represents the response for raw configuration
type RawConfigResponse struct {
	Content string `json:"content"`
	Error   string `json:"error,omitempty"`
}

// GetRawConfig returns the raw Samba configuration file
func (h *APIHandler) GetRawConfig(w http.ResponseWriter, r *http.Request) {
	configPath := GetConfigPath()

	// Read the file
	content, err := os.ReadFile(configPath)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(RawConfigResponse{
		Content: string(content),
	})
}

// SaveRawConfig saves changes to the raw Samba configuration file
func (h *APIHandler) SaveRawConfig(w http.ResponseWriter, r *http.Request) {
	configPath := GetConfigPath()

	var request RawConfigResponse
	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		writeError(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	// Write the content to the file
	err = os.WriteFile(configPath, []byte(request.Content), 0644)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Restart Samba service
	err = restartSambaService()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(APIResponse{
		Status:  "success",
		Message: "Configuration saved and service restarted successfully",
	})
}
