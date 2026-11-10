package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func request(a *Auth, user, pass, ip string) int {
	h := a.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))
	r := httptest.NewRequest("GET", "/x", nil)
	r.RemoteAddr = ip + ":1234"
	if user != "" {
		r.SetBasicAuth(user, pass)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Header().Get("WWW-Authenticate") != "" {
		panic("must not send WWW-Authenticate (browser popup)")
	}
	return w.Code
}

func TestGeneratedPasswordIsStoredHashed(t *testing.T) {
	dir := t.TempDir()
	a, gen, err := New(Options{Username: "admin", StateDir: dir})
	if err != nil || len(gen) < 16 {
		t.Fatalf("gen=%q err=%v", gen, err)
	}
	if request(a, "admin", gen, "1.1.1.1") != 200 || request(a, "admin", "wrong", "1.1.1.1") != 401 {
		t.Error("generated password not accepted / wrong one accepted")
	}
	// second start: same password still works, nothing regenerated
	b, gen2, err := New(Options{Username: "admin", StateDir: dir})
	if err != nil || gen2 != "" {
		t.Fatalf("second start generated=%q err=%v", gen2, err)
	}
	if request(b, "admin", gen, "1.1.1.1") != 200 {
		t.Error("password lost across restarts")
	}
}

func TestConfiguredPasswordAndInsecureFlag(t *testing.T) {
	a, gen, _ := New(Options{Username: "admin", Password: "admin"})
	if gen != "" || !a.Insecure {
		t.Errorf("gen=%q insecure=%v", gen, a.Insecure)
	}
	b, _, _ := New(Options{Username: "admin", Password: "s3cret-pass"})
	if b.Insecure || request(b, "admin", "s3cret-pass", "2.2.2.2") != 200 {
		t.Error("custom password rejected")
	}
	if request(b, "root", "s3cret-pass", "2.2.2.2") != 401 || request(b, "", "", "2.2.2.2") != 401 {
		t.Error("wrong user / no creds must be 401")
	}
}

func TestBcryptHashInConfig(t *testing.T) {
	tmp, _, _ := New(Options{Username: "admin", Password: "hash-me-please"})
	hash := string(tmp.hash)
	if !strings.HasPrefix(hash, "$2") {
		t.Fatal("expected bcrypt hash")
	}
	a, _, err := New(Options{Username: "admin", Password: hash})
	if err != nil || request(a, "admin", "hash-me-please", "3.3.3.3") != 200 {
		t.Errorf("hashed config password not accepted: %v", err)
	}
}

func TestThrottling(t *testing.T) {
	a, _, _ := New(Options{Username: "admin", Password: "correct-horse"})
	for i := 0; i < maxFailures; i++ {
		if c := request(a, "admin", "nope", "9.9.9.9"); c != 401 {
			t.Fatalf("attempt %d = %d", i, c)
		}
	}
	if c := request(a, "admin", "correct-horse", "9.9.9.9"); c != http.StatusTooManyRequests {
		t.Errorf("blocked IP got %d, want 429", c)
	}
	if c := request(a, "admin", "correct-horse", "8.8.8.8"); c != 200 {
		t.Errorf("other IP must not be affected, got %d", c)
	}
}

func TestChangePassword(t *testing.T) {
	dir := t.TempDir()
	a, _, _ := New(Options{Username: "admin", Password: "old-password", StateDir: dir})
	if a.ChangePassword("bad", "new-password-1") == nil {
		t.Error("wrong current password accepted")
	}
	if a.ChangePassword("old-password", "short") == nil || a.ChangePassword("old-password", "admin") == nil {
		t.Error("weak new password accepted")
	}
	if err := a.ChangePassword("old-password", "new-password-1"); err != nil {
		t.Fatal(err)
	}
	if request(a, "admin", "old-password", "4.4.4.4") != 401 || request(a, "admin", "new-password-1", "4.4.4.4") != 200 {
		t.Error("password not switched")
	}
	// stored hash beats the configured password after a restart
	b, _, _ := New(Options{Username: "admin", Password: "old-password", StateDir: dir})
	if request(b, "admin", "new-password-1", "5.5.5.5") != 200 {
		t.Error("changed password not persisted")
	}
}
