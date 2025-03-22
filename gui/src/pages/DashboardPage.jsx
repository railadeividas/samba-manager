import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getShares } from '../services/sharesService';
import { getUsers } from '../services/usersService';
import { restartService, getServiceStatus } from '../services/serviceStatus';
import { useApp } from '../context/AppContext';
import { useApi } from '../services/useApi';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ConnectionError from '../components/Common/ConnectionError';
import StatCard from '../components/Dashboard/StatCard';
import SharesList from '../components/Dashboard/SharesList';
import UsersList from '../components/Dashboard/UsersList';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { serviceStatus, setServiceStatus, setShares, setUsers } = useApp();
  const [restartLoading, setRestartLoading] = useState(false);
  const [restartError, setRestartError] = useState(null);

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

  // Combine loading and error states
  const loading = sharesLoading || usersLoading || statusLoading;
  const error = sharesError || usersError || statusError || restartError;
  const isConnectionError = isSharesConnectionError || isUsersConnectionError || isStatusConnectionError;

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
  };

  // If there's a connection error, show the ConnectionError component
  if (isConnectionError) {
    return <ConnectionError error={error} onRetry={forceRetryStatus} />;
  }

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
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <StatCard
                title="Service Status"
                value={serviceStatusData?.status || serviceStatus.status}
                icon="status"
                status={serviceStatusData?.active || serviceStatus.active}
                actionText={restartLoading ? "Restarting..." : "Restart"}
                onAction={handleRestartService}
                actionDisabled={restartLoading}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <StatCard
                title="Shares"
                value={sharesData ? Object.keys(sharesData).length : 0}
                subtext="Total shares"
                icon="shares"
                actionText="Manage"
                onAction={() => navigate('/shares')}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <StatCard
                title="Users"
                value={usersData?.users ? usersData.users.length : 0}
                subtext="Total users"
                icon="users"
                actionText="Manage"
                onAction={() => navigate('/users')}
              />
            </Grid>
          </Grid>

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
