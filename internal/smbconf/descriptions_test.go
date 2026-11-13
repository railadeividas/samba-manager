package smbconf

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// The web UI explains parameters from a hand-written list. Every parameter the
// manager writes itself must be in it, or the settings pages show it bare.
func TestWrittenParametersHaveUIDescriptions(t *testing.T) {
	raw, err := os.ReadFile("../../gui/src/utils/sambaParameters.jsx")
	if err != nil {
		t.Skipf("UI sources not available: %v", err)
	}
	src := string(raw)
	described := map[string]bool{}
	for _, m := range regexp.MustCompile(`(?m)^  '([^']+)': \{`).FindAllStringSubmatch(src, -1) {
		described[strings.ToLower(m[1])] = true
	}

	written := map[string]bool{}
	for _, line := range strings.Split(DefaultConfig(DefaultOptions{Fruit: true}), "\n") {
		if k, _, ok := strings.Cut(strings.TrimSpace(line), " = "); ok && !strings.HasPrefix(k, "#") {
			written[k] = true
		}
	}
	// share parameters set by the access modes and the Time Machine preset
	for _, k := range []string{
		"inherit acls", "create mask", "directory mask", "force user", "force group", "guest ok",
		"vfs objects", "fruit:time machine", "durable handles", "kernel oplocks",
		"kernel share modes", "posix locking",
	} {
		written[k] = true
	}

	for k := range written {
		if !described[k] {
			t.Errorf("parameter %q is written by the manager but has no description in gui/src/utils/sambaParameters.jsx", k)
		}
	}
}
