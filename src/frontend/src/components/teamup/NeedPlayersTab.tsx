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
  Badge,
  Avatar,
  Divider,
  Collapse,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { teamUpAPI } from '../../services/api';
import { LoadingSpinner } from '../common';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useAuth } from '../../contexts/AuthContext';
import { getImageUrl, getInitials } from '../../utils/imageUtils';
import { TeamUpRequest, CreateTeamUpRequestData, UpdateTeamUpRequestData } from '../../types/teamup';

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

const NeedPlayersTab = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [view, setView] = useState<'myRequests' | 'manageResponses'>('myRequests');
  const [myRequests, setMyRequests] = useState<TeamUpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRequest, setEditingRequest] = useState<TeamUpRequest | null>(null);
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  
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

  const handleOpenDialog = (request?: TeamUpRequest) => {
    if (request) {
      setEditingRequest(request);
      const requestDate = new Date(request.dateTime);
      const dateTimeValue = isNaN(requestDate.getTime()) 
        ? '' 
        : requestDate.toISOString().slice(0, 16);
      
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
        dateTime: dateTimeValue,
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
      setSuccess(t('teamup.statusUpdateSuccess'));
      fetchMyRequests();
    } catch (err) {
      console.error('Error updating status:', err);
      setError(t('teamup.updateRequestError'));
    }
  };

  const handleResponse = async (requestId: string, responseId: string, action: 'accept' | 'decline') => {
    try {
      await teamUpAPI.handleResponse(requestId, responseId, action);
      setSuccess(
        action === 'accept'
          ? t('teamup.acceptResponseSuccess')
          : t('teamup.declineResponseSuccess')
      );
      fetchMyRequests();
    } catch (err: any) {
      console.error('Error handling response:', err);
      setError(
        action === 'accept'
          ? t('teamup.acceptResponseError')
          : t('teamup.declineResponseError')
      );
    }
  };

  const toggleExpanded = (requestId: string) => {
    const newExpanded = new Set(expandedRequests);
    if (newExpanded.has(requestId)) {
      newExpanded.delete(requestId);
    } else {
      newExpanded.add(requestId);
    }
    setExpandedRequests(newExpanded);
  };

  const getResponseStats = (request: TeamUpRequest) => {
    const responses = request.responses || [];
    const pending = responses.filter(r => r.status === 'pending').length;
    const accepted = responses.filter(r => r.status === 'accepted').length;
    const declined = responses.filter(r => r.status === 'declined').length;
    return { pending, accepted, declined, total: responses.length };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'success';
      case 'declined':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleViewChange = (_event: React.MouseEvent<HTMLElement>, newView: 'myRequests' | 'manageResponses' | null) => {
    if (newView !== null) {
      setView(newView);
      setError('');
      setSuccess('');
    }
  };

  const requestsWithResponses = myRequests.filter(
    (req) => req.responses && req.responses.length > 0
  );

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />;
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

      {/* View Toggle */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={handleViewChange}
          aria-label="view selection"
        >
          <ToggleButton value="myRequests" aria-label="my requests">
            {t('teamup.myRequests')}
          </ToggleButton>
          <ToggleButton value="manageResponses" aria-label="manage responses">
            {t('teamup.manageResponses')}
            {requestsWithResponses.length > 0 && (
              <Badge badgeContent={requestsWithResponses.length} color="primary" sx={{ ml: 1 }} />
            )}
          </ToggleButton>
        </ToggleButtonGroup>
        
        {view === 'myRequests' && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            {t('teamup.createRequest')}
          </Button>
        )}
      </Box>

      {/* My Requests View */}
      {view === 'myRequests' && (
        <>
          {myRequests.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary">
                {t('teamup.noRequestsYet')}
              </Typography>
            </Box>
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
                        <Box sx={{ mt: 1 }}>
                          <Badge 
                            badgeContent={request._count.responses} 
                            color="primary"
                            sx={{ width: '100%' }}
                          >
                            <Chip 
                              icon={<PeopleIcon />}
                              label={t('teamup.responses')}
                              color="primary"
                              variant="outlined"
                              size="small"
                              sx={{ width: '100%' }}
                            />
                          </Badge>
                        </Box>
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
        </>
      )}

      {/* Manage Responses View */}
      {view === 'manageResponses' && (
        <>
          {requestsWithResponses.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary">
                {t('teamup.noResponsesReceived')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('teamup.noResponsesReceivedDesc')}
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {requestsWithResponses.map((request) => {
                const stats = getResponseStats(request);
                const isExpanded = expandedRequests.has(request.id);
                const spotsLeft = request.playersNeeded - stats.accepted;

                return (
                  <Grid item xs={12} key={request.id}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" component="div">
                              {request.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {request.sportType} • {new Date(request.dateTime).toLocaleString()}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                              <Chip
                                label={`${stats.pending} ${t('teamup.pending')}`}
                                size="small"
                                color="default"
                              />
                              <Chip
                                label={`${stats.accepted} ${t('teamup.accepted')}`}
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                              <Chip
                                label={`${stats.declined} ${t('teamup.declined')}`}
                                size="small"
                                color="error"
                                variant="outlined"
                              />
                              <Chip
                                label={`${spotsLeft} ${t('teamup.spotsLeft')}`}
                                size="small"
                                color={spotsLeft > 0 ? 'primary' : 'default'}
                              />
                            </Stack>
                          </Box>
                          <IconButton onClick={() => toggleExpanded(request.id)}>
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Box>

                        <Collapse in={isExpanded}>
                          <Divider sx={{ my: 2 }} />
                          <Stack spacing={2}>
                            {request.responses?.map((response) => (
                              <Card key={response.id} variant="outlined">
                                <CardContent>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                                      <Avatar
                                        src={getImageUrl(response.user?.profilePicture)}
                                        sx={{ width: 40, height: 40 }}
                                      >
                                        {getInitials(response.user?.name || 'User')}
                                      </Avatar>
                                      <Box sx={{ flex: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          <Typography variant="subtitle2">
                                            {response.user?.name}
                                          </Typography>
                                          <Chip
                                            label={t(`teamup.responseStatus.${response.status}`)}
                                            color={getStatusColor(response.status)}
                                            size="small"
                                          />
                                        </Box>
                                        <Typography variant="caption" color="text.secondary">
                                          {response.user?.email}
                                        </Typography>
                                        {response.message && (
                                          <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                                            <Typography variant="body2">
                                              "{response.message}"
                                            </Typography>
                                          </Box>
                                        )}
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                          {t('teamup.respondedOn')} {new Date(response.createdAt).toLocaleString()}
                                        </Typography>
                                      </Box>
                                    </Box>
                                    {response.status === 'pending' && (
                                      <Stack direction="row" spacing={1}>
                                        <Button
                                          size="small"
                                          variant="contained"
                                          color="success"
                                          startIcon={<CheckCircleIcon />}
                                          onClick={() => handleResponse(request.id, response.id, 'accept')}
                                          disabled={spotsLeft === 0}
                                        >
                                          {t('teamup.acceptResponse')}
                                        </Button>
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          color="error"
                                          startIcon={<CancelIcon />}
                                          onClick={() => handleResponse(request.id, response.id, 'decline')}
                                        >
                                          {t('teamup.declineResponse')}
                                        </Button>
                                      </Stack>
                                    )}
                                  </Box>
                                </CardContent>
                              </Card>
                            ))}
                          </Stack>
                        </Collapse>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </>
      )}

      {/* Create/Edit Request Dialog */}
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
              <TextField
                fullWidth
                label={t('teamup.location')}
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Enter location"
              />
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

export default NeedPlayersTab;
