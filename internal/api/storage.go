package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

// DiskInfo represents information about a filesystem
type DiskInfo struct {
	Filesystem  string  `json:"filesystem"`
	Mount       string  `json:"mount"`
	Size        string  `json:"size"`
	Used        string  `json:"used"`
	Available   string  `json:"available"`
	UsePercent  float64 `json:"usePercent"`
	MountedOn   string  `json:"mountedOn"`
	DisplayName string  `json:"displayName"`  // Short version of the mount path
	IsVirtualFS bool    `json:"isVirtualFS,omitempty"`
}

// ShareSizeInfo represents size information for a Samba share
type ShareSizeInfo struct {
	Name       string  `json:"name"`
	Path       string  `json:"path"`
	Size       string  `json:"size"`
	Used       string  `json:"used"`
	Available  string  `json:"available"`
	UsePercent float64 `json:"usePercent"`
}

// DisksResponse represents the response for filesystem info
type DisksResponse struct {
	Disks []DiskInfo `json:"disks"`
	Error string     `json:"error,omitempty"`
}

// ShareSizesResponse represents the response for share sizes
type ShareSizesResponse struct {
	Shares []ShareSizeInfo `json:"shares"`
	Error  string          `json:"error,omitempty"`
}

// Cache for filesystem information with a mutex for safe concurrent access
var (
	disksCache        DisksResponse
	disksCacheMux     sync.RWMutex
	disksCacheTime    time.Time

	shareSizesCache      ShareSizesResponse
	shareSizesCacheMux   sync.RWMutex
	shareSizesCacheTime  time.Time

	cacheDuration     = time.Minute // Cache duration set to 1 minute
)

// Virtual filesystem types
var virtualFilesystemTypes = map[string]bool{
	"none":    true,
	"udev":    true,
	"tmpfs":   true,
	"overlay": true,
}

// GetFileSystemSizes returns information about system filesystems
func (h *APIHandler) GetFileSystemSizes(w http.ResponseWriter, r *http.Request) {
	info, err := GetFileSystemSizes()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(info)
}

// GetShareSizes returns size information for Samba shares
func (h *APIHandler) GetShareSizes(w http.ResponseWriter, r *http.Request) {
	info, err := getShareSizes()
	if err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(info)
}

// GetFileSystemSizes returns information about system filesystems using df command with caching
func GetFileSystemSizes() (DisksResponse, error) {
	disksCacheMux.RLock()
	// If cache is still valid, return cached data
	if !disksCacheTime.IsZero() && time.Since(disksCacheTime) < cacheDuration {
		defer disksCacheMux.RUnlock()
		return disksCache, nil
	}
	disksCacheMux.RUnlock()

	// Acquire write lock to update cache
	disksCacheMux.Lock()
	defer disksCacheMux.Unlock()

	// Double-check if cache was updated while waiting for the lock
	if !disksCacheTime.IsZero() && time.Since(disksCacheTime) < cacheDuration {
		return disksCache, nil
	}

	// Get list of shares to mark mounts that are used for Samba shares
	shares, err := ReadConfig()
	if err != nil {
		return DisksResponse{}, err
	}

	// Set of paths used by Samba shares
	sambaPaths := make(map[string]bool)
	for _, share := range shares {
		if path, ok := share["path"]; ok {
			sambaPaths[path] = true
		}
	}

	// Execute df command to get filesystem usage
	cmd := exec.Command("df", "-h")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return DisksResponse{}, err
	}

	// Parse output
	lines := strings.Split(string(output), "\n")
	var disks []DiskInfo

	// Skip header line
	for i := 1; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])
		if line == "" {
			continue
		}

		// Split by whitespace with special handling for filesystems with spaces
		fields := strings.Fields(line)
		if len(fields) < 6 {
			continue
		}

		// Extract percentage and convert to float
		usePercentStr := strings.TrimSuffix(fields[4], "%")
		usePercent, _ := strconv.ParseFloat(usePercentStr, 64)

		// Get mount path and create a display name (shortened if too long)
		mountPath := fields[5]
		displayName := createDisplayName(mountPath)

		// Get filesystem type and check if it's a virtual filesystem
		fsType := fields[0]
		isVirtualFS := virtualFilesystemTypes[fsType]

		// Create filesystem info
		filesystem := DiskInfo{
			Filesystem:  fsType,
			Size:        fields[1],
			Used:        fields[2],
			Available:   fields[3],
			UsePercent:  usePercent,
			MountedOn:   mountPath,
			DisplayName: displayName,
			IsVirtualFS: isVirtualFS,
		}

		disks = append(disks, filesystem)
	}

	// Update cache
	disksCache = DisksResponse{
		Disks: disks,
	}
	disksCacheTime = time.Now()

	return disksCache, nil
}

