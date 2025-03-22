import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getShares } from '../services/sharesService';
import { useApp } from '../context/AppContext';
import { useApi } from '../services/useApi';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ConnectionError from '../components/Common/ConnectionError';
import ShareList from '../components/Shares/ShareList';
import ShareForm from '../components/Shares/ShareForm';

const SharesPage = () => {
  const location = useLocation();
  const { setShares } = useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [currentShare, setCurrentShare] = useState(null);
  const [formMode, setFormMode] = useState('add'); // 'add' or 'edit'

  // Use our custom hook for API data fetching
  const {
    data: sharesData,
    loading,
    error,
    isConnectionError,
    fetchData: fetchShares,
    forceRetry
  } = useApi(getShares);

  // Update the app context when data changes
  useEffect(() => {
    if (sharesData) {
      setShares(sharesData);
    }
  }, [sharesData, setShares]);

  // Handle navigation state (separate from data loading)
  useEffect(() => {
    if (location.state?.action === 'add') {
      handleAddShare();
    } else if (location.state?.action === 'edit' && location.state?.shareName && sharesData) {
      const shareName = location.state.shareName;
      if (sharesData[shareName]) {
        handleEditShare(shareName, sharesData[shareName]);
      }
    }
  }, [location.state, sharesData]);

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
    // Force a refresh after form submission
    fetchShares(true);
    handleFormClose();
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
          Shares
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={() => fetchShares(true)}
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

      {loading && (!sharesData || Object.keys(sharesData).length === 0) ? (
        <LoadingSpinner message="Loading shares..." />
      ) : (
        <ShareList
          shares={sharesData || {}}
          onEdit={handleEditShare}
          onRefresh={() => fetchShares(true)}
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
