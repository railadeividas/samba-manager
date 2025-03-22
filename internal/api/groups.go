package api

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
)

// Group represents a Linux/Samba group
type Group struct {
	Name      string   `json:"name"`
	Users     []string `json:"users"`
	GID       int      `json:"gid"`
	IsSystem  bool     `json:"isSystem"`
}

// GroupListResponse represents the response for group listing
type GroupListResponse struct {
	Groups []Group `json:"groups"`
	Error  string  `json:"error,omitempty"`
}

// GetGroups returns all Samba groups
func (h *APIHandler) GetGroups(w http.ResponseWriter, r *http.Request) {
	// Check if we should include system groups
	includeSystem := r.URL.Query().Get("includeSystem") == "true"

	groups, err := getSambaGroups(includeSystem)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(GroupListResponse{
		Groups: groups,
	})
}

// CreateGroup creates a new Samba group
func (h *APIHandler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	groupName := getRouteParam(regexp.MustCompile(`^/groups/([^/]+)$`), r.URL.Path, 1)

	err := createSambaGroup(groupName)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(APIResponse{
		Status:  "success",
		Message: "Group created successfully",
	})
}

// DeleteGroup deletes a Samba group
func (h *APIHandler) DeleteGroup(w http.ResponseWriter, r *http.Request) {
	groupName := getRouteParam(regexp.MustCompile(`^/groups/([^/]+)$`), r.URL.Path, 1)

	// Check if it's a system group
	gid, err := getGroupGID(groupName)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if (gid < 1000 || gid == 65534) {
		writeError(w, "Cannot delete system groups (GID < 1000)", http.StatusForbidden)
		return
	}

	err = deleteSambaGroup(groupName)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(APIResponse{
		Status:  "success",
		Message: "Group deleted successfully",
	})
}

// AddUserToGroup adds a user to a group
func (h *APIHandler) AddUserToGroup(w http.ResponseWriter, r *http.Request) {
	groupName := getRouteParam(regexp.MustCompile(`^/groups/([^/]+)/users/([^/]+)$`), r.URL.Path, 1)
	userName := getRouteParam(regexp.MustCompile(`^/groups/([^/]+)/users/([^/]+)$`), r.URL.Path, 2)

	err := addUserToSambaGroup(userName, groupName)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(APIResponse{
		Status:  "success",
		Message: fmt.Sprintf("User %s added to group %s successfully", userName, groupName),
	})
}

// RemoveUserFromGroup removes a user from a group
func (h *APIHandler) RemoveUserFromGroup(w http.ResponseWriter, r *http.Request) {
	groupName := getRouteParam(regexp.MustCompile(`^/groups/([^/]+)/users/([^/]+)$`), r.URL.Path, 1)
	userName := getRouteParam(regexp.MustCompile(`^/groups/([^/]+)/users/([^/]+)$`), r.URL.Path, 2)

	err := removeUserFromSambaGroup(userName, groupName)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(APIResponse{
		Status:  "success",
		Message: fmt.Sprintf("User %s removed from group %s successfully", userName, groupName),
	})
}

// getGroupGID gets the GID of a group
func getGroupGID(groupName string) (int, error) {
	cmd := exec.Command("getent", "group", groupName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return 0, fmt.Errorf("Failed to get group info: %v", err)
	}

	parts := strings.Split(strings.TrimSpace(string(output)), ":")
	if len(parts) < 3 {
		return 0, fmt.Errorf("Unexpected output format for group info")
	}

	gid, err := strconv.Atoi(parts[2])
	if err != nil {
		return 0, fmt.Errorf("Failed to parse GID: %v", err)
	}

	return gid, nil
}

// getSambaGroups returns a list of all Samba groups
func getSambaGroups(includeSystem bool) ([]Group, error) {
	// Get all groups from system
	cmd := exec.Command("getent", "group")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("Failed to list groups: %v", err)
	}

	// Parse the output
	var groups []Group
	scanner := bufio.NewScanner(strings.NewReader(string(output)))
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.Split(line, ":")
		if len(parts) >= 4 {
			groupName := parts[0]

			// Parse GID
			gid, err := strconv.Atoi(parts[2])
			if err != nil {
				continue // Skip if GID can't be parsed
			}

			// Check if it's a system group
			isSystem := (gid < 1000 || gid == 65534)

			// Skip system groups if not included
			if isSystem && !includeSystem {
				continue
			}

			// Get user list (last field is comma-separated list of users)
			users := []string{}
			userList := parts[3]
			if userList != "" {
				users = strings.Split(userList, ",")
			}

			group := Group{
				Name:     groupName,
				Users:    users,
				GID:      gid,
				IsSystem: isSystem,
			}
			groups = append(groups, group)
		}
	}

	return groups, nil
}

// createSambaGroup creates a new Samba group
func createSambaGroup(groupName string) error {
	// Create the group
	cmd := exec.Command("groupadd", groupName)
	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("Failed to create group: %v", err)
	}

	return nil
}

// deleteSambaGroup deletes a Samba group
func deleteSambaGroup(groupName string) error {
	// Check if it's a system group
	gid, err := getGroupGID(groupName)
	if err != nil {
		return err
	}

	if (gid < 1000 || gid == 65534) {
		return fmt.Errorf("Cannot delete system groups (GID < 1000)")
	}

	// Delete the group
	cmd := exec.Command("groupdel", groupName)
	err = cmd.Run()
	if err != nil {
		return fmt.Errorf("Failed to delete group: %v", err)
	}

	return nil
}

// addUserToSambaGroup adds a user to a group
func addUserToSambaGroup(userName, groupName string) error {
	// Add user to group
	cmd := exec.Command("usermod", "-a", "-G", groupName, userName)
	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("Failed to add user to group: %v", err)
	}

	return nil
}

// removeUserFromSambaGroup removes a user from a group
func removeUserFromSambaGroup(userName, groupName string) error {
	// Get all groups for user
	cmd := exec.Command("groups", userName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("Failed to get user groups: %v", err)
	}

	// Parse output to get current groups
	outputStr := strings.TrimSpace(string(output))
	groupsStr := strings.Split(outputStr, ":")
	if len(groupsStr) < 2 {
		return fmt.Errorf("Unexpected output from groups command: %s", outputStr)
	}

	groupsList := strings.Split(strings.TrimSpace(groupsStr[1]), " ")
	var newGroups []string
	for _, g := range groupsList {
		g = strings.TrimSpace(g)
		if g != "" && g != groupName {
			newGroups = append(newGroups, g)
		}
	}

	// Set new groups for user (removing the specified group)
	if len(newGroups) > 0 {
		cmd = exec.Command("usermod", "-G", strings.Join(newGroups, ","), userName)
	} else {
		// If user has no groups, set empty groups
		cmd = exec.Command("usermod", "-G", "", userName)
	}
	err = cmd.Run()
	if err != nil {
		return fmt.Errorf("Failed to remove user from group: %v", err)
	}

	return nil
}
