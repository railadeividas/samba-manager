package api

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	"samba-manager/internal/system"
)

// What to do with a home directory that already exists but belongs to someone else.
const (
	homeKeep  = ""      // refuse (the UI asks the user what to do)
	homeAdopt = "adopt" // give the existing files to the user
	homeWipe  = "wipe"  // delete the old contents and start empty
)

// Seams for tests: changing ownership needs root, so tests replace them.
var (
	lchown    = os.Lchown
	fileOwner = func(_ string, fi os.FileInfo) (int, bool) {
		if st, ok := fi.Sys().(*syscall.Stat_t); ok {
			return int(st.Uid), true
		}
		return 0, false
	}
)

// homeInfo describes a leftover home directory (sent to the UI on conflict).
type homeInfo struct {
	Path      string `json:"path"`
	OwnerUID  int    `json:"ownerUid"`
	OwnerName string `json:"ownerName,omitempty"`
	Entries   int    `json:"entries"`
	Bytes     int64  `json:"bytes"`
	Truncated bool   `json:"truncated,omitempty"`
}

// homePath returns the cleaned home directory of acct if it is somewhere the
// manager may touch.
func (s *Server) homePath(acct *system.PasswdEntry) (string, error) {
	home := filepath.Clean(acct.Home)
	if !filepath.IsAbs(home) || home == "/" || home == "/nonexistent" {
		return "", badRequest("User %s has no usable home directory (%q)", acct.Name, acct.Home)
	}
	roots := append([]string{"/home"}, s.Cfg.Samba.AllowedRoots...)
	if _, err := system.ValidateSharePath(home, roots); err != nil {
		return "", badRequest("home directory %s is outside the allowed locations", home)
	}
	for _, root := range roots {
		if filepath.Clean(root) == home {
			return "", badRequest("home directory %s is a top-level location, not a user directory", home)
		}
	}
	return home, nil
}

func overlaps(a, b string) bool {
	within := func(p, root string) bool {
		rel, err := filepath.Rel(root, p)
		return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
	}
	return within(a, b) || within(b, a)
}

// shareUsing returns the name of a share whose directory overlaps path.
func (s *Server) shareUsing(path string) string {
	f, err := s.Store.Read()
	if err != nil {
		return ""
	}
	for _, sec := range f.Sections {
		if system.ReservedSections[strings.ToLower(sec.Name)] {
			continue
		}
		if p, ok := sec.Get("path"); ok && p != "" && overlaps(filepath.Clean(p), path) {
			return sec.Name
		}
	}
	return ""
}

// describeHome gathers what the UI shows before adopting or wiping.
func describeHome(home string, ownerUID int) homeInfo {
	const limit = 200000
	info := homeInfo{Path: home, OwnerUID: ownerUID}
	if u := lookupUID(ownerUID); u != "" {
		info.OwnerName = u
	}
	_ = filepath.WalkDir(home, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if p == home {
			return nil
		}
		if info.Entries >= limit {
			info.Truncated = true
			return filepath.SkipAll
		}
		info.Entries++
		if fi, err := d.Info(); err == nil && fi.Mode().IsRegular() {
			info.Bytes += fi.Size()
		}
		return nil
	})
	return info
}

func lookupUID(uid int) string {
	entries, err := system.ReadPasswd()
	if err != nil {
		return ""
	}
	for _, e := range entries {
		if e.UID == uid {
			return e.Name
		}
	}
	return ""
}

func makeHome(home string, acct *system.PasswdEntry) error {
	if err := os.Mkdir(home, 0o700); err != nil {
		return fmt.Errorf("failed to create home directory: %w", err)
	}
	if err := lchown(home, acct.UID, acct.GID); err != nil {
		_ = os.Remove(home)
		return fmt.Errorf("failed to set ownership of %s: %w", home, err)
	}
	return os.Chmod(home, 0o700)
}

// ensureHome makes sure the user has a home directory and says what it did:
// "created", "reused" (already theirs), "adopted" or "wiped".
//
// An existing directory owned by another UID is never touched unless mode
// asks for it; the caller gets a conflict that carries the details instead.
func (s *Server) ensureHome(acct *system.PasswdEntry, mode string) (string, error) {
	home, err := s.homePath(acct)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(home), 0o755); err != nil {
		return "", fmt.Errorf("failed to create %s: %w", filepath.Dir(home), err)
	}
	fi, err := os.Lstat(home)
	switch {
	case os.IsNotExist(err):
		return "created", makeHome(home, acct)
	case err != nil:
		return "", fmt.Errorf("cannot access %s: %w", home, err)
	case fi.Mode()&os.ModeSymlink != 0:
		return "", badRequest("%s is a symbolic link; refusing to use it as a home directory", home)
	case !fi.IsDir():
		return "", badRequest("%s exists and is not a directory", home)
	}

	owner, _ := fileOwner(home, fi)
	if owner == acct.UID {
		return "reused", nil
	}
	if mode == homeKeep {
		return "", conflictWith("home_conflict", describeHome(home, owner),
			"Home directory %s already exists and belongs to UID %d. Adopt it, wipe it, or cancel.", home, owner)
	}
	if share := s.shareUsing(home); share != "" {
		return "", badRequest("%s is used by share %q; change the share first", home, share)
	}
	switch mode {
	case homeWipe:
		if err := os.RemoveAll(home); err != nil {
			return "", fmt.Errorf("failed to remove old home directory: %w", err)
		}
		return "wiped", makeHome(home, acct)
	case homeAdopt:
		err := filepath.WalkDir(home, func(p string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			return lchown(p, acct.UID, acct.GID) // never follows symlinks
		})
		if err != nil {
			return "", fmt.Errorf("failed to take over %s: %w", home, err)
		}
		return "adopted", nil
	}
	return "", badRequest("invalid existingHome %q (use \"adopt\" or \"wipe\")", mode)
}

// homeMessage turns an ensureHome result into a sentence for the UI.
func homeMessage(action, home string) string {
	switch action {
	case "reused":
		return fmt.Sprintf("The existing home directory %s was already owned by this user and was kept.", home)
	case "adopted":
		return fmt.Sprintf("The existing home directory %s and its files now belong to this user.", home)
	case "wiped":
		return fmt.Sprintf("The old home directory %s was deleted and replaced with an empty one.", home)
	}
	return ""
}

// removeHome deletes the user's own home directory. It only acts on a real
// directory owned by the user and not used by any share.
func (s *Server) removeHome(acct *system.PasswdEntry) (string, error) {
	home, err := s.homePath(acct)
	if err != nil {
		return "", err
	}
	fi, err := os.Lstat(home)
	if os.IsNotExist(err) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if fi.Mode()&os.ModeSymlink != 0 || !fi.IsDir() {
		return fmt.Sprintf("The home %s is not a plain directory and was kept.", home), nil
	}
	if owner, _ := fileOwner(home, fi); owner != acct.UID {
		return fmt.Sprintf("The home %s belongs to another account and was kept.", home), nil
	}
	if share := s.shareUsing(home); share != "" {
		return fmt.Sprintf("The home %s is used by share %q and was kept.", home, share), nil
	}
	if err := os.RemoveAll(home); err != nil {
		return "", fmt.Errorf("failed to delete home directory: %w", err)
	}
	return "", nil
}
