import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Chip,
  Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { eventsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import EventSearchFilters from '../components/event/EventSearchFilters';

const EventsList = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilters, setSearchFilters] = useState({});
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchEvents();
  }, [searchFilters]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await eventsAPI.getAll(searchFilters);
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (filters: any) => {
    setSearchFilters(filters);
  };

  const getEventStatus = (event) => {
    const now = new Date();
    const eventDate = new Date(event.startTime);
    const isFull = event.maxPlayers && event.participants?.length >= event.maxPlayers;
    const isJoined = event.participants?.some(p => p.userId === user?.id);

    if (eventDate < now) return { label: 'Past', color: 'default' };
    if (isFull) return { label: 'Full', color: 'warning' };
    if (isJoined) return { label: 'Joined', color: 'success' };
    return { label: 'Open', color: 'primary' };
  };

  // Utility to format time in 24h and round minutes to nearest 15
  function formatEventTime(dateString) {
    const date = new Date(dateString);
    let hour = date.getHours();
    let minute = date.getMinutes();
    // Round to nearest 15
    minute = Math.round(minute / 15) * 15;
    if (minute === 60) {
      minute = 0;
      hour = (hour + 1) % 24;
    }
    // Pad with zeros
    const hourStr = hour.toString().padStart(2, '0');
    const minuteStr = minute.toString().padStart(2, '0');
    return `${hourStr}:${minuteStr}`;
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress size={60} thickness={4} />
      </Box>
    );
  }

  // If you want to filter events further, do it here. For now, filteredEvents = events
  const filteredEvents = events;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            All Events
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} found
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/events/new')}
          sx={{ 
            background: 'linear-gradient(135deg, #f50057 0%, #c51162 100%)',
            boxShadow: '0 4px 12px rgba(245, 0, 87, 0.4)',
          }}
        >
          Create Event
        </Button>
      </Box>

      {/* Filters and Search */}
      <EventSearchFilters onSearch={handleSearch} />

      {events.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {Object.keys(searchFilters).length > 0 
              ? 'No events match your filters'
              : 'No events available'}
          </Typography>
          {Object.keys(searchFilters).length === 0 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/events/new')}
              sx={{ mt: 2 }}
            >
              Create Your First Event
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={3}>
          {events.map((event: any) => {
            const status = getEventStatus(event);
            const participantCount = event.participants?.length || 0;
            const spotsLeft = event.maxPlayers ? event.maxPlayers - participantCount : null;
            
            return (
              <Grid item xs={12} sm={6} md={4} key={event.id}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    position: 'relative',
                    overflow: 'visible',
                  }}
                >
                  <Box 
                    sx={{ 
                      position: 'absolute', 
                      top: 12, 
                      right: 12, 
                      zIndex: 1,
                    }}
                  >
                    <Chip 
                      label={status.label} 
                      color={status.color}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                  
                  <CardContent sx={{ flexGrow: 1, pt: 3 }}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, pr: 8 }}>
                          {event.title}
                        </Typography>
                        <Chip 
                          label={event.eventType} 
                          size="small" 
                          color="secondary"
                          sx={{ mb: 1 }}
                        />
                      </Box>
                      
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          minHeight: 40,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {event.description || 'No description'}
                      </Typography>
                      
                      <Box>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          📅 {new Date(event.startTime).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          🕐 {formatEventTime(event.startTime)}
                        </Typography>
                        {event.location && (
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              mb: 0.5,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            📍 {event.location}
                          </Typography>
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          👥 {participantCount}
                          {event.maxPlayers && ` / ${event.maxPlayers}`} participants
                        </Typography>
                        {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 3 && (
                          <Chip 
                            label={`${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
                            size="small"
                            color="warning"
                            sx={{ mt: 1, fontWeight: 600 }}
                          />
                        )}
                      </Box>
                    </Stack>
                  </CardContent>
                  
                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Button 
                      size="small" 
                      variant="contained"
                      onClick={() => navigate(`/events/${event.id}`)}
                      fullWidth
                    >
                      View Details
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Container>
  );
};

export default EventsList;
