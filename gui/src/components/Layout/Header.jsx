import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import MenuIcon from '@mui/icons-material/Menu';
import RefreshIcon from '@mui/icons-material/Refresh';
import LogoutIcon from '@mui/icons-material/Logout';
import Chip from '@mui/material/Chip';
import CircleIcon from '@mui/icons-material/Circle';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useNotification } from '../../context/NotificationContext';
import { restartService, getServiceStatus } from '../../services/serviceStatus';
import ThemeToggle from '../ThemeToggle';

const Header = () => {
  const { toggleSidebar, serviceStatus, setServiceStatus } = useApp();
  const { showNotification } = useNotification();
  const { logout } = useAuth();

  const handleRestartService = async () => {
    try {
      await restartService();
      showNotification('Service restarted successfully', 'success');

      // Update service status after a delay
      setTimeout(async () => {
        try {
          const status = await getServiceStatus();
          setServiceStatus(status);
        } catch (error) {
          console.error('Failed to get service status:', error);
        }
      }, 2000);
    } catch (error) {
      showNotification(`Failed to restart service: ${error.message}`, 'error');
    }
  };

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

        <Chip
          icon={<CircleIcon fontSize="small" color={serviceStatus.active ? 'success' : 'error'} />}
          label={`Status: ${serviceStatus.status}`}
          variant="outlined"
          sx={{
            color: 'inherit',
            borderColor: 'rgba(255, 255, 255, 0.3)',
            mr: 2
          }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {/* Theme Toggle Button */}
          <ThemeToggle />

          <Tooltip title="Restart Service">
            <IconButton
              color="inherit"
              aria-label="restart service"
              onClick={handleRestartService}
              sx={{ mr: 1 }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>

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
