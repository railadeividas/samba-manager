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
      'create mask': shareData?.['create mask'] || '0744',
      'directory mask': shareData?.['directory mask'] || '0755'
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

        const shareConfig = {
          ...values,
          'valid users': validUsersStr,
          'write list': writeListStr,
        };

        delete shareConfig.name;

        await createUpdateShare(shareName, shareConfig);
        showNotification(
          `Share "${shareName}" ${isEditMode ? 'updated' : 'created'} successfully`,
          'success'
        );
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
                The system will automatically set up Linux ACLs based on your "Valid Users" and "Write List" settings:
              </Typography>
              <Typography variant="body2" component="ul" sx={{ mt: 1, pl: 2 }}>
                <li>Users and groups in "Valid Users" will have read and execute permissions (r-x)</li>
                <li>Users and groups in "Write List" will have read, write, and execute permissions (rwx)</li>
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
