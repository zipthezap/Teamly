import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { StyledLink } from '../components/common';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const credentials = { email, password };
      if (requires2FA && twoFactorToken) {
        credentials.twoFactorToken = twoFactorToken;
      }
      
      const result = await login(credentials);
      
      // Check if 2FA is required
      if (result && result.requires2FA) {
        setRequires2FA(true);
        setError('');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" flexDirection="column" alignItems="center">
          <LoginIcon sx={{ fontSize: 48, mb: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" gutterBottom>
            {t('auth.loginTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t('auth.loginSubtitle')}
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
              label={t('common.email')}
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              required
              disabled={requires2FA}
            />
            <TextField
              label={t('common.password')}
              type="password"
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              required
              disabled={requires2FA}
            />
            
            {requires2FA && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Two-factor authentication is enabled. Enter your verification code.
                </Alert>
                <TextField
                  label={t('auth.twoFactorToken')}
                  fullWidth
                  margin="normal"
                  value={twoFactorToken}
                  onChange={(e) => setTwoFactorToken(e.target.value)}
                  placeholder={t('auth.twoFactorPlaceholder')}
                  inputProps={{ maxLength: 6 }}
                  InputProps={{
                    sx: { fontSize: '20px', textAlign: 'center' }
                  }}
                  required
                  autoFocus
                />
              </Box>
            )}
            
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading || (requires2FA && twoFactorToken.length !== 6)}
            >
              {loading ? t('common.loading') : requires2FA ? `Verify and ${t('common.login')}` : t('auth.loginButton')}
            </Button>
            
            {requires2FA && (
              <Button
                variant="text"
                fullWidth
                onClick={() => {
                  setRequires2FA(false);
                  setTwoFactorToken('');
                  setError('');
                }}
              >
                {t('common.back')} to {t('common.login')}
              </Button>
            )}
          </Box>

          <Typography variant="body2" sx={{ mt: 2 }}>
            {t('auth.noAccount')}{' '}
            <StyledLink to="/register">
              {t('auth.signUpHere')}
            </StyledLink>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default Login;
