import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  TextField,
  MenuItem,
  Grid,
  Typography,
  Alert,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { teamUpAPI } from '../../services/api';
import { LoadingSpinner, EmptyState } from '../common';
import LocationPicker from '../LocationPicker';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAuth } from '../../contexts/AuthContext';

const SPORT_TYPES = [
  'Football/Soccer',
  'Basketball',
  'Tennis',
  'Volleyball',
  'Baseball',
  'Hockey',
  'Rugby',
  'Cricket',
  'Golf',
  'Swimming',
  'Running',
  'Cycling',
  'Other',
];

const SKILL_LEVELS = ['any', 'beginner', 'intermediate', 'advanced'];

const SubmitRequestTab = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    sportType: '',
    location: '',
    latitude: null as number | null,
    longitude: null as number | null,
    locationName: '',
    city: user?.city || '',
    country: user?.country || '',
    dateTime: '',
    playersNeeded: 1,
    skillLevel: 'any',
  });

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const fetchMyRequests = async () => {
    try {
      setLoading(true);
      const response = await teamUpAPI.getMyRequests();
      setMyRequests(response.data);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError(t('teamup.loadingRequests'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (request?: any) => {
    if (request) {
      setEditingRequest(request);
      setFormData({
        title: request.title,
        description: request.description || '',
        sportType: request.sportType,
        location: request.location || '',
        latitude: request.latitude,
        longitude: request.longitude,
        locationName: request.locationName || '',
        city: request.city || '',
        country: request.country || '',
        dateTime: new Date(request.dateTime).toISOString().slice(0, 16),
        playersNeeded: request.playersNeeded,
        skillLevel: request.skillLevel || 'any',
      });
    } else {
      setEditingRequest(null);
      setFormData({
        title: '',
        description: '',
        sportType: '',
        location: '',
        latitude: null,
        longitude: null,
        locationName: '',
        city: user?.city || '',
        country: user?.country || '',
        dateTime: '',
        playersNeeded: 1,
        skillLevel: 'any',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingRequest(null);
    setError('');
    setSuccess('');
  };

  const handleLocationSelect = (locationData: any) => {
    setFormData({
      ...formData,
      location: locationData.address || '',
      latitude: locationData.lat,
      longitude: locationData.lng,
      locationName: locationData.name || '',
      city: locationData.city || formData.city,
      country: locationData.country || formData.country,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingRequest) {
        await teamUpAPI.update(editingRequest.id, formData);
        setSuccess(t('teamup.updateRequestSuccess'));
      } else {
        await teamUpAPI.create(formData);
        setSuccess(t('teamup.createRequestSuccess'));
      }
      handleCloseDialog();
      fetchMyRequests();
    } catch (err: any) {
      console.error('Error submitting request:', err);
      setError(
        editingRequest
          ? t('teamup.updateRequestError')
          : t('teamup.createRequestError')
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('teamup.confirmDelete'))) {
      return;
    }

    try {
      await teamUpAPI.delete(id);
      setSuccess(t('teamup.deleteRequestSuccess'));
      fetchMyRequests();
    } catch (err) {
      console.error('Error deleting request:', err);
      setError(t('teamup.deleteRequestError'));
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await teamUpAPI.update(id, { status: newStatus });
      fetchMyRequests();
    } catch (err) {
      console.error('Error updating status:', err);
      setError(t('teamup.updateRequestError'));
    }
  };

  if (loading) {
    return <LoadingSpinner message={t('teamup.loadingRequests')} />;
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">{t('teamup.myRequests')}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          {t('teamup.createRequest')}
        </Button>
      </Box>

      {myRequests.length === 0 ? (
        <EmptyState
          title={t('teamup.noRequestsYet')}
          subtitle=""
        />
      ) : (
        <Grid container spacing={3}>
          {myRequests.map((request) => (
            <Grid item xs={12} md={6} lg={4} key={request.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6" component="div">
                      {request.title}
                    </Typography>
                    <Chip
                      label={t(`teamup.status.${request.status}`)}
                      color={
                        request.status === 'open'
                          ? 'success'
                          : request.status === 'filled'
                          ? 'primary'
                          : 'default'
                      }
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {request.sportType}
                  </Typography>
                  {request.description && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {request.description}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    📅 {new Date(request.dateTime).toLocaleString()}
                  </Typography>
                  {request.location && (
                    <Typography variant="body2" color="text.secondary">
                      📍 {request.location}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    👥 {t('teamup.fillersNeeded', { count: request.playersNeeded })}
                  </Typography>
                  {request._count?.responses > 0 && (
                    <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                      {request._count.responses} {t('teamup.responses')}
                    </Typography>
                  )}
                </CardContent>
                <CardActions>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(request)}
                    color="primary"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(request.id)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                  {request.status === 'open' && (
                    <Button
                      size="small"
                      onClick={() => handleStatusChange(request.id, 'filled')}
                    >
                      {t('teamup.markAsFilled')}
                    </Button>
                  )}
                  {request.status === 'filled' && (
                    <Button
                      size="small"
                      onClick={() => handleStatusChange(request.id, 'open')}
                    >
                      {t('teamup.markAsOpen')}
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {editingRequest ? t('teamup.editRequest') : t('teamup.createRequest')}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                required
                label={t('teamup.requestTitle')}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('teamup.requestDescription')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <TextField
                fullWidth
                required
                select
                label={t('teamup.sportType')}
                value={formData.sportType}
                onChange={(e) => setFormData({ ...formData, sportType: e.target.value })}
              >
                {SPORT_TYPES.map((sport) => (
                  <MenuItem key={sport} value={sport}>
                    {sport}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                required
                type="datetime-local"
                label={t('teamup.dateTime')}
                value={formData.dateTime}
                onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                required
                type="number"
                label={t('teamup.playersNeeded')}
                value={formData.playersNeeded}
                onChange={(e) =>
                  setFormData({ ...formData, playersNeeded: parseInt(e.target.value) })
                }
                inputProps={{ min: 1 }}
              />
              <TextField
                fullWidth
                select
                label={t('teamup.skillLevel')}
                value={formData.skillLevel}
                onChange={(e) => setFormData({ ...formData, skillLevel: e.target.value })}
              >
                {SKILL_LEVELS.map((level) => (
                  <MenuItem key={level} value={level}>
                    {t(`teamup.skillLevels.${level}`)}
                  </MenuItem>
                ))}
              </TextField>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('teamup.location')}
                </Typography>
                <LocationPicker
                  onLocationSelect={handleLocationSelect}
                  initialLocation={
                    formData.latitude && formData.longitude
                      ? { lat: formData.latitude, lng: formData.longitude }
                      : undefined
                  }
                />
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
            <Button type="submit" variant="contained">
              {editingRequest ? t('common.save') : t('common.create')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default SubmitRequestTab;
