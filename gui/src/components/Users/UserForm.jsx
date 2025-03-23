import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createUser } from '../../services/usersService';
import { createUserHomeDirectory } from '../../services/usersService';
import { useNotification } from '../../context/NotificationContext';

const UserForm = ({ open, onSubmit, onClose }) => {
  const { showNotification } = useNotification();

  // Create validation schema
  const validationSchema = Yup.object({
    username: Yup.string()
      .required('Username is required')
      .matches(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
      .min(3, 'Username must be at least 3 characters'),
    password: Yup.string()
      .required('Password is required')
      .min(6, 'Password must be at least 6 characters'),
    confirmPassword: Yup.string()
      .required('Please confirm your password')
      .oneOf([Yup.ref('password'), null], 'Passwords must match'),
    createHomeDirectory: Yup.boolean()
  });

  // Initialize form with default values
  const formik = useFormik({
    initialValues: {
      username: '',
      password: '',
      confirmPassword: '',
      createHomeDirectory: false
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        // Create user
        await createUser(values.username, values.password);

        // Optionally create home directory
        if (values.createHomeDirectory) {
          await createUserHomeDirectory(values.username);
        }

        showNotification(`User "${values.username}" created successfully`, 'success');
        onSubmit();
      } catch (error) {
        showNotification(`Failed to create user: ${error.message}`, 'error');
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
          Add User
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Username field */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                id="username"
                name="username"
                label="Username"
                variant="outlined"
                value={formik.values.username}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.username && Boolean(formik.errors.username)}
                helperText={formik.touched.username && formik.errors.username}
                required
              />
            </Grid>

            {/* Password field */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                id="password"
                name="password"
                label="Password"
                type="password"
                variant="outlined"
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.password && Boolean(formik.errors.password)}
                helperText={formik.touched.password && formik.errors.password}
                required
              />
            </Grid>

            {/* Confirm Password field */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                id="confirmPassword"
                name="confirmPassword"
                label="Confirm Password"
                type="password"
                variant="outlined"
                value={formik.values.confirmPassword}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.confirmPassword && Boolean(formik.errors.confirmPassword)}
                helperText={formik.touched.confirmPassword && formik.errors.confirmPassword}
                required
              />
            </Grid>

            {/* Create Home Directory checkbox */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    id="createHomeDirectory"
                    name="createHomeDirectory"
                    checked={formik.values.createHomeDirectory}
                    onChange={formik.handleChange}
                  />
                }
                label="Create Home Directory"
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
            Create
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UserForm;
