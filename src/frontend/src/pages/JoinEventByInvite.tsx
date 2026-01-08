import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import { 
  Container, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Box,
  Alert,
  CircularProgress,
  Chip,
  Grid
} from '@mui/material';
import { 
  CalendarToday, 
  LocationOn, 
  People,
  SportsSoccer 
} from '@mui/icons-material';

const JoinEventByInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [guestName, setGuestName] = useState('');

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await eventsAPI.getByInviteToken(token);
        setEvent(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load event. The invite link may be invalid or expired.');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [token]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!guestName.trim()) {
      setError('Please enter your name');
      return;
    }

    setJoining(true);
    setError('');
    
    try {
      await eventsAPI.joinAsGuest(token, guestName);
      setSuccess('Successfully joined the event! The organizer will have your details.');
      setGuestName('');
      // Refresh event data to show updated participant count
      const response = await eventsAPI.getByInviteToken(token);
      setEvent(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to join event. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error && !event) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Alert severity="error">{error}</Alert>
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  if (!event) {
    return null;
  }

  const totalParticipants = 
    (event.participants?.filter((p: any) => p.status === 'confirmed').length || 0) +
    (event.guestParticipants?.filter((g: any) => g.status === 'confirmed').length || 0);

  const isFull = event.maxPlayers && totalParticipants >= event.maxPlayers;

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          You're Invited to Join
        </Typography>
        
        <Typography variant="h5" color="primary" sx={{ mb: 3 }}>
          {event.title}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <SportsSoccer sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body1">
                <strong>Type:</strong> {event.eventType}
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <CalendarToday sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body1">
                <strong>Start:</strong> {new Date(event.startTime).toLocaleString()}
              </Typography>
            </Box>
          </Grid>

          {event.endTime && (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CalendarToday sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body1">
                  <strong>End:</strong> {new Date(event.endTime).toLocaleString()}
                </Typography>
              </Box>
            </Grid>
          )}

          {event.location && (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LocationOn sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="body1">
                  <strong>Location:</strong> {event.location}
                </Typography>
              </Box>
            </Grid>
          )}

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <People sx={{ mr: 1, color: 'text.secondary' }} />
              <Typography variant="body1">
                <strong>Participants:</strong> {totalParticipants}
                {event.maxPlayers && ` / ${event.maxPlayers}`}
              </Typography>
            </Box>
          </Grid>

          {event.description && (
            <Grid item xs={12}>
              <Typography variant="body1" sx={{ mt: 2 }}>
                <strong>Description:</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {event.description}
              </Typography>
            </Grid>
          )}
        </Grid>

        {isFull ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            This event is currently full.
          </Alert>
        ) : (
          <>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Join this event
            </Typography>

            <form onSubmit={handleJoin}>
              <TextField
                fullWidth
                label="Your Name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter your name"
                required
                disabled={joining}
                sx={{ mb: 2 }}
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={joining || !guestName.trim()}
                  fullWidth
                >
                  {joining ? <CircularProgress size={24} /> : 'Join Event'}
                </Button>
              </Box>
            </form>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Note: You're joining as a guest. To get full access to features, 
              <Button 
                size="small" 
                onClick={() => navigate('/register')}
                sx={{ textTransform: 'none', ml: 0.5 }}
              >
                create an account
              </Button>
            </Typography>
          </>
        )}

        {event.group && (
          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              Organized by: {event.group.name}
            </Typography>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default JoinEventByInvite;
