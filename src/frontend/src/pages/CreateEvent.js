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
    startDate: '',
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
    const { name, value } = e.target;
    
    // Auto-fill minutes to :00 when hour is selected for time inputs
    if ((name === 'startTime' || name === 'endTime') && value) {
      const timeParts = value.split(':');
      if (timeParts.length === 2) {
        const hour = timeParts[0];
        const minute = timeParts[1];
        // If user just changed the hour (minute is empty or changed from previous)
        // Auto-fill to :00
        if (minute === '' || formData[name] === '') {
          setFormData({
            ...formData,
            [name]: `${hour}:00`,
          });
          return;
        }
      }
    }
    
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleEndTimeBlur = (e) => {
    const value = e.target.value;
    // Ensure end time has proper format (HH:MM)
    // If user enters just hour like "14", convert to "14:00"
    if (value && !value.includes(':')) {
      setFormData({
        ...formData,
        endTime: value.padStart(2, '0') + ':00',
      });
    } else if (value && value.split(':')[1] === '') {
      // If format is "HH:" without minutes, add "00"
      setFormData({
        ...formData,
        endTime: value + '00',
      });
    }
  };

  const handleStartTimeBlur = (e) => {
    const value = e.target.value;
    // Ensure start time has proper format (HH:MM)
    if (value && !value.includes(':')) {
      setFormData({
        ...formData,
        startTime: value.padStart(2, '0') + ':00',
      });
    } else if (value && value.split(':')[1] === '') {
      setFormData({
        ...formData,
        startTime: value + '00',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.startDate || !formData.startTime) {
        setError('Start date and time are required.');
        setLoading(false);
        return;
      }

      // Combine date and time for startTime
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
      
      let endDateTime = null;
      if (formData.endTime) {
        // Use the same date for end time (same day event)
        endDateTime = new Date(`${formData.startDate}T${formData.endTime}`);
        
        // Check that end time is after start time
        if (endDateTime <= startDateTime) {
          setError('End time must be after start time.');
          setLoading(false);
          return;
        }
      }

      const data = {
        ...formData,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime ? endDateTime.toISOString() : null,
        maxPlayers: formData.maxPlayers ? parseInt(formData.maxPlayers) : null,
      };
      
      // Remove the separate date/time fields
      delete data.startDate;
      
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
            label="Event Date"
            name="startDate"
            type="date"
            fullWidth
            margin="normal"
            value={formData.startDate}
            onChange={handleChange}
            InputLabelProps={{ shrink: true }}
            required
          />

          <TextField
            label="Start Time"
            name="startTime"
            type="time"
            fullWidth
            margin="normal"
            value={formData.startTime}
            onChange={handleChange}
            onBlur={handleStartTimeBlur}
            InputLabelProps={{ shrink: true }}
            inputProps={{ 
              step: 900, // 15 minutes in seconds
            }}
            required
          />

          <TextField
            label="End Time (optional)"
            name="endTime"
            type="time"
            fullWidth
            margin="normal"
            value={formData.endTime}
            onChange={handleChange}
            onBlur={handleEndTimeBlur}
            InputLabelProps={{ shrink: true }}
            inputProps={{ 
              step: 900, // 15 minutes in seconds
            }}
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
