import React from 'react';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Header from './Header';
import Sidebar from './Sidebar';
import { useApp } from '../../context/AppContext';

const Layout = ({ children }) => {
  const { sidebarOpen } = useApp();

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
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
