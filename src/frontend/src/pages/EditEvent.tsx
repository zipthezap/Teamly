import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import { eventsAPI } from '../services/api';
import { getErrorMessage } from '../utils/errorHandler';
import { useQueryClient } from '@tanstack/react-query';

const EVENT_TYPES = [
  'football',
  'basketball',
  'cricket',
  'americanFootball',
  'iceHockey',
  'baseball',
  'volleyball',
  'rugby',
  'handball',
  'fieldHockey',
  'tennis',
  'running',
  'cycling',
  'swimming',
  'other',
];

const EditEvent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [groupId, setGroupId] = useState<string | number | null>(null);
  const [formData, setFormData] = useState({
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
  const [submitting, setSubmitting] = useState(false);

  const fetchEvent = useCallback(async () => {
    if (!id) {
      setError('Event ID is required');
      setLoading(false);
      return;
    }
    
    try {
      const response = await eventsAPI.getById(id);
      const event = response.data;
      
      // Parse the event data to populate the form
      const startTime = new Date(event.startTime);
      const startDate = startTime.toISOString().split('T')[0];
      const startHour = startTime.getHours().toString().padStart(2, '0');
      const startMinute = startTime.getMinutes().toString().padStart(2, '0');
      
      let endHour = '';
      let endMinute = '00';
      if (event.endTime) {
        const endTime = new Date(event.endTime);
        endHour = endTime.getHours().toString().padStart(2, '0');
        endMinute = endTime.getMinutes().toString().padStart(2, '0');
      }
      
      setFormData({
        title: event.title || '',
        description: event.description || '',
        eventType: event.eventType || 'football',
        location: event.location || '',
        startDate,
        startHour,
        startMinute,
        endHour,
        endMinute,
        maxPlayers: event.maxPlayers?.toString() || '',
      });
      
      // Store groupId for cache invalidation
      if (event.groupId) {
        setGroupId(event.groupId);
      }
    } catch {
      setError('Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [id, fetchEvent]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleHourChange = (name: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (name === 'endHour') {
      setFormData({
        ...formData,
        [name]: e.target.value,
        endMinute: '00',
      });
    } else {
      setFormData({
        ...formData,
        [name]: e.target.value,
      });
    }
  };

  const handleMinuteChange = (name: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Validate required fields
      if (!formData.startDate || !formData.startHour) {
        setError('Start date and time are required.');
        setSubmitting(false);
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
          setSubmitting(false);
          return;
        }
      }

      const data = {
        title: formData.title,
        description: formData.description,
        eventType: formData.eventType,
        location: formData.location,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime ? endDateTime.toISOString() : undefined,
        maxPlayers: formData.maxPlayers ? parseInt(formData.maxPlayers) : undefined,
      };

      if (!id) {
        setError('Event ID is required');
        setSubmitting(false);
        return;
      }

      await eventsAPI.update(id, data);
      
      // Invalidate caches so the updated event is reflected
      queryClient.invalidateQueries({ queryKey: ['eventDetails', id] });
      queryClient.invalidateQueries({ queryKey: ['eventsList'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      // Invalidate group events if this event belongs to a group
      if (groupId) {
        queryClient.invalidateQueries({ queryKey: ['groupEvents', groupId] });
        // Invalidate groupsList to update event counts displayed for groups
        queryClient.invalidateQueries({ queryKey: ['groupsList'] });
      }
      
      navigate(`/events/${id}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to update event');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress size={60} thickness={4} />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 3, md: 4 }, px: { xs: 2, sm: 3 } }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' } }}>
          Edit Event
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            label="Event Title"
            name="title"
            fullWidth
            margin="normal"
            value={formData.title}
            onChange={handleChange}
            required
            sx={{ '& .MuiInputBase-root': { minHeight: '44px' } }}
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
            sx={{ '& .MuiInputBase-root': { minHeight: '44px' } }}
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
            sx={{ '& .MuiInputBase-root': { minHeight: '44px' } }}
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
            sx={{ '& .MuiInputBase-root': { minHeight: '44px' } }}
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
            sx={{ '& .MuiInputBase-root': { minHeight: '44px' } }}
          />

          <Box sx={{ mt: 2 }}>
            <Typography sx={{ mb: 1 }}>Start Time</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
              <TextField
                select
                label="Hour"
                name="startHour"
                value={formData.startHour}
                onChange={handleHourChange('startHour')}
                required
                sx={{ width: { xs: 'calc(50% - 8px)', sm: 100 }, minHeight: '44px' }}
              >
                {[...Array(24)].map((_, i) => (
                  <MenuItem key={i} value={i.toString().padStart(2, '0')}>
                    {i.toString().padStart(2, '0')}
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
                sx={{ width: { xs: 'calc(50% - 8px)', sm: 100 }, minHeight: '44px' }}
              >
                {['00', '15', '30', '45'].map((m) => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography sx={{ mb: 1 }}>End Time (optional)</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
              <TextField
                select
                label="Hour"
                name="endHour"
                value={formData.endHour}
                onChange={handleHourChange('endHour')}
                sx={{ width: { xs: 'calc(50% - 8px)', sm: 100 }, minHeight: '44px' }}
              >
                <MenuItem value="">--</MenuItem>
                {[...Array(24)].map((_, i) => (
                  <MenuItem key={i} value={i.toString().padStart(2, '0')}>
                    {i.toString().padStart(2, '0')}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Minute"
                name="endMinute"
                value={formData.endMinute}
                onChange={handleMinuteChange('endMinute')}
                sx={{ width: { xs: 'calc(50% - 8px)', sm: 100 }, minHeight: '44px' }}
              >
                {['00', '15', '30', '45'].map((m) => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </TextField>
            </Box>
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
            sx={{ '& .MuiInputBase-root': { minHeight: '44px' } }}
          />

          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            justifyContent: { sm: 'flex-end' },
            gap: { xs: 1.5, sm: 2 },
            mt: 3
          }}>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate(`/events/${id}`)}
              fullWidth={{ xs: true, sm: false } as any}
              sx={{ minHeight: '44px', px: { xs: 2, sm: 3 } }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting}
              fullWidth={{ xs: true, sm: false } as any}
              sx={{ minHeight: '44px', px: { xs: 2, sm: 3 } }}
            >
              {submitting ? 'Updating...' : 'Update Event'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Container>
  );
};

export default EditEvent;
