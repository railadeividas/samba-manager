import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getShares } from '../services/sharesService';
import { useApp } from '../context/AppContext';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ShareList from '../components/Shares/ShareList';
import ShareForm from '../components/Shares/ShareForm';

const SharesPage = () => {
  const location = useLocation();
  const { showNotification } = useNotification();
  const { shares, setShares } = useApp();
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [currentShare, setCurrentShare] = useState(null);
  const [formMode, setFormMode] = useState('add'); // 'add' or 'edit'
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Properly wrap fetchShares in useCallback to prevent recreating the function on each render
  const fetchShares = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getShares();
      setShares(data);
    } catch (error) {
      showNotification(`Failed to load shares: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }, [setShares, showNotification]);

  // Initial data load effect
  useEffect(() => {
    if (!initialLoadComplete) {
      fetchShares();
    }
  }, [fetchShares, initialLoadComplete]);

  // Handle navigation state (separate from data loading)
  useEffect(() => {
    if (!initialLoadComplete) return; // Skip until initial load is complete

    if (location.state?.action === 'add') {
      handleAddShare();
    } else if (location.state?.action === 'edit' && location.state?.shareName) {
      const shareName = location.state.shareName;
      if (shares[shareName]) {
        handleEditShare(shareName, shares[shareName]);
      }
    }
  }, [location.state, shares, initialLoadComplete]);

  const handleAddShare = () => {
    setCurrentShare(null);
    setFormMode('add');
    setFormOpen(true);
  };

  const handleEditShare = (shareName, shareData) => {
    setCurrentShare({ name: shareName, ...shareData });
    setFormMode('edit');
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setCurrentShare(null);
  };

  const handleFormSubmit = () => {
    fetchShares();
    handleFormClose();
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
          Shares
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={fetchShares}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddShare}
            disabled={loading}
          >
            Add Share
          </Button>
        </Box>
      </Box>

      {loading && !initialLoadComplete ? (
        <LoadingSpinner message="Loading shares..." />
      ) : (
        <ShareList
          shares={shares}
          onEdit={handleEditShare}
          onRefresh={fetchShares}
          loading={loading}
        />
      )}

      {formOpen && (
        <ShareForm
          open={formOpen}
          mode={formMode}
          shareData={currentShare}
          onSubmit={handleFormSubmit}
          onClose={handleFormClose}
        />
      )}
    </Box>
  );
};

export default SharesPage;
