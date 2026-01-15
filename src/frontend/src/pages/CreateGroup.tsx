import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Paper,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import GroupFormFields from '../components/common/GroupFormFields';
import { groupsAPI } from '../services/api';
import LocationPicker from '../components/LocationPicker';
import ImageUpload from '../components/ImageUpload';
import { AxiosError } from 'axios';

interface LocationValue {
  latitude?: number | string;
  longitude?: number | string;
  locationName?: string;
  city?: string;
  country?: string;
}

const CreateGroup = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [location, setLocation] = useState<LocationValue>({});
  const [groupPicture, setGroupPicture] = useState<File | null>(null);
  const [sportType, setSportType] = useState('');
  const [maxMembers, setMaxMembers] = useState<number | string>('');
  const [autoApproveJoinRequests, setAutoApproveJoinRequests] = useState(false);
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

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
      const response = await groupsAPI.create(groupData);
      const groupId = response.data.id;
      
      // Upload group picture if one was selected
      if (groupPicture) {
        try {
          await groupsAPI.uploadGroupPicture(groupId, groupPicture);
        } catch (uploadErr) {
          console.error('Failed to upload group picture:', uploadErr);
          // Continue navigation even if picture upload fails
        }
      }
      
      navigate(`/groups/${groupId}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || 'Failed to create group'
        : 'Failed to create group';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePictureUpload = async (file: File) => {
    setGroupPicture(file);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          {t('groups.createNewGroup')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <ImageUpload
              onUpload={handlePictureUpload}
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
          
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
            >
              {loading ? t('groups.creating') : t('groups.createGroup')}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/groups')}
            >
              {t('common.cancel')}
            </Button>
          </Box>
        </form>
      </Paper>
    </Container>
  );
};

export default CreateGroup;
