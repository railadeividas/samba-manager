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
              title="Global Configuration Settings"
              description="These settings affect the overall behavior of the Samba server."
            />
          </TabPanel>

          {/* Printers Section Tab */}
          <TabPanel value={activeTab} index={1}>
            <SectionEditor
              sectionName="printers"
              title="Printers Configuration Settings"
              description="These settings control how printers are shared on the network."
            />
          </TabPanel>

          {/* Print$ Section Tab */}
          <TabPanel value={activeTab} index={2}>
            <SectionEditor
              sectionName="print$"
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
