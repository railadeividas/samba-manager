package smbconf

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"samba-manager/internal/system"
)

func newStore(t *testing.T, content string) *Store {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "smb.conf")
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	return &Store{Path: path, BackupDir: filepath.Join(dir, "backups"), Runner: system.ExecRunner{}}
}

func TestStoreUpdateWritesBackupAndKeepsFile(t *testing.T) {
	s := newStore(t, "[global]\n   workgroup = A\n")
	err := s.Update(context.Background(), func(f *File) error {
		f.SetSection("data", map[string]string{"path": "/srv/data"})
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := s.ReadRaw()
	if !strings.Contains(raw, "[data]") || !strings.Contains(raw, "workgroup = A") {
		t.Errorf("unexpected content:\n%s", raw)
	}
	backups, _ := s.ListBackups()
	if len(backups) != 1 {
		t.Fatalf("want 1 backup, got %d", len(backups))
	}
	old, _ := s.ReadBackup(backups[0].Name)
	if strings.Contains(old, "[data]") {
		t.Error("backup must hold the previous content")
	}
	if err := s.RestoreBackup(context.Background(), backups[0].Name); err != nil {
		t.Fatal(err)
	}
	if raw, _ := s.ReadRaw(); strings.Contains(raw, "[data]") {
		t.Error("restore did not bring back the old config")
	}
}

func TestStoreRejectsInvalidConfig(t *testing.T) {
	if !system.HaveCommand("testparm") {
		t.Skip("testparm not installed")
	}
	s := newStore(t, "[global]\n   workgroup = A\n")
	err := s.WriteRaw(context.Background(), "[global]\n   security = bogus\n[broken\n")
	var ve *ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("want ValidationError, got %v", err)
	}
	if raw, _ := s.ReadRaw(); !strings.Contains(raw, "workgroup = A") {
		t.Error("original file must be untouched after a rejected write")
	}
	entries, _ := os.ReadDir(filepath.Dir(s.Path))
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".smb.conf.tmp") {
			t.Errorf("temp file left behind: %s", e.Name())
		}
	}
}

func TestStoreUpdateErrorLeavesFile(t *testing.T) {
	s := newStore(t, "[global]\n   workgroup = A\n")
	boom := errors.New("boom")
	if err := s.Update(context.Background(), func(f *File) error { return boom }); !errors.Is(err, boom) {
		t.Fatalf("got %v", err)
	}
	if raw, _ := s.ReadRaw(); raw != "[global]\n   workgroup = A\n" {
		t.Errorf("file changed: %q", raw)
	}
}

func TestBackupPruning(t *testing.T) {
	s := newStore(t, "[global]\n   a = 1\n")
	s.Keep = 3
	for i := 0; i < 6; i++ {
		if err := s.Update(context.Background(), func(f *File) error {
			f.SetParam("global", "counter", string(rune('a'+i)))
			return nil
		}); err != nil {
			t.Fatal(err)
		}
	}
	list, _ := s.ListBackups()
	if len(list) != 3 {
		t.Errorf("want 3 backups after pruning, got %d", len(list))
	}
	if _, err := s.ReadBackup("../../etc/passwd"); err == nil {
		t.Error("path traversal in backup name must be rejected")
	}
}

func TestEnsureDefault(t *testing.T) {
	path := filepath.Join(t.TempDir(), "etc", "smb.conf")
	created, err := EnsureDefault(path, DefaultOptions{Workgroup: "HOME", NetBIOS: "NAS", Fruit: true})
	if err != nil || !created {
		t.Fatalf("created=%v err=%v", created, err)
	}
	raw, _ := os.ReadFile(path)
	for _, want := range []string{"workgroup = HOME", "netbios name = NAS", "vfs objects = fruit streams_xattr", "map to guest = Never"} {
		if !strings.Contains(string(raw), want) {
			t.Errorf("default config lacks %q", want)
		}
	}
	if created, _ := EnsureDefault(path, DefaultOptions{}); created {
		t.Error("existing file must not be overwritten")
	}
	if system.HaveCommand("testparm") {
		s := &Store{Path: path, Runner: system.ExecRunner{}}
		if err := s.WriteRaw(context.Background(), string(raw)); err != nil {
			t.Errorf("default config must pass testparm: %v", err)
		}
	}
	noFruit := DefaultConfig(DefaultOptions{})
	if strings.Contains(noFruit, "fruit") {
		t.Error("fruit lines must be omitted when the module is missing")
	}
}
