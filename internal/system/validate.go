package system

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	nameRe      = regexp.MustCompile(`^[a-z_][a-z0-9_-]{0,31}$`)
	shareNameRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9 _.$-]{0,79}$`)
	octalRe     = regexp.MustCompile(`^[0-7]{3,4}$`)
)

// ReservedSections are smb.conf sections that are not ordinary shares.
var ReservedSections = map[string]bool{"global": true, "printers": true, "print$": true, "homes": true}

// ValidateUsername checks a Unix/Samba user name.
func ValidateUsername(name string) error {
	if !nameRe.MatchString(name) {
		return fmt.Errorf("invalid user name %q: use lowercase letters, digits, '_' or '-', starting with a letter or '_' (max 32 chars)", name)
	}
	return nil
}

// ValidateGroupname checks a Unix group name.
func ValidateGroupname(name string) error {
	if !nameRe.MatchString(name) {
		return fmt.Errorf("invalid group name %q: use lowercase letters, digits, '_' or '-', starting with a letter or '_' (max 32 chars)", name)
	}
	return nil
}

// ValidateShareName checks a share name and rejects reserved sections.
func ValidateShareName(name string) error {
	if !shareNameRe.MatchString(name) {
		return fmt.Errorf("invalid share name %q: use letters, digits, space, '_', '-', '.' or '$' (max 80 chars)", name)
	}
	if ReservedSections[strings.ToLower(name)] {
		return fmt.Errorf("%q is a reserved section name", name)
	}
	return nil
}

// ValidatePassword enforces a minimal password policy.
func ValidatePassword(pw string) error {
	if len(pw) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}
	if len(pw) > 128 {
		return fmt.Errorf("password is too long (max 128 characters)")
	}
	if strings.ContainsAny(pw, "\r\n\x00") {
		return fmt.Errorf("password must not contain line breaks")
	}
	return nil
}

// ValidateOctalMode checks a permission string such as 0755 or 2775.
func ValidateOctalMode(mode string) error {
	if !octalRe.MatchString(mode) {
		return fmt.Errorf("invalid permissions %q: expected an octal mode such as 0755", mode)
	}
	return nil
}

// ValidateParamKey checks an smb.conf parameter name.
func ValidateParamKey(key string) error {
	if key == "" || len(key) > 100 {
		return fmt.Errorf("invalid parameter name %q", key)
	}
	if strings.ContainsAny(key, "=[]\r\n\x00") || strings.HasPrefix(key, "#") || strings.HasPrefix(key, ";") {
		return fmt.Errorf("invalid parameter name %q", key)
	}
	return nil
}

// ValidateParamValue checks an smb.conf parameter value.
func ValidateParamValue(value string) error {
	if strings.ContainsAny(value, "\r\n\x00") {
		return fmt.Errorf("parameter values must not contain line breaks")
	}
	return nil
}

// ValidateSharePath makes sure path is absolute and lives inside one of the
// allowed roots (after resolving symlinks in the part that already exists).
// It returns the cleaned path.
func ValidateSharePath(path string, roots []string) (string, error) {
	if path == "" || strings.ContainsRune(path, 0) {
		return "", fmt.Errorf("path is required")
	}
	if !filepath.IsAbs(path) {
		return "", fmt.Errorf("path %q must be absolute", path)
	}
	clean := filepath.Clean(path)
	if clean == "/" {
		return "", fmt.Errorf("the filesystem root cannot be shared")
	}
	if len(roots) == 0 {
		return "", fmt.Errorf("no allowed share roots are configured")
	}

	resolved := resolveExisting(clean)
	for _, root := range roots {
		root = filepath.Clean(root)
		if root == "/" {
			continue // never allow "everything"
		}
		rootResolved := resolveExisting(root)
		if within(clean, root) && within(resolved, rootResolved) {
			return clean, nil
		}
	}
	return "", fmt.Errorf("path %q is outside the allowed share locations (%s)", clean, strings.Join(roots, ", "))
}

// resolveExisting resolves symlinks for the longest existing prefix of p.
func resolveExisting(p string) string {
	cur := p
	rest := ""
	for {
		if real, err := filepath.EvalSymlinks(cur); err == nil {
			return filepath.Join(real, rest)
		}
		parent := filepath.Dir(cur)
		if parent == cur {
			return p
		}
		rest = filepath.Join(filepath.Base(cur), rest)
		cur = parent
	}
}

func within(path, root string) bool {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator)))
}
