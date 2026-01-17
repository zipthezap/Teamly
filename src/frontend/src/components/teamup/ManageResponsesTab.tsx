import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  Chip,
  Grid,
  Avatar,
  Stack,
  Divider,
  IconButton,
  Collapse,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { teamUpAPI } from '../../services/api';
import { LoadingSpinner } from '../common';
import { getImageUrl, getInitials } from '../../utils/imageUtils';
import { TeamUpRequestWithDetails } from '../../types/teamup';
import { getTeamUpStatusColor } from '../../utils/statusHelpers';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const ManageResponsesTab = () => {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<TeamUpRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());

  const fetchRequestsWithResponses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await teamUpAPI.getMyRequests();
      // Filter to only show requests with responses
      const requestsWithResponses = response.data.filter(
        (req: TeamUpRequestWithDetails) => req.responses && req.responses.length > 0
      );
      setRequests(requestsWithResponses);
    } catch {
      setError(t('teamup.loadingRequests'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRequestsWithResponses();
  }, [fetchRequestsWithResponses]);

  const handleResponse = async (requestId: string, responseId: string, action: 'accept' | 'decline') => {
    try {
      await teamUpAPI.handleResponse(requestId, responseId, action);
      setSuccess(
        action === 'accept'
          ? t('teamup.acceptResponseSuccess')
          : t('teamup.declineResponseSuccess')
      );
      fetchRequestsWithResponses();
    } catch {
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

  const getResponseStats = (request: TeamUpRequestWithDetails) => {
    const responses = request.responses || [];
    const pending = responses.filter(r => r.status === 'pending').length;
    const accepted = responses.filter(r => r.status === 'accepted').length;
    const declined = responses.filter(r => r.status === 'declined').length;
    return { pending, accepted, declined, total: responses.length };
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

      {requests.length === 0 ? (
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
          {requests.map((request) => {
            const stats = getResponseStats(request);
            const isExpanded = expandedRequests.has(request.id);
            const spotsLeft = request.playersNeeded - stats.accepted;

            return (
              <Grid size={{ xs: 12 }} key={request.id}>
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
                                        color={getTeamUpStatusColor(response.status)}
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
    </Box>
  );
};

export default ManageResponsesTab;
