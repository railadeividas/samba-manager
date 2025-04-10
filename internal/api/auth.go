package api

import (
	"net/http"
)

// AuthConfig contains authentication configuration
type AuthConfig struct {
	Username string
	Password string
}

var authConfig AuthConfig

// SetAuthConfig sets the authentication configuration
func SetAuthConfig(username, password string) {
	authConfig.Username = username
	authConfig.Password = password
}

// BasicAuthMiddleware wraps an http.Handler with Basic Authentication
func BasicAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get username and password from the request
		username, password, ok := r.BasicAuth()

		// If no auth header or invalid format, return unauthorized
		if !ok {
			// Never send WWW-Authenticate header - this prevents browser prompt
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error": "Unauthorized"}`))
			return
		}

		// Check credentials
		if username != authConfig.Username || password != authConfig.Password {
			// Never send WWW-Authenticate header - this prevents browser prompt
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error": "Unauthorized"}`))
			return
		}

		// Authentication successful, call the next handler
		next.ServeHTTP(w, r)
	})
}
