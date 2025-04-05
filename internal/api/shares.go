package api

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strings"
)

// Share represents a Samba share configuration
type Share SectionConfig

// SharesConfig represents all shares in the Samba configuration
type SharesConfig map[string]SectionConfig

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

// GetShares returns all Samba shares
func (h *APIHandler) GetShares(w http.ResponseWriter, r *http.Request) {
	shares, err := ReadConfig()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Convert SectionConfig to Share for each share
	shareMap := make(map[string]Share)
	for name, config := range shares {
		shareMap[name] = Share(config)
	}

	json.NewEncoder(w).Encode(shareMap)
}

// GetShare returns a specific share by name
func (h *APIHandler) GetShare(w http.ResponseWriter, r *http.Request) {
	shareName := getRouteParam(regexp.MustCompile(`^/shares/([^/]+)$`), r.URL.Path, 1)

	shares, err := ReadConfig()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	share, exists := shares[shareName]
	if !exists {
		writeError(w, "Share not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(map[string]Share{shareName: Share(share)})
}

// CreateUpdateShare creates or updates a share
func (h *APIHandler) CreateUpdateShare(w http.ResponseWriter, r *http.Request) {
	shareName := getRouteParam(regexp.MustCompile(`^/shares/([^/]+)$`), r.URL.Path, 1)

	var shareData Share
	err := json.NewDecoder(r.Body).Decode(&shareData)
	if err != nil {
		writeError(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	shares, err := ReadConfig()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Validate users in valid users and write list
	if err := validateShareUsers(shareData); err != nil {
		writeError(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Create directory if path provided and set up ACLs
	err = createShareDirectory(shareData)
	if err != nil {
		writeError(w, fmt.Sprintf("Failed to create directory and set up ACLs: %v", err), http.StatusInternalServerError)
		return
	}

	// Update share config
	shares[shareName] = SectionConfig(shareData)

	err = WriteConfig(shares)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(APIResponse{
		Status:  "success",
		Message: "Share created/updated successfully. Directory created and ACLs set up.",
	})
}

// DeleteShare deletes a share
func (h *APIHandler) DeleteShare(w http.ResponseWriter, r *http.Request) {
	shareName := getRouteParam(regexp.MustCompile(`^/shares/([^/]+)$`), r.URL.Path, 1)

	shares, err := ReadConfig()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if _, exists := shares[shareName]; !exists {
		writeError(w, "Share not found", http.StatusNotFound)
		return
	}

	delete(shares, shareName)

	err = WriteConfig(shares)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(APIResponse{
		Status:  "success",
		Message: "Share deleted successfully",
	})
}

// createShareDirectory creates the directory for a share if it doesn't exist
// and sets up the appropriate ACLs based on valid users and write list
func createShareDirectory(shareData Share) error {
	path, exists := shareData["path"]
	if !exists {
		return nil // No path defined, nothing to create
	}

	// Create the directory with standard permissions
	err := os.MkdirAll(path, 0755)
	if err != nil {
		return fmt.Errorf("Failed to create directory: %v", err)
	}

	// Set owner if specified
	if owner, exists := shareData["owner"]; exists && owner != "" {
		cmd := exec.Command("chown", owner, path)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("Failed to set owner: %v", err)
		}
	}

	// Set group if specified
	if group, exists := shareData["group"]; exists && group != "" {
		cmd := exec.Command("chgrp", group, path)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("Failed to set group: %v", err)
		}
	}

	// Set permissions if specified
	if permissions, exists := shareData["permissions"]; exists && permissions != "" {
		cmd := exec.Command("chmod", permissions, path)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("Failed to set permissions: %v", err)
		}
	}

	// Set up ACLs based on "valid users" and "write list" parameters
	if err := setupShareACL(shareData); err != nil {
		return fmt.Errorf("Failed to set up ACLs: %v", err)
	}

	return nil
}

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
		for _, entry := range validUsers {
			entry = strings.TrimSpace(entry)
			if entry == "" {
				continue
			}

			// Check if it's a group (prefixed with @ or +)
			if strings.HasPrefix(entry, "@") || strings.HasPrefix(entry, "+") {
				// It's a group - remove the prefix to get the group name
				groupName := strings.TrimPrefix(strings.TrimPrefix(entry, "@"), "+")

				// Set read and execute permissions for group
				groupCmd := exec.Command("setfacl", "-m", fmt.Sprintf("g:%s:r-x", groupName), path)
				if err := groupCmd.Run(); err != nil {
					return fmt.Errorf("Failed to set ACL for valid group %s: %v", groupName, err)
				}
			} else {
				// It's a user
				// Set read and execute permissions for user
				userCmd := exec.Command("setfacl", "-m", fmt.Sprintf("u:%s:r-x", entry), path)
				if err := userCmd.Run(); err != nil {
					return fmt.Errorf("Failed to set ACL for valid user %s: %v", entry, err)
				}
			}
		}
	}

	// Process "write list" (read + write + execute permissions)
	if hasWriteList {
		// Split comma-separated list and trim spaces
		writeUsers := strings.Split(writeListStr, ",")
		for _, entry := range writeUsers {
			entry = strings.TrimSpace(entry)
			if entry == "" {
				continue
			}

			// Check if it's a group (prefixed with @ or +)
			if strings.HasPrefix(entry, "@") || strings.HasPrefix(entry, "+") {
				// It's a group - remove the prefix to get the group name
				groupName := strings.TrimPrefix(strings.TrimPrefix(entry, "@"), "+")

				// Set read, write, and execute permissions for group
				groupCmd := exec.Command("setfacl", "-m", fmt.Sprintf("g:%s:rwx", groupName), path)
				if err := groupCmd.Run(); err != nil {
					return fmt.Errorf("Failed to set ACL for write list group %s: %v", groupName, err)
				}
			} else {
				// It's a user
				// Set read, write, and execute permissions for user
				userCmd := exec.Command("setfacl", "-m", fmt.Sprintf("u:%s:rwx", entry), path)
				if err := userCmd.Run(); err != nil {
					return fmt.Errorf("Failed to set ACL for write list user %s: %v", entry, err)
				}
			}
		}
	}

	// Apply the same ACLs recursively to all files and directories
	recurseCmd := exec.Command("setfacl", "-R", "-m", fmt.Sprintf("d:%s", "m::rx"), path)
	if err := recurseCmd.Run(); err != nil {
		return fmt.Errorf("Failed to set default recursive ACLs: %v", err)
	}

	// For valid users, set default ACLs recursively
	if hasValidUsers {
		validUsers := strings.Split(validUsersStr, ",")
		for _, entry := range validUsers {
			entry = strings.TrimSpace(entry)
			if entry == "" {
				continue
			}

			// Check if it's a group
			if strings.HasPrefix(entry, "@") || strings.HasPrefix(entry, "+") {
				// It's a group - remove the prefix
				groupName := strings.TrimPrefix(strings.TrimPrefix(entry, "@"), "+")

				// Set default ACLs for group
				recurseGroupCmd := exec.Command("setfacl", "-R", "-m", fmt.Sprintf("d:g:%s:r-x", groupName), path)
				if err := recurseGroupCmd.Run(); err != nil {
					return fmt.Errorf("Failed to set recursive ACLs for valid group %s: %v", groupName, err)
				}
			} else {
				// It's a user
				recurseUserCmd := exec.Command("setfacl", "-R", "-m", fmt.Sprintf("d:u:%s:r-x", entry), path)
				if err := recurseUserCmd.Run(); err != nil {
					return fmt.Errorf("Failed to set recursive ACLs for valid user %s: %v", entry, err)
				}
			}
		}
	}

	// For write list entries, set default ACLs recursively
	if hasWriteList {
		writeUsers := strings.Split(writeListStr, ",")
		for _, entry := range writeUsers {
			entry = strings.TrimSpace(entry)
			if entry == "" {
				continue
			}

			// Check if it's a group
			if strings.HasPrefix(entry, "@") || strings.HasPrefix(entry, "+") {
				// It's a group - remove the prefix
				groupName := strings.TrimPrefix(strings.TrimPrefix(entry, "@"), "+")

				// Set default ACLs for group
				recurseGroupCmd := exec.Command("setfacl", "-R", "-m", fmt.Sprintf("d:g:%s:rwx", groupName), path)
				if err := recurseGroupCmd.Run(); err != nil {
					return fmt.Errorf("Failed to set recursive ACLs for write group %s: %v", groupName, err)
				}
			} else {
				// It's a user
				recurseUserCmd := exec.Command("setfacl", "-R", "-m", fmt.Sprintf("d:u:%s:rwx", entry), path)
				if err := recurseUserCmd.Run(); err != nil {
					return fmt.Errorf("Failed to set recursive ACLs for write user %s: %v", entry, err)
				}
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

// getShareACLs gets the current ACLs for a share
func getShareACLs(sharePath string) (ShareACLs, error) {
	result := ShareACLs{
		Path:    sharePath,
		Owner:   "",
		Group:   "",
		Entries: []ACLEntry{},
	}

	// Use getfacl to get the current ACLs
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

// GetShareACLs gets the ACLs for a share
func (h *APIHandler) GetShareACLs(w http.ResponseWriter, r *http.Request) {
	shareName := getRouteParam(regexp.MustCompile(`^/shares/([^/]+)/acl$`), r.URL.Path, 1)

	shares, err := ReadConfig()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	share, exists := shares[shareName]
	if !exists {
		writeError(w, "Share not found", http.StatusNotFound)
		return
	}

	path, exists := share["path"]
	if !exists {
		writeError(w, "Share path not found", http.StatusNotFound)
		return
	}

	acls, err := getShareACLs(path)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(acls)
}
