import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import { twoFactorAPI } from '../services/api';
import { getErrorMessage } from '../utils/errorHandler';

interface TwoFactorSetupData {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

interface TwoFactorStatus {
  enabled: boolean;
}

const TwoFactorSetup = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [setupData, setSetupData] = useState<TwoFactorSetupData | null>(null);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const navigate = useNavigate();

  const steps = ['Get Started', 'Scan QR Code', 'Verify Setup', 'Save Backup Codes'];

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await twoFactorAPI.getStatus();
      setStatus(response.data);
    } catch {
    }
  };

  const handleStartSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await twoFactorAPI.setup();
      setSetupData(response.data);
      setActiveStep(1);
    } catch (error: unknown) {
      setError(getErrorMessage(error) || 'Failed to initialize 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await twoFactorAPI.verify(token);
      setSuccess('Two-factor authentication enabled successfully!');
      setActiveStep(3);
    } catch (error: unknown) {
      setError(getErrorMessage(error) || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await twoFactorAPI.disable(password);
      setSuccess('Two-factor authentication disabled successfully!');
      checkStatus();
      setPassword('');
    } catch (error: unknown) {
      setError(getErrorMessage(error) || 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = async () => {
    if (!setupData) return;
    try {
      await navigator.clipboard.writeText(setupData.secret);
      setSuccess('Secret copied to clipboard!');
    } catch {
      setError('Failed to copy to clipboard. Please copy manually.');
    }
  };

  const handleDownloadBackupCodes = () => {
    if (!setupData) return;
    const content = `Teamly 2FA Backup Codes\n\n${setupData.backupCodes.join('\n')}\n\nKeep these codes safe. Each code can only be used once.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teamly-2fa-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box textAlign="center" py={4}>
            <SecurityIcon sx={{ fontSize: 64, mb: 2, color: 'primary.main' }} />
            <Typography variant="h5" gutterBottom>
              Enable Two-Factor Authentication
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Add an extra layer of security to your account by requiring a verification code
              from your authenticator app when signing in.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={handleStartSetup}
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? 'Setting up...' : 'Start Setup'}
            </Button>
          </Box>
        );

      case 1:
        return (
          <Box py={2}>
            <Typography variant="h6" gutterBottom>
              Scan QR Code
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Use your authenticator app (Google Authenticator, Authy, etc.) to scan this QR code:
            </Typography>
            <Box display="flex" justifyContent="center" my={3}>
              <Box
                component="img"
                src={setupData?.qrCode}
                alt="QR Code"
                sx={{ maxWidth: '250px', width: '100%', height: 'auto' }}
              />
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Or enter this secret manually:
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <TextField
                value={setupData?.secret}
                fullWidth
                size="small"
                InputProps={{
                  readOnly: true,
                  sx: { fontFamily: 'monospace' },
                }}
              />
              <IconButton onClick={handleCopySecret} color="primary">
                <ContentCopyIcon />
              </IconButton>
            </Box>
            <Button
              variant="contained"
              fullWidth
              onClick={() => setActiveStep(2)}
              sx={{ mt: 3 }}
            >
              Continue to Verification
            </Button>
          </Box>
        );

      case 2:
        return (
          <Box py={2}>
            <Typography variant="h6" gutterBottom>
              Verify Setup
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Enter the 6-digit code from your authenticator app to verify the setup:
            </Typography>
            <form onSubmit={handleVerify}>
              <TextField
                label="Verification Code"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                fullWidth
                margin="normal"
                placeholder="000000"
                inputProps={{ maxLength: 6 }}
                InputProps={{
                  sx: { fontSize: '24px', textAlign: 'center' }
                }}
                required
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading || token.length !== 6}
                sx={{ mt: 2 }}
              >
                {loading ? 'Verifying...' : 'Verify and Enable'}
              </Button>
            </form>
          </Box>
        );

      case 3:
        return (
          <Box py={2}>
            <Typography variant="h6" gutterBottom>
              Save Your Backup Codes
            </Typography>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Save these backup codes in a safe place. You can use them to access your account
              if you lose access to your authenticator app. Each code can only be used once.
            </Alert>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
              <List dense>
                {setupData?.backupCodes.map((code: string) => (
                  <ListItem key={code}>
                    <ListItemText
                      primary={code}
                      primaryTypographyProps={{
                        fontFamily: 'monospace',
                        fontSize: '16px',
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
            <Button
              variant="contained"
              fullWidth
              startIcon={<DownloadIcon />}
              onClick={handleDownloadBackupCodes}
              sx={{ mt: 2 }}
            >
              Download Backup Codes
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => navigate('/dashboard')}
              sx={{ mt: 1 }}
            >
              Done
            </Button>
          </Box>
        );

      default:
        return null;
    }
  };

  if (status?.enabled) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box display="flex" flexDirection="column" alignItems="center">
            <SecurityIcon sx={{ fontSize: 48, mb: 2, color: 'success.main' }} />
            <Typography variant="h5" gutterBottom>
              2FA is Enabled
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph textAlign="center">
              Your account is protected with two-factor authentication.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
                {success}
              </Alert>
            )}

            <Divider sx={{ width: '100%', my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Disable 2FA
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph textAlign="center">
              Enter your password to disable two-factor authentication:
            </Typography>

            <Box component="form" onSubmit={handleDisable2FA} sx={{ width: '100%' }}>
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                margin="normal"
                required
              />
              <Button
                type="submit"
                variant="contained"
                color="error"
                fullWidth
                disabled={loading}
                sx={{ mt: 2 }}
              >
                {loading ? 'Disabling...' : 'Disable 2FA'}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {renderStepContent()}
      </Paper>
    </Container>
  );
};

export default TwoFactorSetup;
