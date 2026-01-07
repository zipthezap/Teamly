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
    maxPlayers: '',
    description: '',
  });
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title || '',
        eventType: initialData.eventType || '',
        location: initialData.location || '',
        maxPlayers: initialData.maxPlayers || '',
        description: initialData.description || '',
      });
      if (initialData.startTime) {
        const date = new Date(initialData.startTime);
        setHour(date.getHours().toString().padStart(2, '0'));
        setMinute(date.getMinutes().toString().padStart(2, '0'));
      } else {
        setHour('');
        setMinute('');
      }
    } else {
      setForm({
        title: '', eventType: '', location: '', maxPlayers: '', description: ''
      });
      setHour('');
      setMinute('');
    }
  }, [initialData, open]);

  const mutation = useMutation({
    mutationFn: (data: any) =>
      initialData && initialData.id
        ? eventsAPI.update(initialData.id, data)
        : eventsAPI.create({ ...data, groupId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['groupEvents'] });
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHour(e.target.value);
    if (!minute) setMinute('00');
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMinute(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Compose startTime from today + selected hour/minute
    let startTime = '';
    if (hour && minute) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      startTime = `${year}-${month}-${day}T${hour}:${minute}`;
    }
    mutation.mutate({
      ...form,
      startTime,
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
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                select
                label="Hour"
                name="hour"
                value={hour}
                onChange={handleHourChange}
                required
                sx={{ minWidth: 100 }}
              >
                {[...Array(24)].map((_, i) => {
                  const val = String(i + 1).padStart(2, '0');
                  return <MenuItem key={val} value={val}>{val}</MenuItem>;
                })}
              </TextField>
              <TextField
                select
                label="Minute"
                name="minute"
                value={minute}
                onChange={handleMinuteChange}
                required
                sx={{ minWidth: 100 }}
              >
                {['00', '15', '30', '45'].map((m) => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </TextField>
            </Stack>
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
          <Button type="submit" variant="contained" color="primary" disabled={mutation.isPending}>
            {initialData ? 'Save Changes' : 'Create Event'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default EventFormModal;
