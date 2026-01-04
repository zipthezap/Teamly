import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { eventsAPI } from '../services/api';

const EventsList = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await eventsAPI.getAll();
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">All Events</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/events/new')}
        >
          Create Event
        </Button>
      </Box>

      {events.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No events available
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/events/new')}
            sx={{ mt: 2 }}
          >
            Create Your First Event
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {events.map((event) => (
            <Grid item xs={12} sm={6} md={4} key={event.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', border: 1, borderColor: 'divider', bgcolor: 'background.paper', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 6, bgcolor: 'action.hover' } }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {event.title}
                  </Typography>
                  <Chip label={event.eventType} size="small" sx={{ mb: 1 }} />
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {event.description || 'No description'}
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>Date:</strong> {new Date(event.startTime).toLocaleString()}
                    </Typography>
                    {event.location && (
                      <Typography variant="body2">
                        <strong>Location:</strong> {event.location}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      <strong>Participants:</strong> {event.participants?.length || 0}
                      {event.maxPlayers && ` / ${event.maxPlayers}`}
                    </Typography>
                    {event.participants?.length > 0 && (
                      <Typography variant="body2" color="text.secondary">
                        {event.participants.map((p) => p.user?.name).filter(Boolean).join(', ')}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => navigate(`/events/${event.id}`)}>
                    View Details
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default EventsList;
