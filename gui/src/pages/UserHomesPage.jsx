import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControlLabel,
  Switch,
  Paper,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Tooltip,
  TextField,
  CircularProgress,
  Alert,
  Divider,
  IconButton
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import ConfirmDialog from '../components/Common/ConfirmDialog';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ConnectionError from '../components/Common/ConnectionError';
import ParamAutocomplete from '../components/Config/ParamAutocomplete';
import { getSection, updateSection, deleteSection } from '../services/configService';
import { getUsers } from '../services/usersService';
import { useApi } from '../services/useApi';
import { useNotification } from '../context/NotificationContext';
import { getParameterDescriptionText, getParameterDescription } from '../utils/sambaParameters';

// Template configurations for quick setup
const homeTemplates = {
  basic: {
    'comment': 'User home directories',
    'browseable': 'yes',
    'read only': 'no',
    'create mask': '0700',
    'directory mask': '0700',
  },
  secure: {
    'comment': 'Secure user home directories',
    'browseable': 'no',
    'read only': 'no',
    'create mask': '0700',
    'directory mask': '0700',
    'valid users': '%S',
    'follow symlinks': 'no',
    'wide links': 'no',
  },
  standard: {
    'comment': 'Standard user home directories',
    'browseable': 'yes',
    'read only': 'no',
    'create mask': '0644',
    'directory mask': '0755',
    'valid users': '%S',
    'hide dot files': 'yes',
  }
};

