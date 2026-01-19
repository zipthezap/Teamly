import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, MenuItem, Paper, TextField, Typography, Alert, FormControlLabel, Switch } from '@mui/material';
import LocationAutocomplete from './LocationAutocomplete';
import { SportType } from '../../../../shared/types/event.types';

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
  isRecurring?: boolean;
  recurrencePattern?: string;
  recurrenceInterval?: string;
  recurrenceDays?: string[];
  recurrenceEnd?: string;
  recurrenceRule?: string;
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

const EVENT_TYPES = Object.values(SportType);

const EventForm: React.FC<EventFormProps> = ({
  groups = [],
  initialData = {},
  loading = false,
  error = '',
  onSubmit,
  onCancel,
  submitLabel = 'Create',
  showGroupSelect: _showGroupSelect = true,
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
    isRecurring: initialData.isRecurring || false,
    recurrencePattern: initialData.recurrencePattern || 'DAILY',
    recurrenceInterval: initialData.recurrenceInterval || '1',
    recurrenceDays: initialData.recurrenceDays || [],
    recurrenceEnd: initialData.recurrenceEnd || '',
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
          disabled={!!initialData.groupId && groups.length === 1}
          sx={{ '& .MuiInputBase-root': { minHeight: '44px' } }}
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
        sx={{ '& .MuiInputBase-root': { minHeight: '44px' } }}
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
        sx={{ '& .MuiInputBase-root': { minHeight: '44px' } }}
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
        sx={{ '& .MuiInputBase-root': { minHeight: '44px' } }}
      >
        {EVENT_TYPES.map((type) => (
          <MenuItem key={type} value={type}>
            {t(`events.types.${type}`)}
          </MenuItem>
        ))}
      </TextField>
      <LocationAutocomplete
        value={formData.location}
        onChange={(value) => handleChange({ target: { name: 'location', value } } as React.ChangeEvent<HTMLInputElement>)}
        label={t('events.location')}
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
        sx={{ '& .MuiInputBase-root': { minHeight: '44px' } }}
      />
      <Box sx={{ mt: 2 }}>
        <Typography sx={{ mb: 1 }}>{t('events.startTime')}</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
          <TextField
            select
            label={t('events.hour')}
            name="startHour"
            value={formData.startHour}
            onChange={handleHourChange('startHour')}
            required
            sx={{ width: { xs: 'calc(50% - 8px)', sm: 100 }, '& .MuiInputBase-root': { minHeight: '44px' } }}
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
            sx={{ width: { xs: 'calc(50% - 8px)', sm: 100 }, '& .MuiInputBase-root': { minHeight: '44px' } }}
          >
            {['00', '15', '30', '45'].map((m) => (
              <MenuItem key={m} value={m}>{m}</MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>
      <Box sx={{ mt: 2 }}>
        <Typography sx={{ mb: 1 }}>{t('events.endTimeOptional')}</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
          <TextField
            select
            label={t('events.hour')}
            name="endHour"
            value={formData.endHour}
            onChange={handleHourChange('endHour')}
            sx={{ width: { xs: 'calc(50% - 8px)', sm: 100 }, '& .MuiInputBase-root': { minHeight: '44px' } }}
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
            sx={{ width: { xs: 'calc(50% - 8px)', sm: 100 }, '& .MuiInputBase-root': { minHeight: '44px' } }}
          >
            {['00', '15', '30', '45'].map((m) => (
              <MenuItem key={m} value={m}>{m}</MenuItem>
            ))}
          </TextField>
        </Box>
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
        sx={{ '& .MuiInputBase-root': { minHeight: '44px' } }}
      />
      
      {/* Recurring Event Section */}
      <Box sx={{ mt: 3, mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={formData.isRecurring}
              onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
              color="primary"
            />
          }
          label={
            <Box>
              <Typography variant="body1">Recurring Event</Typography>
              <Typography variant="caption" color="text.secondary">
                Create an event that repeats on a schedule
              </Typography>
            </Box>
          }
        />
      </Box>

      {formData.isRecurring && (
        <Paper elevation={1} sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Recurrence Settings
          </Typography>
          
          <TextField
            select
            label="Repeat Pattern"
            name="recurrencePattern"
            fullWidth
            margin="normal"
            value={formData.recurrencePattern}
            onChange={handleChange}
            sx={{ '& .MuiInputBase-root': { minHeight: '44px' } }}
          >
            <MenuItem value="DAILY">Daily</MenuItem>
            <MenuItem value="WEEKLY">Weekly</MenuItem>
            <MenuItem value="MONTHLY">Monthly</MenuItem>
          </TextField>

          <TextField
            label="Repeat Every"
            name="recurrenceInterval"
            type="number"
            fullWidth
            margin="normal"
            value={formData.recurrenceInterval}
            onChange={handleChange}
            inputProps={{ min: 1, max: 365 }}
            helperText={`Repeat every ${formData.recurrenceInterval || 1} ${
              formData.recurrencePattern === 'DAILY' ? 'day' : 
              formData.recurrencePattern === 'WEEKLY' ? 'week' : 
              'month'
            }${(formData.recurrenceInterval || 1) !== '1' ? 's' : ''}`}
            sx={{ '& .MuiInputBase-root': { minHeight: '44px' } }}
          />

          {formData.recurrencePattern === 'WEEKLY' && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Repeat On
              </Typography>
              <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, flexWrap: 'wrap' }}>
                {[
                  { label: 'Mon', value: 'MO' },
                  { label: 'Tue', value: 'TU' },
                  { label: 'Wed', value: 'WE' },
                  { label: 'Thu', value: 'TH' },
                  { label: 'Fri', value: 'FR' },
                  { label: 'Sat', value: 'SA' },
                  { label: 'Sun', value: 'SU' },
                ].map(day => (
                  <Button
                    key={day.value}
                    variant={formData.recurrenceDays?.includes(day.value) ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => {
                      const days = formData.recurrenceDays || [];
                      const newDays = days.includes(day.value)
                        ? days.filter(d => d !== day.value)
                        : [...days, day.value];
                      setFormData({ ...formData, recurrenceDays: newDays });
                    }}
                    sx={{ 
                      minWidth: { xs: '40px', sm: '48px' },
                      minHeight: '44px',
                      px: { xs: 1, sm: 2 }
                    }}
                  >
                    {day.label}
                  </Button>
                ))}
              </Box>
            </Box>
          )}

          <TextField
            label="End Date (Optional)"
            name="recurrenceEnd"
            type="date"
            fullWidth
            margin="normal"
            value={formData.recurrenceEnd}
            onChange={handleChange}
            InputLabelProps={{ shrink: true }}
            helperText="Leave empty to repeat indefinitely (up to 1 year)"
            sx={{ '& .MuiInputBase-root': { minHeight: '44px' } }}
          />
        </Paper>
      )}

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
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column-reverse', sm: 'row' },
        justifyContent: { sm: 'flex-end' },
        gap: { xs: 1.5, sm: 2 },
        mt: 3
      }}>
        {onCancel && (
          <Button
            variant="outlined"
            size="large"
            onClick={onCancel}
            sx={{ 
              minHeight: '44px', 
              px: { xs: 2, sm: 3 },
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            {t('common.cancel')}
          </Button>
        )}
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading}
          sx={{ 
            minHeight: '44px', 
            px: { xs: 2, sm: 3 },
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          {loading ? t('events.submitting') : submitLabel}
        </Button>
      </Box>
    </form>
  );
};

export default EventForm;
