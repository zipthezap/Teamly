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
    startHour: '',
    startMinute: '00',
    endHour: '',
    endMinute: '00',
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
    
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Dropdown handlers for hour/minute
  const handleHourChange = (name) => (e) => {
    if (name === 'endHour') {
      setFormData({
        ...formData,
        [name]: e.target.value,
        endMinute: '00', // Only autofill for endHour
      });
    } else {
      setFormData({
        ...formData,
        [name]: e.target.value,
      });
    }
  };
  const handleMinuteChange = (name) => (e) => {
    setFormData({
      ...formData,
      [name]: e.target.value,
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
      if (!formData.startDate || !formData.startHour) {
        setError('Start date and time are required.');
        setLoading(false);
        return;
      }

      // Compose time strings
      const startTime = `${formData.startHour.padStart(2, '0')}:${formData.startMinute}`;
      let endTime = null;
      if (formData.endHour) {
        endTime = `${formData.endHour.padStart(2, '0')}:${formData.endMinute}`;
      }

      // Combine date and time for startTime
      const startDateTime = new Date(`${formData.startDate}T${startTime}`);
      let endDateTime = null;
      if (endTime) {
        endDateTime = new Date(`${formData.startDate}T${endTime}`);
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
      delete data.startHour;
      delete data.startMinute;
      delete data.endHour;
      delete data.endMinute;
      
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


          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 2 }}>
            <Typography>Start Time</Typography>
            <TextField
              select
              label="Hour"
              name="startHour"
              value={formData.startHour}
              onChange={handleHourChange('startHour')}
              required
              sx={{ width: 100 }}
            >
              {[...Array(24)].map((_, i) => (
                <MenuItem key={i+1} value={(i+1).toString().padStart(2, '0')}>
                  {(i+1).toString().padStart(2, '0')}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Minute"
              name="startMinute"
              value={formData.startMinute}
              onChange={handleMinuteChange('startMinute')}
              required
              sx={{ width: 100 }}
            >
              {['00', '15', '30', '45'].map((m) => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 2 }}>
            <Typography>End Time (optional)</Typography>
            <TextField
              select
              label="Hour"
              name="endHour"
              value={formData.endHour}
              onChange={handleHourChange('endHour')}
              sx={{ width: 100 }}
            >
              <MenuItem value="">--</MenuItem>
              {[...Array(24)].map((_, i) => (
                <MenuItem key={i+1} value={(i+1).toString().padStart(2, '0')}>
                  {(i+1).toString().padStart(2, '0')}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Minute"
              name="endMinute"
              value={formData.endMinute}
              onChange={handleMinuteChange('endMinute')}
              sx={{ width: 100 }}
            >
              {['00', '15', '30', '45'].map((m) => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </TextField>
          </Box>

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
