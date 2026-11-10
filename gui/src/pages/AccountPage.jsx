import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { changeAdminPassword } from '../services/infoService';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

const AccountPage = () => {
  const { showNotification } = useNotification();
  const { logout } = useAuth();

  const formik = useFormik({
    initialValues: { current: '', next: '', confirm: '' },
    validationSchema: Yup.object({
      current: Yup.string().required('Enter your current password'),
      next: Yup.string().required('Enter a new password').min(8, 'At least 8 characters').notOneOf(['admin'], 'Choose a less guessable password'),
      confirm: Yup.string().oneOf([Yup.ref('next')], 'Passwords must match'),
    }),
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        await changeAdminPassword(values.current, values.next);
        showNotification('Password changed. Please sign in again.', 'success');
        resetForm();
        logout();
      } catch (e) {
        showNotification(e.message, 'error');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const field = (name, label) => (
    <TextField
      fullWidth margin="normal" type="password" id={name} name={name} label={label}
      value={formik.values[name]} onChange={formik.handleChange} onBlur={formik.handleBlur}
      error={formik.touched[name] && Boolean(formik.errors[name])}
      helperText={formik.touched[name] && formik.errors[name]}
      autoComplete={name === 'current' ? 'current-password' : 'new-password'}
    />
  );

  return (
    <Box sx={{ maxWidth: 520 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 2 }}>Account</Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Change admin password</Typography>
        <Alert severity="info" sx={{ mb: 1 }}>
          This is the password for this web interface, not for Samba users. You will be signed out afterwards.
        </Alert>
        <form onSubmit={formik.handleSubmit}>
          {field('current', 'Current password')}
          {field('next', 'New password')}
          {field('confirm', 'Confirm new password')}
          <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={formik.isSubmitting || !formik.isValid || !formik.dirty}>
            Change password
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default AccountPage;
