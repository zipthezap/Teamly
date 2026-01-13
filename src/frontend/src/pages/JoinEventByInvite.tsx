import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getImageUrl, getInitials } from '../utils/imageUtils';
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
  Grid,
  Card,
  CardContent,
  Divider,
  Avatar,
  AvatarGroup
} from '@mui/material';
import { 
  CalendarToday, 
  LocationOn, 
  People,
  SportsSoccer,
  CheckCircle,
  Group,
  Person,
  AccessTime
} from '@mui/icons-material';
import { EventWithDetails, EventParticipant, GuestParticipant } from '../../../shared/types';
import { AxiosError } from 'axios';

const JoinEventByInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [guestName, setGuestName] = useState('');

  // Guard for missing token
  if (!token) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Alert severity="error">Invalid invite link</Alert>
      </Container>
    );
  }

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await eventsAPI.getByInviteToken(token!);
        setEvent(response.data);
      } catch (err: unknown) {
        const errorMessage = err instanceof AxiosError 
          ? err.response?.data?.error || 'Failed to load event. The invite link may be invalid or expired.'
          : 'Failed to load event. The invite link may be invalid or expired.';
        setError(errorMessage);
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
      await eventsAPI.joinAsGuest(token!, guestName);
      setSuccess('Successfully joined the event! The organizer will have your details.');
      setGuestName('');
      // Refresh event data to show updated participant count
      const response = await eventsAPI.getByInviteToken(token!);
      setEvent(response.data);
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || 'Failed to join event. Please try again.'
        : 'Failed to join event. Please try again.';
      setError(errorMessage);
    } finally {
      setJoining(false);
    }
  };

  const handleAuthenticatedJoin = async () => {
    setJoining(true);
    setError('');
    
    try {
      // Join as authenticated user
      await eventsAPI.join(event!.id);
      setSuccess('Successfully joined the event! Redirecting to event details...');
      // Redirect to event details after a short delay
      setTimeout(() => {
        navigate(`/events/${event!.id}`);
      }, 1500);
    } catch (err: unknown) {
      const errorMsg = err instanceof AxiosError 
        ? err.response?.data?.error || 'Failed to join event'
        : 'Failed to join event';
      // Provide specific error messages
      if (errorMsg.includes('full')) {
        setError('This event is currently full. Please check back later.');
      } else if (errorMsg.includes('already joined')) {
        setError('You have already joined this event!');
      } else {
        setError(`${errorMsg}. Note: You must be a member of the event's group to join.`);
      }
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
    (event.participants?.filter((p: EventParticipant) => p.status === 'confirmed').length || 0) +
    (event.guestParticipants?.filter((g: GuestParticipant) => g.status === 'confirmed').length || 0);

  const isFull = event.maxPlayers && totalParticipants >= event.maxPlayers;

  // Check if user is already a participant (done efficiently with some())
  const isAlreadyParticipant = user && event.participants?.some((p: EventParticipant) => p.userId === user.id);

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      {/* Hero Section */}
      <Paper 
        elevation={0} 
        sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          p: 4,
          mb: 3,
          borderRadius: 2
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <SportsSoccer sx={{ fontSize: 60, mb: 2, opacity: 0.9 }} />
          <Typography variant="h4" gutterBottom fontWeight="bold">
            You're Invited! 🎉
          </Typography>
          <Typography variant="h5" sx={{ mb: 1 }}>
            {event.title}
          </Typography>
          <Chip 
            icon={<Group />} 
            label={event.group?.name || 'Group Event'} 
            sx={{ 
              bgcolor: 'rgba(255,255,255,0.2)', 
              color: 'white',
              fontWeight: 'bold'
            }} 
          />
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Event Details Card */}
      <Card elevation={3} sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarToday color="primary" />
            Event Details
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SportsSoccer color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">Sport</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {event.eventType}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AccessTime color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">Date & Time</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {new Date(event.startTime).toLocaleString([], { 
                      dateStyle: 'medium', 
                      timeStyle: 'short' 
                    })}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {event.location && (
              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <LocationOn color="action" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Location</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {event.location}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            )}

            {event.description && (
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  {event.description}
                </Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Participants Card */}
      <Card elevation={3} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <People color="primary" />
              Participants
            </Typography>
            <Chip 
              label={event.maxPlayers ? `${totalParticipants}/${event.maxPlayers}` : totalParticipants}
              color={isFull ? 'error' : 'success'}
              size="small"
            />
          </Box>

          {/* Show participant avatars */}
          {totalParticipants > 0 && (
            <Box sx={{ mb: 2 }}>
              <AvatarGroup max={8} sx={{ justifyContent: 'flex-start' }}>
                {event.participants?.filter((p: EventParticipant) => p.status === 'confirmed').map((p: EventParticipant, idx: number) => {
                  // Prefer current profile picture from history if available
                  const currentPic = p.user?.profilePictures?.find((pic) => pic.isCurrent && !pic.deletedAt);
                  const profilePictureUrl = getImageUrl(currentPic?.url || p.user?.profilePicture);
                  return (
                    <Avatar key={idx} sx={{ bgcolor: 'primary.main' }} src={profilePictureUrl || undefined}>
                      {!profilePictureUrl && getInitials(p.user?.name)}
                    </Avatar>
                  );
                })}
                {event.guestParticipants?.filter((g: GuestParticipant) => g.status === 'confirmed').map((g: GuestParticipant, idx: number) => (
                  <Avatar key={`guest-${idx}`} sx={{ bgcolor: 'secondary.main' }}>
                    {getInitials(g.name)}
                  </Avatar>
                ))}
              </AvatarGroup>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {totalParticipants} {totalParticipants === 1 ? 'person has' : 'people have'} joined
              </Typography>
            </Box>
          )}

          {event.maxPlayers && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Capacity
              </Typography>
              <Box sx={{ 
                width: '100%', 
                height: 8, 
                bgcolor: 'grey.300', 
                borderRadius: 1,
                overflow: 'hidden'
              }}>
                <Box sx={{ 
                  width: `${(totalParticipants / event.maxPlayers) * 100}%`,
                  height: '100%',
                  bgcolor: isFull ? 'error.main' : 'success.main',
                  transition: 'width 0.3s ease'
                }} />
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Join Section */}
      {isFull ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This event is currently full.
        </Alert>
      ) : isAlreadyParticipant ? (
        <Alert severity="info" icon={<CheckCircle />}>
          You're already participating in this event! 
          <Button 
            size="small" 
            onClick={() => navigate(`/events/${event.id}`)}
            sx={{ ml: 2 }}
          >
            View Event
          </Button>
        </Alert>
      ) : (
        <Card elevation={3}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Person color="primary" />
              Join this Event
            </Typography>

            {user ? (
              // Authenticated user - one-click join
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Welcome back, <strong>{user.name}</strong>! Click below to join this event.
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleAuthenticatedJoin}
                  disabled={joining}
                  fullWidth
                  sx={{ py: 1.5 }}
                >
                  {joining ? <CircularProgress size={24} /> : 'Join Event Now'}
                </Button>
              </Box>
            ) : (
              // Guest user
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Enter your name to join as a guest, or{' '}
                  <Button 
                    size="small" 
                    onClick={() => navigate('/login')}
                    sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}
                  >
                    sign in
                  </Button>
                  {' '}for full features.
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

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={joining || !guestName.trim()}
                    fullWidth
                    sx={{ py: 1.5 }}
                  >
                    {joining ? <CircularProgress size={24} /> : 'Join as Guest'}
                  </Button>
                </form>

                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
                  💡 Create an account to manage your events and get notifications
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Organizer Info */}
      {event.creator && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Organized by <strong>{event.creator.name}</strong>
          </Typography>
        </Box>
      )}
    </Container>
  );
};

export default JoinEventByInvite;
