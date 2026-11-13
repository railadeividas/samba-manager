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
import Box from '@mui/material/Box';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import FormLabel from '@mui/material/FormLabel';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createUpdateShare } from '../../services/configService';
import { getUsers } from '../../services/usersService';
import { getGroups } from '../../services/groupsService';
import { getInfo } from '../../services/infoService';
import { useNotification } from '../../context/NotificationContext';

// Starting points for common kinds of shares. They only prefill the form.
export const SHARE_TEMPLATES = {
  standard: {
    label: 'Standard share',
    help: 'Named users can read and write; nobody else gets in.',
    values: { browseable: 'yes', 'read only': 'no', 'guest ok': 'no' },
    extra: {},
  },
  public: {
    label: 'Public read-only (guests)',
    help: 'Anyone on the network can read without a password. Windows 11 blocks guest access by default.',
    values: { browseable: 'yes', 'read only': 'yes', 'guest ok': 'yes' },
    extra: {},
  },
  timemachine: {
    label: 'macOS Time Machine backup',
    help: 'A backup target for Macs. Needs the cross-platform preset (Settings > Global) and works best with a Force User.',
    values: { browseable: 'yes', 'read only': 'no', 'guest ok': 'no' },
    extra: {
      'vfs objects': 'catia fruit streams_xattr',
      'fruit:time machine': 'yes',
      'durable handles': 'yes',
      'kernel oplocks': 'no',
      'kernel share modes': 'no',
      'posix locking': 'no',
    },
  },
};

