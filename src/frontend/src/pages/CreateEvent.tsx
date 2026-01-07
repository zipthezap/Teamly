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
      const data = {
        ...formData,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime ? endDateTime.toISOString() : null,
        maxPlayers: formData.maxPlayers ? parseInt(formData.maxPlayers) : null,
      };
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
