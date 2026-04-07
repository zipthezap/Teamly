import React, { useState } from 'react';
import { Container, Box, Typography, Tabs, Tab, Paper } from '@mui/material';
import { useTranslation } from 'react-i18next';
import SearchIcon from '@mui/icons-material/Search';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import LookingForPlayTab from '../components/teamup/LookingForPlayTab';
import NeedPlayersTab from '../components/teamup/NeedPlayersTab';
import { TabPanel } from '../components/common';

const TeamUp = () => {
  const [tabValue, setTabValue] = useState(0);
  const { t } = useTranslation();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #0f1419, #1a202c)',
      pb: { xs: 2, sm: 3, md: 4 }
    }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, sm: 3, md: 4 }, px: { xs: 2, sm: 3 } }}>
        {/* Header Section */}
        <Box sx={{ 
          mb: { xs: 3, sm: 4 }, 
          textAlign: 'center',
          color: 'white'
        }}>
          <Typography 
            variant="h3" 
            gutterBottom 
            sx={{ 
              fontWeight: 700,
              mb: 1,
              fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' }
            }}
          >
            {t('teamup.title')}
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 300,
              opacity: 0.8,
              maxWidth: '600px',
              mx: 'auto',
              fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' },
              px: { xs: 2, sm: 0 },
              color: '#9ca3af'
            }}
          >
            {t('teamup.subtitle')}
          </Typography>
        </Box>

        {/* Main Content Card */}
        <Paper 
          elevation={0}
          sx={{ 
            borderRadius: { xs: 2, sm: 3 },
            overflow: 'hidden',
            backgroundColor: '#1a202c',
            border: '1px solid #374151'
          }}
        >
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            aria-label="teamup tabs"
            variant="fullWidth"
            sx={{
              backgroundColor: '#0f1419',
              borderBottom: 1,
              borderColor: '#374151',
              '& .MuiTab-root': {
                minHeight: { xs: 64, sm: 72 },
                fontSize: { xs: '0.875rem', sm: '1rem' },
                fontWeight: 600,
                textTransform: 'none',
                transition: 'all 0.3s ease',
                px: { xs: 1, sm: 2 },
                '&:hover': {
                  backgroundColor: 'rgba(33, 150, 243, 0.08)',
                  transform: 'translateY(-2px)'
                },
                '&.Mui-selected': {
                  color: '#2196f3'
                }
              },
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
                backgroundColor: '#2196f3'
              },
              '& .MuiTab-iconWrapper': {
                fontSize: { xs: '1.25rem', sm: '1.5rem' }
              }
            }}
          >
            <Tab 
              icon={<SearchIcon />} 
              iconPosition="start" 
              label={t('teamup.lookingForPlayTab')} 
              id="teamup-tab-0"
              sx={{ minHeight: '44px' }}
            />
            <Tab 
              icon={<GroupAddIcon />} 
              iconPosition="start" 
              label={t('teamup.needPlayersTab')} 
              id="teamup-tab-1"
              sx={{ minHeight: '44px' }}
            />
          </Tabs>

          <Box sx={{ backgroundColor: '#1a202c', minHeight: '60vh', p: { xs: 2, sm: 3 } }}>
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
