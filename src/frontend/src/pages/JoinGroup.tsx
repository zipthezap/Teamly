import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Button,
  Alert,
} from '@mui/material';
import { groupsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const JoinGroup = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);

  const handleJoinGroup = useCallback(async () => {
    if (!user) {
      setError(t('joinGroup.loginToJoin'));
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await groupsAPI.joinByInvite(user.id, groupId);
      setSuccess(t('joinGroup.successfullyJoined'));
      setTimeout(() => {
        navigate(`/groups/${groupId}`);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || t('joinGroup.failedToJoin'));
    } finally {
      setLoading(false);
    }
  }, [user, groupId, navigate]);

  useEffect(() => {
    // Auto-join if user is logged in and hasn't attempted yet
    if (user && groupId && !hasAttemptedJoin) {
      setHasAttemptedJoin(true);
      handleJoinGroup();
    }
  }, [user, groupId, hasAttemptedJoin, handleJoinGroup]);

  if (!user) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>
            {t('joinGroup.title')}
          </Typography>
          <Typography variant="body1" paragraph>
            {t('joinGroup.loginToJoin')}
          </Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              onClick={() => navigate('/login', { state: { returnTo: `/groups/join/${groupId}` } })}
            >
              {t('joinGroup.login')}
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/register', { state: { returnTo: `/groups/join/${groupId}` } })}
            >
              {t('joinGroup.signup')}
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          {t('joinGroup.title')}
        </Typography>
        
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
            <Typography variant="body1" sx={{ ml: 2 }}>
              {t('joinGroup.joining')}
            </Typography>
          </Box>
        )}
        
        {error && !loading && (
          <Box display="flex" gap={2} mt={2}>
            <Button
              variant="contained"
              onClick={handleJoinGroup}
            >
              {t('joinGroup.tryAgain')}
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/groups')}
            >
              {t('joinGroup.goToGroups')}
            </Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default JoinGroup;
