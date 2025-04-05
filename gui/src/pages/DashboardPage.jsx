import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getShares } from '../services/configService';
import { getUsers } from '../services/usersService';
import { GetFileSystemSizes } from '../services/storageService';
import { restartService, getServiceStatus } from '../services/serviceStatus';
import { useApp } from '../context/AppContext';
import { useApi } from '../services/useApi';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ConnectionError from '../components/Common/ConnectionError';
import CompactStatCard from '../components/Dashboard/CompactStatCard';
import FilesystemCard from '../components/Dashboard/FilesystemCard';
import SharesList from '../components/Dashboard/SharesList';
import UsersList from '../components/Dashboard/UsersList';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { serviceStatus, setServiceStatus, setShares, setUsers } = useApp();
  const [restartLoading, setRestartLoading] = useState(false);
  const [restartError, setRestartError] = useState(null);
  const [showSystemFilesystems, setShowSystemFilesystems] = useState(false);
  const statusIntervalRef = useRef(null);

  // Use our custom hook for API data fetching for shares
  const {
    data: sharesData,
    loading: sharesLoading,
    error: sharesError,
    isConnectionError: isSharesConnectionError,
    fetchData: fetchShares
  } = useApi(getShares);

  // Use our custom hook for API data fetching for users
  const {
    data: usersData,
    loading: usersLoading,
    error: usersError,
    isConnectionError: isUsersConnectionError,
    fetchData: fetchUsers
  } = useApi(getUsers);

  // Use our custom hook for API data fetching for service status
  const {
    data: serviceStatusData,
    loading: statusLoading,
    error: statusError,
    isConnectionError: isStatusConnectionError,
    fetchData: fetchStatus,
    forceRetry: forceRetryStatus
  } = useApi(getServiceStatus);

  // Use our custom hook for API data fetching for filesystem information
  const {
    data: filesystemsData,
    loading: filesystemsLoading,
    error: filesystemsError,
    isConnectionError: isFilesystemsConnectionError,
    fetchData: fetchFilesystems
  } = useApi(GetFileSystemSizes);

  // Set up periodic status check when dashboard is mounted
  useEffect(() => {
    // Initial status check
    fetchStatus(true);

    // Set up periodic status check
    statusIntervalRef.current = setInterval(() => {
      fetchStatus(true);
    }, 30000); // Check every 30 seconds

    // Clean up interval on unmount
    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [fetchStatus]);

  // Combine loading and error states
  const loading = sharesLoading || usersLoading || statusLoading || filesystemsLoading;
  const error = sharesError || usersError || statusError || filesystemsError || restartError;
  const isConnectionError = isSharesConnectionError || isUsersConnectionError ||
                           isStatusConnectionError || isFilesystemsConnectionError;

  // Update the app context when data changes
  useEffect(() => {
    if (sharesData) {
      setShares(sharesData);
    }
  }, [sharesData, setShares]);

  useEffect(() => {
    if (usersData) {
      setUsers(usersData);
    }
  }, [usersData, setUsers]);

  useEffect(() => {
    if (serviceStatusData) {
      setServiceStatus(serviceStatusData);
    }
  }, [serviceStatusData, setServiceStatus]);

  const handleRestartService = async () => {
    setRestartLoading(true);
    setRestartError(null);

    try {
      await restartService();
      showNotification('Service restarted successfully', 'success');

      // Update service status after a delay
      setTimeout(() => {
        fetchStatus(true);
        setRestartLoading(false);
      }, 2000);
    } catch (error) {
      setRestartLoading(false);
      if (error.isConnectionError) {
        setRestartError(error.message || 'Unable to connect to server');
      } else {
        showNotification(`Failed to restart service: ${error.message}`, 'error');
        setRestartError(error.message || 'Failed to restart service');
      }
    }
  };

  const handleRefresh = () => {
    fetchShares(true);
    fetchUsers(true);
    fetchStatus(true);
    fetchFilesystems(true);
  };

  const handleToggleSystemFilesystems = (event) => {
    setShowSystemFilesystems(event.target.checked);
  };

  // If there's a connection error, show the ConnectionError component
  if (isConnectionError) {
    return <ConnectionError error={error} onRetry={forceRetryStatus} />;
  }

  // Create uptime info object from the service status
  const getUptimeInfo = () => {
    const status = serviceStatusData || serviceStatus;
    if (status.active && status.metadata?.uptime) {
      const uptimeData = status.metadata.uptime;
      if (uptimeData.uptime && uptimeData.uptime !== 'N/A') {
        return {
          uptime: uptimeData.uptime,
          since: uptimeData.since
        };
      }
    }
    return null;
  };

  // Get filesystems (root and large filesystems)
  const getFilesystems = () => {
    if (!filesystemsData || !filesystemsData.disks) {
      return [];
    }

    let filteredFilesystems = filesystemsData.disks
      .filter(filesystem => filesystem.mountedOn === '/' || parseFloat(filesystem.size) > 1); // Root or larger than 1GB

    // Filter out system filesystems if not showing them
    if (!showSystemFilesystems) {
      filteredFilesystems = filteredFilesystems.filter(filesystem => !filesystem.isVirtualFS);
    }

    return filteredFilesystems;
  };

  return (
    <Box>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        mb: 2,
        pb: 1,
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)'
      }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'linear-gradient(45deg, #90caf9 10%, #64b5f6 90%)'
                : 'linear-gradient(45deg, #2196f3 30%, #1976d2 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mr: 2
          }}
        >
          Dashboard
        </Typography>
        <Typography
          variant="subtitle1"
          color="text.secondary"
          sx={{ flexGrow: 1 }}
        >
          System Overview
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={loading || restartLoading}
          sx={{ ml: 1 }}
        >
          Refresh
        </Button>
      </Box>

      {error && !isConnectionError && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={handleRefresh}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loading && (!sharesData || Object.keys(sharesData).length === 0) ? (
        <LoadingSpinner message="Loading dashboard..." />
      ) : (
        <>
          {/* Stats Row - More compact layout */}
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item sm={12} md={6} lg={4}>
                <CompactStatCard
                  title="Service Status"
                  value={serviceStatusData?.status || serviceStatus.status}
                  icon="status"
                  status={serviceStatusData?.active || serviceStatus.active}
                  actionText={restartLoading ? "Restarting..." : "Restart"}
                  onAction={handleRestartService}
                  actionDisabled={restartLoading}
                  additionalInfo={getUptimeInfo()}
                />
              </Grid>
              <Grid item sm={12} md={6} lg={4}>
                <CompactStatCard
                  title="Users"
                  value={usersData?.users ? usersData.users.length : 0}
                  icon="users"
                  actionText="Manage Users"
                  onAction={() => navigate('/users')}
                />
              </Grid>
              <Grid item sm={12} md={6} lg={4}>
                <CompactStatCard
                  title="Shares"
                  value={sharesData ? Object.keys(sharesData).length : 0}
                  icon="shares"
                  actionText="Manage Shares"
                  onAction={() => navigate('/shares')}
                />
              </Grid>
            </Grid>
          </Box>

          {/* Filesystem Usage Section */}
          {filesystemsData && filesystemsData.disks && filesystemsData.disks.length > 0 && (
            <>
              <Box sx={{ mb: 2, mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Storage Usage</Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={showSystemFilesystems}
                      onChange={handleToggleSystemFilesystems}
                      color="primary"
                      size="small"
                    />
                  }
                  label="Show all"
                />
              </Box>
              <Divider sx={{ mt: 1, mb: 2 }} />

              {getFilesystems().length > 0 && (
                <>
                  <Grid container spacing={3} sx={{ mb: 4 }}>
                    {getFilesystems().map((filesystem, index) => (
                      <Grid item xs={12} md={6} lg={4} key={`filesystem-${index}`}>
                        <FilesystemCard filesystemInfo={filesystem} />
                      </Grid>
                    ))}
                  </Grid>
                </>
              )}
            </>
          )}

          {/* Shares and Users Lists */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper
                elevation={1}
                sx={{
                  p: 0,
                  height: '100%',
                  borderRadius: 2,
                  overflow: 'hidden'
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
                  }}
                >
                  <Typography variant="h6">Recent Shares</Typography>
                  <Button
                    size="small"
                    color="primary"
                    onClick={() => navigate('/shares', { state: { action: 'add' } })}
                  >
                    Add Share
                  </Button>
                </Box>
                <SharesList shares={sharesData || {}} limit={5} />
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper
                elevation={1}
                sx={{
                  p: 0,
                  height: '100%',
                  borderRadius: 2,
                  overflow: 'hidden'
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
                  }}
                >
                  <Typography variant="h6">Users</Typography>
                  <Button
                    size="small"
                    color="primary"
                    onClick={() => navigate('/users', { state: { action: 'add' } })}
                  >
                    Add User
                  </Button>
                </Box>
                <UsersList users={usersData?.users || []} limit={5} />
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default DashboardPage;
