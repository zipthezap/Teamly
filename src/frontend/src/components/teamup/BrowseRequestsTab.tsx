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
  LinearProgress,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { teamUpAPI } from '../../services/api';
import { LoadingSpinner } from '../common';
import { useAuth } from '../../contexts/AuthContext';
import { getImageUrl, getInitials } from '../../utils/imageUtils';
import { TeamUpRequest, TeamUpRequestFilters } from '../../types/teamup';
import TeamUpDetailModal from './TeamUpDetailModal';

const SPORT_TYPES = [
  '⚽ Soccer (Football)',
  '🏀 Basketball',
  '🏏 Cricket',
  '🏈 American Football',
  '🏒 Ice Hockey',
  '⚾ Baseball',
  '🏐 Volleyball',
  '🏉 Rugby',
  '🤾 Handball',
  '🏑 Field Hockey',
  'Tennis',
  'Running',
  'Cycling',
  'Swimming',
  'Other',
];

const BrowseRequestsTab = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [requests, setRequests] = useState<TeamUpRequest[]>([]);
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
    fetchRequests();
  }, [filters]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params: TeamUpRequestFilters = { status: 'open' };
      if (filters.sportType) params.sportType = filters.sportType;
      if (filters.city) params.city = filters.city;
      if (filters.country) params.country = filters.country;
      if (filters.skillLevel) params.skillLevel = filters.skillLevel;
      
      const response = await teamUpAPI.getAll(params);
      
      // Sort by urgency: soonest events first, then by spots left
      const sortedRequests = response.data.sort((a: TeamUpRequest, b: TeamUpRequest) => {
        const aDate = new Date(a.dateTime).getTime();
        const bDate = new Date(b.dateTime).getTime();
        const now = Date.now();
        
        // Prioritize events happening soon (within 48 hours)
        const aUrgent = (aDate - now) < (48 * 60 * 60 * 1000);
        const bUrgent = (bDate - now) < (48 * 60 * 60 * 1000);
        
        if (aUrgent && !bUrgent) return -1;
        if (!aUrgent && bUrgent) return 1;
        
        // Then sort by date
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

  const handleOpenModal = (requestId: string) => {
    setSelectedRequestId(requestId);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setSelectedRequestId(null);
  };

  const handleModalUpdate = () => {
    fetchRequests();
  };

  const isOwnRequest = (request: TeamUpRequest) => {
    return request.creator?.id === user?.id;
  };

  const hasResponded = (request: TeamUpRequest) => {
    return request.responses?.some((r) => r.userId === user?.id);
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
            
            // Check if urgent (within 48 hours)
            const eventDate = new Date(request.dateTime).getTime();
            const now = Date.now();
            const hoursUntil = (eventDate - now) / (1000 * 60 * 60);
            const isUrgent = hoursUntil <= 48 && hoursUntil > 0;

            return (
              <Grid item xs={12} md={6} lg={4} key={request.id}>
                <Card sx={{ 
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  },
                  ...(isUrgent && {
                    borderLeft: 4,
                    borderColor: 'warning.main'
                  })
                }}
                onClick={() => handleOpenModal(request.id)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6" component="div">
                        {request.title}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {isUrgent && (
                          <Chip
                            label="Urgent"
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
                </Card>
              </Grid>
            );
          })}
        </Grid>
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

export default BrowseRequestsTab;
