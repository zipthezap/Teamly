import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper } from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';

const TwoFactorSection: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Paper elevation={1} sx={{ p: 3, mb: 2 }}>
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <SecurityIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>
          Two-Factor Authentication
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Add an extra layer of security to your account by enabling two-factor authentication (2FA) with an authenticator app.
      </Typography>
      <Button variant="outlined" onClick={() => navigate('/2fa-setup')}>
        Manage 2FA
      </Button>
    </Paper>
  );
};

export default TwoFactorSection;
