import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getGroups } from '../services/groupsService';
import { getUsers } from '../services/usersService';
import { useApp } from '../context/AppContext';
import { useApi } from '../services/useApi';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ConnectionError from '../components/Common/ConnectionError';
import GroupList from '../components/Groups/GroupList';
import GroupForm from '../components/Groups/GroupForm';

const GroupsPage = () => {
  const location = useLocation();
  const { setGroups, setUsers } = useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [showSystemGroups, setShowSystemGroups] = useState(false);

  // Refs to track if this is a toggle-initiated reload
  const toggleInitiatedRef = useRef(false);
  const mountedRef = useRef(false);

  // Create a stable function to fetch groups
  const fetchGroupsFunction = useCallback(() => {
    return getGroups(showSystemGroups);
  }, [showSystemGroups]);

  // Use our custom hook for API data fetching for groups
  const {
    data: groupsData,
    loading: groupsLoading,
    error: groupsError,
    isConnectionError: isGroupsConnectionError,
    fetchData: fetchGroups,
    forceRetry: forceRetryGroups
  } = useApi(fetchGroupsFunction, [], [], true);

  // Use our custom hook for API data fetching for users
  const {
    data: usersData,
    loading: usersLoading,
    error: usersError,
    isConnectionError: isUsersConnectionError,
    fetchData: fetchUsers
  } = useApi(getUsers);

  // Combine loading and error states
  const loading = groupsLoading || usersLoading;
  const error = groupsError || usersError;
  const isConnectionError = isGroupsConnectionError || isUsersConnectionError;

  // Update the app context when data changes
  useEffect(() => {
    if (groupsData) {
      setGroups(groupsData);
    }
  }, [groupsData, setGroups]);

  useEffect(() => {
    if (usersData) {
      setUsers(usersData);
    }
  }, [usersData, setUsers]);

  // Mark component as mounted
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Handle the system groups toggle change
  const handleToggleSystemGroups = useCallback((event) => {
    setShowSystemGroups(event.target.checked);
    // Set the flag to indicate this change should trigger a reload
    toggleInitiatedRef.current = true;
  }, []);

  // Effect to reload when system groups toggle changes
  useEffect(() => {
    // Only reload if the toggle was initiated by user and component is mounted
    if (toggleInitiatedRef.current && mountedRef.current) {
      fetchGroups(true);
      toggleInitiatedRef.current = false;
    }
  }, [showSystemGroups, fetchGroups]);

  // Handle navigation state
  useEffect(() => {
    if (location.state?.action === 'add') {
      handleAddGroup();
    }
  }, [location.state]);

  const handleAddGroup = useCallback(() => {
    setCurrentGroup(null);
    setFormOpen(true);
  }, []);

  const handleEditGroup = useCallback((group) => {
    setCurrentGroup(group);
    setFormOpen(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setFormOpen(false);
    setCurrentGroup(null);
  }, []);

  const handleFormSubmit = useCallback(() => {
    fetchGroups(true);
    handleFormClose();
  }, [fetchGroups, handleFormClose]);

  const handleRefresh = useCallback(() => {
    fetchGroups(true);
    fetchUsers(true);
  }, [fetchGroups, fetchUsers]);

  const forceRetry = useCallback(() => {
    forceRetryGroups();
    fetchUsers(true);
  }, [forceRetryGroups, fetchUsers]);

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
          Groups
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={showSystemGroups}
                onChange={handleToggleSystemGroups}
                size="small"
              />
            }
            label="Show System Groups"
          />
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
            onClick={handleAddGroup}
            disabled={loading}
          >
            Add Group
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

      {loading && (!groupsData || !groupsData.groups || groupsData.groups.length === 0) ? (
        <LoadingSpinner message="Loading groups..." />
      ) : (
        <GroupList
          groups={groupsData?.groups || []}
          allUsers={usersData?.users || []}
          onEdit={handleEditGroup}
          onRefresh={handleRefresh}
          loading={loading}
        />
      )}

      {formOpen && (
        <GroupForm
          open={formOpen}
          groupData={currentGroup}
          allUsers={usersData?.users || []}
          onSubmit={handleFormSubmit}
          onClose={handleFormClose}
        />
      )}
    </Box>
  );
};

export default GroupsPage;
