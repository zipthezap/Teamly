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
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      pb: { xs: 2, sm: 3, md: 4 }
    }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, sm: 3, md: 4 }, px: { xs: 2, sm: 3 } }}>
        {/* Header Section with Modern Design */}
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
              textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
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
              opacity: 0.95,
              maxWidth: '600px',
              mx: 'auto',
              fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' },
              px: { xs: 2, sm: 0 }
            }}
          >
            {t('teamup.subtitle')}
          </Typography>
        </Box>

        {/* Main Content Card */}
        <Paper 
          elevation={8}
          sx={{ 
            borderRadius: { xs: 2, sm: 3 },
            overflow: 'hidden',
            backgroundColor: 'white'
          }}
        >
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            aria-label="teamup tabs"
            variant="fullWidth"
            sx={{
              backgroundColor: 'grey.50',
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                minHeight: { xs: 64, sm: 72 },
                fontSize: { xs: '0.875rem', sm: '1rem' },
                fontWeight: 600,
                textTransform: 'none',
                transition: 'all 0.3s ease',
                px: { xs: 1, sm: 2 },
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

          <Box sx={{ backgroundColor: '#fafafa', minHeight: '60vh', p: { xs: 2, sm: 3 } }}>
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
