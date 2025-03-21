package main

import (
	"embed"
	"io"
	"io/fs"
	"log"
	"net/http"
	"path"
	"samba-manager/internal/api"
	"samba-manager/internal/config"
	"strings"
	"time"
)

//go:embed gui/build
var reactApp embed.FS

func main() {
	log.Println("Starting Samba Manager...")

	// Load configuration
	cfg := config.LoadConfig()

	// Set config in API
	api.SetConfigPath(cfg.SambaConfPath)

	// Set auth config
	api.SetAuthConfig(cfg.Auth.Username, cfg.Auth.Password, cfg.Auth.Enabled)

	// Set up API handlers
	apiHandler := api.NewAPIHandler()

	// Set up React app file system
	reactFS, err := fs.Sub(reactApp, "gui/build")
	if err != nil {
		log.Fatalf("Failed to create sub filesystem for React app: %v", err)
	}

	// Create HTTP server with routes
	mux := http.NewServeMux()

	// API routes with authentication middleware
	mux.Handle("/api/", api.BasicAuthMiddleware(http.StripPrefix("/api", apiHandler)))

	// React app static files - no authentication for static content
	fileServer := http.FileServer(http.FS(reactFS))

	// Public static files (no auth)
	mux.Handle("/static/", fileServer)
	mux.Handle("/assets/", fileServer)
	mux.Handle("/favicon.ico", fileServer)
	mux.Handle("/manifest.json", fileServer)
	mux.Handle("/logo", fileServer)

	// All other routes - serve index.html for SPA routing (no auth for the HTML)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// For API routes that don't match, return 404
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}

		// Serve index.html directly (no auth)
		serveIndexHTML(w, r, reactFS)
	})

	// Start server
	port := cfg.Port
	log.Printf("Server started on http://localhost:%s", port)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Fatal(server.ListenAndServe())
}

// Helper function to serve index.html
func serveIndexHTML(w http.ResponseWriter, r *http.Request, fsys fs.FS) {
	indexPath := path.Join("index.html")
	indexFile, err := fsys.Open(indexPath)
	if err != nil {
		log.Printf("Error opening index.html: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer indexFile.Close()

	// Read the file content
	content, err := io.ReadAll(indexFile)
	if err != nil {
		log.Printf("Error reading index.html: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Set content type and serve the file
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(content)
}
