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
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  InputAdornment,
  Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import SortIcon from '@mui/icons-material/Sort';
import { eventsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const EventsList = () => {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date-asc');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchEvents();
  }, []);

  const filterAndSortEvents = useCallback(() => {
    let filtered = [...events];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(event => event.eventType === filterType);
    }

    // Status filter
    if (filterStatus === 'upcoming') {
      filtered = filtered.filter(event => new Date(event.startTime) > new Date());
    } else if (filterStatus === 'past') {
      filtered = filtered.filter(event => new Date(event.startTime) <= new Date());
    } else if (filterStatus === 'joined') {
      filtered = filtered.filter(event =>
        event.participants?.some(p => p.userId === user?.id)
      );
    } else if (filterStatus === 'available') {
      filtered = filtered.filter(event =>
        !event.maxPlayers || event.participants?.length < event.maxPlayers
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return new Date(a.startTime) - new Date(b.startTime);
        case 'date-desc':
          return new Date(b.startTime) - new Date(a.startTime);
        case 'participants-desc':
          return (b.participants?.length || 0) - (a.participants?.length || 0);
        case 'participants-asc':
          return (a.participants?.length || 0) - (b.participants?.length || 0);
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    setFilteredEvents(filtered);
  }, [events, searchTerm, filterType, filterStatus, sortBy, user?.id]);

  useEffect(() => {
    filterAndSortEvents();
  }, [filterAndSortEvents]);

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

  const getEventTypes = () => {
    const types = [...new Set(events.map(e => e.eventType))];
    return types.sort();
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
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={filterType}
                label="Type"
                onChange={(e) => setFilterType(e.target.value)}
                startAdornment={
                  <InputAdornment position="start">
                    <FilterListIcon sx={{ ml: 1 }} />
                  </InputAdornment>
                }
              >
                <MenuItem value="all">All Types</MenuItem>
                {getEventTypes().map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                label="Status"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">All Events</MenuItem>
                <MenuItem value="upcoming">Upcoming</MenuItem>
                <MenuItem value="past">Past</MenuItem>
                <MenuItem value="joined">Joined</MenuItem>
                <MenuItem value="available">Available</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4} md={3}>
            <FormControl fullWidth>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                label="Sort By"
                onChange={(e) => setSortBy(e.target.value)}
                startAdornment={
                  <InputAdornment position="start">
                    <SortIcon sx={{ ml: 1 }} />
                  </InputAdornment>
                }
              >
                <MenuItem value="date-asc">Date (Earliest)</MenuItem>
                <MenuItem value="date-desc">Date (Latest)</MenuItem>
                <MenuItem value="participants-desc">Most Participants</MenuItem>
                <MenuItem value="participants-asc">Least Participants</MenuItem>
                <MenuItem value="title">Title (A-Z)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>

      {filteredEvents.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchTerm || filterType !== 'all' || filterStatus !== 'all' 
              ? 'No events match your filters'
              : 'No events available'}
          </Typography>
          {!searchTerm && filterType === 'all' && filterStatus === 'all' && (
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
          {filteredEvents.map((event) => {
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
