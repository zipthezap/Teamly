import React, { useState, useEffect, useCallback } from 'react';
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
import { useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [location, setLocation] = useState<LocationValue>({});
  const [groupPicture, setGroupPicture] = useState<string | undefined>();
  const [sportType, setSportType] = useState('');
  const [maxMembers, setMaxMembers] = useState<number | string>('');
  const [autoApproveJoinRequests, setAutoApproveJoinRequests] = useState(false);
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchGroup = useCallback(async () => {
    if (!id) {
      setError('Group ID is required');
      setLoading(false);
      return;
    }
    
    try {
      const response = await groupsAPI.getById(id);
      const group = response.data;
      
      setName(group.name || '');
      setDescription(group.description || '');
      setIsPublic(group.isPublic || false);
      setGroupPicture(group.picture);
      setSportType(group.sportType || '');
      setMaxMembers(group.maxMembers || '');
      setAutoApproveJoinRequests(group.autoApproveJoinRequests || false);
      setTags(group.tags || '');
      setLocation({
        latitude: group.latitude,
        longitude: group.longitude,
        locationName: group.locationName,
        city: group.city,
        country: group.country,
      });
    } catch {
      setError(t('groups.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchGroup();
  }, [id, fetchGroup]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const groupData = { 
        name, 
        description, 
        isPublic,
        ...(location.latitude && { latitude: typeof location.latitude === 'string' ? parseFloat(location.latitude) : location.latitude }),
        ...(location.longitude && { longitude: typeof location.longitude === 'string' ? parseFloat(location.longitude) : location.longitude }),
        ...(location.locationName && { locationName: location.locationName }),
        ...(location.city && { city: location.city }),
        ...(location.country && { country: location.country }),
        ...(sportType && { sportType }),
        ...(maxMembers && { maxMembers: typeof maxMembers === 'string' ? parseInt(maxMembers) : maxMembers }),
        autoApproveJoinRequests,
        ...(tags && { tags }),
      };
      
      if (!id) {
        setError('Group ID is required');
        setSubmitting(false);
        return;
      }
      
      await groupsAPI.update(id, groupData);
      
      // Invalidate caches so the updated group data is reflected
      queryClient.invalidateQueries({ queryKey: ['groupsList'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groupDetails', id] });
      
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
      
      // Invalidate caches so the updated picture is reflected
      queryClient.invalidateQueries({ queryKey: ['groupDetails', id] });
      queryClient.invalidateQueries({ queryKey: ['groupsList'] });
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
      
      // Invalidate caches so the deleted picture is reflected
      queryClient.invalidateQueries({ queryKey: ['groupDetails', id] });
      queryClient.invalidateQueries({ queryKey: ['groupsList'] });
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
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 3, md: 4 }, px: { xs: 2, sm: 3 } }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' } }}>
          {t('groups.editGroup')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 2, sm: 3 } }}>
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
            sportType={sportType}
            setSportType={setSportType}
            maxMembers={maxMembers}
            setMaxMembers={setMaxMembers}
            autoApproveJoinRequests={autoApproveJoinRequests}
            setAutoApproveJoinRequests={setAutoApproveJoinRequests}
            tags={tags}
            setTags={setTags}
            t={t}
          />

          {isPublic && (
            <LocationPicker
              value={location}
              onChange={setLocation}
            />
          )}
          
          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            justifyContent: { sm: 'flex-end' },
            gap: { xs: 1.5, sm: 2 },
            mt: 3
          }}>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate(`/groups/${id}`)}
              fullWidth={{ xs: true, sm: false }}
              sx={{ minHeight: '44px', px: { xs: 2, sm: 3 } }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting}
              fullWidth={{ xs: true, sm: false }}
              sx={{ minHeight: '44px', px: { xs: 2, sm: 3 } }}
            >
              {submitting ? t('groups.updating') : t('groups.updateGroup')}
            </Button>
          </Box>
        </form>
      </Paper>
    </Container>
  );
};

export default EditGroup;
