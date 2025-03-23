import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getUsers } from '../services/usersService';
import { useApp } from '../context/AppContext';
import { useApi } from '../services/useApi';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ConnectionError from '../components/Common/ConnectionError';
import UserList from '../components/Users/UserList';
import UserForm from '../components/Users/UserForm';
import PasswordForm from '../components/Users/PasswordForm'; // Import PasswordForm

const UsersPage = () => {
  const location = useLocation();
  const { setUsers } = useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [passwordFormOpen, setPasswordFormOpen] = useState(false); // Add state for password form
  const [selectedUser, setSelectedUser] = useState(null); // Add state for selected user

  // Use our custom hook for API data fetching
  const {
    data: usersData,
    loading,
    error,
    isConnectionError,
    fetchData: fetchUsers,
    forceRetry
  } = useApi(getUsers);

  // Update the app context when data changes
  useEffect(() => {
    if (usersData) {
      setUsers(usersData);
    }
  }, [usersData, setUsers]);

  // Handle navigation state
  useEffect(() => {
    if (location.state?.action === 'add') {
      handleAddUser();
    }
  }, [location.state]);

  const handleAddUser = () => {
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
  };

  const handleFormSubmit = () => {
    fetchUsers(true);
    handleFormClose();
  };

  const handleRefresh = () => {
    fetchUsers(true);
  };

  // Add handler for password change
  const handleChangePassword = (username) => {
    setSelectedUser(username);
    setPasswordFormOpen(true);
  };

  // Add handler for password form close
  const handlePasswordFormClose = () => {
    setPasswordFormOpen(false);
    setSelectedUser(null);
  };

  // Add handler for password form submit
  const handlePasswordFormSubmit = () => {
    fetchUsers(true);
    handlePasswordFormClose();
  };

  // If there's a connection error, show the ConnectionError component
  if (isConnectionError) {
    return <ConnectionError error={error} onRetry={forceRetry} />;
  }

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
            onClick={handleRefresh}
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

      {error && !isConnectionError && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={forceRetry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loading && (!usersData || !usersData.users || usersData.users.length === 0) ? (
        <LoadingSpinner message="Loading users..." />
      ) : (
        <UserList
          users={usersData?.users || []}
          onRefresh={handleRefresh}
          loading={loading}
          onChangePassword={handleChangePassword} // Pass the handler to UserList
        />
      )}

      {formOpen && (
        <UserForm
          open={formOpen}
          onSubmit={handleFormSubmit}
          onClose={handleFormClose}
        />
      )}

      {passwordFormOpen && selectedUser && (
        <PasswordForm
          open={passwordFormOpen}
          username={selectedUser}
          onSubmit={handlePasswordFormSubmit}
          onClose={handlePasswordFormClose}
        />
      )}
    </Box>
  );
};

export default UsersPage;
