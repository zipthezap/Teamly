import React, { useState } from 'react';
import { Container, Box, Typography, Tabs, Tab, Paper } from '@mui/material';
import { useTranslation } from 'react-i18next';
import SearchIcon from '@mui/icons-material/Search';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import LookingForPlayTab from '../components/teamup/LookingForPlayTab';
import NeedPlayersTab from '../components/teamup/NeedPlayersTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`teamup-tabpanel-${index}`}
      aria-labelledby={`teamup-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const TeamUp = () => {
  const [tabValue, setTabValue] = useState(0);
  const { t } = useTranslation();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      pb: 4
    }}>
      <Container maxWidth="xl" sx={{ pt: 4 }}>
        {/* Header Section with Modern Design */}
        <Box sx={{ 
          mb: 4, 
          textAlign: 'center',
          color: 'white'
        }}>
          <Typography 
            variant="h3" 
            gutterBottom 
            sx={{ 
              fontWeight: 700,
              textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
              mb: 1
            }}
          >
            {t('teamup.title')}
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 300,
              opacity: 0.95,
              maxWidth: '600px',
              mx: 'auto'
            }}
          >
            {t('teamup.subtitle')}
          </Typography>
        </Box>

        {/* Main Content Card */}
        <Paper 
          elevation={8}
          sx={{ 
            borderRadius: 3,
            overflow: 'hidden',
            backgroundColor: 'white'
          }}
        >
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            aria-label="teamup tabs"
            centered
            sx={{
              backgroundColor: 'grey.50',
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                minHeight: 72,
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: 'rgba(102, 126, 234, 0.08)',
                  transform: 'translateY(-2px)'
                },
                '&.Mui-selected': {
                  color: '#667eea'
                }
              },
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
                backgroundColor: '#667eea'
              }
            }}
          >
            <Tab 
              icon={<SearchIcon />} 
              iconPosition="start" 
              label={t('teamup.lookingForPlayTab')} 
              id="teamup-tab-0" 
            />
            <Tab 
              icon={<GroupAddIcon />} 
              iconPosition="start" 
              label={t('teamup.needPlayersTab')} 
              id="teamup-tab-1" 
            />
          </Tabs>

          <Box sx={{ backgroundColor: '#fafafa', minHeight: '60vh' }}>
            <TabPanel value={tabValue} index={0}>
              <LookingForPlayTab />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <NeedPlayersTab />
            </TabPanel>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default TeamUp;