// Parameters sent to the server even when empty, so clearing a field removes it.
const FORM_PARAMS = [
  'path', 'comment', 'browseable', 'read only', 'guest ok', 'valid users', 'write list',
  'create mask', 'directory mask', 'force user', 'force group',
];

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
  const [info, setInfo] = useState(null);
  const [template, setTemplate] = useState('');
  const [extraParams, setExtraParams] = useState({});
  const [pathTouched, setPathTouched] = useState(false);

  useEffect(() => {
    getInfo().then(setInfo).catch(() => {});
  }, []);

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
      .matches(/^[a-zA-Z0-9][a-zA-Z0-9 _.-]*$/, 'Use letters, numbers, spaces, dots, underscores and hyphens')
      .max(80, 'Share name is too long')
      .notOneOf(['global', 'printers', 'print$', 'homes'], 'This name is reserved'),
    path: Yup.string().required('Path is required').matches(/^\//, 'Path must be absolute (start with /)'),
    permissions: Yup.string().matches(/^([0-7]{3,4})?$/, 'Use an octal mode such as 0775'),
  });

  const defaultRoot = (info && info.allowedRoots && info.allowedRoots[0]) || '/srv/samba';
  const defaultAccess = shareData?._access || 'samba';

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
      'directory mask': shareData?.['directory mask'] || '0775',
      'force user': shareData?.['force user'] || '',
      'force group': shareData?.['force group'] || '',
      owner: shareData?._owner || '',
      group: shareData?._group || '',
      permissions: shareData?._permissions || (isEditMode ? '' : '0775'),
      _access: defaultAccess,
      _recursive: false,
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        const guestAccess = values['guest ok'] === 'yes';
        const shareName = values.name.trim();

        // Convert selections to comma-separated strings
        const validUsersStr = validUsersSelected.map(item => item.value).join(', ');
        const writeListStr = writeListSelected.map(item => item.value).join(', ');

        // One request does everything: directory, access control and smb.conf.
        const payload = { ...extraParams };
        FORM_PARAMS.forEach((key) => { payload[key] = values[key] ?? ''; });
        // Guests are not in any user list, so a list would lock them out
        payload['valid users'] = guestAccess ? '' : validUsersStr;
        payload['write list'] = writeListStr;
        payload._access = guestAccess ? 'samba' : values._access;
        payload._owner = values.owner || '';
        payload._group = values.group || '';
        payload._permissions = values.permissions || '';
        if (values._recursive) payload._recursive = 'yes';

        const result = await createUpdateShare(shareName, payload);

        showNotification(
          result.message || `Share "${shareName}" ${isEditMode ? 'updated' : 'created'} successfully.`,
          'success'
        );

        // Refresh the shares list
        onSubmit();
      } catch (error) {
        showNotification(`Failed to ${isEditMode ? 'update' : 'create'} share: ${error.message}`, 'error');
      }
    },
  });

  // Suggest a path from the name until the user types their own
  useEffect(() => {
    if (!isEditMode && !pathTouched && formik.values.name) {
      const slug = formik.values.name.trim().replace(/[^A-Za-z0-9_.-]+/g, '_');
      formik.setFieldValue('path', `${defaultRoot.replace(/\/$/, '')}/${slug}`, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.name, defaultRoot, pathTouched, isEditMode]);

  const applyTemplate = (key) => {
    setTemplate(key);
    const t = SHARE_TEMPLATES[key];
    if (!t) {
      setExtraParams({});
      return;
    }
    Object.entries(t.values).forEach(([k, v]) => formik.setFieldValue(k, v, false));
    setExtraParams(t.extra);
  };

  const accessMode = formik.values._access;

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
          {!isEditMode && (
            <FormControl fullWidth sx={{ mb: 1.5 }}>
              <InputLabel id="template-label">Start from a template (optional)</InputLabel>
              <Select
                labelId="template-label"
                id="template"
                value={template}
                label="Start from a template (optional)"
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <MenuItem value=""><em>None</em></MenuItem>
                {Object.entries(SHARE_TEMPLATES).map(([key, t]) => (
                  <MenuItem key={key} value={key}>{t.label}</MenuItem>
                ))}
              </Select>
              {template && <FormHelperText>{SHARE_TEMPLATES[template].help}</FormHelperText>}
            </FormControl>
          )}

          <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
            <FormControl>
              <FormLabel id="access-mode-label">Who is allowed in, and how is it enforced?</FormLabel>
              <RadioGroup
                aria-labelledby="access-mode-label"
                name="_access"
                value={accessMode}
                onChange={formik.handleChange}
              >
                <FormControlLabel
                  value="samba"
                  sx={{ alignItems: 'flex-start', '& .MuiRadio-root': { py: 0.5 } }}
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body1">Samba-only (recommended)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Samba checks "Valid Users" and "Write List". Every file belongs to one account (Force User / Force Group),
                        so there are no permission surprises between users.
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="acl"
                  disabled={info && info.aclSupported === false}
                  sx={{ alignItems: 'flex-start', '& .MuiRadio-root': { py: 0.5 } }}
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body1">POSIX ACL (per-user)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        The filesystem enforces access with Linux ACLs: Valid Users get read, Write List users get write,
                        and files keep their real owners. Also protects the files from other programs on the server.
                        {info && info.aclSupported === false && ' (setfacl/getfacl are not installed on the server)'}
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>
            {accessMode === 'samba' && !formik.values['force user'] && !formik.values['force group'] && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Tip: set a Force User or Force Group below so files created by different users stay editable by everyone allowed.
              </Alert>
            )}
            {accessMode === 'acl' && isEditMode && (
              <FormControlLabel
                sx={{ mt: 1 }}
                control={
                  <Checkbox
                    checked={formik.values._recursive}
                    onChange={(e) => formik.setFieldValue('_recursive', e.target.checked)}
                  />
                }
                label="Also apply the ACLs to files and folders that already exist (can take a while on large shares)"
              />
            )}
          </Paper>

          <Grid container spacing={1.25} sx={{ mt: 0 }}>
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
                onChange={(e) => { setPathTouched(true); formik.handleChange(e); }}
                onBlur={formik.handleBlur}
                error={formik.touched.path && Boolean(formik.errors.path)}
                helperText={(formik.touched.path && formik.errors.path) || (info && info.allowedRoots ? `Must be inside: ${info.allowedRoots.join(', ')}` : '')}
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
                    helperText="Owner of the share directory (leave empty to keep it)"
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
                    helperText="Group of the share directory (leave empty to keep it)"
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
                helperText={formik.errors.permissions || "Mode of the share directory (e.g., 0775). Leave empty to keep it as is."}
                error={Boolean(formik.errors.permissions)}
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
                <FormHelperText>
                  {formik.values['guest ok'] === 'yes'
                    ? 'Anyone can open this share without a password'
                    : 'Allow guest access without authentication'}
                </FormHelperText>
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
                disabled={formik.values['guest ok'] === 'yes'}
                options={validUserOptions}
                value={formik.values['guest ok'] === 'yes' ? [] : validUsersSelected}
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
                    helperText={
                      formik.values['guest ok'] === 'yes'
                        ? 'Not used while Guest Access is on: everyone may open the share. Use the Write List to limit who can change files'
                        : 'Who may open the share (read access)'
                    }
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
                    helperText="Who may change files (write access)"
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
