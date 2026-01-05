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
    startMinute: '',
    endHour: '',
    endMinute: '',
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
    if (name === 'startHour') {
      setFormData(prev => ({
        ...prev,
        startHour: value,
        startMinute: prev.startMinute || '00',
      }));
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  // Helper to build time string from hour/minute
  const buildTime = (hour, minute) => {
    if (!hour || !minute) return '';
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.startDate || !formData.startHour || !formData.startMinute) {
        setError('Start date and time are required.');
        setLoading(false);
        return;
      }

      const startTimeStr = buildTime(formData.startHour, formData.startMinute);
      const startDateTime = new Date(`${formData.startDate}T${startTimeStr}`);

      let endDateTime = null;
      if (formData.endHour && formData.endMinute) {
        const endTimeStr = buildTime(formData.endHour, formData.endMinute);
        endDateTime = new Date(`${formData.startDate}T${endTimeStr}`);
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

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              select
              label="Start Hour"
              name="startHour"
              value={formData.startHour}
              onChange={handleChange}
              required
              sx={{ flex: 1 }}
              InputLabelProps={{ shrink: true }}
            >
              {[...Array(24)].map((_, i) => (
                <MenuItem key={i+1} value={String(i+1).padStart(2, '0')}>
                  {i+1}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Start Minute"
              name="startMinute"
              value={formData.startMinute}
              onChange={handleChange}
              required
              sx={{ flex: 1 }}
              InputLabelProps={{ shrink: true }}
            >
              {['00', '15', '30', '45'].map((m) => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              select
              label="End Hour (optional)"
              name="endHour"
              value={formData.endHour}
              onChange={handleChange}
              sx={{ flex: 1 }}
              InputLabelProps={{ shrink: true }}
            >
              <MenuItem value="">--</MenuItem>
              {[...Array(24)].map((_, i) => (
                <MenuItem key={i+1} value={String(i+1).padStart(2, '0')}>
                  {i+1}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="End Minute (optional)"
              name="endMinute"
              value={formData.endMinute}
              onChange={handleChange}
              sx={{ flex: 1 }}
              InputLabelProps={{ shrink: true }}
            >
              <MenuItem value="">--</MenuItem>
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
