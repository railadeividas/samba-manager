package api

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"regexp"
	"strings"
)

// setupShareACL sets up ACLs for a share based on "valid users" and "write list" parameters
func setupShareACL(shareData Share) error {
	// Get the path from share data
	path, exists := shareData["path"]
	if !exists {
		return fmt.Errorf("No path defined for share")
	}

	// Get users from "valid users" parameter
	validUsersStr, hasValidUsers := shareData["valid users"]
	// Get users from "write list" parameter
	writeListStr, hasWriteList := shareData["write list"]

	// If neither parameter exists, skip ACL setup
	if !hasValidUsers && !hasWriteList {
		return nil
	}

	// Clear existing ACLs
	clearCmd := exec.Command("setfacl", "-b", path)
	if err := clearCmd.Run(); err != nil {
		return fmt.Errorf("Failed to clear existing ACLs: %v", err)
	}

	// Set default mask to allow read and execute but not write
	maskCmd := exec.Command("setfacl", "-m", "m::rx", path)
	if err := maskCmd.Run(); err != nil {
		return fmt.Errorf("Failed to set default mask: %v", err)
	}

	// Process "valid users" (read + execute permissions)
	if hasValidUsers {
		// Split comma-separated list and trim spaces
		validUsers := strings.Split(validUsersStr, ",")
		for _, user := range validUsers {
			user = strings.TrimSpace(user)
			if user == "" {
				continue
			}

			// Set read and execute permissions for user
			userCmd := exec.Command("setfacl", "-m", fmt.Sprintf("u:%s:r-x", user), path)
			if err := userCmd.Run(); err != nil {
				return fmt.Errorf("Failed to set ACL for valid user %s: %v", user, err)
			}
		}
	}

	// Process "write list" (read + write + execute permissions)
	if hasWriteList {
		// Split comma-separated list and trim spaces
		writeUsers := strings.Split(writeListStr, ",")
		for _, user := range writeUsers {
			user = strings.TrimSpace(user)
			if user == "" {
				continue
			}

			// Set read, write, and execute permissions for user
			userCmd := exec.Command("setfacl", "-m", fmt.Sprintf("u:%s:rwx", user), path)
			if err := userCmd.Run(); err != nil {
				return fmt.Errorf("Failed to set ACL for write list user %s: %v", user, err)
			}
		}
	}

	// Apply the same ACLs recursively to all files and directories
	recurseCmd := exec.Command("setfacl", "-R", "-m", fmt.Sprintf("d:%s", "m::rx"), path)
	if err := recurseCmd.Run(); err != nil {
		return fmt.Errorf("Failed to set default recursive ACLs: %v", err)
	}

	// For write list users, set default ACLs recursively
	if hasWriteList {
		writeUsers := strings.Split(writeListStr, ",")
		for _, user := range writeUsers {
			user = strings.TrimSpace(user)
			if user == "" {
				continue
			}

			recurseWriteCmd := exec.Command("setfacl", "-R", "-m", fmt.Sprintf("d:u:%s:rwx", user), path)
			if err := recurseWriteCmd.Run(); err != nil {
				return fmt.Errorf("Failed to set recursive ACLs for write user %s: %v", user, err)
			}
		}
	}

	// For valid users, set default ACLs recursively
	if hasValidUsers {
		validUsers := strings.Split(validUsersStr, ",")
		for _, user := range validUsers {
			user = strings.TrimSpace(user)
			if user == "" {
				continue
			}

			recurseReadCmd := exec.Command("setfacl", "-R", "-m", fmt.Sprintf("d:u:%s:r-x", user), path)
			if err := recurseReadCmd.Run(); err != nil {
				return fmt.Errorf("Failed to set recursive ACLs for valid user %s: %v", user, err)
			}
		}
	}

	return nil
}

