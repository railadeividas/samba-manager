import React, { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import InfoIcon from '@mui/icons-material/Info';
import Box from '@mui/material/Box';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createUpdateShare } from '../../services/configService';
import { getUsers } from '../../services/usersService';
import { getGroups } from '../../services/groupsService';
import { useNotification } from '../../context/NotificationContext';
import api from '../../services/api';

const ShareForm = ({ open, mode, shareData, onSubmit, onClose }) => {
  const { showNotification } = useNotification();
  const isEditMode = mode === 'edit';
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [validUserOptions, setValidUserOptions] = useState([]);
  const [writeListOptions, setWriteListOptions] = useState([]);
  const [validUsersSelected, setValidUsersSelected] = useState([]);
  const [writeListSelected, setWriteListSelected] = useState([]);
  const [includeSystemGroups, setIncludeSystemGroups] = useState(false);

  // Load users and groups
  useEffect(() => {
    const loadData = async () => {
      try {
        const usersData = await getUsers();
        const groupsData = await getGroups(includeSystemGroups);

        setUsers(usersData.users || []);
        setGroups(groupsData.groups || []);

        // Prepare options for autocomplete
        const userOptions = (usersData.users || []).map(user => ({
          type: 'user',
          label: user,
          value: user
        }));

        const groupOptions = (groupsData.groups || []).map(group => ({
          type: 'group',
          label: `@${group.name}`,
          value: `@${group.name}`,
          isSystem: group.isSystem
        }));

        setValidUserOptions([...userOptions, ...groupOptions]);
        setWriteListOptions([...userOptions, ...groupOptions]);
      } catch (error) {
        console.error('Failed to load users and groups:', error);
        showNotification(`Failed to load users and groups: ${error.message}`, 'error');
      }
    };

    loadData();
  }, [showNotification, includeSystemGroups]);

  // Parse existing valid users and write list
  useEffect(() => {
    if (shareData) {
      const parseEntityList = (listStr) => {
        if (!listStr) return [];
        return listStr.split(',')
          .map(item => item.trim())
          .filter(item => item !== '')
          .map(item => {
            const isGroup = item.startsWith('@') || item.startsWith('+');
            return {
              type: isGroup ? 'group' : 'user',
              label: item,
              value: item
            };
          });
      };

      const validUsers = parseEntityList(shareData['valid users']);
      const writeList = parseEntityList(shareData['write list']);

      setValidUsersSelected(validUsers);
      setWriteListSelected(writeList);
    }
  }, [shareData]);

  // Create validation schema
  const validationSchema = Yup.object({
    name: Yup.string()
      .required('Share name is required')
      .matches(/^[a-zA-Z0-9_-]+$/, 'Share name can only contain letters, numbers, underscores, and hyphens'),
    path: Yup.string().required('Path is required'),
  });

  // Initialize form with default values
  const formik = useFormik({
    initialValues: {
      name: shareData?.name || '',
      path: shareData?.path || '',
      comment: shareData?.comment || '',
      browseable: shareData?.browseable || 'yes',
      'read only': shareData?.['read only'] || 'no',
      'guest ok': shareData?.['guest ok'] || 'no',
      'valid users': shareData?.['valid users'] || '',
      'write list': shareData?.['write list'] || '',
      'create mask': shareData?.['create mask'] || '0664',
      'directory mask': shareData?.['directory mask'] || '2775',
      'force user': shareData?.['force user'] || '',
      'force group': shareData?.['force group'] || '',
      owner: shareData?.owner || '',
      group: shareData?.group || '',
      permissions: shareData?.permissions || '0755'
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        const shareName = values.name;

        // Convert selections to comma-separated strings
        const validUsersStr = validUsersSelected
          .map(item => item.value)
          .join(', ');

        const writeListStr = writeListSelected
          .map(item => item.value)
          .join(', ');

        // Helper function to filter out empty values
        const filterEmptyValues = (obj) => {
          return Object.fromEntries(
            Object.entries(obj).filter(([_, value]) => value !== '' && value !== undefined && value !== null)
          );
        };

        // Create share configuration object for Samba config
        const sambaConfig = filterEmptyValues({
          path: values.path,
          comment: values.comment,
          browseable: values.browseable,
          'read only': values['read only'],
          'guest ok': values['guest ok'],
          'valid users': validUsersStr,
          'write list': writeListStr,
          'create mask': values['create mask'],
          'directory mask': values['directory mask'],
          'force user': values['force user'],
          'force group': values['force group']
        });

        // Create directory setup object for ACLs and directory creation
        const directoryConfig = filterEmptyValues({
          path: values.path,
          owner: values.owner,
          group: values.group,
          permissions: values.permissions,
          'valid users': validUsersStr,
          'write list': writeListStr
        });

        // First, update the share configuration
        await createUpdateShare(shareName, sambaConfig);

        // Then, create the share directory and set up ACLs
        await api.post(`/shares/${shareName}`, directoryConfig);

        // Show success message with details about what was done
        showNotification(
          `Share "${shareName}" ${isEditMode ? 'updated' : 'created'} successfully. Directory created and ACLs set up.`,
          'success'
        );

        // Refresh the shares list
        onSubmit();
      } catch (error) {
        showNotification(`Failed to ${isEditMode ? 'update' : 'create'} share: ${error.message}`, 'error');
      }
    },
  });

  // Handle system groups toggle
  const handleSystemGroupsToggle = (event) => {
    setIncludeSystemGroups(event.target.checked);
  };

  // Render option with icon based on type (user or group)
  const renderOption = (props, option) => (
    <li {...props}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {option.type === 'group' ? (
          option.isSystem ? (
            <LockIcon sx={{ mr: 1, color: 'warning.main' }} />
          ) : (
            <GroupsIcon sx={{ mr: 1, color: 'warning.main' }} />
          )
        ) : (
          <PersonIcon sx={{ mr: 1, color: 'info.main' }} />
        )}
        {option.label}
        {option.isSystem && (
          <Typography variant="caption" color="warning.main" sx={{ ml: 1 }}>
            (System)
          </Typography>
        )}
      </Box>
    </li>
  );

  // Render selected tags with icons
  const renderTags = (value, getTagProps) =>
    value.map((option, index) => (
      <Chip
        key={index}
        label={option.label}
        {...getTagProps({ index })}
        icon={
          option.type === 'group' ?
            (option.isSystem ? <LockIcon /> : <GroupsIcon />) :
            <PersonIcon />
        }
        color={option.type === 'group' ? (option.isSystem ? 'warning' : 'success') : 'info'}
        variant="outlined"
        size="small"
      />
    ));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <form onSubmit={formik.handleSubmit}>
        <DialogTitle>
          {isEditMode ? 'Edit Share' : 'Add Share'}
        </DialogTitle>
        <DialogContent>
          <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'info.50', display: 'flex', alignItems: 'flex-start' }}>
            <InfoIcon color="info" sx={{ mr: 1, mt: 0.5 }} />
            <Box>
              <Typography variant="subtitle2" color="info.main" gutterBottom>
                Access Control List (ACL) Settings
              </Typography>
              <Typography variant="body2">
                The system will automatically:
              </Typography>
              <Typography variant="body2" component="ul" sx={{ mt: 1, pl: 2 }}>
                <li>Create the share directory if it doesn't exist</li>
                <li>Set up Linux ACLs based on your "Valid Users" and "Write List" settings:</li>
                <li style={{ marginLeft: '1.5rem' }}>• Users and groups in "Valid Users" will have read and execute permissions (r-x)</li>
                <li style={{ marginLeft: '1.5rem' }}>• Users and groups in "Write List" will have read, write, and execute permissions (rwx)</li>
                <li>Apply these permissions recursively to all files and directories</li>
                <li>Set default ACLs for new files and directories</li>
                <li>Use groups (prefixed with @) to give multiple users the same permissions</li>
              </Typography>
            </Box>
          </Paper>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Share name field */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                id="name"
                name="name"
                label="Share Name"
                variant="outlined"
                value={formik.values.name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.name && Boolean(formik.errors.name)}
                helperText={formik.touched.name && formik.errors.name}
                disabled={isEditMode}
                required
              />
            </Grid>

            {/* Path field */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                id="path"
                name="path"
                label="Path"
                variant="outlined"
                value={formik.values.path}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.path && Boolean(formik.errors.path)}
                helperText={formik.touched.path && formik.errors.path}
                required
              />
            </Grid>

            {/* Owner field */}
            <Grid item xs={12} md={4}>
              <Autocomplete
                id="owner"
                options={users}
                value={formik.values.owner}
                onChange={(_, newValue) => {
                  formik.setFieldValue('owner', newValue || '');
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Owner"
                    helperText="Set the owner of the share directory"
                  />
                )}
              />
            </Grid>

            {/* Group field */}
            <Grid item xs={12} md={4}>
              <Autocomplete
                id="group"
                options={groups.map(group => group.name)}
                value={formik.values.group}
                onChange={(_, newValue) => {
                  formik.setFieldValue('group', newValue || '');
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Group"
                    helperText="Set the group of the share directory"
                  />
                )}
              />
            </Grid>

            {/* Permissions field */}
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                id="permissions"
                name="permissions"
                label="Permissions"
                variant="outlined"
                value={formik.values.permissions}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                helperText="Set the permissions of the share directory (e.g., 0755)"
                inputProps={{
                  pattern: "[0-7]{4}",
                  title: "Please enter a valid octal permission (e.g., 0755)"
                }}
              />
            </Grid>

            {/* Comment field */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                id="comment"
                name="comment"
                label="Description"
                variant="outlined"
                value={formik.values.comment}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
            </Grid>

            {/* Browseable field */}
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="browseable-label">Browseable</InputLabel>
                <Select
                  labelId="browseable-label"
                  id="browseable"
                  name="browseable"
                  value={formik.values.browseable}
                  label="Browseable"
                  onChange={formik.handleChange}
                >
                  <MenuItem value="yes">Yes</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                </Select>
                <FormHelperText>Whether the share is visible in network browsing</FormHelperText>
              </FormControl>
            </Grid>

            {/* Read only field */}
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="read-only-label">Read Only</InputLabel>
                <Select
                  labelId="read-only-label"
                  id="read only"
                  name="read only"
                  value={formik.values['read only']}
                  label="Read Only"
                  onChange={formik.handleChange}
                >
                  <MenuItem value="yes">Yes</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                </Select>
                <FormHelperText>Whether the share is read-only</FormHelperText>
              </FormControl>
            </Grid>

            {/* Guest access field */}
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="guest-ok-label">Guest Access</InputLabel>
                <Select
                  labelId="guest-ok-label"
                  id="guest ok"
                  name="guest ok"
                  value={formik.values['guest ok']}
                  label="Guest Access"
                  onChange={formik.handleChange}
                >
                  <MenuItem value="yes">Yes</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                </Select>
                <FormHelperText>Allow guest access without authentication</FormHelperText>
              </FormControl>
            </Grid>

            {/* System groups checkbox */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeSystemGroups}
                    onChange={handleSystemGroupsToggle}
                    color="primary"
                  />
                }
                label="Include system groups in selection"
              />
            </Grid>

            {/* Valid users field */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                multiple
                id="validUsers"
                options={validUserOptions}
                value={validUsersSelected}
                onChange={(_, newValue) => {
                  setValidUsersSelected(newValue);
                }}
                renderOption={renderOption}
                renderTags={renderTags}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.value === value.value}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Valid Users & Groups"
                    placeholder="Select users and groups"
                    helperText="Users and groups with read & execute access (r-x)"
                  />
                )}
              />
            </Grid>

            {/* Write list field */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                multiple
                id="writeList"
                options={writeListOptions}
                value={writeListSelected}
                onChange={(_, newValue) => {
                  setWriteListSelected(newValue);
                }}
                renderOption={renderOption}
                renderTags={renderTags}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.value === value.value}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Write List (Users & Groups)"
                    placeholder="Select users and groups"
                    helperText="Users and groups with read, write & execute access (rwx)"
                  />
                )}
              />
            </Grid>

            {/* Create mask field */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                id="create mask"
                name="create mask"
                label="Create Mask"
                variant="outlined"
                value={formik.values['create mask']}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                helperText="Permissions mask for new files (e.g., 0744)"
              />
            </Grid>

            {/* Directory mask field */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                id="directory mask"
                name="directory mask"
                label="Directory Mask"
                variant="outlined"
                value={formik.values['directory mask']}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                helperText="Permissions mask for new directories (e.g., 0755)"
              />
            </Grid>

            {/* Force user field */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                id="force user"
                options={users}
                value={formik.values['force user']}
                onChange={(_, newValue) => {
                  formik.setFieldValue('force user', newValue || '');
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Force User"
                    helperText="All files created will be owned by this user"
                  />
                )}
              />
            </Grid>

            {/* Force group field */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                id="force group"
                options={groups.map(group => group.name)}
                value={formik.values['force group']}
                onChange={(_, newValue) => {
                  formik.setFieldValue('force group', newValue || '');
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Force Group"
                    helperText="All files created will be owned by this group"
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} color="inherit">Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={formik.isSubmitting || !formik.isValid}
          >
            {isEditMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ShareForm;
