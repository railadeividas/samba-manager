import React from 'react';
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
import Grid from '@mui/material/Grid';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createUpdateShare } from '../../services/sharesService';
import { useNotification } from '../../context/NotificationContext';

const ShareForm = ({ open, mode, shareData, onSubmit, onClose }) => {
  const { showNotification } = useNotification();
  const isEditMode = mode === 'edit';

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
        const { name, ...shareConfig } = values;

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

            {/* Valid users field */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                id="valid users"
                name="valid users"
                label="Valid Users"
                variant="outlined"
                value={formik.values['valid users']}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                helperText="Comma-separated list of users who can access this share"
              />
            </Grid>

            {/* Write list field */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                id="write list"
                name="write list"
                label="Write List"
                variant="outlined"
                value={formik.values['write list']}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                helperText="Comma-separated list of users with write access"
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
