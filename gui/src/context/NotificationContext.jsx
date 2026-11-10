import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

// Create the context
const NotificationContext = createContext();

// Custom hook to use the notification context
export const useNotification = () => useContext(NotificationContext);

// Provider component
export const NotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'info', // 'error', 'warning', 'info', 'success'
    duration: 6000
  });

  // Function to show a notification
  const showNotification = useCallback((message, severity = 'info', duration = 6000) => {
    setNotification({
      open: true,
      message,
      severity,
      duration
    });
  }, []);

  // Warnings returned by the API (see services/api.js) are shown as toasts
  useEffect(() => {
    const onWarning = (event) => showNotification(event.detail, 'warning', 12000);
    window.addEventListener('api-warning', onWarning);
    return () => window.removeEventListener('api-warning', onWarning);
  }, [showNotification]);

  // Function to close the notification
  const closeNotification = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setNotification({ ...notification, open: false });
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <Snackbar
        open={notification.open}
        autoHideDuration={notification.duration}
        onClose={closeNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={closeNotification}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
};
