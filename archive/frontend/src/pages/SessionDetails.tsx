import React, { useState, useCallback, useMemo } from 'react';
import SessionActions from '../components/session/SessionActions';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionsAPI, groupChatAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import InviteLinkCard from '../components/InviteLinkCard';
import { SessionParticipant, GuestParticipant, SessionParticipantStatus, GuestParticipantStatus } from '../../../shared/types/session.types';
import { PublicUser, UserProfilePicture } from '../../../shared/types/user.types';
import { useNotification } from '../hooks/useNotification';
import { useApiMutation } from '../hooks/useApiMutation';
import { usePermissions } from '../hooks/usePermissions';
import ProfileAvatar from '../components/common/ProfileAvatar';
import ConfirmationDialog from '../components/common/ConfirmationDialog';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

interface EventNotification {
  id: string;
  type: string;
  userId: string;
  user?: PublicUser;
  createdAt: Date | string;
}

const SessionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { notification, showSuccess, showError, showInfo, hideNotification } = useNotification();
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; action: 'leave' | 'delete' | null }>({ open: false, action: null });

  const {
    data: event,
    isLoading: loading,
  } = useQuery({
    queryKey: ['eventDetails', id],
    queryFn: async () => {
      const response = await sessionsAPI.getById(id!);
      return response.data;
    },
    enabled: !!id,
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  const joinMutation = useApiMutation({
    mutationFn: async () => sessionsAPI.join(id!),
    invalidateKeys: [['eventDetails', id], ['events']],
    onSuccess: () => showSuccess(t('sessionDetails.joined')),
    onError: (error) => showError(error || t('sessionDetails.failedToJoin')),
  });
  const handleJoin = useCallback(async () => {
    await joinMutation.mutateAsync();
  }, [joinMutation]);

  const leaveMutation = useApiMutation({
    mutationFn: async () => sessionsAPI.leave(id!),
    invalidateKeys: [['eventDetails', id], ['events']],
    onSuccess: () => showSuccess(t('sessionDetails.left')),
    onError: (error) => showError(error || t('sessionDetails.failedToLeave')),
  });
  const handleLeave = useCallback(async () => {
    setConfirmDialog({ open: true, action: 'leave' });
  }, []);

  const updateStatusMutation = useApiMutation({
    mutationFn: async (status: string) => sessionsAPI.updateStatus(id!, status),
    invalidateKeys: [['eventDetails', id], ['events']],
    onSuccess: (_data, status) => showSuccess(t('sessionDetails.statusUpdated', { status })),
    onError: (error) => showError(error || t('sessionDetails.failedToUpdateStatus')),
  });
  const handleUpdateStatus = useCallback(async (status: string) => {
    await updateStatusMutation.mutateAsync(status);
  }, [updateStatusMutation]);

  const deleteMutation = useApiMutation({
    mutationFn: async () => sessionsAPI.delete(id!),
    onSuccess: () => navigate('/events'),
    onError: (error) => showError(error || t('sessionDetails.failedToDelete')),
  });
  const handleDelete = useCallback(async () => {
    setConfirmDialog({ open: true, action: 'delete' });
  }, []);

  const markLateMutation = useApiMutation({
    mutationFn: async () => groupChatAPI.markLate(id!),
    invalidateKeys: [['eventDetails', id]],
    onSuccess: () => showSuccess(t('sessionDetails.markedLate')),
    onError: () => showError(t('sessionDetails.failedToMarkLate')),
  });
  const handleMarkLate = useCallback(async () => {
    await markLateMutation.mutateAsync();
  }, [markLateMutation]);

  const unmarkLateMutation = useApiMutation({
    mutationFn: async () => groupChatAPI.unmarkLate(id!),
    invalidateKeys: [['eventDetails', id]],
    onSuccess: () => showSuccess(t('sessionDetails.lateUndone')),
    onError: () => showError(t('sessionDetails.failedToUndoLate')),
  });
  const handleUnmarkLate = useCallback(async () => {
    await unmarkLateMutation.mutateAsync();
  }, [unmarkLateMutation]);

  const undoAttendanceMutation = useApiMutation({
    mutationFn: async () => sessionsAPI.deleteAttendance(id!, user!.id),
    invalidateKeys: [['eventDetails', id], ['events']],
    onSuccess: () => showSuccess(t('sessionDetails.attendanceUndone')),
    onError: (error) => showError(error || t('sessionDetails.failedToUndoAttendance')),
  });
  const handleUndoAttendance = useCallback(async () => {
    await undoAttendanceMutation.mutateAsync();
  }, [undoAttendanceMutation]);

  const generateInviteLinkMutation = useApiMutation({
    mutationFn: async () => sessionsAPI.generateInviteToken(id!),
    invalidateKeys: [['eventDetails', id]],
    onSuccess: (response: { data: { inviteToken: string } }) => {
      const inviteUrl = `${window.location.origin}/events/join/${response.data.inviteToken}`;
      navigator.clipboard.writeText(inviteUrl);
      showInfo('Invite link copied to clipboard!');
    },
    onError: (error) => showError(error || 'Failed to generate invite link'),
  });
  const handleGenerateInviteLink = useCallback(() => {
    generateInviteLinkMutation.mutate();
  }, [generateInviteLinkMutation]);

  const handleConfirmAction = useCallback(async () => {
    if (confirmDialog.action === 'leave') {
      await leaveMutation.mutateAsync();
    } else if (confirmDialog.action === 'delete') {
      await deleteMutation.mutateAsync();
    }
    setConfirmDialog({ open: false, action: null });
  }, [confirmDialog.action, leaveMutation, deleteMutation]);

  const handleCancelAction = useCallback(() => {
    setConfirmDialog({ open: false, action: null });
  }, []);

  // Helper function to get current profile picture URL
  const getCurrentProfilePicture = useCallback((profilePictures?: UserProfilePicture[], fallback?: string) => {
    const currentPic = profilePictures?.find((p: UserProfilePicture) => p.isCurrent && !p.deletedAt);
    return currentPic?.url || fallback;
  }, []);

  // Memoize computed values to prevent unnecessary recalculations
  const eventStats = useMemo(() => {
    const isParticipant = event?.participants?.some((p: SessionParticipant) => p.id === user?.id || p.userId === user?.id);
    const totalParticipants = 
      ((event?.participants?.filter((p: SessionParticipant) => p.status === SessionParticipantStatus.confirmed).length) || 0) +
      ((event?.guestParticipants?.filter((g: GuestParticipant) => g.status === GuestParticipantStatus.confirmed).length) || 0);
    const isFull = event?.maxPlayers && totalParticipants >= event?.maxPlayers;
    const confirmedCount = event?.participants?.filter((p: SessionParticipant) => p.status === SessionParticipantStatus.confirmed).length || 0;
    const declinedCount = event?.participants?.filter((p: SessionParticipant) => p.status === SessionParticipantStatus.declined).length || 0;
    const pendingCount = (event?.participants?.length || 0) - confirmedCount - declinedCount;
    const fillPercentage = event?.maxPlayers ? (totalParticipants / event.maxPlayers) * 100 : 0;

    return {
      isParticipant,
      totalParticipants,
      isFull,
      confirmedCount,
      declinedCount,
      pendingCount,
      fillPercentage,
    };
  }, [event, user?.id]);

  const isSessionParticipant = useMemo(() => {
    if (!event || !user?.id) return false;
    return (event.participants?.some((p: SessionParticipant) => p.userId === user.id) ?? false);
  }, [event, user?.id]);

  const { isCreator } = usePermissions({
    creatorId: event?.creatorId,
  });

  // Confirmation dialog content
  const confirmDialogContent = useMemo(() => {
    if (confirmDialog.action === 'leave') {
      return {
        title: t('sessionDetails.confirmLeave'),
        message: t('sessionDetails.confirmLeaveMessage', 'Are you sure you want to leave this event?'),
        color: 'primary' as const,
      };
    }
    return {
      title: t('sessionDetails.confirmDelete'),
      message: t('sessionDetails.confirmDeleteMessage', 'Are you sure you want to delete this event?'),
      color: 'error' as const,
    };
  }, [confirmDialog.action, t]);

  // Guard for missing ID - must be after all hooks
  if (!id) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Alert severity="error">{t('sessionDetails.invalidEventId')}</Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  if (!event) {
    return (
      <Container maxWidth="md" sx={{ mt: { xs: 2, sm: 3, md: 4 } }}>
        <Alert severity="error">{t('sessionDetails.notFound')}</Alert>
      </Container>
    );
  }

  const groupId = event.group?.id;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3, md: 4 }, px: { xs: 2, sm: 3 } }}>
      {/* Snackbar for notifications */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={hideNotification}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={hideNotification} severity={notification.severity} sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmDialog.open}
        title={confirmDialogContent.title}
        message={confirmDialogContent.message}
        confirmText={t('common.confirm', 'Confirm')}
        cancelText={t('common.cancel', 'Cancel')}
        confirmColor={confirmDialogContent.color}
        loading={leaveMutation.isLoading || deleteMutation.isLoading}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
      />

      <Card sx={{ position: 'relative', mb: { xs: 2, sm: 3, md: 4 } }}>
        <CardContent sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
          {/* Admin icon buttons in top right */}
          {isCreator && (
            <Box sx={{ position: 'absolute', top: { xs: 12, sm: 16 }, right: { xs: 12, sm: 16 }, display: 'flex', gap: 1, zIndex: 10 }}>
              <IconButton
                onClick={() => navigate(`/events/${event.id}/edit`)}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  minWidth: '44px',
                  minHeight: '44px',
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
                title="Edit Event"
              >
                <EditIcon />
              </IconButton>
              <IconButton
                onClick={handleDelete}
                sx={{
                  bgcolor: 'error.main',
                  color: 'white',
                  minWidth: '44px',
                  minHeight: '44px',
                  '&:hover': { bgcolor: 'error.dark' },
                }}
                title="Delete Event"
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          )}
          
          {/* Event Information Section */}
          <Box sx={{ mb: { xs: 3, sm: 4 } }}>
            <Typography 
              variant="h4" 
              sx={{ 
                fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' },
                fontWeight: 'bold',
                mb: { xs: 1.5, sm: 2 },
                pr: { xs: 10, sm: 12 }
              }}
            >
              {event.title}
            </Typography>
            {event.isPublic && (
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  bgcolor: 'success.dark',
                  color: 'success.light',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '12px',
                  fontSize: { xs: '0.75rem', sm: '0.813rem' },
                  fontWeight: 600,
                  mb: 1
                }}
              >
                🌐 Public Event
              </Box>
            )}
            <Typography 
              sx={{ 
                fontSize: { xs: '0.875rem', sm: '1rem' },
                color: 'text.secondary',
                mb: { xs: 1.5, sm: 2 },
                fontWeight: 500
              }}
            >
              {event.eventType}
            </Typography>
            <Typography 
              sx={{ 
                fontSize: { xs: '0.875rem', sm: '1rem' },
                color: 'text.primary',
                mb: { xs: 2, sm: 3 },
                lineHeight: 1.6
              }}
            >
              {event.description || t('common.noDescription')}
            </Typography>
            
            {/* Date, Time, Location */}
            <Box 
              sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                alignItems: 'center', 
                gap: { xs: 1, sm: 1.5, md: 2 },
                mb: { xs: 2, sm: 3 }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'background.default', px: 2, py: 1, borderRadius: 1, minHeight: '44px' }}>
                <span role="img" aria-label="date">📅</span>
                <Typography sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
                  {new Date(event.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'background.default', px: 2, py: 1, borderRadius: 1, minHeight: '44px' }}>
                <span role="img" aria-label="time">🕐</span>
                <Typography sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
                  {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
              {event.location && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'background.default', px: 2, py: 1, borderRadius: 1, minHeight: '44px', flexWrap: 'wrap' }}>
                  <span role="img" aria-label="location">📍</span>
                  <Typography sx={{ fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
                    {event.location}
                  </Typography>
                  {/* Google Maps Directions Button */}
                  <Link
                    href={
                      event.latitude && event.longitude
                        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.latitude + ',' + event.longitude)}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="hover"
                    sx={{ 
                      ml: 1,
                      fontSize: { xs: '0.75rem', sm: '0.813rem' },
                      color: 'primary.light'
                    }}
                    title="Open in Google Maps"
                  >
                    {event.latitude && event.longitude ? 'Directions' : 'Map'}
                  </Link>
                </Box>
              )}
            </Box>
            
            {/* Organizer Info */}
            <Box 
              sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: { xs: 2, sm: 3 },
                bgcolor: 'background.default',
                borderRadius: 1,
                px: { xs: 2, sm: 3 },
                py: { xs: 2, sm: 2.5 },
                mb: { xs: 2, sm: 3 }
              }}
            >
              <ProfileAvatar
                picture={getCurrentProfilePicture(event.creator?.profilePictures, event.creator?.profilePicture)}
                name={event.creator?.name || ''}
                size={56}
              />
              <Box>
                <Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' }, color: 'text.secondary', mb: 0.5 }}>
                  {t('sessionDetails.organizedBy')}
                </Typography>
                <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, fontWeight: 600 }}>
                  {event.creator?.name}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, color: 'text.secondary', mt: { xs: 0, sm: 0 }, ml: { xs: 0, sm: 'auto' } }}>
                {t('sessionDetails.group')}: <Box component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>{event.group?.name}</Box>
              </Typography>
              {isSessionParticipant && groupId && (
                <Link
                  component="button"
                  type="button"
                  onClick={() => navigate(`/groups/${groupId}`)}
                  underline="hover"
                  sx={{ ml: { xs: 0, sm: 2 }, fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  {t('groups.joinGroup.viewGroup')}
                </Link>
              )}
            </Box>
          </Box>

          {/* Two Column Layout: Capacity + Attendance | Activity Feed */}
          <Box 
            sx={{ 
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' },
              gap: { xs: 2, sm: 3, md: 4 }
            }}
          >
            {/* Left Column: Capacity & Attendance */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
              {/* Capacity Section */}
              <Card>
                <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
                  <Typography sx={{ fontWeight: 600, mb: { xs: 1.5, sm: 2 }, fontSize: { xs: '1rem', sm: '1.125rem' } }}>
                    {t('sessionDetails.capacity')}
                  </Typography>
                  <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, color: 'text.secondary', mb: 2 }}>
                    {event.maxPlayers ? t('sessionDetails.participantsCount', { count: eventStats.totalParticipants, max: event.maxPlayers }) : t('sessionDetails.participants', { count: eventStats.totalParticipants })}
                  </Typography>
                  {event.maxPlayers && (
                    <Box sx={{ width: '100%', bgcolor: 'grey.700', borderRadius: '4px', height: 12, mb: 2, overflow: 'hidden' }}>
                      <Box sx={{ bgcolor: 'primary.main', height: '100%', borderRadius: '4px', transition: 'width 0.3s', width: `${eventStats.fillPercentage}%` }} />
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 1.5 }, fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>
                    <Box component="span" sx={{ bgcolor: 'background.paper', px: 1, py: 0.5, borderRadius: 0.5, color: 'text.secondary' }}>
                      ✅ {eventStats.confirmedCount} {t('sessionDetails.confirmed')}
                    </Box>
                    <Box component="span" sx={{ bgcolor: 'background.paper', px: 1, py: 0.5, borderRadius: 0.5, color: 'text.secondary' }}>
                      ❌ {eventStats.declinedCount} {t('sessionDetails.declined')}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
              
              {/* Attendance/Activity Actions: disabled for past events */}
              {new Date(event.startTime) >= new Date() ? (
                <Card>
                  <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
                    <Typography sx={{ fontWeight: 600, mb: { xs: 1.5, sm: 2 }, fontSize: { xs: '1rem', sm: '1.125rem' } }}>
                      {t('sessionDetails.yourAttendance')}
                    </Typography>
                    <SessionActions
                      event={event}
                      isParticipant={eventStats.isParticipant}
                      isCreator={isCreator}
                      isFull={eventStats.isFull}
                      onJoin={handleJoin}
                      onLeave={handleLeave}
                      onUpdateStatus={handleUpdateStatus}
                      onDelete={handleDelete}
                      onMarkLate={handleMarkLate}
                      onUnmarkLate={handleUnmarkLate}
                      onUndoAttendance={handleUndoAttendance}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card sx={{ opacity: 0.5, pointerEvents: 'none' }}>
                  <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
                    <Typography sx={{ fontWeight: 600, mb: { xs: 1.5, sm: 2 }, fontSize: { xs: '1rem', sm: '1.125rem' } }}>
                      {t('sessionDetails.activityDisabled')}
                    </Typography>
                    <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, color: 'text.secondary' }}>
                      {t('sessionDetails.pastEventNoActions')}
                    </Typography>
                  </CardContent>
                </Card>
              )}
              
              {/* Invite Link Section - Only for creator */}
              <InviteLinkCard
                inviteToken={event.inviteToken ?? null}
                eventTitle={event.title}
                eventDate={new Date(event.startTime).toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
                isCreator={isCreator}
                onGenerateLink={async () => { handleGenerateInviteLink(); }}
                isPublic={event.isPublic}
                isPast={new Date(event.startTime) < new Date()}
              />
            </Box>
            
            {/* Right Column: Activity Feed - Fixed Height */}
            <Card
              sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                maxHeight: { xs: '400px', sm: '500px' }
              }}
              key={event.eventNotifications?.length || 0}
            >
              <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 }, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Typography sx={{ fontWeight: 600, mb: { xs: 1.5, sm: 2 }, fontSize: { xs: '1rem', sm: '1.125rem' }, flexShrink: 0 }}>
                  {t('sessionDetails.activityFeed')}
                </Typography>
                <Box sx={{ flex: 1, overflowY: 'auto', fontSize: { xs: '0.875rem', sm: '1rem' }, color: 'text.secondary', pr: 1 }}>
                  {(event.eventNotifications || []).length === 0 ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
                      <Box>
                        <Box sx={{ fontSize: '2.5rem', mb: 1 }}>📋</Box>
                        <Typography>{t('sessionDetails.noActivity')}</Typography>
                      </Box>
                    </Box>
                  ) : (
                    event.eventNotifications && event.eventNotifications.map((n: EventNotification) => {
                      let action = '';
                      switch (n.type) {
                        case 'join':
                          action = t('sessionDetails.activityJoin', { name: n.user?.name || t('sessionDetails.user') });
                          break;
                        case 'leave':
                          action = t('sessionDetails.activityLeave', { name: n.user?.name || t('sessionDetails.user') });
                          break;
                        case 'confirmed':
                          action = t('sessionDetails.activityConfirmed', { name: n.user?.name || t('sessionDetails.user') });
                          break;
                        case 'declined':
                          action = t('sessionDetails.activityDeclined', { name: n.user?.name || t('sessionDetails.user') });
                          break;
                        case 'late':
                          action = t('sessionDetails.activityLate', { name: n.user?.name || t('sessionDetails.user') });
                          break;
                        default:
                          action = n.type;
                      }
                      return (
                        <Box 
                          key={n.id} 
                          sx={{ 
                            mb: 2, 
                            pb: 2, 
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            '&:last-child': { borderBottom: 'none' }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                            <ProfileAvatar
                              picture={getCurrentProfilePicture(n.user?.profilePictures, n.user?.profilePicture)}
                              name={n.user?.name || t('sessionDetails.user')}
                              size={36}
                            />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ color: 'text.primary', fontWeight: 500, fontSize: { xs: '0.875rem', sm: '1rem' }, mb: 0.5 }}>
                                {n.user?.name || t('sessionDetails.user')}
                              </Typography>
                              <Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' }, color: 'text.secondary', mb: 0.5 }}>
                                {action}
                              </Typography>
                              <Typography sx={{ fontSize: { xs: '0.688rem', sm: '0.75rem' }, color: 'text.disabled' }}>
                                {new Date(n.createdAt).toLocaleString()}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>
        </CardContent>
      </Card>
      
      {/* Participants List */}
      <Card sx={{ mt: { xs: 2, sm: 3, md: 4 } }}>
        <CardContent sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
          <Typography sx={{ fontWeight: 600, mb: { xs: 2, sm: 3 }, fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
            {t('sessionDetails.participantsList', { count: eventStats.totalParticipants })}
          </Typography>
          <Box 
            sx={{ 
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
              gap: { xs: 2, sm: 3 }
            }}
          >
            {event?.participants?.map((p: SessionParticipant) => (
              <Box 
                key={p.id} 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2, 
                  bgcolor: 'background.default', 
                  borderRadius: 1,
                  px: { xs: 2, sm: 2.5 },
                  py: { xs: 2, sm: 2.5 }
                }}
              >
                <ProfileAvatar
                  picture={getCurrentProfilePicture(p.user?.profilePictures, p.user?.profilePicture)}
                  name={p.user?.name || ''}
                  size={44}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography 
                      sx={{ 
                        fontSize: { xs: '0.875rem', sm: '1rem' }, 
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {p.user?.name}
                    </Typography>
                    {/* Show 'Will be late' badge if attendance for this user is late */}
                    {event.eventAttendances?.find((a: { userId: string; status: string }) => a.userId === p.userId && a.status === 'late') && (
                      <Box
                        component="span"
                        sx={{
                          px: 1,
                          py: 0.25,
                          borderRadius: '12px',
                          fontSize: { xs: '0.625rem', sm: '0.688rem' },
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          bgcolor: 'warning.dark',
                          color: 'warning.light'
                        }}
                      >
                        {t('sessionDetails.willBeLate', 'Will be late')}
                      </Box>
                    )}
                  </Box>
                  <Typography 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.813rem' }, 
                      color: 'text.secondary',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      mb: 0.5
                    }}
                  >
                    {p.user?.email}
                  </Typography>
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      px: 1,
                      py: 0.5,
                      borderRadius: 0.5,
                      fontSize: { xs: '0.75rem', sm: '0.813rem' },
                      fontWeight: 500,
                      ...(p.status === 'confirmed' && { bgcolor: 'success.dark', color: 'success.light' }),
                      ...(p.status === 'declined' && { bgcolor: 'error.dark', color: 'error.light' }),
                      ...(p.status !== 'confirmed' && p.status !== 'declined' && { bgcolor: 'warning.dark', color: 'warning.light' })
                    }}
                  >
                    {t(`eventDetails.status.${p.status}`)}
                  </Box>
                </Box>
              </Box>
            ))}
            {event.guestParticipants?.map((g: GuestParticipant) => (
              <Box 
                key={g.id} 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2, 
                  bgcolor: 'background.default', 
                  borderRadius: 1,
                  px: { xs: 2, sm: 2.5 },
                  py: { xs: 2, sm: 2.5 },
                  border: '1px solid',
                  borderColor: 'secondary.main',
                  borderOpacity: 0.3
                }}
              >
                <ProfileAvatar
                  picture={null}
                  name={g.name}
                  size={44}
                  bgcolor="secondary.main"
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography 
                    sx={{ 
                      fontSize: { xs: '0.875rem', sm: '1rem' }, 
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      mb: 0.5
                    }}
                  >
                    {g.name}
                  </Typography>
                  <Typography 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.813rem' }, 
                      color: 'secondary.main',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      mb: 0.5
                    }}
                  >
                    Guest
                  </Typography>
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      px: 1,
                      py: 0.5,
                      borderRadius: 0.5,
                      fontSize: { xs: '0.75rem', sm: '0.813rem' },
                      fontWeight: 500,
                      ...(g.status === 'confirmed' && { bgcolor: 'success.dark', color: 'success.light' }),
                      ...(g.status !== 'confirmed' && { bgcolor: 'error.dark', color: 'error.light' })
                    }}
                  >
                    {t(`eventDetails.status.${g.status}`)}
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

export default SessionDetails;
