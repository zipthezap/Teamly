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
} from '@mui/material';
import { authAPI } from '../services/api';
import { notificationPreferenceAPI } from '../services/notificationPreferenceAPI';

// List of muteable notification types and their labels
const notificationMuteFields = [
  { key: 'muteEventInvites', label: 'Mute Event Invites' },
  { key: 'muteEventReminders', label: 'Mute Event Reminders' },
  { key: 'muteEventUpdates', label: 'Mute Event Updates' },
  { key: 'muteEventCancellations', label: 'Mute Event Cancellations' },
  { key: 'muteGroupInvites', label: 'Mute Group Invites' },
  { key: 'muteGroupRequests', label: 'Mute Group Join Requests' },
  { key: 'muteNearbyGroups', label: 'Mute Nearby Group Notifications' },
  { key: 'muteEventCreated', label: 'Mute New Event Created' },
];

const Profile = () => {
  // ...existing state and handlers...

  // Notification preferences handlers
  const handleNotifCheckbox = (e) => {
    setNotificationPrefs({
      ...notificationPrefs,
      [e.target.name]: e.target.checked,
    });
  };

  const handleSaveNotifPrefs = async () => {
    setNotifLoading(true);
    setNotifError('');
    setNotifSuccess('');
    try {
      await notificationPreferenceAPI.update(notificationPrefs);
      setNotifSuccess('Notification preferences updated');
    } catch (e) {
      setNotifError('Failed to update notification preferences');
    } finally {
      setNotifLoading(false);
    }
  };

  // Profile and password state
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Notification preferences state and logic
  const [notificationPrefs, setNotificationPrefs] = useState(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState('');
  const [notifSuccess, setNotifSuccess] = useState('');

  // Auth context
  const { user, setUser } = React.useContext(require('../contexts/AuthContext').AuthContext);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        city: user.city || '',
        country: user.country || '',
      });
    }
  }, [user]);

  useEffect(() => {
    const fetchPrefs = async () => {
      setNotifLoading(true);
      setNotifError('');
      try {
        const res = await notificationPreferenceAPI.get();
        setNotificationPrefs(res.data);
      } catch (e) {
        setNotifError('Failed to load notification preferences');
      } finally {
        setNotifLoading(false);
      }
    };
    fetchPrefs();
  }, []);

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


  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
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
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Manage which in-app notifications you want to mute. You will still receive notifications for types not muted below.
            </Typography>
            {notifError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setNotifError('')}>
                {notifError}
              </Alert>
            )}
            {notifSuccess && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotifSuccess('')}>
                {notifSuccess}
              </Alert>
            )}
            <Box sx={{ mb: 2 }}>
              {notificationPrefs ? (
                <Stack direction="row" flexWrap="wrap" spacing={2}>
                  {notificationMuteFields.map(({ key, label }) => (
                    <Box key={key} sx={{ minWidth: 220, mb: 1 }}>
                      <label>
                        <input
                          type="checkbox"
                          name={key}
                          checked={!!notificationPrefs[key]}
                          onChange={handleNotifCheckbox}
                          disabled={notifLoading}
                          style={{ marginRight: 8 }}
                        />
                        {label}
                      </label>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">Loading preferences...</Typography>
              )}
            </Box>
            <Button
              variant="contained"
              onClick={handleSaveNotifPrefs}
              disabled={notifLoading || !notificationPrefs}
            >
              Save Notification Preferences
            </Button>
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
    </Container>
  );
};

export default Profile;
