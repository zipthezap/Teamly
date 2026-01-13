import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Grid,
  Typography,
  Alert,
  Chip,
  Avatar,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { teamUpAPI } from '../../services/api';
import { LoadingSpinner } from '../common';
import { useAuth } from '../../contexts/AuthContext';
import { getImageUrl, getInitials } from '../../utils/imageUtils';
import { TeamUpRequest, TeamUpRequestWithDetails, TeamUpRequestFilters, TeamUpResponse } from '../../types/teamup';
import TeamUpDetailModal from './TeamUpDetailModal';
import { SPORT_TYPES } from '../../constants/teamup';
import { getTeamUpStatusColor } from '../../utils/statusHelpers';

const LookingForPlayTab = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [view, setView] = useState<'browse' | 'myResponses'>('browse');
  const [requests, setRequests] = useState<TeamUpRequestWithDetails[]>([]);
  const [myResponses, setMyResponses] = useState<TeamUpResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);
  
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
      const requestsArray = Array.isArray(response.data) ? response.data : [];
      const sortedRequests = requestsArray.sort((a: TeamUpRequest, TeamUpRequestWithDetails, b: TeamUpRequest) => {
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

  const handleOpenModal = (requestId: string) => {
    setSelectedRequestId(requestId);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setSelectedRequestId(null);
  };

  const handleModalUpdate = () => {
    if (view === 'browse') {
      fetchRequests();
    } else {
      fetchMyResponses();
    }
  };

  const isOwnRequest = (request: TeamUpRequestWithDetails) => {
    return request.creator?.id === user?.id;
  };

  const hasResponded = (request: TeamUpRequestWithDetails) => {
    return request.responses?.some((r) => r.userId === user?.id);
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
          sx={{
            backgroundColor: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderRadius: 2,
            '& .MuiToggleButton-root': {
              px: 3,
              py: 1.5,
              border: 'none',
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.95rem',
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: 'rgba(102, 126, 234, 0.08)'
              },
              '&.Mui-selected': {
                backgroundColor: '#667eea',
                color: 'white',
                '&:hover': {
                  backgroundColor: '#5568d3'
                }
              }
            }
          }}
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
          <Box sx={{ 
            mb: 3, 
            p: 3, 
            backgroundColor: 'white',
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <Grid container spacing={2}>
              <Grid xs={12} sm={4}>
                <TextField
                  fullWidth
                  select
                  label={t('teamup.filterBySport')}
                  value={filters.sportType}
                  onChange={(e) => setFilters({ ...filters, sportType: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': {
                        borderColor: '#667eea'
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#667eea'
                      }
                    }
                  }}
                >
                  <MenuItem value="">{t('teamup.allSports')}</MenuItem>
                  {SPORT_TYPES.map((sport) => (
                    <MenuItem key={sport} value={sport}>
                      {sport}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid xs={12} sm={4}>
                <TextField
                  fullWidth
                  label={t('teamup.filterByLocation')}
                  value={filters.city}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                  placeholder="City"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': {
                        borderColor: '#667eea'
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#667eea'
                      }
                    }
                  }}
                />
              </Grid>
              <Grid xs={12} sm={4}>
                <TextField
                  fullWidth
                  select
                  label={t('teamup.filterBySkillLevel')}
                  value={filters.skillLevel}
                  onChange={(e) => setFilters({ ...filters, skillLevel: e.target.value })}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': {
                        borderColor: '#667eea'
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#667eea'
                      }
                    }
                  }}
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
            <Box sx={{ 
              textAlign: 'center', 
              py: 8,
              backgroundColor: 'white',
              borderRadius: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              <Typography variant="h4" sx={{ mb: 2, fontSize: '3rem' }}>🔍</Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {t('teamup.noRequestsFound')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try adjusting your filters to see more activities
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {requests.map((request) => {
                const ownRequest = isOwnRequest(request);
                const responded = hasResponded(request);
                const acceptedResponses = request.responses?.filter(
                  (r) => r.status === 'accepted'
                ).length || 0;
                const spotsLeft = request.playersNeeded - acceptedResponses;
                
                const eventDate = new Date(request.dateTime).getTime();
                const now = Date.now();
                const hoursUntil = (eventDate - now) / (1000 * 60 * 60);
                const isUrgent = hoursUntil <= 48 && hoursUntil > 0;

                return (
                  <Grid size={{ xs: 12, md: 6, lg: 4 }} key={request.id}>
                    <Card sx={{ 
                      position: 'relative',
                      cursor: 'pointer',
                      height: '100%',
                      borderRadius: 2,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      overflow: 'visible',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: '0 12px 24px rgba(102, 126, 234, 0.3)'
                      },
                      ...(isUrgent && {
                        borderLeft: 4,
                        borderColor: 'warning.main',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '4px',
                          background: 'linear-gradient(90deg, #ff9800 0%, #f44336 100%)',
                          borderRadius: '8px 8px 0 0'
                        }
                      })
                    }}
                    onClick={() => handleOpenModal(request.id)}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="h6" component="div" sx={{ 
                            fontWeight: 600,
                            color: '#1a1a1a',
                            flex: 1,
                            pr: 1
                          }}>
                            {request.title}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                            {isUrgent && (
                              <Chip
                                label={t('teamup.urgent')}
                                color="warning"
                                size="small"
                                sx={{ 
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                  height: 24
                                }}
                              />
                            )}
                            <Chip
                              label={request.sportType}
                              size="small"
                              sx={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: '0.7rem',
                                height: 24
                              }}
                            />
                          </Box>
                        </Box>
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
                              WebkitBoxOrient: 'vertical',
                              lineHeight: 1.5
                            }}
                          >
                            {request.description}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontSize: '1rem' }}>📅</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                              {new Date(request.dateTime).toLocaleString()}
                            </Typography>
                          </Box>
                          {request.location && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ fontSize: '1rem' }}>📍</Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                                {request.location}
                              </Typography>
                            </Box>
                          )}
                          {request.city && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ fontSize: '1rem' }}>🌍</Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                                {request.city}{request.country ? `, ${request.country}` : ''}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" fontWeight={600} color="text.secondary">
                              👥 Spots Filled
                            </Typography>
                            <Typography variant="caption" fontWeight={700} color={spotsLeft === 0 ? 'success.main' : 'primary.main'}>
                              {acceptedResponses}/{request.playersNeeded}
                            </Typography>
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={(acceptedResponses / request.playersNeeded) * 100}
                            sx={{ 
                              height: 8, 
                              borderRadius: 4,
                              backgroundColor: 'rgba(0, 0, 0, 0.08)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 4,
                                background: spotsLeft === 0 
                                  ? 'linear-gradient(90deg, #4caf50 0%, #8bc34a 100%)'
                                  : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                              }
                            }}
                          />
                        </Box>
                        {request.skillLevel && request.skillLevel !== 'any' && (
                          <Chip
                            label={t(`teamup.skillLevels.${request.skillLevel}`)}
                            size="small"
                            variant="outlined"
                            sx={{ 
                              mt: 1,
                              borderColor: '#667eea',
                              color: '#667eea',
                              fontWeight: 600
                            }}
                          />
                        )}
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          mt: 3,
                          pt: 2,
                          borderTop: '1px solid',
                          borderColor: 'divider'
                        }}>
                          <Avatar
                            src={getImageUrl(request.creator?.profilePicture)}
                            sx={{ 
                              width: 36, 
                              height: 36, 
                              mr: 1.5,
                              border: '2px solid',
                              borderColor: 'primary.light'
                            }}
                          >
                            {getInitials(request.creator?.name || 'User')}
                          </Avatar>
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.2 }}>
                              {t('teamup.postedBy')}
                            </Typography>
                            <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>
                              {request.creator?.name}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
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
            <Box sx={{ 
              textAlign: 'center', 
              py: 8,
              backgroundColor: 'white',
              borderRadius: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              <Typography variant="h4" sx={{ mb: 2, fontSize: '3rem' }}>💬</Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {t('teamup.noResponsesYet')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start browsing activities and express your interest!
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {myResponses.map((response) => (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={response.id}>
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
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'flex-start' }}>
                        <Typography variant="h6" component="div" sx={{ 
                          fontWeight: 600,
                          flex: 1,
                          pr: 1
                        }}>
                          {response.teamUpRequest?.title}
                        </Typography>
                        <Chip
                          label={t(`teamup.responseStatus.${response.status}`)}
                          color={getTeamUpStatusColor(response.status)}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>
                      <Chip
                        label={response.teamUpRequest?.sportType}
                        size="small"
                        sx={{ 
                          mb: 2,
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          fontWeight: 600
                        }}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '1rem' }}>📅</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(response.teamUpRequest?.dateTime || '').toLocaleString()}
                        </Typography>
                      </Box>
                      {response.message && (
                        <Box sx={{ 
                          mt: 2, 
                          p: 2, 
                          bgcolor: 'grey.50', 
                          borderRadius: 2,
                          borderLeft: 3,
                          borderColor: '#667eea'
                        }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
                            {t('teamup.yourMessage')}:
                          </Typography>
                          <Typography variant="body2">
                            {response.message}
                          </Typography>
                        </Box>
                      )}
                      <Typography 
                        variant="caption" 
                        color="text.secondary" 
                        sx={{ 
                          display: 'block', 
                          mt: 2,
                          pt: 2,
                          borderTop: '1px solid',
                          borderColor: 'divider'
                        }}
                      >
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

      {selectedRequestId && (
        <TeamUpDetailModal
          open={openModal}
          onClose={handleCloseModal}
          requestId={selectedRequestId}
          onUpdate={handleModalUpdate}
        />
      )}
    </Box>
  );
};

export default LookingForPlayTab;
