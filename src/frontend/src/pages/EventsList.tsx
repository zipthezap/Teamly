
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Tabs, Tab } from '@mui/material';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Snackbar,
  Alert,
  Pagination,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import EventIcon from '@mui/icons-material/Event';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PeopleIcon from '@mui/icons-material/People';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import GroupIcon from '@mui/icons-material/Group';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DataObjectIcon from '@mui/icons-material/DataObject';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { eventsAPI } from '../services/api';
import EventFormModal from '../components/event/EventFormModal';
import { useAuth } from '../contexts/AuthContext';
import EventSearchFilters from '../components/event/EventSearchFilters';
import { LoadingSpinner, EmptyState, StatusBadge, StatusType } from '../components/common';


const EventsList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchFilters, setSearchFilters] = useState({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<any>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const [events, setEvents] = useState<any[]>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [tab, setTab] = useState<'my' | 'upcoming' | 'past'>('my');
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [useInfiniteScroll, setUseInfiniteScroll] = useState(true);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch all groups on mount
  useEffect(() => {
    async function fetchGroups() {
      try {
        const response = await (await import('../services/api')).groupsAPI.getAll();
        setGroups(response.data);
      } catch (err) {
        // Optionally handle error
      }
    }
    fetchGroups();
  }, []);

  // Fetch events
  const fetchEvents = useCallback(async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsFetching(true);
      }
      setIsLoading(true);
      const offset = (page - 1) * visibleCount;
      const params = { ...searchFilters, offset, limit: visibleCount } as import('../services/api').EventSearchParams;
      const response = await eventsAPI.getAll(params);
      setEvents(response.data);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [searchFilters, page, t]);

  useEffect(() => {
    fetchEvents();
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

  // Export events
  const handleExportEvents = async (format: 'csv' | 'ical' | 'json') => {
    try {
      setIsExporting(true);
      setExportMenuAnchor(null);
      
      const response = await eventsAPI.export(format);
      
      // Create a blob from the response data
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/octet-stream' 
      });
      
      // Get filename from Content-Disposition header or create default
      const contentDisposition = response.headers['content-disposition'];
      let filename = `teamly-events-${new Date().toISOString().split('T')[0]}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      } else {
        // Add extension based on format
        const extensions: Record<string, string> = { csv: 'csv', ical: 'ics', json: 'json' };
        filename += `.${extensions[format] || 'txt'}`;
      }
      
      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setToast({ 
        message: t('events.exportSuccess', { format: format.toUpperCase() }) || `Events exported successfully as ${format.toUpperCase()}`, 
        type: 'success' 
      });
    } catch (err: any) {
      console.error('Export error:', err);
      setToast({ 
        message: t('events.exportError') || 'Failed to export events', 
        type: 'error' 
      });
    } finally {
      setIsExporting(false);
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
    // Removed pagination controls
  };

  // Get event status
  const getEventStatus = (event: any): { label: string; status: StatusType } => {
    const now = new Date();
    const eventDate = new Date(event.startTime);
    const isFull = event.maxPlayers && event.participants?.length >= event.maxPlayers;
    const isJoined = event.participants?.some((p: any) => p.userId === user?.id);
    if (eventDate < now) return { label: t('common.past'), status: 'default' };
    if (isFull) return { label: t('common.full'), status: 'warning' };
    if (isJoined) return { label: t('common.joined'), status: 'success' };
    return { label: t('common.open'), status: 'info' };
  };

  // Format event time
  function formatEventTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  if (isLoading) {
    return <LoadingSpinner message={t('events.loadingEvents')} />;
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <EmptyState
          icon={<EventIcon />}
          title={t('common.errorLoadingEvents')}
          description=""
          actionLabel={t('common.retry')}
          onAction={() => fetchEvents()}
          gradient="linear-gradient(135deg, rgba(244, 67, 54, 0.05) 0%, rgba(244, 67, 54, 0.02) 100%)"
        />
      </Container>
    );
  }

  // Filter events by tab (fix: use creatorId, and only filter by date and participation/ownership)
  const now = new Date();
  let filteredEvents: any[] = [];
  if (tab === 'my') {
    // Show all upcoming events where user is a participant or creator
    filteredEvents = events.filter(event => {
      const eventDate = new Date(event.startTime);
      const isJoined = event.participants?.some((p: any) => p.userId === user?.id);
      const isCreator = event.creatorId === user?.id;
      return eventDate >= now && (isJoined || isCreator);
    });
  } else if (tab === 'upcoming') {
    // Show all upcoming events
    filteredEvents = events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate >= now;
    });
  } else {
    // Show all past events where user is a participant or creator
    filteredEvents = events.filter(event => {
      const eventDate = new Date(event.startTime);
      const isJoined = event.participants?.some((p: any) => p.userId === user?.id);
      const isCreator = event.creatorId === user?.id;
      return eventDate < now && (isJoined || isCreator);
    });
  }

  // Main render
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Snackbar 
        open={!!toast} 
        autoHideDuration={6000} 
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setToast(null)} severity={toast?.type || 'info'} sx={{ width: '100%' }}>
          {toast?.message}
        </Alert>
      </Snackbar>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 0.5 }}>
            {t('events.allEvents')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {events.length} {events.length !== 1 ? t('events.eventsFound') : t('events.eventFound')}
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            disabled={isExporting || events.length === 0}
          >
            {isExporting ? t('events.exporting', 'Exporting...') : t('events.export', 'Export')}
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddIcon />}
            onClick={() => { setEditEvent(null); setModalOpen(true); }}
          >
            {t('events.createEvent')}
          </Button>
        </Box>
      </Box>

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={() => setExportMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleExportEvents('csv')}>
          <ListItemIcon>
            <DescriptionIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={t('events.exportCSV', 'Export as CSV')} 
            secondary={t('events.exportCSVDesc', 'Spreadsheet format')}
          />
        </MenuItem>
        <MenuItem onClick={() => handleExportEvents('ical')}>
          <ListItemIcon>
            <CalendarTodayIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={t('events.exportICalendar', 'Export as iCalendar')} 
            secondary={t('events.exportICalendarDesc', 'For Google Calendar, Outlook')}
          />
        </MenuItem>
        <MenuItem onClick={() => handleExportEvents('json')}>
          <ListItemIcon>
            <DataObjectIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText 
            primary={t('events.exportJSON', 'Export as JSON')} 
            secondary={t('events.exportJSONDesc', 'Developer format')}
          />
        </MenuItem>
      </Menu>

      {/* Removed tabs for Upcoming/Past */}
      {/* Tabs for My/Upcoming/Past */}
      <Box mb={2}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} aria-label="event tabs">
          <Tab value="my" label={t('events.myEvents') || 'My Events'} />
          <Tab value="upcoming" label={t('events.upcomingEvents') || 'Upcoming Events'} />
          <Tab value="past" label={t('events.pastEvents') || 'Past Events'} />
        </Tabs>
      </Box>
      {/* Filters and Search */}
      <Box mb={3}>
        <EventSearchFilters onSearch={handleSearch} />
      </Box>
      {filteredEvents.length === 0 ? (
        <EmptyState
          icon={<EventIcon />}
          title={Object.keys(searchFilters).length > 0 ? t('events.noEventsMatch') : t('events.noEventsAvailable')}
          description={Object.keys(searchFilters).length === 0 ? t('events.createFirstEventDesc') : ''}
          actionLabel={Object.keys(searchFilters).length === 0 ? t('events.createFirstEvent') : ''}
          onAction={Object.keys(searchFilters).length === 0 ? () => { setEditEvent(null); setModalOpen(true); } : undefined}
          gradient="linear-gradient(135deg, rgba(245, 0, 87, 0.05) 0%, rgba(245, 0, 87, 0.02) 100%)"
        />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
          {filteredEvents.map((event: any, idx: number) => {
            const status = getEventStatus(event);
            const participantCount = event.participants?.length || 0;
            const spotsLeft = event.maxPlayers ? event.maxPlayers - participantCount : null;
            const isJoined = event.participants?.some((p: any) => p.userId === user?.id);
            const isAdmin = event.organizerId === user?.id;
            return (
              <Card 
                key={event.id}
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  transition: 'all 0.3s',
                  '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6,
                    }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={1.5}>
                      <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1, pr: 1 }}>
                        {event.title}
                      </Typography>
                      <Box display="flex" gap={0.5} alignItems="center">
                        <StatusBadge 
                          status={status.status}
                          label={status.label}
                        />
                        {isAdmin && (
                          <>
                            <IconButton 
                              size="small" 
                              onClick={() => { setEditEvent(event); setModalOpen(true); }}
                              sx={{ ml: 0.5 }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => { setEventToDelete(event); setDeleteDialogOpen(true); }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    </Box>
                    <Box mb={1.5}>
                      <Chip label={event.eventType} size="small" color="secondary" />
                      <Chip 
                        icon={event.isPublic ? <PublicIcon /> : <LockIcon />}
                        label={event.isPublic ? t('common.public') : t('groups.private')}
                        size="small"
                        color={event.isPublic ? 'info' : 'default'}
                        sx={{ ml: 0.5 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <GroupIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {event.group?.name || 'N/A'}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <EventIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {new Date(event.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {formatEventTime(event.startTime)}
                        </Typography>
                      </Box>
                      {event.location && (
                        <Box display="flex" alignItems="center" gap={1}>
                          <LocationOnIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {event.location}
                          </Typography>
                        </Box>
                      )}
                      <Box display="flex" alignItems="center" gap={1}>
                        <PeopleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {participantCount}{event.maxPlayers && ` / ${event.maxPlayers}`} {t('common.participants')}
                        </Typography>
                      </Box>
                      {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 3 && (
                        <Chip 
                          label={t('events.spotsLeft', { count: spotsLeft })} 
                          size="small" 
                          color="warning"
                          sx={{ mt: 0.5, alignSelf: 'flex-start' }}
                        />
                      )}
                    </Box>
                  </CardContent>
                  <CardActions sx={{ px: 2.5, pb: 2.5, pt: 0, flexDirection: 'column', gap: 1 }}>
                    <Button 
                      variant="contained"
                      fullWidth
                      color="secondary"
                      onClick={() => navigate(`/events/${event.id}`)}
                    >
                      {t('common.viewDetails')}
                    </Button>
                    {/* Join/Leave actions, only if not past */}
                    {status.label !== t('common.past') && !isAdmin && (
                      isJoined ? (
                        <Button
                          variant="outlined"
                          fullWidth
                          onClick={() => handleLeaveEvent(event.id)}
                          disabled={isFetching}
                        >
                          {t('events.leaveEvent')}
                        </Button>
                      ) : (
                        <Button
                          variant="contained"
                          fullWidth
                          color="success"
                          onClick={() => handleJoinEvent(event.id)}
                          disabled={isFetching || status.label === t('common.full')}
                        >
                          {t('events.joinEvent')}
                        </Button>
                      )
                    )}
                  </CardActions>
                </Card>
            );
          })}
        </Box>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('events.confirmDeleteTitle') || 'Delete Event?'}</DialogTitle>
        <DialogContent>
          {t('events.confirmDeleteText') || 'Are you sure you want to delete this event? This action cannot be undone.'}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
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
        groups={groups}
      />

      {/* Pagination controls */}
      {events.length > 0 && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination 
            count={page + 1} 
            page={page} 
            onChange={(e, value) => handlePageChange(value)}
            color="secondary"
          />
        </Box>
      )}
    </Container>
  );
};

export default EventsList;
