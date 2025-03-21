import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import { getShares } from '../services/sharesService';
import { getUsers } from '../services/usersService';
import { useApp } from '../context/AppContext';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import StatCard from '../components/Dashboard/StatCard';
import SharesList from '../components/Dashboard/SharesList';
import UsersList from '../components/Dashboard/UsersList';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { serviceStatus, shares, setShares, users, setUsers } = useApp();
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

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  const sharesCount = Object.keys(shares).length;
  const usersCount = users.users ? users.users.length : 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Service Status"
            value={serviceStatus.status}
            icon="status"
            status={serviceStatus.active}
            actionText="Restart"
            onAction={() => {/* restart service */}}
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