// getShareSizes returns size information for Samba shares with caching
func getShareSizes() (ShareSizesResponse, error) {
	shareSizesCacheMux.RLock()
	// If cache is still valid, return cached data
	if !shareSizesCacheTime.IsZero() && time.Since(shareSizesCacheTime) < cacheDuration {
		defer shareSizesCacheMux.RUnlock()
		return shareSizesCache, nil
	}
	shareSizesCacheMux.RUnlock()

	// Acquire write lock to update cache
	shareSizesCacheMux.Lock()
	defer shareSizesCacheMux.Unlock()

	// Double-check if cache was updated while waiting for the lock
	if !shareSizesCacheTime.IsZero() && time.Since(shareSizesCacheTime) < cacheDuration {
		return shareSizesCache, nil
	}

	// Get filesystem information first to get mount points and sizes
	filesystemsInfo, err := GetFileSystemSizes()
	if err != nil {
		return ShareSizesResponse{}, err
	}

	// Get list of shares
	shares, err := ReadConfig()
	if err != nil {
		return ShareSizesResponse{}, err
	}

	// Create a map of mount points to filesystem info for quick lookup
	mountMap := make(map[string]DiskInfo)
	for _, filesystem := range filesystemsInfo.Disks {
		mountMap[filesystem.MountedOn] = filesystem
	}

	// Calculate share sizes
	var shareSizes []ShareSizeInfo

	for name, share := range shares {
		path, ok := share["path"]
		if !ok {
			continue // Skip shares without a path
		}

		// Find the best matching mount for this share path
		var bestMount string
		for mountPath := range mountMap {
			if strings.HasPrefix(path, mountPath) {
				if bestMount == "" || len(mountPath) > len(bestMount) {
					bestMount = mountPath
				}
			}
		}

		if bestMount == "" {
			// Couldn't find a matching mount, skip
			continue
		}

		// Get filesystem info for the mount
		filesystemInfo := mountMap[bestMount]

		// Get directory size using du command
		cmd := exec.Command("du", "-sh", path)
		output, err := cmd.CombinedOutput()
		if err != nil {
			// Skip if we can't get the directory size
			continue
		}

		// Parse the output
		parts := strings.Fields(string(output))
		if len(parts) < 2 {
			continue
		}

		dirSize := parts[0]

		// Parse directory size to calculate usage percentage
		sizeStr := filesystemInfo.Size
		usedStr := dirSize

		// Normalize size units for calculation
		sizeBytes, _ := convertSizeToBytes(sizeStr)
		usedBytes, _ := convertSizeToBytes(usedStr)

		var usePercent float64
		if sizeBytes > 0 {
			usePercent = float64(usedBytes) / float64(sizeBytes) * 100
		}

		// Create share size info
		shareSizeInfo := ShareSizeInfo{
			Name:       name,
			Path:       path,
			Size:       sizeStr,                   // Total size of the mounted filesystem
			Used:       usedStr,                   // Used space by the share directory
			Available:  filesystemInfo.Available,  // Available space on the filesystem
			UsePercent: usePercent,               // Share directory usage as percentage of filesystem
		}

		shareSizes = append(shareSizes, shareSizeInfo)
	}

	// Update cache
	shareSizesCache = ShareSizesResponse{
		Shares: shareSizes,
	}
	shareSizesCacheTime = time.Now()

	return shareSizesCache, nil
}

// createDisplayName creates a shortened display name for long mount paths
func createDisplayName(mountPath string) string {
	// If the path is short enough, use it as is
	if len(mountPath) <= 20 {
		return mountPath
	}

	// For long paths, use a combination of the beginning and end
	parts := strings.Split(mountPath, "/")
	if len(parts) <= 3 {
		return mountPath // Not a long hierarchical path
	}

	// Create a shorter name: /first/…/last
	return "/" + parts[1] + "/…/" + parts[len(parts)-1]
}

// convertSizeToBytes converts human-readable size to bytes
func convertSizeToBytes(size string) (uint64, error) {
	size = strings.TrimSpace(size)
	if size == "" {
		return 0, fmt.Errorf("Empty size string")
	}

	// Handle units - find the numeric part and the unit
	var numPart string
	var unit string
	for i, c := range size {
		if (c < '0' || c > '9') && c != '.' {
			numPart = size[:i]
			unit = strings.ToUpper(size[i:])
			break
		}
		if i == len(size)-1 {
			numPart = size
			unit = "B"
		}
	}

	// Parse the numeric part
	num, err := strconv.ParseFloat(numPart, 64)
	if err != nil {
		return 0, err
	}

	// Convert based on unit
	unit = strings.TrimSpace(unit)
	var multiplier uint64 = 1
	switch unit {
	case "K", "KB":
		multiplier = 1024
	case "M", "MB":
		multiplier = 1024 * 1024
	case "G", "GB":
		multiplier = 1024 * 1024 * 1024
	case "T", "TB":
		multiplier = 1024 * 1024 * 1024 * 1024
	}

	return uint64(num * float64(multiplier)), nil
}
