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
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PeopleIcon from '@mui/icons-material/People';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { eventsAPI, groupChatAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

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
      await eventsAPI.markLate(id);
      setLateSuccess('Marked as late.');
      fetchEvent();
    } catch (err) {
      setLateError('Failed to mark as late');
    }
  };

  const isParticipant = event?.participants?.find((p) => p.userId === user?.id);
  const isCreator = event?.creatorId === user?.id;
  const isFull = event?.maxPlayers && event?.participants?.length >= event?.maxPlayers;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
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

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {lateSuccess && <Alert severity="success">{lateSuccess}</Alert>}
      {lateError && <Alert severity="error">{lateError}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="start">
          <Box sx={{ flexGrow: 1 }}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Typography variant="h4">{event.title}</Typography>
              <Chip label={event.eventType} color="primary" />
            </Box>
            
            <Typography variant="body1" paragraph>
              {event.description || 'No description provided'}
            </Typography>

            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <AccessTimeIcon color="action" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Start Time
                    </Typography>
                    <Typography variant="body1">
                      {new Date(event.startTime).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              {event.endTime && (
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <AccessTimeIcon color="action" />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        End Time
                      </Typography>
                      <Typography variant="body1">
                        {new Date(event.endTime).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              )}

              {event.location && (
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <LocationOnIcon color="action" />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Location
                      </Typography>
                      <Typography variant="body1">{event.location}</Typography>
                    </Box>
                  </Box>
                </Grid>
              )}

              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <PeopleIcon color="action" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Participants
                    </Typography>
                    <Typography variant="body1">
                      {event.participants?.length || 0}
                      {event.maxPlayers && ` / ${event.maxPlayers}`}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="caption" color="text.secondary">
              Created by {event.creator?.name} • Group: {event.group?.name}
            </Typography>
          </Box>

          <Box display="flex" flexDirection="column" gap={1}>
            {!isParticipant && !isFull && (
              <Button variant="contained" onClick={handleJoin}>
                Join Event
              </Button>
            )}
            {isParticipant && !isCreator && (
              <>
                <Button variant="outlined" color="error" onClick={handleLeave}>
                  Leave Event
                </Button>
                <Button
                  variant={isParticipant.status === 'confirmed' ? 'contained' : 'outlined'}
                  onClick={() => handleUpdateStatus('confirmed')}
                >
                  Confirm
                </Button>
                <Button
                  variant={isParticipant.status === 'declined' ? 'contained' : 'outlined'}
                  onClick={() => handleUpdateStatus('declined')}
                >
                  Decline
                </Button>
              </>
            )}
            {isCreator && (
              <Button variant="outlined" color="error" onClick={handleDelete}>
                Delete Event
              </Button>
            )}
            {isFull && !isParticipant && (
              <Chip label="Event Full" color="error" />
            )}
            {user && event && event.participants?.some(p => p.userId === user.id) && (
              <Button variant="outlined" color="warning" onClick={handleMarkLate} sx={{ ml: 2 }}>
                Will be late
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      <Box sx={{ mb: 2 }}>
        <Typography variant="h6">Notifications</Typography>
        {notifications.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No notifications.</Typography>
        ) : (
          notifications.map(n => (
            <Alert key={n.id} severity={n.type === 'join' ? 'info' : 'warning'} sx={{ mb: 1 }}>
              {n.type === 'join' ? `${n.userId} joined the event.` : `${n.userId} left the event.`}
            </Alert>
          ))
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Participants ({event.participants?.length || 0})
              </Typography>
              <List>
                {event.participants?.map((participant) => (
                  <ListItem key={participant.id}>
                    <ListItemText
                      primary={participant.user?.name}
                      secondary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <span>{participant.user?.email}</span>
                          <Chip
                            label={participant.status}
                            size="small"
                            color={
                              participant.status === 'confirmed'
                                ? 'success'
                                : participant.status === 'declined'
                                ? 'error'
                                : 'default'
                            }
                          />
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
                {(!event.participants || event.participants.length === 0) && (
                  <ListItem>
                    <ListItemText secondary="No participants yet" />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default EventDetails;
