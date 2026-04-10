import React, { useState } from 'react';
import { Container, Box, Typography, Tabs, Tab, Paper } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import SearchIcon from '@mui/icons-material/Search';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import LookingForPlayTab from '../components/teamup/LookingForPlayTab';
import NeedPlayersTab from '../components/teamup/NeedPlayersTab';
import { TabPanel } from '../components/common';

const TeamUp = () => {
  const [tabValue, setTabValue] = useState(0);
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: `linear-gradient(to bottom, ${alpha(theme.palette.background.default, 0.9)}, ${alpha(theme.palette.background.paper, 0.96)})`,
      pb: { xs: 2, sm: 3, md: 4 }
    }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 2, sm: 3, md: 4 }, px: { xs: 2, sm: 3 } }}>
        {/* Header Section */}
        <Box sx={{ 
          mb: { xs: 3, sm: 4 }, 
          textAlign: 'center',
          color: 'text.primary'
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
              color: 'text.secondary'
            }}
          >
            {t('teamup.subtitle')}
          </Typography>
        </Box>

        {/* Main Content Card */}
        <Paper 
          elevation={0}
          sx={{ 
            borderRadius: { xs: 1.5, sm: 2 },
            overflow: 'hidden',
            backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.94 : 0.98),
            border: `1px solid ${theme.palette.divider}`
          }}
        >
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            aria-label="teamup tabs"
            variant="fullWidth"
            sx={{
              backgroundColor: alpha(theme.palette.background.default, isDark ? 0.75 : 0.5),
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                minHeight: { xs: 64, sm: 72 },
                fontSize: { xs: '0.875rem', sm: '1rem' },
                fontWeight: 650,
                textTransform: 'none',
                transition: 'all 0.3s ease',
                px: { xs: 1, sm: 2 },
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.08)
                },
                '&.Mui-selected': {
                  color: theme.palette.primary.main
                }
              },
              '& .MuiTabs-indicator': {
                height: 2,
                borderRadius: '3px 3px 0 0',
                backgroundColor: theme.palette.primary.main
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

          <Box sx={{ backgroundColor: 'transparent', minHeight: '60vh', p: { xs: 2, sm: 3 } }}>
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
