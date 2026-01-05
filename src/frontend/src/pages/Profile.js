import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Alert,
  Divider,
  Stack,
  Grid,
  Switch,
  FormControlLabel,
  FormGroup,
  CircularProgress,
} from '@mui/material';
import { authAPI, emailAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { user, setUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    city: '',
    country: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [emailPreferences, setEmailPreferences] = useState({
    eventInvites: true,
    eventReminders: true,
    eventUpdates: true,
    eventCancellations: true,
    groupInvites: true,
    commentMentions: true,
  });
  const [allNotificationsMuted, setAllNotificationsMuted] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        city: user.city || '',
        country: user.country || '',
      });
      setAllNotificationsMuted(!user.emailNotifications);
    }
    fetchEmailPreferences();
  }, [user]);

  const fetchEmailPreferences = async () => {
    try {
      const response = await emailAPI.getPreferences();
      setEmailPreferences(response.data);
    } catch (err) {
      console.error('Failed to fetch email preferences:', err);
    } finally {
      setPreferencesLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await authAPI.updateProfile(formData);
      const updatedUser = response.data.user;
      setUser(updatedUser);
      // Update localStorage to maintain consistency
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await authAPI.updatePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setSuccess('Password updated successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleMuteToggle = async (event) => {
    const muted = event.target.checked;
    setAllNotificationsMuted(muted);
    
    try {
      await emailAPI.toggleNotifications(!muted);
      setSuccess(muted ? 'All notifications muted' : 'Notifications unmuted');
      // Update user context
      const updatedUser = { ...user, emailNotifications: !muted };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (err) {
      setError('Failed to update notification settings');
      // Revert on error
      setAllNotificationsMuted(!muted);
    }
  };

  const handlePreferenceChange = (preference) => async (event) => {
    const newValue = event.target.checked;
    const updatedPreferences = {
      ...emailPreferences,
      [preference]: newValue,
    };
    setEmailPreferences(updatedPreferences);
    
    try {
      await emailAPI.updatePreferences(updatedPreferences);
      setSuccess('Notification preferences updated');
    } catch (err) {
      setError('Failed to update preferences');
      // Revert on error
      setEmailPreferences(emailPreferences);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {!user ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress size={60} thickness={4} />
        </Box>
      ) : (
        <>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
            Profile Settings
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          <Grid container spacing={3}>
        {/* Profile Information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box component="form" onSubmit={handleUpdateProfile}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                Profile Information
              </Typography>
              
              <Stack spacing={2.5}>
                <TextField
                  fullWidth
                  label="Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  variant="outlined"
                />

                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  variant="outlined"
                />

                <Divider sx={{ my: 1 }} />

                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Location Settings
                </Typography>

                <TextField
                  fullWidth
                  label="City"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  variant="outlined"
                  helperText="Used for group discovery in your area"
                />

                <TextField
                  fullWidth
                  label="Country"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  variant="outlined"
                />

                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  size="large"
                  sx={{ mt: 2 }}
                >
                  Update Profile
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* Change Password */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box component="form" onSubmit={handleUpdatePassword}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                Security Settings
              </Typography>
              
              <Stack spacing={2.5}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Change Password
                </Typography>

                <TextField
                  fullWidth
                  label="Current Password"
                  name="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  required
                  variant="outlined"
                />

                <TextField
                  fullWidth
                  label="New Password"
                  name="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  required
                  variant="outlined"
                  helperText="Minimum 6 characters"
                />

                <TextField
                  fullWidth
                  label="Confirm New Password"
                  name="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                  variant="outlined"
                />

                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  size="large"
                  sx={{ mt: 2 }}
                >
                  Update Password
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* Notification Preferences */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              Notification Preferences
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Control which email notifications you receive for events and group activities.
            </Typography>

            {preferencesLoading ? (
              <Box display="flex" justifyContent="center" py={3}>
                <CircularProgress />
              </Box>
            ) : (
              <Stack spacing={3}>
                <Box 
                  sx={{ 
                    p: 2, 
                    bgcolor: allNotificationsMuted ? 'rgba(255, 152, 0, 0.1)' : 'rgba(76, 175, 80, 0.1)',
                    borderRadius: 2,
                    border: allNotificationsMuted ? '2px solid #ff9800' : '2px solid #4caf50',
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={allNotificationsMuted}
                        onChange={handleMuteToggle}
                        color="warning"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {allNotificationsMuted ? '🔕 All Notifications Muted' : '🔔 Notifications Active'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {allNotificationsMuted 
                            ? 'You will not receive any email notifications' 
                            : 'You will receive email notifications based on your preferences below'}
                        </Typography>
                      </Box>
                    }
                  />
                </Box>

                <Divider />

                <FormGroup>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                    Event Notifications
                  </Typography>
                  <Stack spacing={1.5}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={emailPreferences.eventInvites}
                          onChange={handlePreferenceChange('eventInvites')}
                          disabled={allNotificationsMuted}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>Event Invites</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Get notified when you're invited to new events
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={emailPreferences.eventReminders}
                          onChange={handlePreferenceChange('eventReminders')}
                          disabled={allNotificationsMuted}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>Event Reminders</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Receive reminders before events start
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={emailPreferences.eventUpdates}
                          onChange={handlePreferenceChange('eventUpdates')}
                          disabled={allNotificationsMuted}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>Event Updates</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Get notified about changes to event details
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={emailPreferences.eventCancellations}
                          onChange={handlePreferenceChange('eventCancellations')}
                          disabled={allNotificationsMuted}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>Event Cancellations</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Be informed when events are cancelled
                          </Typography>
                        </Box>
                      }
                    />
                  </Stack>
                </FormGroup>

                <Divider />

                <FormGroup>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                    Group & Social Notifications
                  </Typography>
                  <Stack spacing={1.5}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={emailPreferences.groupInvites}
                          onChange={handlePreferenceChange('groupInvites')}
                          disabled={allNotificationsMuted}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>Group Invites</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Get notified when you're invited to join groups
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={emailPreferences.commentMentions}
                          onChange={handlePreferenceChange('commentMentions')}
                          disabled={allNotificationsMuted}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>Comment Mentions</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Be notified when someone mentions you in comments
                          </Typography>
                        </Box>
                      }
                    />
                  </Stack>
                </FormGroup>
              </Stack>
            )}
          </Paper>
        </Grid>

        {/* Privacy Settings */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              Privacy & Display
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Control how your information is displayed to other users.
            </Typography>
            <Alert severity="info">
              Your name and email are visible to members of groups you join. 
              Your city information is used for location-based group discovery but is not publicly displayed.
            </Alert>
          </Paper>
        </Grid>
      </Grid>
        </>
      )}
    </Container>
  );
};

export default Profile;
