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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

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
        {t('notifications.emailNotificationPreferences')}
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
                {t('notifications.muteAllNotifications')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('notifications.stopReceivingEmails')}
              </Typography>
            </Box>
          }
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ opacity: allNotificationsMuted ? 0.5 : 1, pointerEvents: allNotificationsMuted ? 'none' : 'auto' }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          {t('notifications.notificationTypes')}
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
            label={t('common.notificationPreferences.eventInvites')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.eventReminders}
                onChange={onPreferenceChange('eventReminders')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('common.notificationPreferences.eventReminders')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.eventUpdates}
                onChange={onPreferenceChange('eventUpdates')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('common.notificationPreferences.eventUpdates')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.eventCancellations}
                onChange={onPreferenceChange('eventCancellations')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('common.notificationPreferences.eventCancellations')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.groupInvites}
                onChange={onPreferenceChange('groupInvites')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('common.notificationPreferences.groupInvites')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.commentMentions}
                onChange={onPreferenceChange('commentMentions')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('common.notificationPreferences.commentMentions')}
          />
        </FormGroup>
      </Box>
    </Paper>
  );
};

export default NotificationPreferences;
