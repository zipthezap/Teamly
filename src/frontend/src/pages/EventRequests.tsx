import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import EventForm, { EventFormData } from '../components/common/EventForm';
import { useNavigate, useParams } from 'react-router-dom';
import { eventRequestsAPI, groupsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { EventRequestWithDetails, GroupWithDetails } from '../../../shared/types';
import { getErrorMessage } from '../utils/errorHandler';
import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogTitle,
  Snackbar,
  Alert,
  Chip,
  LinearProgress,
  CircularProgress,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CloseIcon from '@mui/icons-material/Close';

const EventRequests = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [requests, setRequests] = useState<EventRequestWithDetails[]>([]);
  const [group, setGroup] = useState<GroupWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<Record<string, boolean>>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [newRequest, setNewRequest] = useState<EventFormData>({
    title: '',
    description: '',
    eventType: 'football',
    location: '',
    startDate: '',
    startHour: '',
    startMinute: '00',
    endHour: '',
    endMinute: '00',
    maxPlayers: '',
    groupId: groupId || '',
  });

  const fetchData = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const [requestsRes, groupRes] = await Promise.all([
        eventRequestsAPI.getByGroup(groupId),
        groupsAPI.getById(groupId),
      ]);
      setRequests(requestsRes.data);
      setGroup(groupRes.data);
    } catch (error: unknown) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error) || t('events.eventRequests.failedToLoad'),
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    if (groupId) {
      fetchData();
    }
  }, [groupId, fetchData]);

  const handleVote = async (requestId: string, vote: 'yes' | 'no') => {
    setVoting((prev) => ({ ...prev, [requestId]: true }));
    try {
      await eventRequestsAPI.vote(requestId, vote);
      await fetchData();
      setSnackbar({
        open: true,
        message: t('events.eventRequests.voteRecorded'),
        severity: 'success',
      });
    } catch (error: unknown) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error) || t('events.eventRequests.failedToVote'),
        severity: 'error',
      });
    } finally {
      setVoting((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const handleFinalize = async (requestId: string) => {
    try {
      await eventRequestsAPI.finalize(requestId);
      await fetchData();
      setSnackbar({
        open: true,
        message: t('events.eventRequests.finalized'),
        severity: 'success',
      });
    } catch (error: unknown) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error) || t('events.eventRequests.failedToFinalize'),
        severity: 'error',
      });
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      await eventRequestsAPI.cancel(requestId);
      await fetchData();
      setSnackbar({
        open: true,
        message: t('events.eventRequests.cancelled'),
        severity: 'success',
      });
    } catch (error: unknown) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error) || t('events.eventRequests.failedToCancel'),
        severity: 'error',
      });
    }
  };

  const handleCreateRequest = async (formData: EventFormData) => {
    try {
      if (!formData.startDate || !formData.startHour) {
        setSnackbar({ open: true, message: t('events.startDateRequired'), severity: 'error' });
        return;
      }
      const startTime = `${formData.startHour.padStart(2, '0')}:${formData.startMinute}`;
      let endTime = null;
      if (formData.endHour) {
        endTime = `${formData.endHour.padStart(2, '0')}:${formData.endMinute}`;
      }
      const startDateTime = new Date(`${formData.startDate}T${startTime}`);
      let endDateTime = null;
      if (endTime) {
        endDateTime = new Date(`${formData.startDate}T${endTime}`);
        if (endDateTime <= startDateTime) {
          setSnackbar({ open: true, message: t('events.eventRequests.endTimeAfterStart'), severity: 'error' });
          return;
        }
      }
      
      if (!groupId) {
        setSnackbar({ open: true, message: t('events.eventRequests.groupIdRequired'), severity: 'error' });
        return;
      }
      
      const data = {
        groupId,
        title: formData.title,
        description: formData.description,
        eventType: formData.eventType,
        location: formData.location,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime ? endDateTime.toISOString() : undefined,
        maxPlayers: formData.maxPlayers ? parseInt(formData.maxPlayers) : undefined,
      };
      await eventRequestsAPI.create(data);
      await fetchData();
      setCreateDialogOpen(false);
      setNewRequest({
        title: '',
        description: '',
        eventType: 'football',
        location: '',
        startDate: '',
        startHour: '',
        startMinute: '00',
        endHour: '',
        endMinute: '00',
        maxPlayers: '',
        groupId: groupId || '',
      });
      setSnackbar({
        open: true,
        message: t('events.eventRequests.created'),
        severity: 'success',
      });
    } catch (error: unknown) {
      setSnackbar({
        open: true,
        message: getErrorMessage(error) || t('events.eventRequests.failedToCreate'),
        severity: 'error',
      });
    }
  };

  const isAdmin = group?.members?.some(
    (m) => m.id === user?.id && m.role === 'admin'
  );

  const isMember = group?.members?.some(
    (m) => m.id === user?.id
  );

  const getVotePercentage = (request: EventRequestWithDetails) => {
    const total = (request.yesVotes || 0) + (request.noVotes || 0);
    if (total === 0) return 0;
    return ((request.yesVotes || 0) / total) * 100;
  };

  const getUserVote = (request: EventRequestWithDetails) => {
    return request.votes?.find((v) => v.id === user?.id)?.vote;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 3, md: 4 }, mb: { xs: 2, sm: 3, md: 4 }, px: { xs: 2, sm: 3 } }}>
      <Box 
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: { xs: 2, sm: 0 },
          mb: { xs: 3, sm: 4 }
        }}
      >
        <Box>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 600, 
              mb: 0.5,
              fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' }
            }}
          >
            {t('events.eventRequests.title')}
          </Typography>
          {group && (
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
            >
              {group.name}
            </Typography>
          )}
        </Box>
        {group?.id && (
          <Button
            variant="outlined"
            onClick={() => navigate(`/groups/${group.id}`)}
            sx={{
              minHeight: '44px',
              fontSize: '0.875rem',
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            {t('groups.joinGroup.viewGroup')}
          </Button>
        )}
        {isMember && (
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ 
              minHeight: '44px',
              fontSize: '0.875rem',
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            {t('events.eventRequests.createRequest')}
          </Button>
        )}
      </Box>

      {requests.length === 0 ? (
        <Box 
          sx={{ 
            textAlign: 'center', 
            py: { xs: 8, sm: 12, md: 16 },
            px: { xs: 2, sm: 3 }
          }}
        >
          <Box 
            component="svg" 
            sx={{ 
              mx: 'auto', 
              mb: 2, 
              width: { xs: 48, sm: 64 }, 
              height: { xs: 48, sm: 64 },
              color: 'text.disabled'
            }} 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            viewBox="0 0 24 24"
          >
            <path d="M9 17v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" />
            <path d="M12 19v2" />
            <circle cx="12" cy="12" r="10" />
          </Box>
          <Typography 
            variant="h6" 
            sx={{ 
              color: 'text.secondary',
              fontWeight: 600,
              mb: 1,
              fontSize: { xs: '1rem', sm: '1.25rem' }
            }}
          >
            {t('events.eventRequests.noRequests')}
          </Typography>
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            {isMember
              ? t('events.eventRequests.noRequestsMember')
              : t('events.eventRequests.noRequestsUser')}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
          {requests.map((request) => {
            const userVote = getUserVote(request);
            const votePercentage = getVotePercentage(request);

            return (
              <Card 
                key={request.id}
                sx={{ 
                  transition: 'all 0.3s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4,
                  }
                }}
              >
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      justifyContent: 'space-between',
                      gap: { xs: 1.5, sm: 2 },
                      mb: 2
                    }}
                  >
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 600,
                        fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' }
                      }}
                    >
                      {request.title}
                    </Typography>
                    <Chip 
                      label={t(`events.eventRequests.status.${request.status}`)}
                      size="small"
                      color={
                        request.status === 'voting' 
                          ? 'info' 
                          : request.status === 'finalized' 
                            ? 'success' 
                            : 'default'
                      }
                      sx={{ 
                        fontWeight: 600,
                        minHeight: { xs: '28px', sm: '32px' }
                      }}
                    />
                  </Box>

                  {request.description && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mb: 2,
                        fontSize: { xs: '0.813rem', sm: '0.875rem' }
                      }}
                    >
                      {request.description}
                    </Typography>
                  )}

                  <Box 
                    sx={{ 
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                      gap: 1,
                      mb: 2
                    }}
                  >
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}
                    >
                      {t('events.eventType')}: {request.eventType}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}
                    >
                      {t('events.location')}: {request.location || t('events.eventRequests.tbd')}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}
                    >
                      {t('events.eventDate')}: {new Date(request.startTime).toLocaleString()}
                    </Typography>
                    {request.maxPlayers && (
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}
                      >
                        {t('events.maxPlayers')}: {request.maxPlayers}
                      </Typography>
                    )}
                  </Box>

                  {request.status === 'voting' && (
                    <>
                      <Box sx={{ mb: 2 }}>
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            mb: 1,
                            fontSize: { xs: '0.75rem', sm: '0.813rem' }
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            {t('events.eventRequests.yes')}: {request.yesVotes} | {t('events.eventRequests.no')}: {request.noVotes}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {votePercentage.toFixed(0)}% {t('events.eventRequests.approval')}
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={votePercentage}
                          color={votePercentage >= 50 ? 'success' : 'error'}
                          sx={{ 
                            height: { xs: 6, sm: 8 },
                            borderRadius: 1
                          }}
                        />
                      </Box>
                      {userVote && (
                        <Alert 
                          severity="info"
                          sx={{ 
                            mb: 2,
                            fontSize: { xs: '0.75rem', sm: '0.813rem' },
                            py: { xs: 0.5, sm: 1 }
                          }}
                        >
                          {t('events.eventRequests.youVoted', { vote: t(`events.eventRequests.${userVote}`) })}
                        </Alert>
                      )}
                    </>
                  )}

                  <Box 
                    sx={{ 
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      flexWrap: 'wrap',
                      gap: { xs: 1.5, sm: 2 },
                      mt: 2
                    }}
                  >
                    {request.status === 'voting' && (
                      <>
                        <Button
                          variant={userVote === 'yes' ? 'contained' : 'outlined'}
                          color="success"
                          startIcon={<ThumbUpIcon />}
                          onClick={() => handleVote(request.id, 'yes')}
                          disabled={voting[request.id]}
                          sx={{ 
                            minHeight: '44px',
                            fontSize: { xs: '0.813rem', sm: '0.875rem' },
                            flex: { xs: '1 1 100%', sm: '0 1 auto' }
                          }}
                        >
                          {t('events.eventRequests.yes')}
                        </Button>
                        <Button
                          variant={userVote === 'no' ? 'contained' : 'outlined'}
                          color="error"
                          startIcon={<ThumbDownIcon />}
                          onClick={() => handleVote(request.id, 'no')}
                          disabled={voting[request.id]}
                          sx={{ 
                            minHeight: '44px',
                            fontSize: { xs: '0.813rem', sm: '0.875rem' },
                            flex: { xs: '1 1 100%', sm: '0 1 auto' }
                          }}
                        >
                          {t('events.eventRequests.no')}
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              variant="outlined"
                              color="primary"
                              startIcon={<CheckCircleIcon />}
                              onClick={() => handleFinalize(request.id)}
                              sx={{ 
                                minHeight: '44px',
                                fontSize: { xs: '0.813rem', sm: '0.875rem' },
                                flex: { xs: '1 1 100%', sm: '0 1 auto' }
                              }}
                            >
                              {t('events.eventRequests.finalize')}
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              startIcon={<CancelIcon />}
                              onClick={() => handleCancel(request.id)}
                              sx={{ 
                                minHeight: '44px',
                                fontSize: { xs: '0.813rem', sm: '0.875rem' },
                                flex: { xs: '1 1 100%', sm: '0 1 auto' }
                              }}
                            >
                              {t('common.cancel')}
                            </Button>
                          </>
                        )}
                      </>
                    )}
                    {request.status === 'finalized' && (
                      <Alert 
                        severity="success"
                        sx={{ 
                          width: '100%',
                          fontSize: { xs: '0.75rem', sm: '0.813rem' },
                          py: { xs: 0.5, sm: 1 }
                        }}
                      >
                        {t('events.eventRequests.eventCreated')}
                      </Alert>
                    )}
                    {request.status === 'cancelled' && (
                      <Alert 
                        severity="error"
                        sx={{ 
                          width: '100%',
                          fontSize: { xs: '0.75rem', sm: '0.813rem' },
                          py: { xs: 0.5, sm: 1 }
                        }}
                      >
                        {t('events.eventRequests.cancelled')}
                      </Alert>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      {/* Create Event Request Dialog */}
      <Dialog 
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={false}
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: 2, sm: 3 },
            maxHeight: { xs: 'calc(100% - 32px)', sm: 'calc(100% - 64px)' }
          }
        }}
      >
        <DialogTitle 
          sx={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 2,
            fontSize: { xs: '1.125rem', sm: '1.25rem' }
          }}
        >
          {t('events.eventRequests.createRequest')}
          <IconButton
            edge="end"
            color="inherit"
            onClick={() => setCreateDialogOpen(false)}
            aria-label="close"
            sx={{ minWidth: '44px', minHeight: '44px' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2 } }}>
          <EventForm
            initialData={{ ...newRequest, groupId: groupId || '' }}
            loading={false}
            error={''}
            onSubmit={handleCreateRequest}
            onCancel={() => setCreateDialogOpen(false)}
            submitLabel={t('common.create')}
            showGroupSelect={false}
          />
        </DialogContent>
      </Dialog>

      {/* Snackbar */}
      <Snackbar 
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity as 'success' | 'error' | 'info'}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default EventRequests;
