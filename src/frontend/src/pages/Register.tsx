import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { groupsAPI } from '../services/api';
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
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
import { StyledLink } from '../components/common';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const handleOAuthSignup = (provider: 'google' | 'facebook') => {
    const params = new URLSearchParams(location.search);
    const inviteGroupId = params.get('invite');
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    const authUrl = new URL(`/auth/${provider}`, apiUrl);
    if (inviteGroupId) {
      authUrl.searchParams.set('inviteGroupId', inviteGroupId);
    }
    
    window.location.href = authUrl.toString();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      const newUser = await register({ name, email, password });
      
      // Check for returnTo in location state (from invite link)
      const returnTo = location.state?.returnTo;
      if (returnTo) {
        navigate(returnTo);
      } else {
        // Check for invite param (legacy)
        const params = new URLSearchParams(location.search);
        const inviteGroupId = params.get('invite');
        if (inviteGroupId && newUser?.id) {
          // Call backend to join group
          try {
            await groupsAPI.joinByInvite(newUser.id, inviteGroupId);
          } catch (err) {
            // Optionally handle join error
          }
          navigate(`/groups/${inviteGroupId}`);
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error && 'response' in err 
        ? ((err as any).response?.data?.error || t('auth.registerFailed'))
        : t('auth.registerFailed');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box display="flex" flexDirection="column" alignItems="center">
          <PersonAddIcon sx={{ fontSize: 48, mb: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" gutterBottom>
            {t('auth.registerTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t('auth.registerSubtitle')}
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          <Divider sx={{ width: '100%', mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('auth.orContinueWith') || 'Or continue with email'}
            </Typography>
          </Divider>

          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
              label={t('common.name')}
              fullWidth
              margin="normal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.namePlaceholder')}
              required
            />
            <TextField
              label={t('common.email')}
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              required
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
            />
            <TextField
              label={t('auth.confirmPassword')}
              type="password"
              fullWidth
              margin="normal"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? t('common.loading') : t('auth.registerButton')}
            </Button>

            {/* External sign-ups below Teamly sign-up */}
            <Box sx={{ width: '100%', mt: 1 }}>
              <Button
                variant="outlined"
                fullWidth
                size="large"
                startIcon={<GoogleIcon />}
                onClick={() => handleOAuthSignup('google')}
                sx={{ mb: 1, textTransform: 'none' }}
              >
                {t('auth.signUpWithGoogle') || 'Sign up with Google'}
              </Button>
              <Button
                variant="outlined"
                fullWidth
                size="large"
                startIcon={<FacebookIcon />}
                onClick={() => handleOAuthSignup('facebook')}
                sx={{ textTransform: 'none' }}
              >
                {t('auth.signUpWithFacebook') || 'Sign up with Facebook'}
              </Button>
            </Box>
          </Box>

          <Typography variant="body2" sx={{ mt: 2 }}>
            {t('auth.hasAccount')}{' '}
            <StyledLink to="/login">
              {t('auth.signInHere')}
            </StyledLink>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default Register;
