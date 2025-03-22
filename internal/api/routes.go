package api

import (
	"net/http"
	"regexp"
)

// Route defines an API route with handler
type Route struct {
	Pattern *regexp.Regexp
	Method  string
	Handler http.HandlerFunc
}

// APIHandler handles all API requests
type APIHandler struct {
	routes []Route
}

// NewAPIHandler creates a new API handler with all routes registered
func NewAPIHandler() *APIHandler {
	handler := &APIHandler{}
	handler.registerRoutes()
	return handler
}

// ServeHTTP handles all API requests
func (h *APIHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers for all API responses
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// Handle preflight requests
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Add common Content-Type header for all responses
	w.Header().Set("Content-Type", "application/json")

	// Find matching route
	for _, route := range h.routes {
		// Match the URL path against the route pattern
		if route.Pattern.MatchString(r.URL.Path) {
			// Match the HTTP method
			if route.Method == r.Method || route.Method == "*" {
				route.Handler(w, r)
				return
			}
		}
	}

	// If no route matched, return 404
	http.NotFound(w, r)
}

// registerRoutes registers all API routes
func (h *APIHandler) registerRoutes() {
	// Shares routes
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/shares$`),
		Method:  http.MethodGet,
		Handler: h.GetShares,
	})
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/shares/([^/]+)$`),
		Method:  http.MethodGet,
		Handler: h.GetShare,
	})
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/shares/([^/]+)$`),
		Method:  http.MethodPost,
		Handler: h.CreateUpdateShare,
	})
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/shares/([^/]+)$`),
		Method:  http.MethodDelete,
		Handler: h.DeleteShare,
	})
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/shares/([^/]+)/acl$`),
		Method:  http.MethodGet,
		Handler: h.GetShareACLs,
	})

	// Users routes
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/users$`),
		Method:  http.MethodGet,
		Handler: h.GetUsers,
	})
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/users/([^/]+)$`),
		Method:  http.MethodPost,
		Handler: h.CreateUser,
	})
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/users/([^/]+)$`),
		Method:  http.MethodDelete,
		Handler: h.DeleteUser,
	})
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/users/([^/]+)/password$`),
		Method:  http.MethodPost,
		Handler: h.ChangePassword,
	})

	// Group routes
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/groups$`),
		Method:  http.MethodGet,
		Handler: h.GetGroups,
	})
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/groups/([^/]+)$`),
		Method:  http.MethodPost,
		Handler: h.CreateGroup,
	})
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/groups/([^/]+)$`),
		Method:  http.MethodDelete,
		Handler: h.DeleteGroup,
	})
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/groups/([^/]+)/users/([^/]+)$`),
		Method:  http.MethodPost,
		Handler: h.AddUserToGroup,
	})
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/groups/([^/]+)/users/([^/]+)$`),
		Method:  http.MethodDelete,
		Handler: h.RemoveUserFromGroup,
	})

	// Raw Config routes
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/config/raw$`),
		Method:  http.MethodGet,
		Handler: h.GetRawConfig,
	})
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/config/raw$`),
		Method:  http.MethodPost,
		Handler: h.SaveRawConfig,
	})

	// Service routes
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/status$`),
		Method:  http.MethodGet,
		Handler: h.GetServiceStatus,
	})
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/restart$`),
		Method:  http.MethodPost,
		Handler: h.RestartService,
	})

	// Storage info routes
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/storage-filesystems$`),
		Method:  http.MethodGet,
		Handler: h.GetFileSystemSizes,
	})
	h.routes = append(h.routes, Route{
		Pattern: regexp.MustCompile(`^/storage-shares$`),
		Method:  http.MethodGet,
		Handler: h.GetShareSizes,
	})
}
