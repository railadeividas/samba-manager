package api

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
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

// SectionConfig represents a section in the Samba configuration file
type SectionConfig map[string]string

// SambaConfig represents the complete Samba configuration with all sections
type SambaConfig map[string]SectionConfig

// ConfigResponse represents the response for configuration operations
type ConfigResponse struct {
	Config SambaConfig `json:"config"`
	Error  string      `json:"error,omitempty"`
}

// RawConfigResponse represents the response for raw configuration
type RawConfigResponse struct {
	Content string `json:"content"`
	Error   string `json:"error,omitempty"`
}

// GetConfig returns the complete Samba configuration
func (h *APIHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	config, err := ReadConfig()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(ConfigResponse{
		Config: config,
	})
}

// GetSection returns a specific section of the Samba configuration
func (h *APIHandler) GetSection(w http.ResponseWriter, r *http.Request) {
	sectionName := getRouteParam(regexp.MustCompile(`^/config/sections/([^/]+)$`), r.URL.Path, 1)

	config, err := ReadConfig()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	section, exists := config[sectionName]
	if !exists {
		section = make(SectionConfig) // Return empty section if not found
	}

	json.NewEncoder(w).Encode(map[string]SectionConfig{
		sectionName: section,
	})
}

// UpdateSection updates a specific section of the Samba configuration
func (h *APIHandler) UpdateSection(w http.ResponseWriter, r *http.Request) {
	sectionName := getRouteParam(regexp.MustCompile(`^/config/sections/([^/]+)$`), r.URL.Path, 1)

	var sectionData map[string]SectionConfig
	err := json.NewDecoder(r.Body).Decode(&sectionData)
	if err != nil {
		writeError(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	section, exists := sectionData[sectionName]
	if !exists {
		writeError(w, "Section data not found in request", http.StatusBadRequest)
		return
	}

	// Get current configuration
	config, err := ReadConfig()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Update only the specified section
	config[sectionName] = section

	// Save configuration
	err = WriteConfig(config)
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
		Message: fmt.Sprintf("Section '%s' updated successfully", sectionName),
	})
}

// UpdateConfig updates multiple sections of the Samba configuration
func (h *APIHandler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	var request ConfigResponse
	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		writeError(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	// Get current configuration
	currentConfig, err := ReadConfig()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Update only the sections provided in the request
	for section, params := range request.Config {
		currentConfig[section] = params
	}

	// Save configuration
	err = WriteConfig(currentConfig)
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
		Message: "Configuration updated successfully",
	})
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

// ReadConfig reads and parses the entire Samba configuration file
func ReadConfig() (SambaConfig, error) {
	config := make(SambaConfig)
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
	var currentSection string

	// Regular expressions for parsing
	sectionRegex := regexp.MustCompile(`^\[([^\]]+)\]$`)
	paramRegex := regexp.MustCompile(`^([^=]+)=(.*)$`)

	// Parse line by line
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip comments and empty lines
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}

		// Check if it's a section header
		if match := sectionRegex.FindStringSubmatch(line); match != nil {
			currentSection = match[1]

			// Create section if it doesn't exist
			if _, exists := config[currentSection]; !exists {
				config[currentSection] = make(SectionConfig)
			}

			continue
		}

		// If we're in a section, parse parameters
		if currentSection != "" {
			if match := paramRegex.FindStringSubmatch(line); match != nil {
				paramName := strings.TrimSpace(match[1])
				paramValue := strings.TrimSpace(match[2])

				// Add parameter to current section
				section := config[currentSection]
				section[paramName] = paramValue
				config[currentSection] = section
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("Error reading Samba config: %v", err)
	}

	return config, nil
}

// WriteConfig writes the complete Samba configuration to file
func WriteConfig(config SambaConfig) error {
	configPath := GetConfigPath()

	// Read current config to preserve comments and formatting
	file, err := os.Open(configPath)
	if err != nil {
		return fmt.Errorf("Failed to open Samba config: %v", err)
	}

	var newConfig []string
	var inSection bool = false
	var currentSection string = ""
	sectionRegex := regexp.MustCompile(`^\[([^\]]+)\]$`)
	paramRegex := regexp.MustCompile(`^([^=]+)=(.*)$`)
	processedSections := make(map[string]bool)

	scanner := bufio.NewScanner(file)

	// First pass: process existing sections in the file
	for scanner.Scan() {
		line := scanner.Text()
		trimmedLine := strings.TrimSpace(line)

		// Check if it's a section header
		if match := sectionRegex.FindStringSubmatch(trimmedLine); match != nil {
			// End of previous section processing
			if inSection {
				// Add parameters for the current section
				if section, exists := config[currentSection]; exists {
					addSectionParams(&newConfig, section)
				}
			}

			// Start of new section
			currentSection = match[1]
			inSection = true
			processedSections[currentSection] = true
			newConfig = append(newConfig, line) // Keep the section header

			continue
		}

		// If we're in a section
		if inSection {
			// Skip parameter lines in the current section - we'll add our own
			if paramRegex.MatchString(trimmedLine) {
				continue
			}

			// Keep non-parameter lines (comments, blank lines)
			if !paramRegex.MatchString(trimmedLine) {
				newConfig = append(newConfig, line)
			}
		} else {
			// Not in a section, keep the line
			newConfig = append(newConfig, line)
		}
	}
	file.Close()

	// Handle the last section if any
	if inSection && currentSection != "" {
		if section, exists := config[currentSection]; exists {
			addSectionParams(&newConfig, section)
		}
	}

	// Second pass: add sections that weren't in the file
	for sectionName, sectionParams := range config {
		if !processedSections[sectionName] && len(sectionParams) > 0 {
			newConfig = append(newConfig, "")
			newConfig = append(newConfig, fmt.Sprintf("[%s]", sectionName))
			addSectionParams(&newConfig, sectionParams)
			processedSections[sectionName] = true
		}
	}

	// Write the new config
	err = os.WriteFile(configPath, []byte(strings.Join(newConfig, "\n")), 0644)
	if err != nil {
		return fmt.Errorf("Failed to write Samba config: %v", err)
	}

	return nil
}

// addSectionParams adds parameters to a section
func addSectionParams(config *[]string, params SectionConfig) {
	for key, value := range params {
		*config = append(*config, fmt.Sprintf("    %s = %s", key, value))
	}
}
