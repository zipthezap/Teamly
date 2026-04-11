import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Divider,
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
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
  const location = useLocation();
  const { t } = useTranslation();

  const handleOAuthLogin = (provider: 'google' | 'facebook') => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    window.location.href = `${apiUrl}/auth/${provider}`;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const credentials: { email: string; password: string; twoFactorToken?: string } = { email, password };
      if (requires2FA && twoFactorToken) {
        credentials.twoFactorToken = twoFactorToken;
      }
      
      const result = await login(credentials);
      
      // Check if 2FA is required
      if (result && (result as { requires2FA?: boolean }).requires2FA) {
        setRequires2FA(true);
        setError('');
      } else {
        // Navigate to returnTo location if provided, otherwise dashboard
        const returnTo = (location.state as { returnTo?: string })?.returnTo || '/dashboard';
        navigate(returnTo);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: { xs: 4, sm: 6, md: 8 }, px: { xs: 2, sm: 3 } }}>
      <Paper elevation={3} sx={{ p: { xs: 3, sm: 4 } }}>
        <Box display="flex" flexDirection="column" alignItems="center">
          <LoginIcon sx={{ fontSize: { xs: 40, sm: 48 }, mb: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' }, textAlign: 'center' }}>
            {t('auth.loginTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ textAlign: 'center' }}>
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
                  {t('auth.twoFactorRequired')}
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
              sx={{ mt: 3, mb: 2, minHeight: '48px' }}
              disabled={loading || (requires2FA && twoFactorToken.length !== 6)}
            >
              {loading ? t('common.loading') : requires2FA ? t('auth.verifyAndLogin') : t('auth.loginButton')}
            </Button>

            {/* Divider after sign in button */}
            {!requires2FA && (
              <Divider sx={{ width: '100%', mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
                  {t('auth.orContinueWith') || 'Or continue with email'}
                </Typography>
              </Divider>
            )}

            {/* External sign-ins below divider */}
            {!requires2FA && (
              <Box sx={{ width: '100%', mt: 1 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  size="large"
                  startIcon={<GoogleIcon />}
                  onClick={() => handleOAuthLogin('google')}
                  sx={{ mb: 1, textTransform: 'none', minHeight: '48px' }}
                >
                  {t('auth.signInWithGoogle') || 'Sign in with Google'}
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  size="large"
                  startIcon={<FacebookIcon />}
                  onClick={() => handleOAuthLogin('facebook')}
                  sx={{ textTransform: 'none', minHeight: '48px' }}
                >
                  {t('auth.signInWithFacebook') || 'Sign in with Facebook'}
                </Button>
              </Box>
            )}
            
            {requires2FA && (
              <Button
                variant="text"
                fullWidth
                onClick={() => {
                  setRequires2FA(false);
                  setTwoFactorToken('');
                  setError('');
                }}
                sx={{ minHeight: '44px' }}
              >
                {t('auth.backToLogin')}
              </Button>
            )}
          </Box>

          <Typography variant="body2" sx={{ mt: 2, textAlign: 'center', fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
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
