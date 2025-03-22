import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getUsers } from '../services/usersService';
import { useApp } from '../context/AppContext';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import UserList from '../components/Users/UserList';
import UserForm from '../components/Users/UserForm';
import PasswordForm from '../components/Users/PasswordForm';

const UsersPage = () => {
  const location = useLocation();
  const { showNotification } = useNotification();
  const { users, setUsers } = useApp();
  const [loading, setLoading] = useState(true);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Properly wrap fetchUsers in useCallback to prevent recreating the function on each render
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      showNotification(`Failed to load users: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }, [setUsers, showNotification]);

  // Initial data load effect
  useEffect(() => {
    if (!initialLoadComplete) {
      fetchUsers();
    }
  }, [fetchUsers, initialLoadComplete]);

  // Handle navigation state (separate from data loading)
  useEffect(() => {
    if (!initialLoadComplete) return; // Skip until initial load is complete

    if (location.state?.action === 'add') {
      handleAddUser();
    } else if (location.state?.action === 'edit' && location.state?.username) {
      const username = location.state.username;
      handleChangePassword(username);
    }
  }, [location.state, initialLoadComplete]);

  const handleAddUser = () => {
    setCurrentUser(null);
    setUserFormOpen(true);
  };

  const handleChangePassword = (username) => {
    setCurrentUser(username);
    setPasswordFormOpen(true);
  };

  const handleUserFormClose = () => {
    setUserFormOpen(false);
    setCurrentUser(null);
  };

  const handlePasswordFormClose = () => {
    setPasswordFormOpen(false);
    setCurrentUser(null);
  };

  const handleFormSubmit = () => {
    fetchUsers();
    handleUserFormClose();
    handlePasswordFormClose();
  };

  return (
    <Box>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
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
          Users
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={fetchUsers}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddUser}
            disabled={loading}
          >
            Add User
          </Button>
        </Box>
      </Box>

      {loading && !initialLoadComplete ? (
        <LoadingSpinner message="Loading users..." />
      ) : (
        <UserList
          users={users.users || []}
          onChangePassword={handleChangePassword}
          onRefresh={fetchUsers}
          loading={loading}
        />
      )}

      {userFormOpen && (
        <UserForm
          open={userFormOpen}
          onSubmit={handleFormSubmit}
          onClose={handleUserFormClose}
        />
      )}

      {passwordFormOpen && (
        <PasswordForm
          open={passwordFormOpen}
          username={currentUser}
          onSubmit={handleFormSubmit}
          onClose={handlePasswordFormClose}
        />
      )}
    </Box>
  );
};

export default UsersPage;