// validateShareUsers validates that all users listed in "valid users" and "write list" exist in Samba
func validateShareUsers(shareData Share) error {
	// Get the list of existing Samba users
	existingUsers, err := getSambaUsers()
	if err != nil {
		return fmt.Errorf("Failed to get existing users: %v", err)
	}

	// Create a map for quick lookup
	userMap := make(map[string]bool)
	for _, user := range existingUsers {
		userMap[user] = true
	}

	// Check "valid users"
	if validUsersStr, exists := shareData["valid users"]; exists {
		validUsers := strings.Split(validUsersStr, ",")
		for _, user := range validUsers {
			user = strings.TrimSpace(user)
			if user == "" {
				continue
			}

			// Skip special entries (@group, +group, &group)
			if strings.HasPrefix(user, "@") || strings.HasPrefix(user, "+") || strings.HasPrefix(user, "&") {
				continue
			}

			if !userMap[user] {
				return fmt.Errorf("User '%s' from 'valid users' does not exist in Samba", user)
			}
		}
	}

	// Check "write list"
	if writeListStr, exists := shareData["write list"]; exists {
		writeUsers := strings.Split(writeListStr, ",")
		for _, user := range writeUsers {
			user = strings.TrimSpace(user)
			if user == "" {
				continue
			}

			// Skip special entries (@group, +group, &group)
			if strings.HasPrefix(user, "@") || strings.HasPrefix(user, "+") || strings.HasPrefix(user, "&") {
				continue
			}

			if !userMap[user] {
				return fmt.Errorf("User '%s' from 'write list' does not exist in Samba", user)
			}
		}
	}

	return nil
}

// refreshShareACLs refreshes ACLs for all shares
func refreshShareACLs() error {
	shares, err := readSambaConfig()
	if err != nil {
		return fmt.Errorf("Failed to read Samba config: %v", err)
	}

	for _, shareData := range shares {
		// Skip shares without a path
		if _, exists := shareData["path"]; !exists {
			continue
		}

		// Set up ACLs for the share
		if err := setupShareACL(shareData); err != nil {
			return fmt.Errorf("Failed to refresh ACLs: %v", err)
		}
	}

	return nil
}

// ACLEntry represents a single ACL entry
type ACLEntry struct {
	User       string `json:"user"`
	Permission string `json:"permission"`
	Type       string `json:"type"` // "user", "group", "mask", etc.
	Default    bool   `json:"default"` // Is this a default ACL?
}

// ShareACLs represents the ACLs for a share
type ShareACLs struct {
	Path    string     `json:"path"`
	Owner   string     `json:"owner"`
	Group   string     `json:"group"`
	Entries []ACLEntry `json:"entries"`
}

// getShareACLs gets the current ACLs for a share
func getShareACLs(sharePath string) (ShareACLs, error) {
	result := ShareACLs{
		Path:    sharePath,
		Owner:   "",
		Group:   "",
		Entries: []ACLEntry{},
	}

	// Use getfacl to get the current ACLs (don't use --numeric to get usernames)
	cmd := exec.Command("getfacl", "-p", sharePath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return result, fmt.Errorf("Failed to get ACLs: %v", err)
	}

	// Parse the output
	scanner := bufio.NewScanner(strings.NewReader(string(output)))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip empty lines
		if line == "" {
			continue
		}

		// Extract owner and group info
		if strings.HasPrefix(line, "# owner:") {
			result.Owner = strings.TrimSpace(strings.TrimPrefix(line, "# owner:"))
			continue
		}
		if strings.HasPrefix(line, "# group:") {
			result.Group = strings.TrimSpace(strings.TrimPrefix(line, "# group:"))
			continue
		}

		// Skip other comment lines and file name line
		if strings.HasPrefix(line, "#") {
			continue
		}

		// Check if it's a default ACL
		isDefault := false
		if strings.HasPrefix(line, "default:") {
			isDefault = true
			line = strings.TrimPrefix(line, "default:")
		}

		// Parse ACL entries (user::rwx, group::r-x, etc.)
		parts := strings.Split(line, ":")
		if len(parts) >= 2 {
			entryType := parts[0]
			user := parts[1]
			permission := ""

			if len(parts) >= 3 {
				permission = parts[2]
			}

			// Only add named users and groups (skip entries with empty user field which are for owner/group/other)
			if (entryType == "user" || entryType == "group") && user != "" {
				entry := ACLEntry{
					Type:       entryType,
					User:       user,
					Permission: permission,
					Default:    isDefault,
				}
				result.Entries = append(result.Entries, entry)
			}
		}
	}

	return result, nil
}

// GetShareACLs API handler to get ACLs for a share
func (h *APIHandler) GetShareACLs(w http.ResponseWriter, r *http.Request) {
	shareName := getRouteParam(regexp.MustCompile(`^/shares/([^/]+)/acl$`), r.URL.Path, 1)

	shares, err := readSambaConfig()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	share, exists := shares[shareName]
	if !exists {
		writeError(w, "Share not found", http.StatusNotFound)
		return
	}

	path, hasPath := share["path"]
	if !hasPath {
		writeError(w, "Share has no path defined", http.StatusBadRequest)
		return
	}

	acls, err := getShareACLs(path)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(acls)
}
