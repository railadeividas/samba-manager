package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// Config represents the application configuration
type Config struct {
	// Manager configuration
	Manager struct {
		Port string `yaml:"port"` // Port to listen on
		Host string `yaml:"host"` // Host to bind to
	} `yaml:"manager"`

	// Samba configuration
	Samba struct {
		ConfigPath string `yaml:"configPath"` // Path to smb.conf
	} `yaml:"samba"`

	// Authentication configuration
	Auth struct {
		Username string `yaml:"username"` // Basic auth username
		Password string `yaml:"password"` // Basic auth password
	} `yaml:"auth"`
}

// DefaultConfig returns the default configuration
func DefaultConfig() *Config {
	cfg := &Config{}

	// Manager defaults
	cfg.Manager.Port = "8080"
	cfg.Manager.Host = "localhost"

	// Samba defaults
	cfg.Samba.ConfigPath = "/etc/samba/smb.conf"

	// Auth defaults
	cfg.Auth.Username = "admin"
	cfg.Auth.Password = "admin"

	return cfg
}

// LoadConfig loads configuration from file or returns defaults
func LoadConfig() *Config {
	// Get config file path from environment or use default
	configPath := os.Getenv("SAMBA_MANAGER_CONFIG")
	if configPath == "" {
		// Try to find config in common locations
		possiblePaths := []string{
			"/etc/samba-manager/config.yaml",
			"./config.yaml",
			filepath.Join(os.Getenv("HOME"), ".config/samba-manager/config.yaml"),
		}

		for _, path := range possiblePaths {
			if _, err := os.Stat(path); err == nil {
				configPath = path
				break
			}
		}
	}

	// If no config file found, return defaults
	if configPath == "" {
		return DefaultConfig()
	}

	// Load config from file
	file, err := os.ReadFile(configPath)
	if err != nil {
		fmt.Printf("Warning: Could not read config file %s: %v\n", configPath, err)
		return DefaultConfig()
	}

	cfg := DefaultConfig()
	if err := yaml.Unmarshal(file, cfg); err != nil {
		fmt.Printf("Warning: Could not parse config file %s: %v\n", configPath, err)
		return DefaultConfig()
	}

	// Override with environment variables if set
	if port := os.Getenv("SAMBA_MANAGER_PORT"); port != "" {
		cfg.Manager.Port = port
	}
	if host := os.Getenv("SAMBA_MANAGER_HOST"); host != "" {
		cfg.Manager.Host = host
	}
	if configPath := os.Getenv("SAMBA_CONFIG_PATH"); configPath != "" {
		cfg.Samba.ConfigPath = configPath
	}
	if username := os.Getenv("SAMBA_MANAGER_USERNAME"); username != "" {
		cfg.Auth.Username = username
	}
	if password := os.Getenv("SAMBA_MANAGER_PASSWORD"); password != "" {
		cfg.Auth.Password = password
	}

	return cfg
}

// SaveConfig saves the configuration to a file
func SaveConfig(cfg *Config, path string) error {
	// Create directory if it doesn't exist
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %v", err)
	}

	// Marshal config to YAML
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %v", err)
	}

	// Write to file
	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %v", err)
	}

	return nil
}
