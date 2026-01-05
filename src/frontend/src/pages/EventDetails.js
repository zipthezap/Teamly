import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Button,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Alert,
  Chip,
  Divider,
  Avatar,
  ListItemAvatar,
  Stack,
  LinearProgress,
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HelpIcon from '@mui/icons-material/Help';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PersonIcon from '@mui/icons-material/Person';
import { eventsAPI, groupChatAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarColor } from '../utils/colors';

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lateSuccess, setLateSuccess] = useState('');
  const [lateError, setLateError] = useState('');
  const [notifications, setNotifications] = useState([]);

  const fetchEvent = useCallback(async () => {
    try {
      const response = await eventsAPI.getById(id);
      setEvent(response.data);
    } catch (error) {
      console.error('Error fetching event:', error);
      setError('Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await groupChatAPI.getNotifications();
      setNotifications(res.data);
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchEvent();
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchEvent, fetchNotifications]);

  const handleJoin = async () => {
    setError('');
    setSuccess('');
    try {
      await eventsAPI.join(id);
      setSuccess('Successfully joined the event');
      fetchEvent();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join event');
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('Are you sure you want to leave this event?')) return;
    
    setError('');
    setSuccess('');
    try {
      await eventsAPI.leave(id);
      setSuccess('Successfully left the event');
      fetchEvent();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to leave event');
    }
  };

  const handleUpdateStatus = async (status) => {
    setError('');
    setSuccess('');
    try {
      await eventsAPI.updateStatus(id, status);
      setSuccess(`Status updated to ${status}`);
      fetchEvent();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    
    try {
      await eventsAPI.delete(id);
      navigate('/events');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete event');
    }
  };

  const handleMarkLate = async () => {
    setLateError('');
    setLateSuccess('');
    try {
      await groupChatAPI.markLate(id);
      setLateSuccess('Marked as late.');
      fetchEvent();
    } catch (err) {
      setLateError('Failed to mark as late');
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircleIcon sx={{ fontSize: 18 }} />;
      case 'declined':
        return <CancelIcon sx={{ fontSize: 18 }} />;
      default:
        return <HelpIcon sx={{ fontSize: 18 }} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'declined':
        return 'error';
      default:
        return 'default';
    }
  };

  const isParticipant = event?.participants?.find((p) => p.userId === user?.id);
  const isCreator = event?.creatorId === user?.id;
  const isFull = event?.maxPlayers && event?.participants?.length >= event?.maxPlayers;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress size={60} thickness={4} />
      </Box>
    );
  }

  if (!event) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">Event not found</Alert>
      </Container>
    );
  }

  const participantCount = event.participants?.length || 0;
  const confirmedCount = event.participants?.filter(p => p.status === 'confirmed').length || 0;
  const declinedCount = event.participants?.filter(p => p.status === 'declined').length || 0;
  const pendingCount = participantCount - confirmedCount - declinedCount;
  const fillPercentage = event.maxPlayers ? (participantCount / event.maxPlayers) * 100 : 0;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Stack spacing={3}>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
        {lateSuccess && <Alert severity="success" onClose={() => setLateSuccess('')}>{lateSuccess}</Alert>}
        {lateError && <Alert severity="error" onClose={() => setLateError('')}>{lateError}</Alert>}

        <Paper sx={{ p: 4 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Box display="flex" alignItems="start" gap={2} mb={2}>
                <Avatar 
                  sx={{ 
                    width: 64, 
                    height: 64, 
                    bgcolor: 'primary.main',
                    fontSize: '1.5rem',
                    fontWeight: 600,
                  }}
                >
                  {event.eventType?.charAt(0).toUpperCase()}
                </Avatar>
                <Box flexGrow={1}>
                  <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                    {event.title}
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip 
                      label={event.eventType} 
                      color="secondary"
                      sx={{ fontWeight: 600 }}
                    />
                    {isFull && (
                      <Chip 
                        label="Full" 
                        color="warning"
                        sx={{ fontWeight: 600 }}
                      />
                    )}
                    {isParticipant && (
                      <Chip 
                        label="Joined" 
                        color="success"
                        sx={{ fontWeight: 600 }}
                      />
                    )}
                    {isCreator && (
                      <Chip 
                        label="Organizer" 
                        color="primary"
                        sx={{ fontWeight: 600 }}
                      />
                    )}
                  </Box>
                </Box>
              </Box>
              
              <Typography variant="body1" paragraph sx={{ mt: 2, mb: 3 }}>
                {event.description || 'No description provided'}
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Box 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'rgba(33, 150, 243, 0.05)',
                      borderRadius: 2,
                      border: '1px solid rgba(33, 150, 243, 0.2)',
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <AccessTimeIcon color="primary" />
                      <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 600 }}>
                        Start Time
                      </Typography>
                    </Box>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      📅 {new Date(event.startTime).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric',
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      🕐 {new Date(event.startTime).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Typography>
                  </Box>
                </Grid>

                {event.endTime && (
                  <Grid item xs={12} sm={6}>
                    <Box 
                      sx={{ 
                        p: 2, 
                        bgcolor: 'rgba(245, 0, 87, 0.05)',
                        borderRadius: 2,
                        border: '1px solid rgba(245, 0, 87, 0.2)',
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <AccessTimeIcon color="secondary" />
                        <Typography variant="subtitle2" color="secondary" sx={{ fontWeight: 600 }}>
                          End Time
                        </Typography>
                      </Box>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        📅 {new Date(event.endTime).toLocaleDateString('en-US', { 
                          weekday: 'long',
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        🕐 {new Date(event.endTime).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </Typography>
                    </Box>
                  </Grid>
                )}

                {event.location && (
                  <Grid item xs={12}>
                    <Box 
                      sx={{ 
                        p: 2, 
                        bgcolor: 'rgba(76, 175, 80, 0.05)',
                        borderRadius: 2,
                        border: '1px solid rgba(76, 175, 80, 0.2)',
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <LocationOnIcon color="success" />
                        <Typography variant="subtitle2" color="success.main" sx={{ fontWeight: 600 }}>
                          Location
                        </Typography>
                      </Box>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        📍 {event.location}
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Box display="flex" alignItems="center" gap={2}>
                <Avatar 
                  sx={{ 
                    bgcolor: 'secondary.main',
                    width: 40,
                    height: 40,
                  }}
                >
                  {getInitials(event.creator?.name)}
                </Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Organized by
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {event.creator?.name}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                  Group: <strong>{event.group?.name}</strong>
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3, 
                  bgcolor: 'rgba(33, 150, 243, 0.05)',
                  border: '1px solid rgba(33, 150, 243, 0.2)',
                }}
              >
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Event Actions
                </Typography>
                
                <Stack spacing={2}>
                  {!isParticipant && !isFull && (
                    <Button 
                      variant="contained" 
                      fullWidth 
                      size="large"
                      onClick={handleJoin}
                      sx={{
                        background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
                        py: 1.5,
                      }}
                    >
                      Join Event
                    </Button>
                  )}
                  
                  {isParticipant && !isCreator && (
                    <>
                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                        Your Status
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant={isParticipant.status === 'confirmed' ? 'contained' : 'outlined'}
                          color="success"
                          fullWidth
                          startIcon={<CheckCircleIcon />}
                          onClick={() => handleUpdateStatus('confirmed')}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant={isParticipant.status === 'declined' ? 'contained' : 'outlined'}
                          color="error"
                          fullWidth
                          startIcon={<CancelIcon />}
                          onClick={() => handleUpdateStatus('declined')}
                        >
                          Decline
                        </Button>
                      </Stack>
                      <Button 
                        variant="outlined" 
                        color="warning" 
                        fullWidth
                        startIcon={<ScheduleIcon />}
                        onClick={handleMarkLate}
                      >
                        Will be late
                      </Button>
                      <Button 
                        variant="outlined" 
                        color="error" 
                        fullWidth
                        onClick={handleLeave}
                      >
                        Leave Event
                      </Button>
                    </>
                  )}
                  
                  {isCreator && (
                    <Button 
                      variant="outlined" 
                      color="error" 
                      fullWidth
                      onClick={handleDelete}
                    >
                      Delete Event
                    </Button>
                  )}
                  
                  {isFull && !isParticipant && (
                    <Alert severity="warning">
                      <strong>Event Full</strong><br />
                      This event has reached maximum capacity
                    </Alert>
                  )}
                </Stack>

                <Divider sx={{ my: 3 }} />

                <Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Capacity
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {participantCount}
                      {event.maxPlayers && ` / ${event.maxPlayers}`}
                    </Typography>
                  </Box>
                  {event.maxPlayers && (
                    <LinearProgress 
                      variant="determinate" 
                      value={fillPercentage} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          background: fillPercentage >= 100 
                            ? 'linear-gradient(90deg, #f44336 0%, #d32f2f 100%)'
                            : fillPercentage >= 80
                            ? 'linear-gradient(90deg, #ff9800 0%, #f57c00 100%)'
                            : 'linear-gradient(90deg, #4caf50 0%, #388e3c 100%)',
                        }
                      }}
                    />
                  )}
                  
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">
                        ✅ Confirmed
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {confirmedCount}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">
                        ❌ Declined
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {declinedCount}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">
                        ⏳ Pending
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {pendingCount}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Paper>

        {notifications.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Recent Activity
              </Typography>
              <Stack spacing={1}>
                {notifications.slice(0, 5).map(n => (
                  <Alert 
                    key={n.id} 
                    severity={n.type === 'join' ? 'info' : 'warning'}
                    sx={{ py: 0 }}
                  >
                    {n.type === 'join' 
                      ? `Someone joined the event` 
                      : `Someone left the event`}
                  </Alert>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              Participants ({participantCount})
            </Typography>
            {(!event.participants || event.participants.length === 0) ? (
              <Box textAlign="center" py={4}>
                <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5, mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No participants yet. Be the first to join!
                </Typography>
              </Box>
            ) : (
              <List>
                {event.participants.map((participant, idx) => (
                  <React.Fragment key={participant.id}>
                    <ListItem 
                      sx={{ 
                        px: 2,
                        py: 1.5,
                        borderRadius: 2,
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.05)',
                        }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar 
                          sx={{ 
                            bgcolor: getAvatarColor(idx),
                            fontWeight: 600,
                          }}
                        >
                          {getInitials(participant.user?.name)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {participant.user?.name}
                            {participant.userId === event.creatorId && (
                              <Chip 
                                label="Organizer" 
                                size="small" 
                                color="primary"
                                sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Typography>
                        }
                        secondary={participant.user?.email}
                      />
                      <Chip
                        icon={getStatusIcon(participant.status)}
                        label={participant.status}
                        size="small"
                        color={getStatusColor(participant.status)}
                        sx={{ 
                          fontWeight: 600,
                          textTransform: 'capitalize',
                        }}
                      />
                    </ListItem>
                    {idx < event.participants.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
};

export default EventDetails;
