package config

import (
	"os"
	"path/filepath"
	"testing"
)

func write(t *testing.T, content string) string {
	p := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestEnvOverridesApplyWithoutConfigFile(t *testing.T) {
	t.Setenv("SAMBA_MANAGER_CONFIG", "")
	old, _ := os.Getwd()
	os.Chdir(t.TempDir())
	t.Cleanup(func() { os.Chdir(old) })
	t.Setenv("SAMBA_MANAGER_PASSWORD", "from-env")
	t.Setenv("SAMBA_MANAGER_PORT", "9090")
	t.Setenv("SAMBA_MANAGER_SUPERVISE", "true")
	t.Setenv("SAMBA_MANAGER_ALLOWED_ROOTS", "/a, /b")
	cfg, _, err := Load("")
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Auth.Password != "from-env" || cfg.Manager.Port != "9090" || !cfg.Supervisor.Enabled {
		t.Errorf("env overrides ignored: %+v", cfg)
	}
	if len(cfg.Samba.AllowedRoots) != 2 || cfg.Samba.AllowedRoots[1] != "/b" {
		t.Errorf("roots: %v", cfg.Samba.AllowedRoots)
	}
}

func TestFileThenEnv(t *testing.T) {
	p := write(t, "manager:\n  port: \"7000\"\nsamba:\n  allowedRoots: [/data]\n")
	t.Setenv("SAMBA_MANAGER_HOST", "127.0.0.1")
	cfg, used, err := Load(p)
	if err != nil || used != p {
		t.Fatal(err, used)
	}
	if cfg.Manager.Port != "7000" || cfg.Manager.Host != "127.0.0.1" || cfg.Samba.AllowedRoots[0] != "/data" {
		t.Errorf("%+v", cfg)
	}
	if cfg.Samba.ConfigPath != "/etc/samba/smb.conf" {
		t.Error("defaults must survive a partial file")
	}
}

func TestInvalidConfigIsAnError(t *testing.T) {
	if _, _, err := Load(write(t, "manager: [not, a, map")); err == nil {
		t.Error("broken YAML must not silently fall back to defaults")
	}
	if _, _, err := Load(write(t, "manager:\n  port: \"nope\"\n")); err == nil {
		t.Error("invalid port accepted")
	}
	if _, _, err := Load(write(t, "samba:\n  serviceMode: magic\n")); err == nil {
		t.Error("invalid service mode accepted")
	}
	if _, _, err := Load(filepath.Join(t.TempDir(), "missing.yaml")); err == nil {
		t.Error("explicitly named missing file must be an error")
	}
}
