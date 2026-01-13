import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { eventsAPI, groupsAPI } from '../services/api';
import EventForm, { EventFormData } from '../components/common/EventForm';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

const CreateEvent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await groupsAPI.getAll();
        setGroups(response.data);
      } catch (error) {
        setError('Error fetching groups');
      }
    };
    fetchGroups();
  }, []);

  const handleSubmit = async (formData: EventFormData) => {
    setError('');
    setLoading(true);
    try {
      if (!formData.startDate || !formData.startHour) {
        setError('Start date and time required');
        setLoading(false);
        return;
      }
      const startTime = `${formData.startHour.padStart(2, '0')}:${formData.startMinute}`;
      let endTime = null;
      if (formData.endHour) {
        endTime = `${formData.endHour.padStart(2, '0')}:${formData.endMinute}`;
      }
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

      // Build recurrence rule if recurring event
      let recurrenceRule = null;
      if (formData.isRecurring) {
        const pattern = formData.recurrencePattern || 'DAILY';
        const interval = formData.recurrenceInterval || '1';
        
        if (pattern === 'DAILY') {
          recurrenceRule = `FREQ=DAILY;INTERVAL=${interval}`;
        } else if (pattern === 'WEEKLY') {
          const days = formData.recurrenceDays && formData.recurrenceDays.length > 0 
            ? formData.recurrenceDays.join(',') 
            : (() => {
                // Get day abbreviation from start date
                const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
                return dayNames[startDateTime.getDay()];
              })();
          recurrenceRule = `FREQ=WEEKLY;BYDAY=${days};INTERVAL=${interval}`;
        } else if (pattern === 'MONTHLY') {
          const dayOfMonth = startDateTime.getDate();
          recurrenceRule = `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth};INTERVAL=${interval}`;
        }
      }

      const data: {
        startTime: string;
        endTime: string | null;
        maxPlayers: number | null;
        isRecurring: boolean;
        recurrenceRule?: string;
        recurrenceEnd?: string;
        [key: string]: unknown;
      } = {
        ...formData,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime ? endDateTime.toISOString() : null,
        maxPlayers: formData.maxPlayers ? parseInt(formData.maxPlayers) : null,
        isRecurring: formData.isRecurring || false,
      };

      if (formData.isRecurring && recurrenceRule) {
        data.recurrenceRule = recurrenceRule;
        if (formData.recurrenceEnd) {
          data.recurrenceEnd = new Date(formData.recurrenceEnd).toISOString();
        }
      }

      // Remove temporary form fields
      delete data.startDate;
      delete data.startHour;
      delete data.startMinute;
      delete data.endHour;
      delete data.endMinute;
      delete data.recurrencePattern;
      delete data.recurrenceInterval;
      delete data.recurrenceDays;

      const response = await eventsAPI.create(data);
      navigate(`/events/${response.data.id}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to create event');
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
        <EventForm
          groups={groups}
          initialData={{ groupId: location.state?.groupId || '' }}
          loading={loading}
          error={error}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/events')}
          submitLabel="Create"
          showGroupSelect={true}
        />
      </Paper>
    </Container>
  );
};

export default CreateEvent;
