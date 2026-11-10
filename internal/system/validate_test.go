package system

import (
	"os"
	"path/filepath"
	"testing"
)

func TestValidateNames(t *testing.T) {
	good := []string{"alice", "bob_1", "_svc", "a-b"}
	bad := []string{"", "Alice", "-rf", "a b", "a;b", "1abc", "root:x", "../x", "a\nb", "averyveryveryveryveryverylongusername1"}
	for _, n := range good {
		if err := ValidateUsername(n); err != nil {
			t.Errorf("ValidateUsername(%q) = %v, want nil", n, err)
		}
		if err := ValidateGroupname(n); err != nil {
			t.Errorf("ValidateGroupname(%q) = %v, want nil", n, err)
		}
	}
	for _, n := range bad {
		if ValidateUsername(n) == nil {
			t.Errorf("ValidateUsername(%q) = nil, want error", n)
		}
	}
}

func TestValidateShareName(t *testing.T) {
	for _, n := range []string{"data", "My Docs", "backup.2024", "tm$"} {
		if err := ValidateShareName(n); err != nil {
			t.Errorf("ValidateShareName(%q) = %v", n, err)
		}
	}
	for _, n := range []string{"", "global", "HOMES", "print$", "a]b", "a\nb", "-x", "a/b"} {
		if ValidateShareName(n) == nil {
			t.Errorf("ValidateShareName(%q) = nil, want error", n)
		}
	}
}

func TestValidateParam(t *testing.T) {
	if ValidateParamKey("valid users") != nil || ValidateParamKey("fruit:time machine") != nil {
		t.Error("good keys rejected")
	}
	for _, k := range []string{"", "a=b", "[x]", "a\nb", "#c", ";c"} {
		if ValidateParamKey(k) == nil {
			t.Errorf("key %q accepted", k)
		}
	}
	if ValidateParamValue("a\n[global]") == nil || ValidateParamValue("ok value") != nil {
		t.Error("value validation wrong")
	}
}

func TestValidatePassword(t *testing.T) {
	if ValidatePassword("short") == nil || ValidatePassword("long enough") != nil || ValidatePassword("abc\ndefghij") == nil {
		t.Error("password policy wrong")
	}
}

func TestValidateOctalMode(t *testing.T) {
	for _, m := range []string{"755", "0755", "2775"} {
		if ValidateOctalMode(m) != nil {
			t.Errorf("%q rejected", m)
		}
	}
	for _, m := range []string{"", "9", "07555", "rwx", "0 755"} {
		if ValidateOctalMode(m) == nil {
			t.Errorf("%q accepted", m)
		}
	}
}

func TestValidateSharePath(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(root, "escape")); err != nil {
		t.Fatal(err)
	}
	roots := []string{root}

	ok := []string{root, filepath.Join(root, "a"), filepath.Join(root, "a", "b", "..", "c")}
	for _, p := range ok {
		if _, err := ValidateSharePath(p, roots); err != nil {
			t.Errorf("ValidateSharePath(%q) = %v", p, err)
		}
	}
	bad := []string{"", "relative/path", "/", "/etc", outside, filepath.Join(root, "..", "x"), filepath.Join(root, "escape", "x"), root + "-sibling"}
	for _, p := range bad {
		if _, err := ValidateSharePath(p, roots); err == nil {
			t.Errorf("ValidateSharePath(%q) = nil, want error", p)
		}
	}
	if _, err := ValidateSharePath(root, []string{"/"}); err == nil {
		t.Error("root '/' must never be an allowed root")
	}
	if _, err := ValidateSharePath(root, nil); err == nil {
		t.Error("no roots must reject")
	}
}
