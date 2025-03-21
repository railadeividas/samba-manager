package config

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
)

// Config holds application configuration
type Config struct {
	SambaConfPath string `json:"samba_conf_path"`
	Port          string `json:"port"`
	Debug         bool   `json:"debug"`
	Auth          struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Enabled  bool   `json:"enabled"`
	} `json:"auth"`
}

const (
	defaultConfigPath = "/etc/samba-manager/config.json"
	defaultSambaConf  = "/etc/samba/smb.conf"
	defaultPort       = "8080"
)

// LoadConfig loads configuration from file or environment variables
func LoadConfig() *Config {
	cfg := &Config{
		SambaConfPath: getEnv("SAMBA_CONF_PATH", defaultSambaConf),
		Port:          getEnv("PORT", defaultPort),
		Debug:         getEnv("DEBUG", "false") == "true",
	}

	// Set default auth values
	cfg.Auth.Enabled = true
	cfg.Auth.Username = getEnv("AUTH_USERNAME", "admin")
	cfg.Auth.Password = getEnv("AUTH_PASSWORD", "admin")

	// Try to load config from file
	configPath := getEnv("CONFIG_PATH", defaultConfigPath)
	if _, err := os.Stat(configPath); err == nil {
		log.Printf("Loading configuration from %s", configPath)
		if err := loadConfigFromFile(configPath, cfg); err != nil {
			log.Printf("Error loading config file: %v, using defaults/env vars", err)
		}
	} else {
		log.Printf("Config file not found at %s, using defaults/env vars", configPath)
		// Create default config file if directory exists
		if dir := filepath.Dir(configPath); dirExists(dir) {
			if err := saveConfigToFile(configPath, cfg); err != nil {
				log.Printf("Error saving default config: %v", err)
			} else {
				log.Printf("Created default config at %s", configPath)
			}
		}
	}

	log.Printf("Configuration loaded: SambaConfPath=%s, Port=%s, Debug=%v, Auth.Enabled=%v",
		cfg.SambaConfPath, cfg.Port, cfg.Debug, cfg.Auth.Enabled)
	return cfg
}

// Load configuration from JSON file
func loadConfigFromFile(path string, cfg *Config) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	return json.Unmarshal(data, cfg)
}

// Save configuration to JSON file
func saveConfigToFile(path string, cfg *Config) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

// Check if directory exists
func dirExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

// getEnv gets an environment variable or returns the default
func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
