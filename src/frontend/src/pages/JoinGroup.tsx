import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
import { Group } from '../../../shared/types';

const JoinGroup = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);
  const [groupInfo, setGroupInfo] = useState<Group | null>(null);

  // Fetch group info (for display purposes)
  useEffect(() => {
    const fetchGroupInfo = async () => {
      try {
        // Try to get public group info without auth
        const res = await groupsAPI.getPublic();
        const foundGroup = res.data.find((g: Group) => g.id === groupId);
        if (foundGroup) {
          setGroupInfo(foundGroup);
        }
      } catch (err) {
        // Silently fail - group info is optional
      }
    };
    
    if (groupId) {
      fetchGroupInfo();
    }
  }, [groupId]);

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
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'response' in err && 
        err.response && typeof err.response === 'object' && 'data' in err.response &&
        err.response.data && typeof err.response.data === 'object' && 'error' in err.response.data
        ? String(err.response.data.error)
        : t('joinGroup.failedToJoin');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user, groupId, navigate, t]);

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
          {groupInfo && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>
                {groupInfo.name}
              </Typography>
              {groupInfo.description && (
                <Typography variant="body2" color="text.secondary">
                  {groupInfo.description}
                </Typography>
              )}
            </Box>
          )}
          <Typography variant="body1" paragraph>
            {t('joinGroup.loginToJoin')}
          </Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              onClick={() => navigate('/login', { state: { returnTo: `/join-group/${groupId}` } })}
            >
              {t('joinGroup.login')}
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/register', { state: { returnTo: `/join-group/${groupId}` } })}
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
        
        {groupInfo && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="h6">
              {groupInfo.name}
            </Typography>
            {groupInfo.description && (
              <Typography variant="body2" color="text.secondary">
                {groupInfo.description}
              </Typography>
            )}
          </Box>
        )}
        
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
