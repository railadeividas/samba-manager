package smbconf

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"samba-manager/internal/system"
)

// Store is the single gatekeeper for smb.conf. Every change goes through
// Update, which serialises writers, validates with testparm, keeps a backup
// and replaces the file atomically.
type Store struct {
	Path      string
	BackupDir string // empty disables backups
	Keep      int    // backups to keep (default 30)
	Runner    system.Runner

	mu sync.Mutex
}

// ValidationError is returned when testparm rejects a configuration.
type ValidationError struct{ Output string }

func (e *ValidationError) Error() string {
	return "Samba rejected the configuration: " + strings.TrimSpace(e.Output)
}

// Read parses the current configuration.
func (s *Store) Read() (*File, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.read()
}

func (s *Store) read() (*File, error) {
	data, err := os.ReadFile(s.Path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("Samba config file not found at %s", s.Path)
		}
		return nil, fmt.Errorf("failed to read Samba config: %w", err)
	}
	return Parse(string(data)), nil
}

// ReadRaw returns the file content as is.
func (s *Store) ReadRaw() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := os.ReadFile(s.Path)
	return string(data), err
}

// Update applies fn to the parsed file and saves the result if fn succeeds.
func (s *Store) Update(ctx context.Context, fn func(*File) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	f, err := s.read()
	if err != nil {
		return err
	}
	if err := fn(f); err != nil {
		return err
	}
	return s.save(ctx, f.Render())
}

// WriteRaw replaces the whole file with content (after validation).
func (s *Store) WriteRaw(ctx context.Context, content string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !strings.HasSuffix(content, "\n") {
		content += "\n"
	}
	return s.save(ctx, strings.ReplaceAll(content, "\r\n", "\n"))
}

