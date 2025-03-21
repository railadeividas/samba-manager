package api

import (
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
