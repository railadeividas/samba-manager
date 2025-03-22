import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getGroups } from '../services/groupsService';
import { getUsers } from '../services/usersService';
import { useApp } from '../context/AppContext';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import GroupList from '../components/Groups/GroupList';
import GroupForm from '../components/Groups/GroupForm';

const GroupsPage = () => {
  const location = useLocation();
  const { showNotification } = useNotification();
  const { groups, setGroups, users, setUsers } = useApp();
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [showSystemGroups, setShowSystemGroups] = useState(false);

  // Fetch groups and users
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch groups with system groups toggle
      const groupsData = await getGroups(showSystemGroups);
      setGroups(groupsData);

      // Fetch users for member selection
      const usersData = await getUsers();
      setUsers(usersData);
    } catch (error) {
      showNotification(`Failed to load data: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }, [setGroups, setUsers, showNotification, showSystemGroups]);

  // Initial data load effect
  useEffect(() => {
    if (!initialLoadComplete) {
      fetchData();
    }
  }, [fetchData, initialLoadComplete]);

  // Reload when system groups toggle changes
  useEffect(() => {
    if (initialLoadComplete) {
      fetchData();
    }
  }, [showSystemGroups, fetchData, initialLoadComplete]);

  // Handle navigation state
  useEffect(() => {
    if (!initialLoadComplete) return;

    if (location.state?.action === 'add') {
      handleAddGroup();
    }
  }, [location.state, initialLoadComplete]);

  const handleAddGroup = () => {
    setCurrentGroup(null);
    setFormOpen(true);
  };

  const handleEditGroup = (group) => {
    setCurrentGroup(group);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setCurrentGroup(null);
  };

  const handleFormSubmit = () => {
    fetchData();
    handleFormClose();
  };

  const handleToggleSystemGroups = (event) => {
    setShowSystemGroups(event.target.checked);
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
            onClick={fetchData}
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

      {loading && !initialLoadComplete ? (
        <LoadingSpinner message="Loading groups..." />
      ) : (
        <GroupList
          groups={groups.groups || []}
          allUsers={users.users || []}
          onEdit={handleEditGroup}
          onRefresh={fetchData}
          loading={loading}
        />
      )}

      {formOpen && (
        <GroupForm
          open={formOpen}
          groupData={currentGroup}
          allUsers={users.users || []}
          onSubmit={handleFormSubmit}
          onClose={handleFormClose}
        />
      )}
    </Box>
  );
};

export default GroupsPage;
