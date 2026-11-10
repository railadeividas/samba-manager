// Package auth protects the API with HTTP Basic authentication backed by a
// bcrypt hash, with throttling of repeated failures.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const (
	maxFailures   = 5
	failureWindow = time.Minute
	cacheTTL      = 5 * time.Minute
)

type stored struct {
	Username string `json:"username"`
	Hash     string `json:"hash"`
}

// Auth verifies credentials for the single admin account.
type Auth struct {
	mu       sync.Mutex
	username string
	hash     []byte
	file     string // where UI password changes are persisted ("" = memory only)

	// Insecure is true while the legacy default password "admin" is in use.
	Insecure bool

	failures map[string][]time.Time
	cache    map[[32]byte]time.Time
}

// Options configure New.
type Options struct {
	Username string
	// Password from config/env: plain text or a bcrypt hash. Empty = none.
	Password string
	// StateDir persists the hash when the password is changed in the UI.
	StateDir string
}

// New builds an Auth. A password changed through the UI (stored in StateDir)
// wins over the configured one. When neither exists a random password is
// generated, stored, and returned as generated so it can be shown once.
func New(o Options) (a *Auth, generated string, err error) {
	a = &Auth{
		username: o.Username,
		failures: map[string][]time.Time{},
		cache:    map[[32]byte]time.Time{},
	}
	if o.StateDir != "" {
		a.file = filepath.Join(o.StateDir, "auth.json")
	}

	if a.file != "" {
		if raw, rerr := os.ReadFile(a.file); rerr == nil {
			var s stored
			if json.Unmarshal(raw, &s) == nil && s.Hash != "" {
				if s.Username != "" {
					a.username = s.Username
				}
				a.hash = []byte(s.Hash)
				return a, "", nil
			}
		}
	}

	switch {
	case o.Password == "":
		generated, err = randomPassword(20)
		if err != nil {
			return nil, "", err
		}
		if err = a.setPassword(generated); err != nil {
			return nil, "", err
		}
		if perr := a.persist(); perr != nil {
			log.Printf("auth: cannot persist generated password: %v", perr)
		}
	case strings.HasPrefix(o.Password, "$2"):
		a.hash = []byte(o.Password)
	default:
		if err = a.setPassword(o.Password); err != nil {
			return nil, "", err
		}
		a.Insecure = o.Password == "admin"
	}
	return a, generated, nil
}

func (a *Auth) setPassword(pw string) error {
	h, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	a.hash = h
	return nil
}

func (a *Auth) persist() error {
	if a.file == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(a.file), 0o700); err != nil {
		return err
	}
	raw, _ := json.Marshal(stored{Username: a.username, Hash: string(a.hash)})
	tmp := a.file + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, a.file)
}

// Username returns the admin user name.
func (a *Auth) Username() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.username
}

// Check verifies a user/password pair.
func (a *Auth) Check(user, pass string) bool {
	a.mu.Lock()
	hash := a.hash
	name := a.username
	key := sha256.Sum256([]byte(user + "\x00" + pass + "\x00" + string(hash)))
	if t, ok := a.cache[key]; ok && time.Since(t) < cacheTTL {
		a.mu.Unlock()
		return subtle.ConstantTimeCompare([]byte(user), []byte(name)) == 1
	}
	a.mu.Unlock()

	userOK := subtle.ConstantTimeCompare([]byte(user), []byte(name)) == 1
	// always run bcrypt so timing does not reveal whether the user exists
	passOK := bcrypt.CompareHashAndPassword(hash, []byte(pass)) == nil
	if !(userOK && passOK) {
		return false
	}
	a.mu.Lock()
	if len(a.cache) > 64 {
		a.cache = map[[32]byte]time.Time{}
	}
	a.cache[key] = time.Now()
	a.mu.Unlock()
	return true
}

// ChangePassword verifies the current password, then stores the new one.
func (a *Auth) ChangePassword(current, next string) error {
	if !a.Check(a.Username(), current) {
		return fmt.Errorf("current password is incorrect")
	}
	if len(next) < 8 {
		return fmt.Errorf("new password must be at least 8 characters")
	}
	if next == "admin" {
		return fmt.Errorf("choose a less guessable password")
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if err := a.setPassword(next); err != nil {
		return err
	}
	a.cache = map[[32]byte]time.Time{}
	a.Insecure = false
	return a.persist()
}

// blocked reports whether ip has too many recent failures.
func (a *Auth) blocked(ip string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return len(a.recent(ip)) >= maxFailures
}

func (a *Auth) recent(ip string) []time.Time {
	cut := time.Now().Add(-failureWindow)
	list := a.failures[ip][:0]
	for _, t := range a.failures[ip] {
		if t.After(cut) {
			list = append(list, t)
		}
	}
	if len(list) == 0 {
		delete(a.failures, ip)
	} else {
		a.failures[ip] = list
	}
	return list
}

func (a *Auth) fail(ip string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if len(a.failures) > 1000 {
		a.failures = map[string][]time.Time{}
	}
	a.failures[ip] = append(a.recent(ip), time.Now())
}

func (a *Auth) clear(ip string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	delete(a.failures, ip)
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func unauthorized(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	if status == http.StatusTooManyRequests {
		w.Header().Set("Retry-After", "60")
	}
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// Middleware requires valid Basic credentials. It never sends a
// WWW-Authenticate header, so browsers do not pop up their own login box.
func (a *Auth) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		if a.blocked(ip) {
			unauthorized(w, http.StatusTooManyRequests, "Too many failed attempts. Try again in a minute.")
			return
		}
		user, pass, ok := r.BasicAuth()
		if !ok {
			unauthorized(w, http.StatusUnauthorized, "Unauthorized")
			return
		}
		if !a.Check(user, pass) {
			a.fail(ip)
			unauthorized(w, http.StatusUnauthorized, "Unauthorized")
			return
		}
		a.clear(ip)
		next.ServeHTTP(w, r)
	})
}

func randomPassword(n int) (string, error) {
	const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	out := make([]byte, n)
	for i := range out {
		v, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", err
		}
		out[i] = alphabet[v.Int64()]
	}
	return string(out), nil
}
