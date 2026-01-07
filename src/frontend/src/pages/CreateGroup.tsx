import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { groupsAPI } from '../services/api';
import LocationPicker from '../components/LocationPicker';

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
        ...(location.latitude && { latitude: location.latitude }),
        ...(location.longitude && { longitude: location.longitude }),
        ...(location.locationName && { locationName: location.locationName }),
        ...(location.city && { city: location.city }),
        ...(location.country && { country: location.country }),
      };
      const response = await groupsAPI.create(groupData);
      navigate(`/groups/${response.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setLoading(false);
    }
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
          <TextField
            label={t('groups.groupName')}
            fullWidth
            margin="normal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <TextField
            label={t('groups.description')}
            fullWidth
            multiline
            rows={4}
            margin="normal"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                color="primary"
              />
            }
            label={t('groups.makePublic')}
            sx={{ mt: 2 }}
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
