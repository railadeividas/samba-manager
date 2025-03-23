import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import ConfirmDialog from '../components/Common/ConfirmDialog';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ConnectionError from '../components/Common/ConnectionError';
import { getRawConfig, saveRawConfig } from '../services/configService';
import { useApi } from '../services/useApi';
import { useNotification } from '../context/NotificationContext';

const AdvancedConfigurationPage = () => {
  const { showNotification } = useNotification();
  const [configContent, setConfigContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Use our custom hook for API data fetching
  const {
    data: rawConfigData,
    loading,
    error,
    isConnectionError,
    fetchData: fetchRawConfig,
    forceRetry
  } = useApi(getRawConfig);

  // Update content when data changes
  useEffect(() => {
    if (rawConfigData && rawConfigData.content !== undefined) {
      setConfigContent(rawConfigData.content);
      setOriginalContent(rawConfigData.content);
      setHasChanges(false);
    }
  }, [rawConfigData]);

  const handleContentChange = (e) => {
    setConfigContent(e.target.value);
    setHasChanges(e.target.value !== originalContent);
  };

  const handleRefresh = () => {
    fetchRawConfig(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      await saveRawConfig(configContent);
      showNotification('Configuration saved successfully', 'success');
      setOriginalContent(configContent);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save configuration:', error);

      if (error.isConnectionError) {
        showNotification('Connection failed. Unable to save configuration.', 'error');
      } else {
        showNotification(`Failed to save configuration: ${error.message || 'Something went wrong'}`, 'error');
      }

      setSaveError(error.message || 'Failed to save configuration');
    } finally {
      // Delay resetting the saving state to ensure UI feedback
      setTimeout(() => {
        setSaving(false);
        setConfirmOpen(false);
      }, 500);
    }
  };

  // If there's a connection error, show the ConnectionError component
  if (isConnectionError) {
    return <ConnectionError error={error} onRetry={forceRetry} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
          Advanced Configuration
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading || saving}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={() => setConfirmOpen(true)}
            disabled={loading || saving || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>

      {(error || saveError) && !isConnectionError && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={error ? forceRetry : () => setSaveError(null)}>
              {error ? 'Retry' : 'Dismiss'}
            </Button>
          }
        >
          {error || saveError}
        </Alert>
      )}

      <Paper
        elevation={1}
        sx={{
          p: 2,
          mb: 3,
          bgcolor: 'warning.50',
          border: '1px solid',
          borderColor: 'warning.light'
        }}
      >
        <Typography variant="subtitle1" color="warning.main" gutterBottom>
          Warning: Advanced Configuration
        </Typography>
        <Typography variant="body2">
          Editing the raw Samba configuration file directly can cause issues if not done correctly.
          It's recommended to use the Settings and Homes interfaces for most configuration tasks.
          Changes made here will restart the Samba service.
        </Typography>
      </Paper>

      {loading && !configContent ? (
        <LoadingSpinner message="Loading configuration..." />
      ) : (
        <Paper
          elevation={1}
          sx={{
            p: 2,
            borderRadius: 2,
            flex: 1,
            minHeight: '500px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            /etc/samba/smb.conf
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <textarea
              value={configContent}
              onChange={handleContentChange}
              style={{
                flex: '1',
                minHeight: '400px',
                padding: '12px',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                resize: 'vertical',
                overflow: 'auto'
              }}
              disabled={loading || saving}
            />
          </Box>
        </Paper>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Save Configuration"
        message="Are you sure you want to save changes to the Samba configuration? This will restart the Samba service and could affect active connections."
        confirmText={saving ? "Saving..." : "Save & Restart"}
        confirmColor="warning"
        onConfirm={handleSave}
        onCancel={() => !saving && setConfirmOpen(false)}
        disableConfirm={saving}
        disableCancel={saving}
      />
    </Box>
  );
};

export default AdvancedConfigurationPage;
