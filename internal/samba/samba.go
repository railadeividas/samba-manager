package api

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
)

const (
	SAMBA_CONF_PATH   = "/etc/samba/smb.conf"
	SMB_PASSWD_CMD    = "smbpasswd"
	SMB_USER_ADD_CMD  = "pdbedit"
	SMB_USER_DEL_CMD  = "pdbedit"
	SMB_USER_LIST_CMD = "pdbedit"
)

// readSambaConfig reads and parses the Samba configuration file
func readSambaConfig() (SharesConfig, error) {
	shares := make(SharesConfig)

	// Check if file exists
	if _, err := os.Stat(SAMBA_CONF_PATH); os.IsNotExist(err) {
		return nil, fmt.Errorf("Samba config file not found at %s", SAMBA_CONF_PATH)
	}

	// Read the file
	file, err := os.Open(SAMBA_CONF_PATH)
	if err != nil {
		return nil, fmt.Errorf("Failed to open Samba config: %v", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	var currentShare string

	// Regular expressions
	shareRegex := regexp.MustCompile(`^\[([^\]]+)\]$`)
	paramRegex := regexp.MustCompile(`^([^=]+)=(.*)$`)

	// Parse line by line
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip comments and empty lines
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}

		// Check if it's a share definition
		if match := shareRegex.FindStringSubmatch(line); match != nil {
			currentShare = match[1]
			if currentShare != "global" && currentShare != "printers" && currentShare != "print$" {
				shares[currentShare] = make(Share)
			}
			continue
		}

		// If we're in a share section, parse parameters
		if currentShare != "" && currentShare != "global" && currentShare != "printers" && currentShare != "print$" {
			if match := paramRegex.FindStringSubmatch(line); match != nil {
				paramName := strings.TrimSpace(match[1])
				paramValue := strings.TrimSpace(match[2])
				shares[currentShare][paramName] = paramValue
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("Error reading Samba config: %v", err)
	}

	return shares, nil
}

// writeSambaConfig writes the shares configuration to the Samba config file
func writeSambaConfig(shares SharesConfig) error {
	// Read current config to preserve global settings
	file, err := os.Open(SAMBA_CONF_PATH)
	if err != nil {
		return fmt.Errorf("Failed to open Samba config: %v", err)
	}

	var newConfig []string
	scanner := bufio.NewScanner(file)
	inCustomShare := false
	shareRegex := regexp.MustCompile(`^\[([^\]]+)\]$`)

	// Preserve global and default sections
	for scanner.Scan() {
		line := scanner.Text()
		if match := shareRegex.FindStringSubmatch(strings.TrimSpace(line)); match != nil {
			shareName := match[1]
			if shareName != "global" && shareName != "printers" && shareName != "print$" {
				inCustomShare = true
			} else {
				inCustomShare = false
				newConfig = append(newConfig, line)
			}
		} else if !inCustomShare {
			newConfig = append(newConfig, line)
		}
	}
	file.Close()

	// Add custom shares
	for shareName, params := range shares {
		newConfig = append(newConfig, fmt.Sprintf("\n[%s]", shareName))
		for paramName, paramValue := range params {
			newConfig = append(newConfig, fmt.Sprintf("    %s = %s", paramName, paramValue))
		}
	}

	// Write the new config
	err = os.WriteFile(SAMBA_CONF_PATH, []byte(strings.Join(newConfig, "\n")+"\n"), 0644)
	if err != nil {
		return fmt.Errorf("Failed to write Samba config: %v", err)
	}

	// Restart Samba service
	cmd := exec.Command("systemctl", "restart", "smbd")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("Failed to restart Samba service: %v", err)
	}

	return nil
}

// createShareDirectory creates the directory for a share if it doesn't exist
func createShareDirectory(shareData Share) error {
	path, exists := shareData["path"]
	if !exists {
		return nil // No path defined, nothing to create
	}

	err := os.MkdirAll(path, 0755)
	if err != nil {
		return fmt.Errorf("Failed to create directory: %v", err)
	}

	return nil
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

// getSambaServiceStatus returns the Samba service status
func getSambaServiceStatus() (ServiceStatusResponse, error) {
	cmd := exec.Command("systemctl", "is-active", "smbd")
	output, _ := cmd.CombinedOutput()
	isActive := strings.TrimSpace(string(output)) == "active"

	return ServiceStatusResponse{
		Service: "smbd",
		Active:  isActive,
		Status:  map[bool]string{true: "running", false: "stopped"}[isActive],
	}, nil
}
