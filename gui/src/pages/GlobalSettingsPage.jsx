import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PrintIcon from '@mui/icons-material/Print';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import SectionEditor from '../components/Config/SectionEditor';

// Common parameter descriptions
const paramDescriptions = {
  // Global section
  'workgroup': 'NT domain name or workgroup name',
  'server string': 'Descriptive text about the server',
  'netbios name': 'The NetBIOS name of this server',
  'security': 'Security mode (user, domain, ads)',
  'map to guest': 'Mapping to guest account (never, bad user, bad password)',
  'dns proxy': 'Whether to host NetBIOS names via DNS',
  'log file': 'Path to log file',
  'max log size': 'Maximum size of log file in KB',
  'log level': 'Logging verbosity (0-10)',
  'client min protocol': 'Minimum SMB protocol version (SMB1, SMB2, SMB3)',
  'client max protocol': 'Maximum SMB protocol version (SMB1, SMB2, SMB3)',
  'server min protocol': 'Minimum SMB protocol version for server',
  'server max protocol': 'Maximum SMB protocol version for server',
  'passdb backend': 'Password database backend (tdbsam, smbpasswd)',
  'printing': 'Printing configuration (bsd, sysv, cups)',
  'printcap name': 'Printcap file path or print system name',
  'load printers': 'Whether to load printers automatically (yes/no)',
  'encrypt passwords': 'Whether to use encrypted passwords (yes/no)',
  'wins support': 'Whether this server acts as a WINS server (yes/no)',
  'wins server': 'IP address of WINS server',
  'name resolve order': 'Name resolution order (bcast, lmhosts, host, wins)',

  // Printers section
  'comment': 'Descriptive text about the share',
  'path': 'Path to the share directory',
  'browseable': 'Whether the share is visible (yes/no)',
  'guest ok': 'Whether guest access is allowed (yes/no)',
  'printable': 'Whether printing is enabled (yes/no)',
  'print ok': 'Whether printing is enabled (yes/no)',
  'printer admin': 'Users who can administer this printer',
  'printer name': 'Name of the printer in the printing subsystem',
  'use client driver': 'Whether to use client-side printer drivers (yes/no)',
  'default devmode': 'Whether to use default device mode (yes/no)',

  // Print$ section
  'read only': 'Whether the share is read-only (yes/no)',
  'write list': 'Users who can write to this share',
  'create mask': 'File creation mask',
  'directory mask': 'Directory creation mask',
};

// Tab panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`config-tabpanel-${index}`}
      aria-labelledby={`config-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const GlobalSettingsPage = () => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 2,
        pb: 1,
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)'
      }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'linear-gradient(45deg, #90caf9 10%, #64b5f6 90%)'
                : 'linear-gradient(45deg, #2196f3 30%, #1976d2 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mr: 2
          }}
        >
          Samba Configuration
        </Typography>
      </Box>

      <Paper
        elevation={1}
        sx={{
          p: 2,
          mb: 3,
          bgcolor: 'info.50',
          border: '1px solid',
          borderColor: 'info.light'
        }}
      >
        <Typography variant="subtitle1" color="info.main" gutterBottom>
          Structured Configuration Editor
        </Typography>
        <Typography variant="body2">
          Use the tabs below to edit different sections of your Samba configuration.
          Changes are applied to the configuration file when you save.
        </Typography>
      </Paper>

      <Paper
        elevation={1}
        sx={{
          borderRadius: 2,
          flex: 1,
          minHeight: '500px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label="configuration tabs"
          >
            <Tab
              icon={<SettingsIcon />}
              iconPosition="start"
              label="Global"
              id="config-tab-0"
              aria-controls="config-tabpanel-0"
            />
            <Tab
              icon={<PrintIcon />}
              iconPosition="start"
              label="Printers"
              id="config-tab-1"
              aria-controls="config-tabpanel-1"
            />
            <Tab
              icon={<FolderSpecialIcon />}
              iconPosition="start"
              label="Print Drivers"
              id="config-tab-2"
              aria-controls="config-tabpanel-2"
            />
          </Tabs>
        </Box>

        <Box sx={{ p: 3, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Global Section Tab */}
          <TabPanel value={activeTab} index={0}>
            <SectionEditor
              sectionName="global"
              paramDescriptions={paramDescriptions}
              title="Global Configuration Settings"
              description="These settings affect the overall behavior of the Samba server."
            />
          </TabPanel>

          {/* Printers Section Tab */}
          <TabPanel value={activeTab} index={1}>
            <SectionEditor
              sectionName="printers"
              paramDescriptions={paramDescriptions}
              title="Printers Configuration Settings"
              description="These settings control how printers are shared on the network."
            />
          </TabPanel>

          {/* Print$ Section Tab */}
          <TabPanel value={activeTab} index={2}>
            <SectionEditor
              sectionName="print$"
              paramDescriptions={paramDescriptions}
              title="Print Drivers Configuration Settings"
              description="These settings control how printer drivers are shared on the network."
            />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
};

export default GlobalSettingsPage;
