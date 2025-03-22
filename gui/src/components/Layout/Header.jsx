import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import Box from '@mui/material/Box';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useNotification } from '../../context/NotificationContext';
import ThemeToggle from '../ThemeToggle';

const Header = () => {
  const { toggleSidebar } = useApp();
  const { showNotification } = useNotification();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    showNotification('You have been logged out successfully', 'info');
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)'
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="toggle sidebar"
          edge="start"
          onClick={toggleSidebar}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Samba Manager
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {/* Theme Toggle Button */}
          <ThemeToggle />

          <Button
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={{
              ml: 1,
              borderRadius: 2,
              border: '1px solid rgba(255, 255, 255, 0.3)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(255, 255, 255, 0.5)',
              }
            }}
          >
            Logout
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
