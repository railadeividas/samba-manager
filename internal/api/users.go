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

// GetUsers returns all Samba users
func (h *APIHandler) GetUsers(w http.ResponseWriter, r *http.Request) {
	users, err := getSambaUsers()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(UserListResponse{
		Users: users,
	})
}

// CreateUser creates a new Samba user
func (h *APIHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	username := getRouteParam(regexp.MustCompile(`^/users/([^/]+)$`), r.URL.Path, 1)

	var passwordReq PasswordRequest
	err := json.NewDecoder(r.Body).Decode(&passwordReq)
	if err != nil {
		writeError(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	if passwordReq.Password == "" {
		writeError(w, "Password is required", http.StatusBadRequest)
		return
	}

	err = createSambaUser(username, passwordReq.Password)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(APIResponse{
		Status:  "success",
		Message: "User created successfully",
	})
}

// DeleteUser deletes a Samba user
func (h *APIHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	username := getRouteParam(regexp.MustCompile(`^/users/([^/]+)$`), r.URL.Path, 1)

	err := deleteSambaUser(username)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(APIResponse{
		Status:  "success",
		Message: "User deleted successfully",
	})
}

// ChangePassword changes a user's password
func (h *APIHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	username := getRouteParam(regexp.MustCompile(`^/users/([^/]+)/password$`), r.URL.Path, 1)

	var passwordReq PasswordRequest
	err := json.NewDecoder(r.Body).Decode(&passwordReq)
	if err != nil {
		writeError(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	if passwordReq.Password == "" {
		writeError(w, "Password is required", http.StatusBadRequest)
		return
	}

	err = changeSambaPassword(username, passwordReq.Password)
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(APIResponse{
		Status:  "success",
		Message: "Password changed successfully",
	})
}

// getSambaUsers returns a list of all Samba users
func getSambaUsers() ([]string, error) {
	cmd := exec.Command(SMB_USER_LIST_CMD, "-L")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("Failed to list Samba users: %v", err)
	}

	var users []string
	scanner := bufio.NewScanner(strings.NewReader(string(output)))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.Contains(line, ":") {
			username := strings.TrimSpace(strings.Split(line, ":")[0])
			if username != "" && !strings.HasPrefix(username, "#") {
				users = append(users, username)
			}
		}
	}

	return users, nil
}

// createSambaUser creates a new Samba user
func createSambaUser(username, password string) error {
	// Add user to system
	sysCmd := exec.Command("useradd", "-M", "-s", "/sbin/nologin", username)
	err := sysCmd.Run()
	if err != nil {
		return fmt.Errorf("Failed to create system user: %v", err)
	}

	// Add to Samba database
	smbCmd := exec.Command(SMB_USER_ADD_CMD, "-a", "-u", username)
	smbCmd.Stdin = strings.NewReader(fmt.Sprintf("%s\n%s\n", password, password))
	err = smbCmd.Run()
	if err != nil {
		return fmt.Errorf("Failed to add Samba user: %v", err)
	}

	// Set password
	passCmd := exec.Command(SMB_PASSWD_CMD, "-a", username)
	passCmd.Stdin = strings.NewReader(fmt.Sprintf("%s\n%s\n", password, password))
	err = passCmd.Run()
	if err != nil {
		return fmt.Errorf("Failed to set Samba password: %v", err)
	}

	return nil
}

// deleteSambaUser deletes a Samba user
func deleteSambaUser(username string) error {
	// Delete from Samba database
	smbCmd := exec.Command(SMB_USER_DEL_CMD, "-x", username)
	err := smbCmd.Run()
	if err != nil {
		return fmt.Errorf("Failed to delete Samba user: %v", err)
	}

	// Remove from system
	sysCmd := exec.Command("userdel", username)
	err = sysCmd.Run()
	if err != nil {
		return fmt.Errorf("Failed to delete system user: %v", err)
	}

	return nil
}

// changeSambaPassword changes a user's password
func changeSambaPassword(username, password string) error {
	cmd := exec.Command(SMB_PASSWD_CMD, username)
	cmd.Stdin = strings.NewReader(fmt.Sprintf("%s\n%s\n", password, password))
	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("Failed to change password: %v", err)
	}

	return nil
}
