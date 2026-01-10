import React, { useState } from 'react';
import { Container, Box, Typography, Tabs, Tab } from '@mui/material';
import { useTranslation } from 'react-i18next';
import SubmitRequestTab from '../components/teamup/SubmitRequestTab';
import BrowseRequestsTab from '../components/teamup/BrowseRequestsTab';

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
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
          {t('teamup.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('teamup.subtitle')}
        </Typography>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          aria-label="teamup tabs"
        >
          <Tab label={t('teamup.submitTab')} id="teamup-tab-0" />
          <Tab label={t('teamup.browseTab')} id="teamup-tab-1" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <SubmitRequestTab />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <BrowseRequestsTab />
      </TabPanel>
    </Container>
  );
};

export default TeamUp;
