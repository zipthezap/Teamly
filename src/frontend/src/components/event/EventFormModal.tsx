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
  const [endHour, setEndHour] = useState('');
  const [endMinute, setEndMinute] = useState('');
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
      if (initialData.endTime) {
        const endDate = new Date(initialData.endTime);
        setEndHour(endDate.getHours().toString().padStart(2, '0'));
        setEndMinute(endDate.getMinutes().toString().padStart(2, '0'));
      } else {
        setEndHour('');
        setEndMinute('');
      }
    } else {
      setForm({
        title: '', eventType: '', location: '', maxPlayers: '', description: ''
      });
      setHour('');
      setMinute('');
      setEndHour('');
      setEndMinute('');
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

  const handleEndHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndHour(e.target.value);
    if (!endMinute) setEndMinute('00');
  };

  const handleEndMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndMinute(e.target.value);
  };

  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    // Compose startTime and endTime from today + selected hour/minute
    let startTime = '';
    let endTime = '';
    if (hour && minute) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      startTime = `${year}-${month}-${day}T${hour}:${minute}`;
    }
    if (endHour && endMinute) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      endTime = `${year}-${month}-${day}T${endHour}:${endMinute}`;
    }
    // Validation: endTime must be after startTime and same day
    if (startTime && endTime) {
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      if (startDate.toDateString() !== endDate.toDateString()) {
        setFormError('Start and end times must be on the same day.');
        return;
      }
      if (endDate <= startDate) {
        setFormError('End time must be after start time.');
        return;
      }
    }
    mutation.mutate({
      ...form,
      startTime,
      endTime: endTime || undefined,
      maxPlayers: form.maxPlayers ? Number(form.maxPlayers) : undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{initialData ? 'Edit Event' : 'Create Event'}</DialogTitle>
        <DialogContent>
          {formError && (
            <div style={{ color: 'red', marginBottom: 8 }}>{formError}</div>
          )}
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
                  const val = String(i).padStart(2, '0');
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
            {/* End Time (optional) */}
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                select
                label="End Hour (optional)"
                name="endHour"
                value={endHour}
                onChange={handleEndHourChange}
                sx={{ minWidth: 100 }}
              >
                {[...Array(24)].map((_, i) => {
                  const val = String(i).padStart(2, '0');
                  return <MenuItem key={val} value={val}>{val}</MenuItem>;
                })}
              </TextField>
              <TextField
                select
                label="End Minute (optional)"
                name="endMinute"
                value={endMinute}
                onChange={handleEndMinuteChange}
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
