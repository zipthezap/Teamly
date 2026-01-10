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
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { teamUpAPI } from '../../services/api';
import { LoadingSpinner, EmptyState } from '../common';
import { useAuth } from '../../contexts/AuthContext';
import { getImageUrl, getInitials } from '../../utils/imageUtils';

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

const BrowseRequestsTab = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');
  
  const [filters, setFilters] = useState({
    sportType: '',
    city: user?.city || '',
    country: user?.country || '',
  });

  useEffect(() => {
    fetchRequests();
  }, [filters]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params: any = { status: 'open' };
      if (filters.sportType) params.sportType = filters.sportType;
      if (filters.city) params.city = filters.city;
      if (filters.country) params.country = filters.country;
      
      const response = await teamUpAPI.getAll(params);
      setRequests(response.data);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError(t('teamup.loadingRequests'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (request: any) => {
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
    } catch (err: any) {
      console.error('Error responding:', err);
      const errorMessage = err.response?.data?.error || t('teamup.respondError');
      setError(errorMessage);
    }
  };

  const isOwnRequest = (request: any) => {
    return request.creator?.id === user?.id;
  };

  const hasResponded = (request: any) => {
    return request.responses?.some((r: any) => r.userId === user?.id);
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
        </Grid>
      </Box>

      {requests.length === 0 ? (
        <EmptyState
          title={t('teamup.noRequestsFound')}
          subtitle=""
        />
      ) : (
        <Grid container spacing={3}>
          {requests.map((request) => {
            const ownRequest = isOwnRequest(request);
            const responded = hasResponded(request);
            const acceptedResponses = request.responses?.filter(
              (r: any) => r.status === 'accepted'
            ).length || 0;
            const spotsLeft = request.playersNeeded - acceptedResponses;

            return (
              <Grid item xs={12} md={6} lg={4} key={request.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6" component="div">
                        {request.title}
                      </Typography>
                      <Chip
                        label={request.sportType}
                        color="primary"
                        size="small"
                        variant="outlined"
                      />
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
                      👥 {spotsLeft} {t('teamup.fillersNeeded', { count: spotsLeft })}
                    </Typography>
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

export default BrowseRequestsTab;
