import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsAPI, groupChatAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import InviteLinkCard from '../components/InviteLinkCard';
import { getImageUrl, getInitials } from '../utils/imageUtils';
import { EventWithDetails, EventParticipant, GuestParticipant, EventParticipantStatus, GuestParticipantStatus } from '../../../shared/types/event.types';
import { UserProfilePicture, PublicUser } from '../../../shared/types/user.types';
import { AxiosError } from 'axios';

interface EventNotification {
  id: string;
  type: string;
  userId: string;
  user?: PublicUser;
  createdAt: Date | string;
}

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lateSuccess, setLateSuccess] = useState('');
  const [lateError, setLateError] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  const queryClient = useQueryClient();

  const {
    data: event,
    isLoading: loading,
    refetch: refetchEvent,
  } = useQuery({
    queryKey: ['eventDetails', id],
    queryFn: async () => {
      const response = await eventsAPI.getById(id!);
      return response.data;
    },
    enabled: !!id,
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  const joinMutation = useMutation({
    mutationFn: async () => eventsAPI.join(id!),
    onSuccess: () => {
      setSuccess(t('eventDetails.joined'));
      queryClient.invalidateQueries({ queryKey: ['eventDetails', id] });
    },
    onError: (err: unknown) => {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || t('eventDetails.failedToJoin')
        : t('eventDetails.failedToJoin');
      setError(errorMessage);
    },
  });
  const handleJoin = useCallback(() => {
    setError('');
    setSuccess('');
    joinMutation.mutate();
  }, [joinMutation]);

  const leaveMutation = useMutation({
    mutationFn: async () => eventsAPI.leave(id!),
    onSuccess: () => {
      setSuccess(t('eventDetails.left'));
      queryClient.invalidateQueries({ queryKey: ['eventDetails', id] });
    },
    onError: (err: unknown) => {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || t('eventDetails.failedToLeave')
        : t('eventDetails.failedToLeave');
      setError(errorMessage);
    },
  });
  const handleLeave = useCallback(() => {
    if (!window.confirm(t('eventDetails.confirmLeave'))) return;
    setError('');
    setSuccess('');
    leaveMutation.mutate();
  }, [leaveMutation, t]);

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => eventsAPI.updateStatus(id!, status),
    onSuccess: (_data, status) => {
      setSuccess(t('eventDetails.statusUpdated', { status }));
      queryClient.invalidateQueries({ queryKey: ['eventDetails', id] });
    },
    onError: (err: unknown) => {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || t('eventDetails.failedToUpdateStatus')
        : t('eventDetails.failedToUpdateStatus');
      setError(errorMessage);
    },
  });
  const handleUpdateStatus = useCallback((status: string) => {
    setError('');
    setSuccess('');
    updateStatusMutation.mutate(status);
  }, [updateStatusMutation]);

  const deleteMutation = useMutation({
    mutationFn: async () => eventsAPI.delete(id!),
    onSuccess: () => {
      navigate('/events');
    },
    onError: (err: unknown) => {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || t('eventDetails.failedToDelete')
        : t('eventDetails.failedToDelete');
      setError(errorMessage);
    },
  });
  const handleDelete = useCallback(() => {
    if (!window.confirm(t('eventDetails.confirmDelete'))) return;
    deleteMutation.mutate();
  }, [deleteMutation, t]);

  const markLateMutation = useMutation({
    mutationFn: async () => groupChatAPI.markLate(id!),
    onSuccess: () => {
      setLateSuccess(t('eventDetails.markedLate'));
      queryClient.invalidateQueries({ queryKey: ['eventDetails', id] });
    },
    onError: () => {
      setLateError(t('eventDetails.failedToMarkLate'));
    },
  });
  const handleMarkLate = useCallback(() => {
    setLateError('');
    setLateSuccess('');
    markLateMutation.mutate();
  }, [markLateMutation]);

  const unmarkLateMutation = useMutation({
    mutationFn: async () => groupChatAPI.unmarkLate(id!),
    onSuccess: () => {
      setLateSuccess(t('eventDetails.lateUndone'));
      queryClient.invalidateQueries({ queryKey: ['eventDetails', id] });
    },
    onError: () => {
      setLateError(t('eventDetails.failedToUndoLate'));
    },
  });
  const handleUnmarkLate = useCallback(() => {
    setLateError('');
    setLateSuccess('');
    unmarkLateMutation.mutate();
  }, [unmarkLateMutation]);

  const generateInviteLinkMutation = useMutation({
    mutationFn: async () => eventsAPI.generateInviteToken(id!),
    onSuccess: (response: { data: { inviteToken: string } }) => {
      const inviteUrl = `${window.location.origin}/events/join/${response.data.inviteToken}`;
      navigator.clipboard.writeText(inviteUrl);
      setCopySuccess('Invite link copied to clipboard!');
      queryClient.invalidateQueries({ queryKey: ['eventDetails', id] });
    },
    onError: (err: unknown) => {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.error || 'Failed to generate invite link'
        : 'Failed to generate invite link';
      setError(errorMessage);
    },
  });
  const handleGenerateInviteLink = useCallback(() => {
    setError('');
    setCopySuccess('');
    generateInviteLinkMutation.mutate();
  }, [generateInviteLinkMutation]);

  const handleCopyInviteLink = useCallback(async () => {
    if (event?.inviteToken) {
      const inviteUrl = `${window.location.origin}/events/join/${event.inviteToken}`;
      await navigator.clipboard.writeText(inviteUrl);
      setCopySuccess('Invite link copied to clipboard!');
      setTimeout(() => setCopySuccess(''), 3000);
    }
  }, [event?.inviteToken]);

  // Guard for missing ID - must be after all hooks
  if (!id) {
    return <div className="p-4 text-red-600">{t('eventDetails.invalidEventId')}</div>;
  }

  // Memoize computed values to prevent unnecessary recalculations
  const eventStats = useMemo(() => {
    const isParticipant = event?.participants?.some((p: EventParticipant) => p.id === user?.id || p.userId === user?.id);
    const isCreator = event?.creatorId === user?.id;
    const totalParticipants = 
      ((event?.participants?.filter((p: EventParticipant) => p.status === EventParticipantStatus.confirmed).length) || 0) +
      ((event?.guestParticipants?.filter((g: GuestParticipant) => g.status === GuestParticipantStatus.confirmed).length) || 0);
    const isFull = event?.maxPlayers && totalParticipants >= event?.maxPlayers;
    const confirmedCount = event?.participants?.filter((p: EventParticipant) => p.status === EventParticipantStatus.confirmed).length || 0;
    const declinedCount = event?.participants?.filter((p: EventParticipant) => p.status === EventParticipantStatus.declined).length || 0;
    const pendingCount = (event?.participants?.length || 0) - confirmedCount - declinedCount;
    const fillPercentage = event?.maxPlayers ? (totalParticipants / event.maxPlayers) * 100 : 0;

    return {
      isParticipant,
      isCreator,
      totalParticipants,
      isFull,
      confirmedCount,
      declinedCount,
      pendingCount,
      fillPercentage,
    };
  }, [event, user?.id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh]">
        <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-red-900/50 text-red-300 p-4 rounded border border-red-700">{t('eventDetails.notFound')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-8 mb-8 px-2">
      {/* Alerts */}
      {error && <div className="bg-red-900/50 text-red-300 p-3 rounded mb-4 border border-red-700">{error}</div>}
      {success && <div className="bg-green-900/50 text-green-300 p-3 rounded mb-4 border border-green-700">{success}</div>}
      {lateSuccess && <div className="bg-green-900/50 text-green-300 p-3 rounded mb-4 border border-green-700">{lateSuccess}</div>}
      {lateError && <div className="bg-red-900/50 text-red-300 p-3 rounded mb-4 border border-red-700">{lateError}</div>}
      {copySuccess && <div className="bg-blue-900/50 text-blue-300 p-3 rounded mb-4 border border-blue-700">{copySuccess}</div>}

      <div className="relative bg-[#232946] rounded-xl shadow-md p-6 mb-8">
        {/* Admin icon buttons in top right */}
        {eventStats.isCreator && (
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <button onClick={() => navigate(`/events/${event.id}/edit`)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 transition-colors" title="Edit Event">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z" /></svg>
            </button>
            <button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2 transition-colors" title="Delete Event">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3" /></svg>
            </button>
          </div>
        )}
        
        {/* Event Information Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-3 pr-24">{event.title}</h2>
          {event.isPublic && (
            <div className="inline-block bg-green-600/20 text-green-400 px-3 py-1 rounded-full text-xs font-semibold mb-2">
              🌐 Public Event
            </div>
          )}
          <div className="text-base text-[#a1a6b4] mb-3 font-medium">{event.eventType}</div>
          <div className="text-sm text-[#d4d8e1] mb-4 leading-relaxed">{event.description || t('common.noDescription')}</div>
          
          {/* Date, Time, Location */}
          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-2 bg-[#1a2233] px-3 py-2 rounded-lg">
              <span role="img" aria-label="date">📅</span>
              <span className="text-[#d4d8e1]">{new Date(event.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-2 bg-[#1a2233] px-3 py-2 rounded-lg">
              <span role="img" aria-label="time">🕐</span>
              <span className="text-[#d4d8e1]">{new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2 bg-[#1a2233] px-3 py-2 rounded-lg">
                <span role="img" aria-label="location">📍</span>
                <span className="text-[#d4d8e1]">{event.location}</span>
                {/* Google Maps Directions Button */}
                <a
                  href={
                    event.latitude && event.longitude
                      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.latitude + ',' + event.longitude)}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-blue-400 underline hover:text-blue-300 text-xs"
                  title="Open in Google Maps"
                >
                  {event.latitude && event.longitude ? 'Directions' : 'Map'}
                </a>
              </div>
            )}
          </div>
          
          {/* Organizer Info */}
          <div className="flex items-center gap-3 bg-[#1a2233] rounded-lg px-4 py-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold flex-shrink-0 overflow-hidden">
              {(() => {
                const currentPic = event.creator?.profilePictures?.find((p: UserProfilePicture) => p.isCurrent && !p.deletedAt);
                const url = getImageUrl(currentPic?.url || event.creator?.profilePicture);
                return url ? (
                  <img src={url} alt={event.creator?.name} className="w-full h-full object-cover" />
                ) : (
                  getInitials(event.creator?.name)
                );
              })()}
            </div>
            <div>
              <div className="text-xs text-[#a1a6b4] mb-0.5">{t('eventDetails.organizedBy')}</div>
              <div className="text-base font-semibold text-white">{event.creator?.name}</div>
            </div>
            <div className="ml-auto text-sm text-[#a1a6b4]">
              {t('eventDetails.group')}: <span className="font-bold text-blue-400">{event.group?.name}</span>
            </div>
          </div>
        </div>

        {/* Two Column Layout: Capacity + Attendance | Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Capacity & Attendance */}
          <div className="flex flex-col gap-4">
            {/* Capacity Section */}
            <div className="bg-[#1a2233] rounded-lg p-5">
              <div className="font-semibold mb-3 text-lg">{t('eventDetails.capacity')}</div>
              <div className="text-sm text-[#a1a6b4] mb-3">{event.maxPlayers ? t('eventDetails.participantsCount', { count: eventStats.totalParticipants, max: event.maxPlayers }) : t('eventDetails.participants', { count: eventStats.totalParticipants })}</div>
              {event.maxPlayers && (
                <div className="w-full bg-gray-700 rounded-full h-3 mb-3">
                  <div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: `${eventStats.fillPercentage}%` }}></div>
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-[#a1a6b4]">
                <span className="bg-[#232946] px-2 py-1 rounded">✅ {eventStats.confirmedCount} {t('eventDetails.confirmed')}</span>
                <span className="bg-[#232946] px-2 py-1 rounded">❌ {eventStats.declinedCount} {t('eventDetails.declined')}</span>
                <span className="bg-[#232946] px-2 py-1 rounded">⏳ {eventStats.pendingCount} {t('eventDetails.pending')}</span>
              </div>
            </div>
            
            {/* Attendance/Activity Actions: disabled for past events */}
            {new Date(event.startTime) >= new Date() ? (
              <div className="bg-[#1a2233] rounded-lg p-5">
                <div className="font-semibold mb-3 text-lg">{t('eventDetails.yourAttendance')}</div>
                <div className="flex flex-col gap-2">
                  {!eventStats.isParticipant && !eventStats.isFull && (
                    <button onClick={handleJoin} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-3 text-sm font-semibold transition-colors w-full">
                      {t('eventDetails.join')}
                    </button>
                  )}
                  {eventStats.isParticipant && (
                    <>
                      <button 
                        onClick={() => handleUpdateStatus(EventParticipantStatus.confirmed)} 
                        className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-3 text-sm font-semibold transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={
                          // Can click when not confirmed or when declined (to switch)
                          event.participants?.find((p: EventParticipant) => p.userId === user?.id)?.status === EventParticipantStatus.confirmed
                        }
                      >
                        ✓ {t('eventDetails.confirmAttendance')}
                      </button>
                      <button 
                        onClick={() => handleUpdateStatus(EventParticipantStatus.declined)} 
                        className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg px-4 py-3 text-sm font-semibold transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={
                          // Can only click when confirmed (to switch from confirmed to declined)
                          event.participants?.find((p: EventParticipant) => p.userId === user?.id)?.status !== EventParticipantStatus.confirmed
                        }
                      >
                        ✗ {t('eventDetails.decline')}
                      </button>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button 
                          onClick={handleMarkLate} 
                          className="bg-gray-600 hover:bg-gray-700 text-white rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={
                            // Can only click when confirmed and not already late
                            event.participants?.find((p: EventParticipant) => p.userId === user?.id)?.status !== EventParticipantStatus.confirmed ||
                            event.eventAttendances?.find((a: EventAttendance) => a.userId === user?.id && a.status === 'late') !== undefined
                          }
                        >
                          ⏰ {t('eventDetails.markLate')}
                        </button>
                        <button 
                          onClick={handleUnmarkLate} 
                          className="bg-gray-600 hover:bg-gray-700 text-white rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={
                            // Disable if not marked as late
                            event.eventAttendances?.find((a: EventAttendance) => a.userId === user?.id && a.status === 'late') === undefined
                          }
                        >
                          ↩ {t('eventDetails.undoLate')}
                        </button>
                      </div>
                      {!eventStats.isCreator && (
                        <button onClick={handleLeave} className="bg-pink-600 hover:bg-pink-700 text-white rounded-lg px-4 py-3 text-sm font-semibold transition-colors w-full mt-2">
                          {t('eventDetails.leave')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#1a2233] rounded-lg p-5 opacity-50 pointer-events-none select-none">
                <div className="font-semibold mb-3 text-lg">{t('eventDetails.activityDisabled')}</div>
                <div className="text-sm text-[#a1a6b4]">{t('eventDetails.pastEventNoActions')}</div>
              </div>
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
              isCreator={eventStats.isCreator}
              onGenerateLink={async () => { handleGenerateInviteLink(); }}
              isPublic={event.isPublic}
              isPast={new Date(event.startTime) < new Date()}
            />
          </div>
          
          {/* Right Column: Activity Feed - Fixed Height */}
          <div
            className="bg-[#1a2233] rounded-lg p-5 flex flex-col max-h-[500px]"
            key={event.eventNotifications?.length || 0}
          >
            <div className="font-semibold mb-3 text-lg flex-shrink-0">{t('eventDetails.activityFeed')}</div>
            <div className="flex-1 overflow-y-auto text-sm text-[#a1a6b4] pr-2">
              {(event.eventNotifications || []).length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <div className="text-4xl mb-2">📋</div>
                    <div>{t('eventDetails.noActivity')}</div>
                  </div>
                </div>
              ) : (
                event.eventNotifications && event.eventNotifications.map((n: EventNotification) => {
                  let action = '';
                  switch (n.type) {
                    case 'join':
                      action = t('eventDetails.activityJoin', { name: n.user?.name || t('eventDetails.user') });
                      break;
                    case 'leave':
                      action = t('eventDetails.activityLeave', { name: n.user?.name || t('eventDetails.user') });
                      break;
                    case 'confirmed':
                      action = t('eventDetails.activityConfirmed', { name: n.user?.name || t('eventDetails.user') });
                      break;
                    case 'declined':
                      action = t('eventDetails.activityDeclined', { name: n.user?.name || t('eventDetails.user') });
                      break;
                    case 'late':
                      action = t('eventDetails.activityLate', { name: n.user?.name || t('eventDetails.user') });
                      break;
                    default:
                      action = n.type;
                  }
                  return (
                    <div key={n.id} className="mb-3 pb-3 border-b border-[#232946] last:border-b-0">
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
                          {(() => {
                            const currentPic = n.user?.profilePictures?.find((p: UserProfilePicture) => p.isCurrent && !p.deletedAt);
                            const url = getImageUrl(currentPic?.url || n.user?.profilePicture);
                            return url ? (
                              <img src={url} alt={n.user?.name} className="w-full h-full object-cover" />
                            ) : (
                              getInitials(n.user?.name || t('eventDetails.user'))
                            );
                          })()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm mb-0.5">{n.user?.name || t('eventDetails.user')}</div>
                          <div className="text-xs text-[#a1a6b4] mb-1">{action}</div>
                          <div className="text-xs text-[#757b8a]">{new Date(n.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Participants List */}
      <div className="bg-[#232946] rounded-xl shadow-md p-6 mt-8">
        <div className="font-semibold mb-4 text-xl">{t('eventDetails.participantsList', { count: eventStats.totalParticipants })}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {event?.participants?.map((p: EventParticipant) => (
            <div key={p.id} className="flex items-center gap-3 bg-[#1a2233] rounded-lg px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">
                {(() => {
                  const currentPic = p.user?.profilePictures?.find((pic: UserProfilePicture) => pic.isCurrent && !pic.deletedAt);
                  const url = getImageUrl(currentPic?.url || p.user?.profilePicture);
                  return url ? (
                    <img src={url} alt={p.user?.name} className="w-full h-full object-cover" />
                  ) : (
                    getInitials(p.user?.name)
                  );
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{p.user?.name}</div>
                <div className="text-xs text-[#a1a6b4] truncate">{p.user?.email}</div>
                <div className="text-xs">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                    p.status === 'confirmed' ? 'bg-green-900/50 text-green-300' :
                    p.status === 'declined' ? 'bg-red-900/50 text-red-300' :
                    'bg-yellow-900/50 text-yellow-300'
                  }`}>
                    {t(`eventDetails.status.${p.status}`)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {event.guestParticipants?.map((g: GuestParticipant) => (
            <div key={g.id} className="flex items-center gap-3 bg-[#1a2233] rounded-lg px-4 py-3 border border-purple-500/30">
              <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">{getInitials(g.name)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{g.name}</div>
                <div className="text-xs text-purple-400 truncate">Guest</div>
                <div className="text-xs">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                    g.status === 'confirmed' ? 'bg-green-900/50 text-green-300' :
                    'bg-red-900/50 text-red-300'
                  }`}>
                    {t(`eventDetails.status.${g.status}`)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EventDetails;
