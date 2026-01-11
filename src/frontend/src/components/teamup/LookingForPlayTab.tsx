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
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { teamUpAPI } from '../../services/api';
import { LoadingSpinner } from '../common';
import { useAuth } from '../../contexts/AuthContext';
import { getImageUrl, getInitials } from '../../utils/imageUtils';
import { TeamUpRequest, TeamUpRequestFilters, TeamUpResponse } from '../../types/teamup';

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

const LookingForPlayTab = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [view, setView] = useState<'browse' | 'myResponses'>('browse');
  const [requests, setRequests] = useState<TeamUpRequest[]>([]);
  const [myResponses, setMyResponses] = useState<TeamUpResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<TeamUpRequest | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');
  
  const [filters, setFilters] = useState<TeamUpRequestFilters>({
    sportType: '',
    city: user?.city || '',
    country: user?.country || '',
    skillLevel: '',
  });

  useEffect(() => {
    if (view === 'browse') {
      fetchRequests();
    } else {
      fetchMyResponses();
    }
  }, [view, filters]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params: TeamUpRequestFilters = { status: 'open' };
      if (filters.sportType) params.sportType = filters.sportType;
      if (filters.city) params.city = filters.city;
      if (filters.country) params.country = filters.country;
      if (filters.skillLevel) params.skillLevel = filters.skillLevel;
      
      const response = await teamUpAPI.getAll(params);
      
      // Sort by urgency: soonest events first
      const sortedRequests = response.data.sort((a: TeamUpRequest, b: TeamUpRequest) => {
        const aDate = new Date(a.dateTime).getTime();
        const bDate = new Date(b.dateTime).getTime();
        const now = Date.now();
        
        const aUrgent = (aDate - now) < (48 * 60 * 60 * 1000);
        const bUrgent = (bDate - now) < (48 * 60 * 60 * 1000);
        
        if (aUrgent && !bUrgent) return -1;
        if (!aUrgent && bUrgent) return 1;
        
        return aDate - bDate;
      });
      
      setRequests(sortedRequests);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError(t('teamup.loadingRequests'));
    } finally {
      setLoading(false);
    }
  };

  const fetchMyResponses = async () => {
    try {
      setLoading(true);
      const response = await teamUpAPI.getMyResponses();
      setMyResponses(response.data);
    } catch (err) {
      console.error('Error fetching my responses:', err);
      setError(t('teamup.loadingResponses'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (request: TeamUpRequest) => {
    setSelectedRequest(request);
    setResponseMessage('');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedRequest(null);
    setResponseMessage('');
  };

  const handleRespond = async () => {
    if (!selectedRequest) return;

    try {
      await teamUpAPI.respond(selectedRequest.id, responseMessage);
      setSuccess(t('teamup.respondSuccess'));
      handleCloseDialog();
      fetchRequests();
      if (view === 'myResponses') {
        fetchMyResponses();
      }
    } catch (err: any) {
      console.error('Error responding:', err);
      const errorMessage = err.response?.data?.error || t('teamup.respondError');
      setError(errorMessage);
    }
  };

  const isOwnRequest = (request: TeamUpRequest) => {
    return request.creator?.id === user?.id;
  };

  const hasResponded = (request: TeamUpRequest) => {
    return request.responses?.some((r) => r.userId === user?.id);
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

  const handleViewChange = (_event: React.MouseEvent<HTMLElement>, newView: 'browse' | 'myResponses' | null) => {
    if (newView !== null) {
      setView(newView);
      setError('');
      setSuccess('');
    }
  };

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
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={handleViewChange}
          aria-label="view selection"
        >
          <ToggleButton value="browse" aria-label="browse requests">
            {t('teamup.browseActivities')}
          </ToggleButton>
          <ToggleButton value="myResponses" aria-label="my responses">
            {t('teamup.myResponses')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Browse View */}
      {view === 'browse' && (
        <>
          {/* Filters */}
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  select
                  label={t('teamup.filterBySport')}
                  value={filters.sportType}
                  onChange={(e) => setFilters({ ...filters, sportType: e.target.value })}
                >
                  <MenuItem value="">{t('teamup.allSports')}</MenuItem>
                  {SPORT_TYPES.map((sport) => (
                    <MenuItem key={sport} value={sport}>
                      {sport}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label={t('teamup.filterByLocation')}
                  value={filters.city}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                  placeholder="City"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  select
                  label={t('teamup.filterBySkillLevel')}
                  value={filters.skillLevel}
                  onChange={(e) => setFilters({ ...filters, skillLevel: e.target.value })}
                >
                  <MenuItem value="">{t('teamup.skillLevels.any')}</MenuItem>
                  <MenuItem value="beginner">{t('teamup.skillLevels.beginner')}</MenuItem>
                  <MenuItem value="intermediate">{t('teamup.skillLevels.intermediate')}</MenuItem>
                  <MenuItem value="advanced">{t('teamup.skillLevels.advanced')}</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Box>

          {/* Requests Grid */}
          {requests.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary">
                {t('teamup.noRequestsFound')}
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {requests.map((request) => {
                const ownRequest = isOwnRequest(request);
                const responded = hasResponded(request);
                const acceptedResponses = request.responses?.filter(
                  (r: any) => r.status === 'accepted'
                ).length || 0;
                const spotsLeft = request.playersNeeded - acceptedResponses;
                
                const eventDate = new Date(request.dateTime).getTime();
                const now = Date.now();
                const hoursUntil = (eventDate - now) / (1000 * 60 * 60);
                const isUrgent = hoursUntil <= 48 && hoursUntil > 0;

                return (
                  <Grid item xs={12} md={6} lg={4} key={request.id}>
                    <Card sx={{ 
                      position: 'relative',
                      ...(isUrgent && {
                        borderLeft: 4,
                        borderColor: 'warning.main'
                      })
                    }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="h6" component="div">
                            {request.title}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {isUrgent && (
                              <Chip
                                label={t('teamup.urgent')}
                                color="warning"
                                size="small"
                                sx={{ fontWeight: 'bold' }}
                              />
                            )}
                            <Chip
                              label={request.sportType}
                              color="primary"
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        </Box>
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
                        {request.city && (
                          <Typography variant="body2" color="text.secondary">
                            🌍 {request.city}{request.country ? `, ${request.country}` : ''}
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          👥 {acceptedResponses}/{request.playersNeeded} spots filled
                        </Typography>
                        <Box sx={{ mt: 1, mb: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={(acceptedResponses / request.playersNeeded) * 100}
                            sx={{ 
                              height: 8, 
                              borderRadius: 1,
                              backgroundColor: 'rgba(0, 0, 0, 0.1)',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: spotsLeft === 0 ? '#4caf50' : '#2196f3'
                              }
                            }}
                          />
                        </Box>
                        {request.skillLevel && request.skillLevel !== 'any' && (
                          <Chip
                            label={t(`teamup.skillLevels.${request.skillLevel}`)}
                            size="small"
                            sx={{ mt: 1 }}
                          />
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                          <Avatar
                            src={getImageUrl(request.creator?.profilePicture)}
                            sx={{ width: 32, height: 32, mr: 1 }}
                          >
                            {getInitials(request.creator?.name || 'User')}
                          </Avatar>
                          <Typography variant="caption" color="text.secondary">
                            {t('teamup.postedBy')} {request.creator?.name}
                          </Typography>
                        </Box>
                      </CardContent>
                      <CardActions>
                        {ownRequest ? (
                          <Chip label="Your request" color="default" size="small" />
                        ) : responded ? (
                          <Chip label={t('teamup.alreadyResponded')} color="info" size="small" />
                        ) : (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleOpenDialog(request)}
                            disabled={spotsLeft === 0}
                          >
                            {t('teamup.respondToRequest')}
                          </Button>
                        )}
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </>
      )}

      {/* My Responses View */}
      {view === 'myResponses' && (
        <>
          {myResponses.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary">
                {t('teamup.noResponsesYet')}
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {myResponses.map((response) => (
                <Grid item xs={12} md={6} lg={4} key={response.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h6" component="div">
                          {response.teamUpRequest?.title}
                        </Typography>
                        <Chip
                          label={t(`teamup.responseStatus.${response.status}`)}
                          color={getStatusColor(response.status)}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {response.teamUpRequest?.sportType}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        📅 {new Date(response.teamUpRequest?.dateTime || '').toLocaleString()}
                      </Typography>
                      {response.message && (
                        <Box sx={{ mt: 2, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {t('teamup.yourMessage')}:
                          </Typography>
                          <Typography variant="body2">
                            {response.message}
                          </Typography>
                        </Box>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                        {t('teamup.respondedOn')} {new Date(response.createdAt).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* Response Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('teamup.respondToRequest')}</DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {selectedRequest.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {selectedRequest.sportType} • {new Date(selectedRequest.dateTime).toLocaleString()}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                label={t('teamup.addMessage')}
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                placeholder="Tell them why you'd be a good fit..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
          <Button onClick={handleRespond} variant="contained">
            {t('teamup.sendResponse')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LookingForPlayTab;
