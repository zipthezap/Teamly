
import React, { useState, useRef, useCallback, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { eventsAPI } from '../services/api';
import EventFormModal from '../components/event/EventFormModal';
import { useAuth } from '../contexts/AuthContext';
import EventSearchFilters from '../components/event/EventSearchFilters';

// Simple toast system
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  return (
    <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded shadow-lg text-white ${type === "success" ? "bg-green-600" : "bg-red-600"}`}>
      {message}
      <button className="ml-4 font-bold" onClick={onClose}>×</button>
    </div>
  );
}


const EventsList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchFilters, setSearchFilters] = useState({});
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<any>(null);
  const [useInfiniteScroll, setUseInfiniteScroll] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<any>(null);
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const lastEventRef = useRef<HTMLDivElement | null>(null);

  // Fetch events
  const fetchEvents = useCallback(async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsFetching(true);
      }
      const response = await eventsAPI.getAll({ ...searchFilters, page });
      setEvents(response.data);
      setError(null);
    } catch (err: any) {
      setError(err);
      setToast({ message: err?.response?.data?.message || t('common.errorLoadingEvents'), type: 'error' });
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [searchFilters, page, t]);

  useEffect(() => {
    fetchEvents(true);
  }, [fetchEvents]);

  // Delete event
  const handleDeleteEvent = async (eventId: string | number) => {
    try {
      await eventsAPI.delete(eventId);
      setToast({ message: t('events.eventDeleted'), type: 'success' });
      setDeleteDialogOpen(false);
      setEventToDelete(null);
      fetchEvents();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || t('events.errorDeletingEvent'), type: 'error' });
    }
  };

  // Join event
  const handleJoinEvent = async (eventId: string | number) => {
    try {
      await eventsAPI.join(eventId);
      setToast({ message: t('events.eventJoined'), type: 'success' });
      fetchEvents();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || t('events.errorJoiningEvent'), type: 'error' });
    }
  };

  // Leave event
  const handleLeaveEvent = async (eventId: string | number) => {
    try {
      await eventsAPI.leave(eventId);
      setToast({ message: t('events.leftEvent'), type: 'success' });
      fetchEvents();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || t('events.failedToLeaveEvent'), type: 'error' });
    }
  };

  // Handle search/filter
  const handleSearch = (filters: any) => {
    setSearchFilters(filters);
    setPage(1);
    setSearchParams({ ...filters, page: '1' }, { replace: false });
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSearchParams({ ...searchFilters, page: newPage.toString() }, { replace: false });
  };

  // Get event status
  const getEventStatus = (event: any) => {
    const now = new Date();
    const eventDate = new Date(event.startTime);
    const isFull = event.maxPlayers && event.participants?.length >= event.maxPlayers;
    const isJoined = event.participants?.some((p: any) => p.userId === user?.id);
    if (eventDate < now) return { label: t('common.past'), color: 'default' };
    if (isFull) return { label: t('common.full'), color: 'warning' };
    if (isJoined) return { label: t('common.joined'), color: 'success' };
    return { label: t('common.open'), color: 'primary' };
  };

  // Format event time
  function formatEventTime(dateString: string) {
    const date = new Date(dateString);
    let hour = date.getHours();
    let minute = date.getMinutes();
    minute = Math.round(minute / 15) * 15;
    if (minute === 60) {
      minute = 0;
      hour = (hour + 1) % 24;
    }
    const hourStr = hour.toString().padStart(2, '0');
    const minuteStr = minute.toString().padStart(2, '0');
    return `${hourStr}:${minuteStr}`;
  }

  // Infinite scroll effect
  // Removed infinite scroll effect (pagination only)

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[80vh] text-red-400">
        {t('common.errorLoadingEvents')}
        <button className="mt-4 bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-md px-3 py-1.5 text-sm shadow transition" onClick={() => fetchEvents()}>{t('common.retry')}</button>
      </div>
    );
  }

  // Main render
  return (
    <div className="max-w-6xl mx-auto mt-8 mb-8 px-2">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1 text-gray-100">{t('events.allEvents')}</h1>
          <div className="text-sm text-gray-400">
            {events.length} {events.length !== 1 ? t('events.eventsFound') : t('events.eventFound')}
          </div>
        </div>
        <button onClick={() => { setEditEvent(null); setModalOpen(true); }} className="bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-md px-3 py-1.5 text-sm shadow transition">{t('events.createEvent')}</button>
      </div>
      {/* Filters and Search */}
      <EventSearchFilters onSearch={handleSearch} />
      {/* Toggle infinite scroll / pagination */}
      <div className="flex justify-end mb-2">
        <button
          className="text-xs px-3 py-1 rounded border border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 transition"
          onClick={() => setUseInfiniteScroll((v) => !v)}
        >
          {useInfiniteScroll ? t('events.switchToPagination') : t('events.switchToInfiniteScroll')}
        </button>
      </div>
      {events.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-lg text-gray-400 mb-2">
            {Object.keys(searchFilters).length > 0 ? t('events.noEventsMatch') : t('events.noEventsAvailable')}
          </div>
          {Object.keys(searchFilters).length === 0 && (
            <button onClick={() => { setEditEvent(null); setModalOpen(true); }} className="bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-md px-3 py-1.5 text-sm shadow transition mt-2">{t('events.createFirstEvent')}</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {events.map((event: any, idx: number) => {
            const status = getEventStatus(event);
            const participantCount = event.participants?.length || 0;
            const spotsLeft = event.maxPlayers ? event.maxPlayers - participantCount : null;
            const isJoined = event.participants?.some((p: any) => p.userId === user?.id);
            const isAdmin = event.organizerId === user?.id;
            const isLast = idx === events.length - 1;
            return (
              <div
                key={event.id}
                ref={useInfiniteScroll && isLast ? lastEventRef : undefined}
                className="bg-[#1a202c] rounded-lg shadow-md p-4 hover:shadow-lg transition border border-gray-700 animate-fadein"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold truncate flex-1 text-gray-100">{event.title}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ml-2 ${
                    status.label === 'Joined' ? 'bg-green-900/50 text-green-300 border border-green-700' :
                    status.label === 'Full' ? 'bg-orange-900/50 text-orange-300 border border-orange-700' :
                    status.label === 'Past' ? 'bg-gray-700 text-gray-300 border border-gray-600' :
                    'bg-blue-900/50 text-blue-300 border border-blue-700'
                  }`}>{status.label}</span>
                  {isAdmin && (
                    <>
                      <button
                        className="ml-2 px-2 py-0.5 text-xs rounded bg-gray-700 hover:bg-gray-800 text-gray-200 border border-gray-600"
                        onClick={() => { setEditEvent(event); setModalOpen(true); }}
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        className="ml-2 px-2 py-0.5 text-xs rounded bg-red-700 hover:bg-red-800 text-red-100 border border-red-600"
                        onClick={() => { setEventToDelete(event); setDeleteDialogOpen(true); }}
                      >
                        {t('common.delete')}
                      </button>
                    </>
                  )}
                </div>
                <div className="mb-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-900/50 text-purple-300 border border-purple-700">{event.eventType}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span role="img" aria-label="date">📅</span>
                    <span className="text-xs text-gray-400">{new Date(event.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span role="img" aria-label="time">🕐</span>
                    <span className="text-xs text-gray-400">{formatEventTime(event.startTime)}</span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2">
                      <span role="img" aria-label="location">📍</span>
                      <span className="text-xs text-gray-400 truncate">{event.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span role="img" aria-label="participants">👥</span>
                    <span className="text-xs text-gray-400">{participantCount}{event.maxPlayers && ` / ${event.maxPlayers}`} {t('common.participants')}</span>
                  </div>
                  {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 3 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-900/50 text-yellow-300 border border-yellow-700 mt-1">
                      {t('events.spotsLeft', { count: spotsLeft })}
                    </span>
                  )}
                </div>
                <button onClick={() => navigate(`/events/${event.id}`)} className="mt-4 w-full bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-md px-3 py-1.5 text-sm shadow transition">{t('common.viewDetails')}</button>
                {/* Join/Leave actions, only if not past */}
                {status.label !== t('common.past') && !isAdmin && (
                  isJoined ? (
                    <button
                      className="mt-2 w-full bg-gray-700 hover:bg-gray-800 text-white font-medium rounded-md px-3 py-1.5 text-sm shadow transition"
                      onClick={() => handleLeaveEvent(event.id)}
                      disabled={isFetching}
                    >
                      {t('events.leaveEvent')}
                    </button>
                  ) : (
                    <button
                      className="mt-2 w-full bg-green-700 hover:bg-green-800 text-white font-medium rounded-md px-3 py-1.5 text-sm shadow transition"
                      onClick={() => handleJoinEvent(event.id)}
                      disabled={isFetching || status.label === t('common.full')}
                    >
                      {t('events.joinEvent')}
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('events.confirmDeleteTitle') || 'Delete Event?'}</DialogTitle>
        <DialogContent>
          {t('events.confirmDeleteText') || 'Are you sure you want to delete this event? This action cannot be undone.'}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="secondary">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => eventToDelete && handleDeleteEvent(eventToDelete.id)}
            color="error"
            variant="contained"
            disabled={isFetching}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Event create/edit modal */}
      <EventFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => fetchEvents()}
        initialData={editEvent}
      />

      {/* Pagination controls */}
      <div className="flex justify-center mt-8 gap-2">
        <button
          className="px-3 py-1 rounded border border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 transition disabled:opacity-50"
          onClick={() => handlePageChange(page - 1)}
          disabled={page <= 1}
        >
          {t('common.prev')}
        </button>
        {[...Array(page + 1)].map((_, i) => (
          <button
            key={i + 1}
            className={`px-3 py-1 rounded border ${page === i + 1 ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-200'} hover:bg-pink-700 transition`}
            onClick={() => handlePageChange(i + 1)}
          >
            {i + 1}
          </button>
        ))}
        <button
          className="px-3 py-1 rounded border border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 transition disabled:opacity-50"
          onClick={() => handlePageChange(page + 1)}
        >
          {t('common.next')}
        </button>
      </div>

      {/* Infinite scroll loader */}
      {isFetching && (
        <div className="flex justify-center py-6">
          <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};

export default EventsList;
