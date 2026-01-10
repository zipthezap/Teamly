import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import GroupFormFields from '../components/common/GroupFormFields';
import { groupsAPI } from '../services/api';
import LocationPicker from '../components/LocationPicker';
import ImageUpload from '../components/ImageUpload';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';

interface LocationValue {
  latitude?: number | string;
  longitude?: number | string;
  locationName?: string;
  city?: string;
  country?: string;
}

const EditGroup = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [location, setLocation] = useState<LocationValue>({});
  const [groupPicture, setGroupPicture] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchGroup();
  }, [id]);

  const fetchGroup = async () => {
    try {
      const response = await groupsAPI.getById(id);
      const group = response.data;
      
      setName(group.name || '');
      setDescription(group.description || '');
      setIsPublic(group.isPublic || false);
      setGroupPicture(group.picture);
      setLocation({
        latitude: group.latitude,
        longitude: group.longitude,
        locationName: group.locationName,
        city: group.city,
        country: group.country,
      });
    } catch (error) {
      console.error('Error fetching group:', error);
      setError(t('groups.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const groupData = { 
        name, 
        description, 
        isPublic,
        ...(location.latitude && { latitude: location.latitude }),
        ...(location.longitude && { longitude: location.longitude }),
        ...(location.locationName && { locationName: location.locationName }),
        ...(location.city && { city: location.city }),
        ...(location.country && { country: location.country }),
      };
      await groupsAPI.update(id, groupData);
      navigate(`/groups/${id}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || t('groups.failedToUpdate')
        : t('groups.failedToUpdate');
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePictureUpload = async (file: File) => {
    setError('');
    try {
      const response = await groupsAPI.uploadGroupPicture(id!, file);
      setGroupPicture(response.data.group.picture);
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || 'Failed to upload group picture'
        : 'Failed to upload group picture';
      setError(errorMessage);
      throw err;
    }
  };

  const handleDeletePicture = async () => {
    setError('');
    try {
      const response = await groupsAPI.deleteGroupPicture(id!);
      setGroupPicture(response.data.group.picture);
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || 'Failed to delete group picture'
        : 'Failed to delete group picture';
      setError(errorMessage);
      throw err;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress size={60} thickness={4} />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          {t('groups.editGroup')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <ImageUpload
              currentImage={groupPicture}
              onUpload={handlePictureUpload}
              onDelete={handleDeletePicture}
              label={t('groups.groupPicture') || 'Group Picture'}
              shape="square"
              size={150}
            />
          </Box>

          <GroupFormFields
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            isPublic={isPublic}
            setIsPublic={setIsPublic}
            t={t}
          />

          {isPublic && (
            <LocationPicker
              value={location}
              onChange={setLocation}
            />
          )}
          
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting}
            >
              {submitting ? t('groups.updating') : t('groups.updateGroup')}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate(`/groups/${id}`)}
            >
              {t('common.cancel')}
            </Button>
          </Box>
        </form>
      </Paper>
    </Container>
  );
};

export default EditGroup;
