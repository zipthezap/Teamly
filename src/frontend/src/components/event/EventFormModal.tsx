import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Stack } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsAPI } from '../../services/api';

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: any;
  groupId?: string | number;
  onSuccess?: () => void;
}

const EVENT_TYPES = [
  'Football',
  'Basketball',
  'Tennis',
  'Volleyball',
  'Other',
];

const EventFormModal: React.FC<EventFormModalProps> = ({ open, onClose, initialData, groupId, onSuccess }) => {
  const [form, setForm] = useState({
    title: '',
    eventType: '',
    location: '',
    startTime: '',
    maxPlayers: '',
    description: '',
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title || '',
        eventType: initialData.eventType || '',
        location: initialData.location || '',
        startTime: initialData.startTime ? initialData.startTime.slice(0, 16) : '',
        maxPlayers: initialData.maxPlayers || '',
        description: initialData.description || '',
      });
    } else {
      setForm({
        title: '', eventType: '', location: '', startTime: '', maxPlayers: '', description: ''
      });
    }
  }, [initialData, open]);

  const mutation = useMutation(
    (data: any) =>
      initialData && initialData.id
        ? eventsAPI.update(initialData.id, data)
        : eventsAPI.create({ ...data, groupId }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['events']);
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      },
    }
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...form,
      maxPlayers: form.maxPlayers ? Number(form.maxPlayers) : undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{initialData ? 'Edit Event' : 'Create Event'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Title"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              fullWidth
            />
            <TextField
              select
              label="Event Type"
              name="eventType"
              value={form.eventType}
              onChange={handleChange}
              required
              fullWidth
            >
              {EVENT_TYPES.map((type) => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Location"
              name="location"
              value={form.location}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              label="Start Time"
              name="startTime"
              type="datetime-local"
              value={form.startTime}
              onChange={handleChange}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Max Players"
              name="maxPlayers"
              type="number"
              value={form.maxPlayers}
              onChange={handleChange}
              fullWidth
              inputProps={{ min: 1 }}
            />
            <TextField
              label="Description"
              name="description"
              value={form.description}
              onChange={handleChange}
              multiline
              rows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="secondary">Cancel</Button>
          <Button type="submit" variant="contained" color="primary" disabled={mutation.isLoading}>
            {initialData ? 'Save Changes' : 'Create Event'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default EventFormModal;
