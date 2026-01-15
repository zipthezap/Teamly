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
    nearbyTeamUps: boolean;
    muteEventInvites?: boolean;
    muteEventReminders?: boolean;
    muteEventUpdates?: boolean;
    muteEventCancellations?: boolean;
    muteGroupInvites?: boolean;
    muteGroupRequests?: boolean;
    muteNearbyGroups?: boolean;
    muteEventCreated?: boolean;
    muteNearbyTeamUps?: boolean;
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
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.nearbyTeamUps}
                onChange={onPreferenceChange('nearbyTeamUps')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('common.notificationPreferences.nearbyTeamUps') || 'Nearby TeamUp Opportunities'}
          />
        </FormGroup>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
          {t('notifications.muteInAppNotifications') || 'Mute In-App Notifications'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('notifications.muteInAppDescription') || 'Control which in-app notifications you want to see'}
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.muteEventInvites || false}
                onChange={onPreferenceChange('muteEventInvites')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('notifications.mute.eventInvites') || 'Mute Event Invites'}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.muteEventReminders || false}
                onChange={onPreferenceChange('muteEventReminders')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('notifications.mute.eventReminders') || 'Mute Event Reminders'}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.muteEventUpdates || false}
                onChange={onPreferenceChange('muteEventUpdates')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('notifications.mute.eventUpdates') || 'Mute Event Updates'}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.muteEventCancellations || false}
                onChange={onPreferenceChange('muteEventCancellations')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('notifications.mute.eventCancellations') || 'Mute Event Cancellations'}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.muteGroupInvites || false}
                onChange={onPreferenceChange('muteGroupInvites')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('notifications.mute.groupInvites') || 'Mute Group Invites'}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.muteGroupRequests || false}
                onChange={onPreferenceChange('muteGroupRequests')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('notifications.mute.groupRequests') || 'Mute Group Join Requests'}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.muteNearbyGroups || false}
                onChange={onPreferenceChange('muteNearbyGroups')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('notifications.mute.nearbyGroups') || 'Mute Nearby Groups'}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.muteEventCreated || false}
                onChange={onPreferenceChange('muteEventCreated')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('notifications.mute.eventCreated') || 'Mute Event Created'}
          />
          <FormControlLabel
            control={
              <Switch
                checked={emailPreferences.muteNearbyTeamUps || false}
                onChange={onPreferenceChange('muteNearbyTeamUps')}
                disabled={allNotificationsMuted}
              />
            }
            label={t('notifications.mute.nearbyTeamUps') || 'Mute Nearby TeamUps'}
          />
        </FormGroup>
      </Box>
    </Paper>
  );
};

export default NotificationPreferences;