const UserHomesPage = () => {
  const { showNotification } = useNotification();
  const [homesConfig, setHomesConfig] = useState({});
  const [originalHomesConfig, setOriginalHomesConfig] = useState({});
  const [homesEnabled, setHomesEnabled] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('basic');
  const [usersList, setUsersList] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newParam, setNewParam] = useState({ key: '', value: '' });

  // Fetch users data
  const {
    data: usersData,
    loading: usersLoading
  } = useApi(getUsers);

  // Update users list when users data changes
  useEffect(() => {
    if (usersData && usersData.users) {
      setUsersList(usersData.users);
    }
  }, [usersData]);

  // Fetch homes section to check if it's enabled
  const {
    data: homesData,
    loading: homesLoading,
    error: homesError,
    isConnectionError: homesConnectionError,
    fetchData: fetchHomesData,
    forceRetry: retryHomesData
  } = useApi(() => getSection('homes'));

  // Update homes config when data changes
  useEffect(() => {
    if (homesData) {
      const isEnabled = Object.keys(homesData).length > 0;
      setHomesConfig(homesData);
      setOriginalHomesConfig(JSON.parse(JSON.stringify(homesData)));
      setHomesEnabled(isEnabled);
      setHasChanges(false);
    }
  }, [homesData]);

  // Toggle homes enabled/disabled in local state
  const handleToggleHomes = (event) => {
    const newState = event.target.checked;
    setHomesEnabled(newState);

    // If enabling and no config, set basic template
    if (newState && Object.keys(homesConfig).length === 0) {
      setHomesConfig(homeTemplates.basic);
    } else if (!newState) {
      // If disabling, empty the config in local state
      setHomesConfig({});
    }

    setHasChanges(true);
  };

  // Apply template to local state
  const handleApplyTemplate = () => {
    setHomesConfig(homeTemplates[selectedTemplate]);
    setHasChanges(true);
    setTemplateDialogOpen(false);
  };

  // Save changes
  const handleSave = async () => {
    setSaving(true);

    try {
      if (homesEnabled) {
        await updateSection('homes', homesConfig);
      } else {
        // When disabled, delete the entire homes section
        await deleteSection('homes');
      }
      showNotification('Home directories configuration saved successfully', 'success');
      setOriginalHomesConfig(JSON.parse(JSON.stringify(homesConfig)));
      setHasChanges(false);

      // Refresh data after saving
      fetchHomesData(true);
    } catch (error) {
      console.error('Failed to save configuration:', error);

      if (error.isConnectionError) {
        showNotification('Connection failed. Unable to save configuration.', 'error');
      } else {
        showNotification(`Failed to save configuration: ${error.message || 'Something went wrong'}`, 'error');
      }
    } finally {
      // Wait a moment before enabling the button again
      setTimeout(() => {
        setSaving(false);
        setConfirmOpen(false);
      }, 500);
    }
  };

  // Parameter change handler
  const handleParamChange = (key, value) => {
    setHomesConfig(prev => {
      const updated = { ...prev, [key]: value };
      setHasChanges(true);
      return updated;
    });
  };

  // Delete parameter handler
  const handleDeleteParam = (key) => {
    setHomesConfig(prev => {
      const updated = { ...prev };
      delete updated[key];
      setHasChanges(true);
      return updated;
    });
  };

  // New parameter key change handler with autocomplete
  const handleNewParamKeyChange = (value) => {
    setNewParam(prev => ({ ...prev, key: value || '' }));
  };

  // Add parameter handler
  const handleAddParam = () => {
    if (!newParam.key.trim()) return;

    setHomesConfig(prev => {
      const updated = { ...prev, [newParam.key]: newParam.value };
      setHasChanges(true);
      return updated;
    });

    setNewParam({ key: '', value: '' });
  };

  // Refresh handler
  const handleRefresh = () => {
    fetchHomesData(true);
  };

  // If there's a connection error, show the ConnectionError component
  if (homesConnectionError) {
    return <ConnectionError error={homesError} onRetry={retryHomesData} />;
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
          User Home Directories
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => setTemplateDialogOpen(true)}
            disabled={!homesEnabled || homesLoading || saving}
            startIcon={<HomeIcon />}
          >
            Apply Template
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={homesLoading || saving}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={() => setConfirmOpen(true)}
            disabled={homesLoading || saving || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>

      {homesError && !homesConnectionError && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={retryHomesData}>
              Retry
            </Button>
          }
        >
          {homesError}
        </Alert>
      )}

      <Paper
        elevation={1}
        sx={{
          p: 2,
          mb: 3,
          bgcolor: 'info.50',
          border: '1px solid',
          borderColor: 'info.light'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <HomeIcon color="info" />
          <Typography variant="subtitle1" color="info.main">
            Samba User Home Directories
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ mt: 1 }}>
          The [homes] section is a special share that automatically creates a share for each user's home directory.
          When users connect to this share, they will see their own home directory.
        </Typography>

        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          mt: 2,
          pt: 2,
          borderTop: '1px solid',
          borderColor: 'info.light'
        }}>
          <FormControlLabel
            control={
              <Switch
                checked={homesEnabled}
                onChange={handleToggleHomes}
                disabled={homesLoading || saving}
              />
            }
            label={
              <Typography variant="body1" fontWeight="medium">
                {homesEnabled ? "Home Directories Enabled" : "Home Directories Disabled"}
              </Typography>
            }
          />
        </Box>
      </Paper>

      {homesLoading ? (
        <LoadingSpinner message="Loading homes configuration..." />
      ) : (
        <Paper
          elevation={1}
          sx={{
            p: 3,
            borderRadius: 2,
            flex: 1,
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            opacity: homesEnabled ? 1 : 0.6,
            pointerEvents: homesEnabled ? 'auto' : 'none',
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Home Directories Configuration
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={2}>
            {Object.entries(homesConfig).map(([key, value]) => (
              <Grid container item spacing={2} alignItems="center" key={key}>
                <Grid item xs={12} sm={4} md={3}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <TextField
                      fullWidth
                      label="Parameter"
                      value={key}
                      disabled
                      size="small"
                      variant="outlined"
                    />
                    <Tooltip
                      title={
                        <Box sx={{ maxWidth: 300 }}>
                          <Typography variant="body2" gutterBottom>
                            {getParameterDescriptionText(key)}
                          </Typography>

                          {getParameterDescription(key)?.examples && (
                            <>
                              <Typography variant="caption" sx={{ fontWeight: 'bold', mt: 1, display: 'block' }}>
                                Examples:
                              </Typography>
                              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                                {getParameterDescription(key)?.examples.map((example, index) => (
                                  <Typography key={index} component="li" variant="caption" sx={{ fontFamily: 'monospace' }}>
                                    {example}
                                  </Typography>
                                ))}
                              </Box>
                            </>
                          )}
                        </Box>
                      }
                      placement="right"
                    >
                      <IconButton size="small">
                        <InfoIcon fontSize="small" color="info" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={7} md={8}>
                  {key === 'valid users' ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <div style={{ flex: 1 }}>
                        <TextField
                          fullWidth
                          label="Value"
                          value={value}
                          onChange={(e) => handleParamChange(key, e.target.value)}
                          size="small"
                          variant="outlined"
                        />
                      </div>
                      <Tooltip title="Use %S to refer to the current user">
                        <Box sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                          <PersonIcon sx={{ mr: 0.5 }} color="primary" fontSize="small" />
                          <Typography variant="caption">%S = Username</Typography>
                        </Box>
                      </Tooltip>
                    </Box>
                  ) : (
                    <TextField
                      fullWidth
                      label="Value"
                      value={value}
                      onChange={(e) => handleParamChange(key, e.target.value)}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Grid>
                <Grid item xs={12} sm={1} md={1}>
                  <IconButton
                    color="error"
                    onClick={() => handleDeleteParam(key)}
                    disabled={saving}
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}

            <Grid container item spacing={2} alignItems="center">
              <Grid item xs={12} sm={4} md={3}>
                {/* Use ParamAutocomplete with centralized parameter data */}
                <ParamAutocomplete
                  sectionName="homes"
                  value={newParam.key}
                  onChange={handleNewParamKeyChange}
                  disabled={saving}
                  textFieldProps={{
                    placeholder: "Enter or select parameter",
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={7} md={8}>
                <TextField
                  fullWidth
                  label="Value"
                  value={newParam.value}
                  onChange={(e) => setNewParam(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="Enter parameter value"
                  size="small"
                  variant="outlined"
                  disabled={saving}
                />
              </Grid>
              <Grid item xs={12} sm={1} md={1}>
                <IconButton
                  color="primary"
                  onClick={handleAddParam}
                  disabled={!newParam.key.trim() || saving}
                  size="small"
                >
                  <AddIcon />
                </IconButton>
              </Grid>
            </Grid>
          </Grid>

          {/* Users info */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="subtitle2" gutterBottom>
              Available Users
            </Typography>
            <Paper
              elevation={0}
              variant="outlined"
              sx={{ p: 2, mt: 1 }}
            >
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {usersList.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No users found. You need to create users in the Users section.
                  </Typography>
                ) : (
                  usersList.map(user => (
                    <Chip
                      key={user}
                      icon={<PersonIcon />}
                      label={user}
                      variant="outlined"
                      color="primary"
                      size="small"
                    />
                  ))
                )}
              </Box>
            </Paper>
          </Box>
        </Paper>
      )}

      {/* Confirm Save Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Save Home Directories Configuration"
        message="Are you sure you want to save changes to the homes configuration? This will restart the Samba service and could affect active connections."
        confirmText={saving ? "Saving..." : "Save & Restart"}
        confirmColor="warning"
        onConfirm={handleSave}
        onCancel={() => !saving && setConfirmOpen(false)}
        disableConfirm={saving}
        disableCancel={saving}
      />

      {/* Template Selection Dialog */}
      <Dialog
        open={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Apply Configuration Template</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Select a template for the homes configuration:
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Switch
                  checked={selectedTemplate === 'basic'}
                  onChange={() => setSelectedTemplate('basic')}
                  color="primary"
                />
                <Typography>Basic (Simple home directories)</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Switch
                  checked={selectedTemplate === 'secure'}
                  onChange={() => setSelectedTemplate('secure')}
                  color="warning"
                />
                <Typography>Secure (Restricted access, more security)</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Switch
                  checked={selectedTemplate === 'standard'}
                  onChange={() => setSelectedTemplate('standard')}
                  color="info"
                />
                <Typography>Standard (Balanced configuration)</Typography>
              </Box>
            </Grid>
          </Grid>

          <Paper
            elevation={0}
            variant="outlined"
            sx={{ mt: 2, p: 2, bgcolor: 'background.default' }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Template Preview:
            </Typography>
            {Object.entries(homeTemplates[selectedTemplate]).map(([key, value]) => (
              <Typography key={key} variant="body2" sx={{ fontFamily: 'monospace', mb: 0.5 }}>
                <Box component="span" sx={{ color: 'primary.main' }}>{key}</Box> = {value}
              </Typography>
            ))}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApplyTemplate}
            variant="contained"
            color="primary"
          >
            Apply Template
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserHomesPage;
