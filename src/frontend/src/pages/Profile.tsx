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
  TwoFactorSection,
  OAuthConnections,
} from '../components/profile';
import ProfilePictureHistory from '../components/profile/ProfilePictureHistory';
import { AxiosError } from 'axios';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    city: '',
    country: '',
    address: '',
    postalCode: '',
    discoveryRadius: 25,
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
    nearbyTeamUps: true,
  });
  const [allNotificationsMuted, setAllNotificationsMuted] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [pictureHistory, setPictureHistory] = useState([]);
  const [pictureHistoryLoading, setPictureHistoryLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        city: user.city || '',
        country: user.country || '',
        address: user.address || '',
        postalCode: user.postalCode || '',
        discoveryRadius: user.discoveryRadius || 25,
      });
      setAllNotificationsMuted(!user.emailNotifications);
      fetchProfilePictureHistory();
    }
    fetchEmailPreferences();
  }, [user]);

  const fetchProfilePictureHistory = async () => {
    setPictureHistoryLoading(true);
    try {
      const response = await authAPI.listProfilePictures();
      setPictureHistory(response.data.pictures || []);
    } catch (err) {
      // Optionally handle error
    } finally {
      setPictureHistoryLoading(false);
    }
  };

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
      updateUser(updatedUser);
      setSuccess('Profile updated successfully');
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || 'Failed to update profile'
        : 'Failed to update profile';
      setError(errorMessage);
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

    if (passwordData.newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      // If user doesn't have a password (OAuth-only), don't require current password
      const payload: { newPassword: string; currentPassword?: string } = {
        newPassword: passwordData.newPassword,
      };
      
      // Only include currentPassword if it's provided (user has existing password)
      if (passwordData.currentPassword) {
        payload.currentPassword = passwordData.currentPassword;
      }
      
      await authAPI.updatePassword(payload);
      setSuccess('Password updated successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || 'Failed to update password'
        : 'Failed to update password';
      setError(errorMessage);
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
      updateUser({ emailNotifications: !muted });
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

  const handleUploadProfilePicture = async (file: File) => {
    setError('');
    setSuccess('');
    try {
      const response = await authAPI.uploadProfilePicture(file);
      const updatedUser = response.data.user;
      updateUser(updatedUser);
      setSuccess('Profile picture updated successfully');
      fetchProfilePictureHistory();
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || 'Failed to upload profile picture'
        : 'Failed to upload profile picture';
      setError(errorMessage);
      throw err;
    }
  };

  const handleDeleteProfilePicture = async () => {
    setError('');
    setSuccess('');
    try {
      const response = await authAPI.deleteProfilePicture();
      const updatedUser = response.data.user;
      updateUser(updatedUser);
      setSuccess('Profile picture removed successfully');
      fetchProfilePictureHistory();
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || 'Failed to delete profile picture'
        : 'Failed to delete profile picture';
      setError(errorMessage);
      throw err;
    }
  };

  const handleRestoreProfilePicture = async (pictureId: string) => {
    setError('');
    setSuccess('');
    try {
      await authAPI.restoreProfilePicture(pictureId);
      setSuccess('Profile picture restored');
      fetchProfilePictureHistory();
      // Optionally refresh user/profile
      const refreshed = await authAPI.getProfile();
      updateUser(refreshed.data.user);
    } catch (err) {
      setError('Failed to restore profile picture');
    }
  };

  const handleHardDeleteProfilePicture = async (pictureId: string) => {
    setError('');
    setSuccess('');
    try {
      await authAPI.hardDeleteProfilePicture(pictureId);
      setSuccess('Profile picture permanently deleted');
      fetchProfilePictureHistory();
    } catch (err) {
      setError('Failed to permanently delete profile picture');
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
            <TwoFactorSection />
            <OAuthConnections 
              onSuccess={(message) => setSuccess(message)}
              onError={(error) => setError(error)}
            />
            <Grid container spacing={3}>
              <Grid xs={12} md={6}>
                <ProfileForm
                  formData={formData}
                  profilePicture={user.profilePicture}
                  loading={loading}
                  onChange={handleChange}
                  onSubmit={handleUpdateProfile}
                  onUploadPicture={handleUploadProfilePicture}
                  onDeletePicture={handleDeleteProfilePicture}
                />
                <ProfilePictureHistory
                  pictures={pictureHistory}
                  onRestore={handleRestoreProfilePicture}
                  onHardDelete={handleHardDeleteProfilePicture}
                  currentPictureId={user.profilePicture}
                />
              </Grid>
              <Grid xs={12} md={6}>
                <PasswordChangeForm
                  passwordData={passwordData}
                  loading={loading}
                  onChange={handlePasswordChange}
                  onSubmit={handleUpdatePassword}
                  hasPassword={!!user.password}
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
