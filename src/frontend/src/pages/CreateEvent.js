import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  MenuItem,
} from '@mui/material';
import { eventsAPI, groupsAPI } from '../services/api';

const EVENT_TYPES = [
  'football',
  'basketball',
  'tennis',
  'volleyball',
  'badminton',
  'cricket',
  'rugby',
  'hockey',
  'baseball',
  'other',
];

const CreateEvent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [formData, setFormData] = useState({
    groupId: location.state?.groupId || '',
    title: '',
    description: '',
    eventType: 'football',
    location: '',
    startTime: '',
    endTime: '',
    maxPlayers: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await groupsAPI.getAll();
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate that events are single-day only
      if (formData.startTime && formData.endTime) {
        const startDate = new Date(formData.startTime);
        const endDate = new Date(formData.endTime);
        
        // Check if they're on the same day
        if (startDate.toDateString() !== endDate.toDateString()) {
          setError('Events must be single-day only. Start and end times must be on the same day.');
          setLoading(false);
          return;
        }
        
        // Check that end time is after start time
        if (endDate <= startDate) {
          setError('End time must be after start time.');
          setLoading(false);
          return;
        }
      }

      const data = {
        ...formData,
        maxPlayers: formData.maxPlayers ? parseInt(formData.maxPlayers) : null,
      };
      const response = await eventsAPI.create(data);
      navigate(`/events/${response.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Create New Event
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            select
            label="Group"
            name="groupId"
            fullWidth
            margin="normal"
            value={formData.groupId}
            onChange={handleChange}
            required
          >
            {groups.map((group) => (
              <MenuItem key={group.id} value={group.id}>
                {group.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Event Title"
            name="title"
            fullWidth
            margin="normal"
            value={formData.title}
            onChange={handleChange}
            required
          />

          <TextField
            label="Description"
            name="description"
            fullWidth
            multiline
            rows={3}
            margin="normal"
            value={formData.description}
            onChange={handleChange}
          />

          <TextField
            select
            label="Event Type"
            name="eventType"
            fullWidth
            margin="normal"
            value={formData.eventType}
            onChange={handleChange}
            required
          >
            {EVENT_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Location"
            name="location"
            fullWidth
            margin="normal"
            value={formData.location}
            onChange={handleChange}
          />

          <TextField
            label="Start Time"
            name="startTime"
            type="datetime-local"
            fullWidth
            margin="normal"
            value={formData.startTime}
            onChange={handleChange}
            InputLabelProps={{ shrink: true }}
            required
          />

          <TextField
            label="End Time"
            name="endTime"
            type="datetime-local"
            fullWidth
            margin="normal"
            value={formData.endTime}
            onChange={handleChange}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Max Players"
            name="maxPlayers"
            type="number"
            fullWidth
            margin="normal"
            value={formData.maxPlayers}
            onChange={handleChange}
            inputProps={{ min: 1 }}
          />

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Event'}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/events')}
            >
              Cancel
            </Button>
          </Box>
        </form>
      </Paper>
    </Container>
  );
};

export default CreateEvent;
