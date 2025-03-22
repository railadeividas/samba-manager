import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createGroup } from '../../services/groupsService';
import { useNotification } from '../../context/NotificationContext';

const GroupForm = ({ open, groupData, onSubmit, onClose }) => {
  const { showNotification } = useNotification();
  const isEditMode = Boolean(groupData);

  // Create validation schema
  const validationSchema = Yup.object({
    name: Yup.string()
      .required('Group name is required')
      .matches(/^[a-zA-Z0-9_-]+$/, 'Group name can only contain letters, numbers, underscores, and hyphens'),
  });

  // Initialize form with default values
  const formik = useFormik({
    initialValues: {
      name: groupData?.name || '',
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        const groupName = values.name;

        if (isEditMode) {
          // Group editing is not implemented - groups can only be created or deleted
          // Users are added/removed via separate actions
          showNotification('Group editing is not supported. Use add/remove user actions instead.', 'info');
        } else {
          await createGroup(groupName);
          showNotification(`Group "${groupName}" created successfully`, 'success');
        }
        onSubmit();
      } catch (error) {
        showNotification(`Failed to ${isEditMode ? 'update' : 'create'} group: ${error.message}`, 'error');
      }
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <form onSubmit={formik.handleSubmit}>
        <DialogTitle>
          {isEditMode ? 'Edit Group' : 'Add Group'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                id="name"
                name="name"
                label="Group Name"
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

            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Groups can be used in shares for collective access control. Assign users to groups to give them the same permissions.
              </Typography>
              {isEditMode && (
                <Typography variant="body2" color="info.main" sx={{ mt: 1 }}>
                  To add or remove users from this group, use the actions on the groups list page.
                </Typography>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} color="inherit">Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={formik.isSubmitting || !formik.isValid || isEditMode}
          >
            {isEditMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default GroupForm;
