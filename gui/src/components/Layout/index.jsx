import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Header from './Header';
import Sidebar from './Sidebar';
import { useApp } from '../../context/AppContext';
import { getInfo } from '../../services/infoService';

const Layout = ({ children }) => {
  const { sidebarOpen } = useApp();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    getInfo().then(setInfo).catch(() => {});
  }, []);

  // Exact width values
  const sidebarWidth = sidebarOpen ? 240 : 64;
  const appBarHeight = 64;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />

      {/* App Bar */}
      <Header />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          marginTop: `${appBarHeight}px`,
          marginLeft: `${sidebarWidth}px`,
          transition: (theme) => theme.transitions.create('margin-left', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          padding: 0, // Remove any default padding
        }}
      >
        {/* Content Container */}
        <Box sx={{ padding: 3 }}>
          {info && info.insecurePassword && (
            <Alert
              severity="warning"
              sx={{ mb: 3 }}
              action={<Button color="inherit" size="small" onClick={() => navigate('/settings/account')}>Change it</Button>}
            >
              The admin password is still the default "admin". Anyone who can reach this page can control your file server.
            </Alert>
          )}
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
