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

const JoinGroup = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);

  const handleJoinGroup = useCallback(async () => {
    if (!user) {
      setError('Please log in to join this group');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await groupsAPI.joinByInvite(user.id, groupId);
      setSuccess('Successfully joined the group!');
      setTimeout(() => {
        navigate(`/groups/${groupId}`);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join group');
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
            Join Group
          </Typography>
          <Typography variant="body1" paragraph>
            Please log in to join this group.
          </Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              onClick={() => navigate('/login', { state: { returnTo: `/groups/join/${groupId}` } })}
            >
              Log In
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/register', { state: { returnTo: `/groups/join/${groupId}` } })}
            >
              Sign Up
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
          Join Group
        </Typography>
        
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          !success && !error && (
            <Box>
              <Typography variant="body1" paragraph>
                Joining group...
              </Typography>
            </Box>
          )
        )}
        
        {error && !loading && (
          <Box display="flex" gap={2} mt={2}>
            <Button
              variant="contained"
              onClick={handleJoinGroup}
            >
              Try Again
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/groups')}
            >
              Go to Groups
            </Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default JoinGroup;
