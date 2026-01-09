import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, MenuItem, Paper, TextField, Typography, Alert, Container, FormControlLabel, Switch } from '@mui/material';

export interface EventFormData {
  groupId?: string;
  title: string;
  description: string;
  eventType: string;
  location: string;
  startDate?: string;
  startHour?: string;
  startMinute?: string;
  endHour?: string;
  endMinute?: string;
  maxPlayers?: string;
  startTime?: string;
  endTime?: string;
  isPublic?: boolean;
}

export interface EventFormProps {
  groups?: Array<{ id: string; name: string }>;
  initialData?: Partial<EventFormData>;
  loading?: boolean;
  error?: string;
  onSubmit: (data: EventFormData) => void;
  onCancel?: () => void;
  submitLabel?: string;
  showGroupSelect?: boolean;
}

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

const EventForm: React.FC<EventFormProps> = ({
  groups = [],
  initialData = {},
  loading = false,
  error = '',
  onSubmit,
  onCancel,
  submitLabel = 'Create',
  showGroupSelect = true,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<EventFormData>({
    groupId: initialData.groupId || '',
    title: initialData.title || '',
    description: initialData.description || '',
    eventType: initialData.eventType || 'football',
    location: initialData.location || '',
    startDate: initialData.startDate || '',
    startHour: initialData.startHour || '',
    startMinute: initialData.startMinute || '00',
    endHour: initialData.endHour || '',
    endMinute: initialData.endMinute || '00',
    maxPlayers: initialData.maxPlayers || '',
    isPublic: initialData.isPublic || false,
  });

  const [localError, setLocalError] = useState<string>('');

  useEffect(() => {
    setFormData((prev) => ({ ...prev, ...initialData }));
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, isPublic: e.target.checked });
  };

  const handleHourChange = (name: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [name]: e.target.value });
  };
  const handleMinuteChange = (name: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Require groupId
    let groupId = formData.groupId;
    if ((!groupId || groupId === '') && groups && groups.length > 0) {
      groupId = groups[0].id;
    }
    if (!groupId) {
      setLocalError('Please select a group.');
      return;
    }
    // Require date field
    if (!formData.startDate) {
      setLocalError('Event date is required.');
      return;
    }
    // Require time field
    if (!formData.startHour || !formData.startMinute) {
      setLocalError('Event start time is required.');
      return;
    }
    // Validate start time is in the future
    const startDateTime = new Date(`${formData.startDate}T${formData.startHour.padStart(2, '0')}:${formData.startMinute}`);
    if (startDateTime <= new Date()) {
      setLocalError('Event start time must be in the future.');
      return;
    }
    setLocalError('');
    onSubmit({ ...formData, groupId });
  };

  return (
    <form onSubmit={handleSubmit}>
      {groups && groups.length > 0 && (
        <TextField
          select
          label={t('events.group')}
          name="groupId"
          fullWidth
          margin="normal"
          value={formData.groupId}
          onChange={handleChange}
          required
          // Only disable if we are in a group context (editing/creating from a group page)
          disabled={!!initialData.groupId && groups.length === 1}
        >
          {groups.map((group) => (
            <MenuItem key={group.id} value={group.id}>
              {group.name}
            </MenuItem>
          ))}
        </TextField>
      )}
      <TextField
        label={t('events.eventTitle')}
        name="title"
        fullWidth
        margin="normal"
        value={formData.title}
        onChange={handleChange}
        required
      />
      <TextField
        label={t('events.description')}
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
        label={t('events.eventType')}
        name="eventType"
        fullWidth
        margin="normal"
        value={formData.eventType}
        onChange={handleChange}
        required
      >
        {EVENT_TYPES.map((type) => (
          <MenuItem key={type} value={type}>
            {t(`events.types.${type}`)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label={t('events.location')}
        name="location"
        fullWidth
        margin="normal"
        value={formData.location}
        onChange={handleChange}
      />
      <TextField
        label={t('events.eventDate')}
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
        <Typography>{t('events.startTime')}</Typography>
        <TextField
          select
          label={t('events.hour')}
          name="startHour"
          value={formData.startHour}
          onChange={handleHourChange('startHour')}
          required
          sx={{ width: 100 }}
        >
          {[...Array(24)].map((_, i) => (
            <MenuItem key={i} value={i.toString().padStart(2, '0')}>
              {i.toString().padStart(2, '0')}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={t('events.minute')}
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
        <Typography>{t('events.endTimeOptional')}</Typography>
        <TextField
          select
          label={t('events.hour')}
          name="endHour"
          value={formData.endHour}
          onChange={handleHourChange('endHour')}
          sx={{ width: 100 }}
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
          label={t('events.minute')}
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
        label={t('events.maxPlayers')}
        name="maxPlayers"
        type="number"
        fullWidth
        margin="normal"
        value={formData.maxPlayers}
        onChange={handleChange}
        inputProps={{ min: 1 }}
      />
      <Box sx={{ mt: 2, mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={formData.isPublic}
              onChange={handleSwitchChange}
              color="primary"
            />
          }
          label={
            <Box>
              <Typography variant="body1">
                {formData.isPublic ? 'Public Event' : 'Private Event'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formData.isPublic 
                  ? 'Anyone with the invite link can join, even without an account'
                  : 'Only group members can join this event'}
              </Typography>
            </Box>
          }
        />
      </Box>
      {(error || localError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {localError || error}
        </Alert>
      )}
      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading}
        >
          {loading ? t('events.submitting') : submitLabel}
        </Button>
        {onCancel && (
          <Button
            variant="outlined"
            size="large"
            onClick={onCancel}
          >
            {t('common.cancel')}
          </Button>
        )}
      </Box>
    </form>
  );
};

export default EventForm;
