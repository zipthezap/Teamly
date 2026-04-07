import React, { useState, useEffect, useCallback } from 'react';
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
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useAuth } from '../../contexts/AuthContext';
import { TeamUpRequest, TeamUpRequestWithDetails } from '../../types/teamup';
import TeamUpDetailModal from './TeamUpDetailModal';
import { SPORT_TYPES, SKILL_LEVELS } from '../../constants/teamup';

const NeedPlayersTab = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [view, setView] = useState<'myRequests' | 'manageResponses'>('myRequests');
  const [myRequests, setMyRequests] = useState<TeamUpRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRequest, setEditingRequest] = useState<TeamUpRequest | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [openDetailModal, setOpenDetailModal] = useState(false);
  
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

  const fetchMyRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await teamUpAPI.getMyRequests();
      setMyRequests(response.data);
    } catch {
      setError(t('teamup.loadingRequests'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchMyRequests();
  }, [fetchMyRequests]);

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
        latitude: request.latitude ?? null,
        longitude: request.longitude ?? null,
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
      // Convert null to undefined for API compatibility
      const apiData = {
        ...formData,
        latitude: formData.latitude ?? undefined,
        longitude: formData.longitude ?? undefined,
      };
      
      if (editingRequest) {
        await teamUpAPI.update(editingRequest.id, apiData);
        setSuccess(t('teamup.updateRequestSuccess'));
      } else {
        await teamUpAPI.create(apiData);
        setSuccess(t('teamup.createRequestSuccess'));
      }
      handleCloseDialog();
      fetchMyRequests();
    } catch {
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
    } catch {
      setError(t('teamup.deleteRequestError'));
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      // Validate status before sending
      const validStatuses = ['open', 'filled', 'cancelled', 'expired'] as const;
      type ValidStatus = typeof validStatuses[number];
      const isValidStatus = (status: string): status is ValidStatus => {
        return validStatuses.includes(status as ValidStatus);
      };
      if (!isValidStatus(newStatus)) {
        setError('Invalid status');
        return;
      }
      await teamUpAPI.update(id, { status: newStatus });
      setSuccess(t('teamup.statusUpdateSuccess'));
      fetchMyRequests();
    } catch {
      setError(t('teamup.updateRequestError'));
    }
  };

  const handleOpenDetailModal = (requestId: string) => {
    setSelectedRequestId(requestId);
    setOpenDetailModal(true);
  };

  const handleCloseDetailModal = () => {
    setOpenDetailModal(false);
    setSelectedRequestId(null);
  };

  const handleDetailModalUpdate = () => {
    fetchMyRequests();
  };

  const getResponseStats = (request: TeamUpRequestWithDetails) => {
    const responses = request.responses || [];
    const pending = responses.filter(r => r.status === 'pending').length;
    const accepted = responses.filter(r => r.status === 'accepted').length;
    const declined = responses.filter(r => r.status === 'declined').length;
    return { pending, accepted, declined, total: responses.length };
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
      <Box sx={{ mb: { xs: 2, sm: 3 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={handleViewChange}
          aria-label="view selection"
          sx={{
            backgroundColor: '#1a202c',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderRadius: 2,
            '& .MuiToggleButton-root': {
              px: { xs: 2, sm: 3 },
              py: { xs: 1, sm: 1.5 },
              minHeight: '44px',
              border: 'none',
              fontWeight: 600,
              textTransform: 'none',
              fontSize: { xs: '0.813rem', sm: '0.95rem' },
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: 'rgba(33, 150, 243, 0.08)'
              },
              '&.Mui-selected': {
                backgroundColor: '#2196f3',
                color: 'white',
                '&:hover': {
                  backgroundColor: '#1976d2'
                }
              }
            }
          }}
        >
          <ToggleButton value="myRequests" aria-label="my requests">
            {t('teamup.myRequests')}
          </ToggleButton>
          <ToggleButton value="manageResponses" aria-label="manage responses">
            {t('teamup.manageResponses')}
            {requestsWithResponses.length > 0 && (
              <Badge badgeContent={requestsWithResponses.length} color="error" sx={{ ml: 1 }} />
            )}
          </ToggleButton>
        </ToggleButtonGroup>
        
        {view === 'myRequests' && (
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{
              background: '#2196f3',
              color: 'white',
              fontWeight: 600,
              textTransform: 'none',
              px: { xs: 2, sm: 3 },
              py: { xs: 1, sm: 1.5 },
              minHeight: '44px',
              fontSize: { xs: '0.875rem', sm: '1rem' },
              borderRadius: 2,
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
              transition: 'all 0.3s ease',
              '&:hover': {
                background: '#1976d2',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 16px rgba(102, 126, 234, 0.5)'
              }
            }}
          >
            {t('teamup.createRequest')}
          </Button>
        )}
      </Box>

      {/* My Requests View */}
      {view === 'myRequests' && (
        <>
          {myRequests.length === 0 ? (
            <Box sx={{ 
              textAlign: 'center', 
              py: { xs: 6, sm: 8 },
              backgroundColor: '#1a202c',
              borderRadius: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              <Typography variant="h4" sx={{ mb: 2, fontSize: { xs: '2.5rem', sm: '3rem' } }}>📝</Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                {t('teamup.noRequestsYet')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
                Create your first request to find players!
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={{ xs: 2, sm: 3 }}>
              {myRequests.map((request) => (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={request.id}>
                  <Card sx={{
                    height: '100%',
                    borderRadius: 2,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.15)'
                    }
                  }}>
                    <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                        <Typography variant="h6" component="div" sx={{ 
                          fontWeight: 600,
                          flex: 1,
                          pr: 1,
                          fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' }
                        }}>
                          {request.title}
                        </Typography>
                        <Chip
                          label={t(`teamup.status.${request.status}`)}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            ...(request.status === 'open' && {
                              background: 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)',
                              color: 'white'
                            }),
                            ...(request.status === 'filled' && {
                              background: 'linear-gradient(135deg, #2196f3 0%, #21cbf3 100%)',
                              color: 'white'
                            })
                          }}
                        />
                      </Box>
                      <Chip
                        label={request.sportType}
                        size="small"
                        sx={{ 
                          mb: 2,
                          background: '#2196f3',
                          color: 'white',
                          fontWeight: 600
                        }}
                      />
                      {request.description && (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            mb: 2,
                            color: 'text.secondary',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}
                        >
                          {request.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontSize: '1rem' }}>📅</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(request.dateTime).toLocaleString()}
                          </Typography>
                        </Box>
                        {request.location && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontSize: '1rem' }}>📍</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {request.location}
                            </Typography>
                          </Box>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontSize: '1rem' }}>👥</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('teamup.fillersNeeded', { count: request.playersNeeded })}
                          </Typography>
                        </Box>
                      </Box>
                      {request._count?.responses && request._count.responses > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Chip 
                            icon={<PeopleIcon />}
                            label={`${request._count.responses} ${t('teamup.responses')}`}
                            size="small"
                            sx={{
                              width: '100%',
                              justifyContent: 'center',
                              background: 'linear-gradient(135deg, #ff9800 0%, #f44336 100%)',
                              color: 'white',
                              fontWeight: 600,
                              '& .MuiChip-icon': {
                                color: 'white'
                              }
                            }}
                          />
                        </Box>
                      )}
                    </CardContent>
                    <CardActions sx={{ px: { xs: 2, sm: 2.5, md: 3 }, pb: 2, pt: 0, borderTop: '1px solid', borderColor: 'divider', gap: 1, flexWrap: 'wrap' }}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(request)}
                        sx={{
                          color: '#2196f3',
                          minWidth: '44px',
                          minHeight: '44px',
                          '&:hover': {
                            backgroundColor: 'rgba(33, 150, 243, 0.08)'
                          }
                        }}
                        title={t('common.edit')}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(request.id)}
                        sx={{
                          color: 'error.main',
                          minWidth: '44px',
                          minHeight: '44px',
                          '&:hover': {
                            backgroundColor: 'rgba(244, 67, 54, 0.08)'
                          }
                        }}
                        title={t('common.delete')}
                      >
                        <DeleteIcon />
                      </IconButton>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VisibilityIcon />}
                        onClick={() => handleOpenDetailModal(request.id)}
                        sx={{
                          borderColor: '#2196f3',
                          color: '#2196f3',
                          textTransform: 'none',
                          fontWeight: 600,
                          minHeight: '44px',
                          fontSize: { xs: '0.813rem', sm: '0.875rem' },
                          px: { xs: 1.5, sm: 2 },
                          '&:hover': {
                            borderColor: '#1976d2',
                            backgroundColor: 'rgba(33, 150, 243, 0.08)'
                          }
                        }}
                      >
                        {t('common.viewDetails')}
                      </Button>
                      {request.status === 'open' && (
                        <Button
                          size="small"
                          onClick={() => handleStatusChange(request.id, 'filled')}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            minHeight: '44px',
                            fontSize: { xs: '0.813rem', sm: '0.875rem' },
                            px: { xs: 1.5, sm: 2 },
                            color: '#4caf50',
                            '&:hover': {
                              backgroundColor: 'rgba(76, 175, 80, 0.08)'
                            }
                          }}
                        >
                          {t('teamup.markAsFilled')}
                        </Button>
                      )}
                      {request.status === 'filled' && (
                        <Button
                          size="small"
                          onClick={() => handleStatusChange(request.id, 'open')}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            minHeight: '44px',
                            fontSize: { xs: '0.813rem', sm: '0.875rem' },
                            px: { xs: 1.5, sm: 2 },
                            color: '#2196f3',
                            '&:hover': {
                              backgroundColor: 'rgba(33, 150, 243, 0.08)'
                            }
                          }}
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
            <Box sx={{ 
              textAlign: 'center', 
              py: { xs: 6, sm: 8 },
              backgroundColor: '#1a202c',
              borderRadius: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              <Typography variant="h4" sx={{ mb: 2, fontSize: { xs: '2.5rem', sm: '3rem' } }}>📬</Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                {t('teamup.noResponsesReceived')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
                {t('teamup.noResponsesReceivedDesc')}
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={{ xs: 2, sm: 3 }}>
              {requestsWithResponses.map((request) => {
                const stats = getResponseStats(request);
                const spotsLeft = request.playersNeeded - stats.accepted;

                return (
                  <Grid size={{ xs: 12, md: 6, lg: 4 }} key={request.id}>
                    <Card sx={{
                      cursor: 'pointer',
                      height: '100%',
                      borderRadius: 2,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: '0 12px 24px rgba(102, 126, 234, 0.3)'
                      }
                    }}
                    onClick={() => handleOpenDetailModal(request.id)}
                    >
                      <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
                        <Typography variant="h6" component="div" gutterBottom sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' } }}>
                          {request.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                          <Chip
                            label={request.sportType}
                            size="small"
                            sx={{ 
                              background: '#2196f3',
                              color: 'white',
                              fontWeight: 600
                            }}
                          />
                          <Typography variant="body2" color="text.secondary">•</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(request.dateTime).toLocaleString()}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1, mb: 2 }}>
                          <Chip
                            label={`${stats.pending} ${t('teamup.pending')}`}
                            size="small"
                            sx={{
                              backgroundColor: '#374151',
                              fontWeight: 600
                            }}
                          />
                          <Chip
                            label={`${stats.accepted} ${t('teamup.accepted')}`}
                            size="small"
                            sx={{
                              background: 'linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)',
                              color: 'white',
                              fontWeight: 600
                            }}
                          />
                          <Chip
                            label={`${stats.declined} ${t('teamup.declined')}`}
                            size="small"
                            sx={{
                              backgroundColor: 'error.light',
                              color: 'white',
                              fontWeight: 600
                            }}
                          />
                          <Chip
                            label={`${spotsLeft} ${t('teamup.spotsLeft')}`}
                            size="small"
                            sx={{
                              background: spotsLeft > 0 
                                ? 'linear-gradient(135deg, #2196f3 0%, #21cbf3 100%)'
                                : 'grey.400',
                              color: 'white',
                              fontWeight: 600
                            }}
                          />
                        </Stack>
                        {stats.pending > 0 && (
                          <Alert 
                            severity="info" 
                            sx={{ 
                              mt: 2,
                              borderRadius: 2,
                              fontWeight: 600,
                              '& .MuiAlert-icon': {
                                fontSize: '1.5rem'
                              }
                            }}
                          >
                            {stats.pending} {t('teamup.pendingResponses')}
                          </Alert>
                        )}
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
          <DialogTitle sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
            {editingRequest ? t('teamup.editRequest') : t('teamup.createRequest')}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={{ xs: 1.5, sm: 2 }} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                required
                label={t('teamup.requestTitle')}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
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
                sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
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
                sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
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
                sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
              />
              <TextField
                fullWidth
                select
                label={t('teamup.skillLevel')}
                value={formData.skillLevel}
                onChange={(e) => setFormData({ ...formData, skillLevel: e.target.value })}
                sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
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
                sx={{ '& .MuiInputBase-root': { minHeight: { xs: '44px', sm: '56px' } } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 3 } }}>
            <Button onClick={handleCloseDialog} sx={{ minHeight: '44px', px: { xs: 2, sm: 3 } }}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="contained" sx={{ minHeight: '44px', px: { xs: 2, sm: 3 } }}>
              {editingRequest ? t('common.save') : t('common.create')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Detail Modal */}
      {selectedRequestId && (
        <TeamUpDetailModal
          open={openDetailModal}
          onClose={handleCloseDetailModal}
          requestId={selectedRequestId}
          onUpdate={handleDetailModalUpdate}
        />
      )}
    </Box>
  );
};

export default NeedPlayersTab;
