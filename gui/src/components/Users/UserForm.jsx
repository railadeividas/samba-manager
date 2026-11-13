import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { createUser } from '../../services/usersService';
import HomeConflictDialog from './HomeConflictDialog';
import { useNotification } from '../../context/NotificationContext';

const UserForm = ({ open, onSubmit, onClose }) => {
  const { showNotification } = useNotification();
  const [homeConflict, setHomeConflict] = useState(null);

  // Create validation schema
  const validationSchema = Yup.object({
    username: Yup.string()
      .required('Username is required')
      .matches(/^[a-z_][a-z0-9_-]*$/, 'Use lowercase letters, numbers, underscores and hyphens, starting with a letter or underscore')
      .min(3, 'Username must be at least 3 characters')
      .max(32, 'Username must be at most 32 characters'),
    password: Yup.string()
      .required('Password is required')
      .min(8, 'Password must be at least 8 characters'),
    confirmPassword: Yup.string()
      .required('Please confirm your password')
      .oneOf([Yup.ref('password'), null], 'Passwords must match'),
  });

  // Creates the user (and its home directory). When a leftover home belongs to
  // someone else the server answers with a conflict and we ask what to do.
  const submitUser = async (values, existingHome = '') => {
    try {
      await createUser(values.username, values.password, existingHome);
      setHomeConflict(null);
      showNotification(`User "${values.username}" created successfully`, 'success');
      onSubmit();
    } catch (error) {
      if (error.data?.code === 'home_conflict') {
        setHomeConflict({ values, home: error.data.data });
      } else {
        setHomeConflict(null);
        showNotification(`Failed to create user: ${error.message}`, 'error');
      }
    }
  };

  // Initialize form with default values
  const formik = useFormik({
    initialValues: {
      username: '',
      password: '',
      confirmPassword: '',
    },
    validationSchema,
    onSubmit: (values) => submitUser(values),
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
      <HomeConflictDialog
        open={Boolean(homeConflict)}
        username={homeConflict?.values.username}
        home={homeConflict?.home}
        busy={formik.isSubmitting}
        onChoose={(choice) => submitUser(homeConflict.values, choice)}
        onCancel={() => setHomeConflict(null)}
      />
    </Dialog>
  );
};

export default UserForm;
