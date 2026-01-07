import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Switch,
  FormControlLabel,
  FormGroup,
  Divider,
  CircularProgress,
} from '@mui/material';

interface NotificationPreferencesProps {
  allNotificationsMuted: boolean;
  emailPreferences: {
    eventInvites: boolean;
    eventReminders: boolean;
    eventUpdates: boolean;
    eventCancellations: boolean;
    groupInvites: boolean;
    commentMentions: boolean;
  };
  loading: boolean;
  onMuteToggle: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPreferenceChange: (preference: string) => (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  allNotificationsMuted,
  emailPreferences,
  loading,
  onMuteToggle,
  onPreferenceChange,
}) => {
  if (loading) {
    return (
      <Paper sx={{ p: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" py={4}>
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        Email Notification Preferences
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={allNotificationsMuted}
              onChange={onMuteToggle}
              color="primary"
            />
          }
          label={
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                Mute All Notifications
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Stop receiving all email notifications
              </Typography>
            </Box>
          }
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ opacity: allNotificationsMuted ? 0.5 : 1, pointerEvents: allNotificationsMuted ? 'none' : 'auto' }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          Notification Types
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.eventInvites}
                onChange={onPreferenceChange('eventInvites')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('notificationPreferences.eventInvites')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.eventReminders}
                onChange={onPreferenceChange('eventReminders')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('notificationPreferences.eventReminders')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.eventUpdates}
                onChange={onPreferenceChange('eventUpdates')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('notificationPreferences.eventUpdates')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.eventCancellations}
                onChange={onPreferenceChange('eventCancellations')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('notificationPreferences.eventCancellations')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.groupInvites}
                onChange={onPreferenceChange('groupInvites')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('notificationPreferences.groupInvites')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.commentMentions}
                onChange={onPreferenceChange('commentMentions')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('notificationPreferences.commentMentions')}
          />
        </FormGroup>
      </Box>
    </Paper>
  );
};

export default NotificationPreferences;
