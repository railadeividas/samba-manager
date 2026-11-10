// Package config loads the manager's own settings (not smb.conf).
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

// Config is the manager configuration.
type Config struct {
	Manager struct {
		Port string `yaml:"port"`
		Host string `yaml:"host"`
		TLS  struct {
			Cert string `yaml:"cert"`
			Key  string `yaml:"key"`
		} `yaml:"tls"`
	} `yaml:"manager"`

	Samba struct {
		ConfigPath string `yaml:"configPath"`
		// Mode selects how smbd is controlled: auto, systemd or process.
		ServiceMode string `yaml:"serviceMode"`
		// AllowedRoots limits where share directories may live.
		AllowedRoots []string `yaml:"allowedRoots"`
		LogDir       string   `yaml:"logDir"`
		Workgroup    string   `yaml:"workgroup"`
		NetBIOSName  string   `yaml:"netbiosName"`
	} `yaml:"samba"`

	Auth struct {
		Username string `yaml:"username"`
		// Password may be plain text or a bcrypt hash ($2a$...). Leave it empty
		// to have a random one generated on first start.
		Password string `yaml:"password"`
	} `yaml:"auth"`

	State struct {
		Dir string `yaml:"dir"`
	} `yaml:"state"`

	// Supervisor runs smbd (and friends) as child processes. It is meant for
	// containers; on a normal VM systemd manages Samba instead.
	Supervisor struct {
		Enabled bool `yaml:"enabled"`
		NMBD    bool `yaml:"nmbd"`
		WSDD    bool `yaml:"wsdd"`
		Avahi   bool `yaml:"avahi"`
	} `yaml:"supervisor"`
}

// Default returns the built-in defaults.
func Default() *Config {
	c := &Config{}
	c.Manager.Port = "8080"
	c.Manager.Host = "0.0.0.0"
	c.Samba.ConfigPath = "/etc/samba/smb.conf"
	c.Samba.ServiceMode = "auto"
	c.Samba.AllowedRoots = []string{"/srv/samba"}
	c.Samba.LogDir = "/var/log/samba"
	c.Auth.Username = "admin"
	c.State.Dir = "/var/lib/samba-manager"
	c.Supervisor.NMBD = true
	return c
}

// SearchPaths lists where a config file is looked for.
func SearchPaths() []string {
	return []string{
		"/etc/samba-manager/config.yaml",
		"./config.yaml",
		filepath.Join(os.Getenv("HOME"), ".config/samba-manager/config.yaml"),
	}
}

// Load reads the config file (path argument, $SAMBA_MANAGER_CONFIG or the
// search paths), then applies environment overrides. A missing file is fine;
// an unreadable or invalid file is an error. The path used is returned
// (empty when none).
func Load(path string) (*Config, string, error) {
	cfg := Default()
	if path == "" {
		path = os.Getenv("SAMBA_MANAGER_CONFIG")
	}
	if path == "" {
		for _, p := range SearchPaths() {
			if _, err := os.Stat(p); err == nil {
				path = p
				break
			}
		}
	}
	if path != "" {
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil, path, fmt.Errorf("cannot read config %s: %w", path, err)
		}
		if err := yaml.Unmarshal(raw, cfg); err != nil {
			return nil, path, fmt.Errorf("cannot parse config %s: %w", path, err)
		}
	}
	cfg.applyEnv()
	return cfg, path, cfg.validate()
}

func envBool(name string, dst *bool) {
	if v := os.Getenv(name); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			*dst = b
		}
	}
}

func envStr(name string, dst *string) {
	if v := os.Getenv(name); v != "" {
		*dst = v
	}
}

func (c *Config) applyEnv() {
	envStr("SAMBA_MANAGER_PORT", &c.Manager.Port)
	envStr("SAMBA_MANAGER_HOST", &c.Manager.Host)
	envStr("SAMBA_MANAGER_TLS_CERT", &c.Manager.TLS.Cert)
	envStr("SAMBA_MANAGER_TLS_KEY", &c.Manager.TLS.Key)
	envStr("SAMBA_CONFIG_PATH", &c.Samba.ConfigPath)
	envStr("SAMBA_MANAGER_SERVICE_MODE", &c.Samba.ServiceMode)
	envStr("SAMBA_MANAGER_LOG_DIR", &c.Samba.LogDir)
	envStr("SAMBA_WORKGROUP", &c.Samba.Workgroup)
	envStr("SAMBA_NETBIOS_NAME", &c.Samba.NetBIOSName)
	if v := os.Getenv("SAMBA_MANAGER_ALLOWED_ROOTS"); v != "" {
		c.Samba.AllowedRoots = nil
		for _, p := range strings.Split(v, ",") {
			if p = strings.TrimSpace(p); p != "" {
				c.Samba.AllowedRoots = append(c.Samba.AllowedRoots, p)
			}
		}
	}
	envStr("SAMBA_MANAGER_USERNAME", &c.Auth.Username)
	envStr("SAMBA_MANAGER_PASSWORD", &c.Auth.Password)
	envStr("SAMBA_MANAGER_STATE_DIR", &c.State.Dir)
	envBool("SAMBA_MANAGER_SUPERVISE", &c.Supervisor.Enabled)
	envBool("SAMBA_MANAGER_NMBD", &c.Supervisor.NMBD)
	envBool("SAMBA_MANAGER_WSDD", &c.Supervisor.WSDD)
	envBool("SAMBA_MANAGER_AVAHI", &c.Supervisor.Avahi)
}

func (c *Config) validate() error {
	if p, err := strconv.Atoi(c.Manager.Port); err != nil || p < 1 || p > 65535 {
		return fmt.Errorf("invalid manager.port %q", c.Manager.Port)
	}
	switch c.Samba.ServiceMode {
	case "", "auto", "systemd", "process":
	default:
		return fmt.Errorf("invalid samba.serviceMode %q (use auto, systemd or process)", c.Samba.ServiceMode)
	}
	if (c.Manager.TLS.Cert == "") != (c.Manager.TLS.Key == "") {
		return fmt.Errorf("manager.tls.cert and manager.tls.key must be set together")
	}
	if c.Auth.Username == "" {
		return fmt.Errorf("auth.username must not be empty")
	}
	return nil
}

// Save writes the configuration as YAML.
func Save(c *Config, path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	raw, err := yaml.Marshal(c)
	if err != nil {
		return err
	}
	return os.WriteFile(path, raw, 0o600)
}