func (s *Store) save(ctx context.Context, content string) error {
	dir := filepath.Dir(s.Path)
	tmp, err := os.CreateTemp(dir, ".smb.conf.tmp-*")
	if err != nil {
		// Directory not writable (e.g. single-file bind mount): fall back
		// to validating through a temp file elsewhere and writing in place.
		tmp, err = os.CreateTemp("", "smb.conf.tmp-*")
		if err != nil {
			return fmt.Errorf("cannot create temp file: %w", err)
		}
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if _, err := tmp.WriteString(content); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	tmp.Close()
	if err := os.Chmod(tmpName, 0o644); err != nil {
		return err
	}

	if err := s.validate(ctx, tmpName); err != nil {
		return err
	}
	if err := s.backup(); err != nil {
		return fmt.Errorf("cannot back up current config: %w", err)
	}

	if err := os.Rename(tmpName, s.Path); err != nil {
		// rename fails for bind-mounted files or across filesystems
		if werr := os.WriteFile(s.Path, []byte(content), 0o644); werr != nil {
			return fmt.Errorf("failed to write Samba config: %w", werr)
		}
	}
	return nil
}

func (s *Store) validate(ctx context.Context, file string) error {
	if s.Runner == nil || !system.HaveCommand("testparm") {
		return nil
	}
	out, err := s.Runner.Run(ctx, "", "testparm", "--suppress-prompt", file)
	if err == nil {
		return nil
	}
	var ce *system.CmdError
	if errors.As(err, &ce) {
		// strip the noise testparm prints before the actual problem
		msg := ce.Output
		if strings.TrimSpace(msg) == "" {
			msg = out
		}
		return &ValidationError{Output: tailLines(msg, 8)}
	}
	return err
}

func tailLines(s string, n int) string {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return strings.Join(lines, "\n")
}

// ---- backups ----

// Backup describes a saved copy of smb.conf.
type Backup struct {
	Name string    `json:"name"`
	Time time.Time `json:"time"`
	Size int64     `json:"size"`
}

var backupNameRe = regexp.MustCompile(`^smb\.conf\.\d{8}-\d{6}(\.\d+)?\.bak$`)

func (s *Store) backup() error {
	if s.BackupDir == "" {
		return nil
	}
	data, err := os.ReadFile(s.Path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if err := os.MkdirAll(s.BackupDir, 0o700); err != nil {
		return err
	}
	name := "smb.conf." + time.Now().Format("20060102-150405") + ".bak"
	for i := 1; ; i++ {
		if _, err := os.Stat(filepath.Join(s.BackupDir, name)); os.IsNotExist(err) {
			break
		}
		name = fmt.Sprintf("smb.conf.%s.%d.bak", time.Now().Format("20060102-150405"), i)
	}
	if err := os.WriteFile(filepath.Join(s.BackupDir, name), data, 0o600); err != nil {
		return err
	}
	s.prune()
	return nil
}

func (s *Store) prune() {
	keep := s.Keep
	if keep <= 0 {
		keep = 30
	}
	list, _ := s.listBackups()
	for i := keep; i < len(list); i++ {
		os.Remove(filepath.Join(s.BackupDir, list[i].Name))
	}
}

func (s *Store) listBackups() ([]Backup, error) {
	entries, err := os.ReadDir(s.BackupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var out []Backup
	for _, e := range entries {
		if !backupNameRe.MatchString(e.Name()) {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, Backup{Name: e.Name(), Time: info.ModTime(), Size: info.Size()})
	}
	// newest first
	sort.Slice(out, func(i, j int) bool { return out[i].Name > out[j].Name })
	return out, nil
}

// ListBackups returns saved copies, newest first.
func (s *Store) ListBackups() ([]Backup, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.listBackups()
}

// ReadBackup returns the content of a named backup.
func (s *Store) ReadBackup(name string) (string, error) {
	if !backupNameRe.MatchString(name) {
		return "", fmt.Errorf("invalid backup name")
	}
	data, err := os.ReadFile(filepath.Join(s.BackupDir, name))
	return string(data), err
}

// RestoreBackup makes a backup the current configuration (the current file is backed up first).
func (s *Store) RestoreBackup(ctx context.Context, name string) error {
	content, err := s.ReadBackup(name)
	if err != nil {
		return err
	}
	return s.WriteRaw(ctx, content)
}

// ---- bootstrap ----

// DefaultOptions customises the generated smb.conf.
type DefaultOptions struct {
	Workgroup  string
	NetBIOS    string // empty = hostname
	ServerName string
	// Fruit enables the macOS compatibility modules (needs vfs_fruit installed).
	Fruit bool
}

// DefaultConfig returns a standalone-server smb.conf tuned for Windows,
// macOS and Linux clients.
func DefaultConfig(o DefaultOptions) string {
	if o.Workgroup == "" {
		o.Workgroup = "WORKGROUP"
	}
	if o.ServerName == "" {
		o.ServerName = "Samba Manager"
	}
	var b strings.Builder
	b.WriteString("# Generated by samba-manager. Edit it here or in the web UI.\n")
	b.WriteString("[global]\n")
	add := func(k, v string) { fmt.Fprintf(&b, "    %s = %s\n", k, v) }
	add("workgroup", o.Workgroup)
	if o.NetBIOS != "" {
		add("netbios name", o.NetBIOS)
	}
	add("server string", o.ServerName)
	add("server role", "standalone server")
	add("security", "user")
	add("passdb backend", "tdbsam")
	add("map to guest", "Never")
	add("restrict anonymous", "2")
	add("server min protocol", "SMB2_10")
	add("log file", "/var/log/samba/log.%m")
	add("max log size", "1000")
	add("load printers", "no")
	add("printing", "bsd")
	add("printcap name", "/dev/null")
	add("disable spoolss", "yes")
	add("unix charset", "UTF-8")
	if o.Fruit {
		b.WriteString("    # macOS (Finder) and Windows compatibility\n")
		add("vfs objects", "fruit streams_xattr")
		add("fruit:metadata", "stream")
		add("fruit:model", "MacSamba")
		add("fruit:posix_rename", "yes")
		add("fruit:veto_appledouble", "no")
		add("fruit:nfs_aces", "no")
		add("fruit:wipe_intentionally_left_blank_rfork", "yes")
		add("fruit:delete_empty_adfiles", "yes")
	}
	return b.String()
}

// EnsureDefault creates the configuration file if it does not exist yet.
// It reports whether a file was created.
func EnsureDefault(path string, o DefaultOptions) (bool, error) {
	if _, err := os.Stat(path); err == nil {
		return false, nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return false, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return false, err
	}
	return true, os.WriteFile(path, []byte(DefaultConfig(o)), 0o644)
}
