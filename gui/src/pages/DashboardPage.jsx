import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import { getShares } from '../services/sharesService';
import { getUsers } from '../services/usersService';
import { restartService, getServiceStatus } from '../services/serviceStatus';
import { useApp } from '../context/AppContext';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import StatCard from '../components/Dashboard/StatCard';
import SharesList from '../components/Dashboard/SharesList';
import UsersList from '../components/Dashboard/UsersList';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { serviceStatus, setServiceStatus, shares, setShares, users, setUsers } = useApp();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch shares
        const sharesData = await getShares();
        setShares(sharesData);

        // Fetch users
        const usersData = await getUsers();
        setUsers(usersData);
      } catch (error) {
        showNotification(`Failed to load dashboard data: ${error.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [setShares, setUsers, showNotification]);

  const handleRestartService = async () => {
    try {
      await restartService();
      showNotification('Service restarted successfully', 'success');

      // Update service status after a delay
      setTimeout(async () => {
        try {
          const status = await getServiceStatus();
          setServiceStatus(status);
        } catch (error) {
          console.error('Failed to get service status:', error);
        }
      }, 2000);
    } catch (error) {
      showNotification(`Failed to restart service: ${error.message}`, 'error');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  const sharesCount = Object.keys(shares).length;
  const usersCount = users.users ? users.users.length : 0;

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
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Service Status"
            value={serviceStatus.status}
            icon="status"
            status={serviceStatus.active}
            actionText="Restart"
            onAction={handleRestartService}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Shares"
            value={sharesCount}
            subtext="Total shares"
            icon="shares"
            actionText="Manage"
            onAction={() => navigate('/shares')}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Users"
            value={usersCount}
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
            <SharesList shares={shares} limit={5} />
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
            <UsersList users={users.users || []} limit={5} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;
