import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, CircularProgress, Box, Typography, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { groupsAPI } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setTokens } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const token = searchParams.get('token');
      const refreshToken = searchParams.get('refreshToken');
      const inviteGroupId = searchParams.get('inviteGroupId');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError(t('auth.oauthFailed') || 'OAuth authentication failed');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      if (!token || !refreshToken) {
        setError(t('auth.invalidAuthResponse') || 'Invalid authentication response');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      // Store tokens
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);

      // Update auth context
      if (setTokens) {
        await setTokens(token, refreshToken);
      }

      // If there's an invite group ID, join the group
      if (inviteGroupId) {
        try {
          // Fetch user profile to validate authentication before joining group
          const profileResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/auth/profile`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (profileResponse.ok) {
            await groupsAPI.joinByInvite(inviteGroupId);
            
            // Invalidate caches so the joined group appears
            queryClient.invalidateQueries({ queryKey: ['groupsList'] });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            queryClient.invalidateQueries({ queryKey: ['groupDetails', inviteGroupId] });
            queryClient.invalidateQueries({ queryKey: ['groupMembers', inviteGroupId] });
            
            navigate(`/groups/${inviteGroupId}`);
          } else {
            navigate('/dashboard');
          }
        } catch {
          navigate('/dashboard');
        }
      } else {
        navigate('/dashboard');
      }
    };

    handleCallback();
  }, [searchParams, navigate, setTokens, t, queryClient]);

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Box display="flex" flexDirection="column" alignItems="center">
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : (
          <>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="h6">
              {t('auth.completingLogin') || 'Completing login...'}
            </Typography>
          </>
        )}
      </Box>
    </Container>
  );
};

export default AuthCallback;
