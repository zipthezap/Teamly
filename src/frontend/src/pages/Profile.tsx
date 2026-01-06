import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Alert,
  Stack,
  Grid,
  CircularProgress,
} from '@mui/material';
import { authAPI, emailAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  ProfileForm,
  PasswordChangeForm,
  NotificationPreferences,
} from '../components/profile';

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleMuteToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const muted = event.target.checked;
    setAllNotificationsMuted(muted);
    
    try {
      await emailAPI.toggleNotifications(!muted);
      setSuccess(muted ? 'All notifications muted' : 'Notifications unmuted');
      const updatedUser = { ...user, emailNotifications: !muted };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (err) {
      setError('Failed to update notification settings');
      setAllNotificationsMuted(!muted);
    }
  };

  const handlePreferenceChange = (preference: string) => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    const previousPreferences = emailPreferences;
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
      setEmailPreferences(previousPreferences);
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

          <Stack spacing={3}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <ProfileForm
                  formData={formData}
                  loading={loading}
                  onChange={handleChange}
                  onSubmit={handleUpdateProfile}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <PasswordChangeForm
                  passwordData={passwordData}
                  loading={loading}
                  onChange={handlePasswordChange}
                  onSubmit={handleUpdatePassword}
                />
              </Grid>
            </Grid>

            <NotificationPreferences
              allNotificationsMuted={allNotificationsMuted}
              emailPreferences={emailPreferences}
              loading={preferencesLoading}
              onMuteToggle={handleMuteToggle}
              onPreferenceChange={handlePreferenceChange}
            />
          </Stack>
        </>
      )}
    </Container>
  );
};

export default Profile;
