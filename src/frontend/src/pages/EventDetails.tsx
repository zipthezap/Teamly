import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Box,
  CircularProgress,
  Grid,
  Alert,
  Stack,
  LinearProgress,
  Avatar,
  Divider,
  Typography,
} from '@mui/material';
import { eventsAPI, groupChatAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  EventInformation,
  ParticipantsList,
  EventActions,
  EventActivityFeed,
} from '../components/event';

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
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);

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

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleJoin = async () => {
    setError('');
    setSuccess('');
    try {
      await eventsAPI.join(id);
      setSuccess('Successfully joined the event');
      fetchEvent();
    } catch (err: any) {
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to leave event');
    }
  };

  const handleUpdateStatus = async (status: string) => {
    setError('');
    setSuccess('');
    try {
      await eventsAPI.updateStatus(id, status);
      setSuccess(`Status updated to ${status}`);
      fetchEvent();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    
    try {
      await eventsAPI.delete(id);
      navigate('/events');
    } catch (err: any) {
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

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isParticipant = event?.participants?.find((p: any) => p.userId === user?.id);
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
  const confirmedCount = event.participants?.filter((p: any) => p.status === 'confirmed').length || 0;
  const declinedCount = event.participants?.filter((p: any) => p.status === 'declined').length || 0;
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
            {/* Left Column: Event Information */}
            <Grid item xs={12} md={8}>
              <Stack spacing={3}>
                <EventInformation
                  event={event}
                  isParticipant={!!isParticipant}
                  isCreator={isCreator}
                  isFull={isFull}
                />

                <Divider />

                {/* Organizer Info */}
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
              </Stack>
            </Grid>

            {/* Right Column: Event Actions and Activity */}
            <Grid item xs={12} md={4}>
              <Stack spacing={3}>
                {/* Capacity Progress */}
                {event.maxPlayers && (
                  <Paper elevation={2} sx={{ p: 2.5 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                      Event Capacity
                    </Typography>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {participantCount} / {event.maxPlayers} participants
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={fillPercentage} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 5,
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                      }}
                    />
                    <Box display="flex" gap={2} mt={2}>
                      <Typography variant="caption" color="text.secondary">
                        ✅ {confirmedCount} confirmed
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ❌ {declinedCount} declined
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ⏳ {pendingCount} pending
                      </Typography>
                    </Box>
                  </Paper>
                )}

                {/* Event Actions */}
                <Paper elevation={2} sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                    Event Actions
                  </Typography>
                  <EventActions
                    event={event}
                    isParticipant={!!isParticipant}
                    isCreator={isCreator}
                    isFull={isFull}
                    onJoin={handleJoin}
                    onLeave={handleLeave}
                    onUpdateStatus={handleUpdateStatus}
                    onDelete={handleDelete}
                    onMarkLate={handleMarkLate}
                  />
                </Paper>

                {/* Activity Feed */}
                <EventActivityFeed
                  event={event}
                  activityDialogOpen={activityDialogOpen}
                  onOpenDialog={() => setActivityDialogOpen(true)}
                  onCloseDialog={() => setActivityDialogOpen(false)}
                />
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* Participants List */}
        <ParticipantsList event={event} participantCount={participantCount} />
      </Stack>
    </Container>
  );
};

export default EventDetails;
