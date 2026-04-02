import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { eventsAPI, groupsAPI } from '../services/api';
import EventFormModal from '../components/event/EventFormModal';
import { useAuth } from '../contexts/AuthContext';
import EventSearchFilters from '../components/event/EventSearchFilters';
import { LoadingSpinner, EmptyState } from '../components/common';
import { StatusBadge, StatusType } from '../components/common/StatusBadge';
import { EventWithDetails, EventSearchParams, GroupWithDetails, EventParticipant, GroupMember } from '../../../shared/types';
import { AxiosError } from 'axios';

const EventsList = () => {
  // All hooks at top level, before any conditional returns
  const [searchFilters, setSearchFilters] = useState<EventSearchParams>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventWithDetails | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<EventWithDetails | null>(null);
  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [groups, setGroups] = useState<GroupWithDetails[]>([]);
  const [tab, setTab] = useState<'my' | 'upcoming' | 'past'>('my');
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [page, setPage] = useState(1);
  const visibleCount = 12; // Items per page
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { t } = useTranslation();
  const { user, loading: userLoading } = useAuth();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  // DEBUG: Log hook initialization order
  React.useEffect(() => {
  }, []);

  // Defensive: Ensure hooks are never called conditionally
  // If you need to use a hook, declare it here at the top level only

  // Fetch all groups on mount
  useEffect(() => {
    async function fetchGroups() {
      try {
        const response = await groupsAPI.getAll();
        setGroups(response.data);
      } catch {
        // Groups are supplementary data; non-critical failure is silently ignored
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
      const offset = (page - 1) * visibleCount;
      const params: EventSearchParams = { ...searchFilters, offset, limit: visibleCount };
      const response = await eventsAPI.getAll(params);
      // Always expect API response shape { data: [...] }
      let newEvents: EventWithDetails[] = [];
      if (Array.isArray(response.data?.data)) {
        newEvents = response.data.data;
      } else if (Array.isArray(response.data)) {
        newEvents = response.data;
      }
      setEvents(newEvents);
    } catch {
      setToast({ message: t('common.errorLoadingEvents', 'Failed to load events'), type: 'error' });
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [searchFilters, page]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Delete event
  const handlePageChange = useCallback((value: number) => {
    setPage(value);
  }, []);

  const handleDeleteEvent = useCallback(async (eventId: string | number) => {
    try {
      await eventsAPI.delete(eventId);
      setToast({ message: t('events.eventDeleted'), type: 'success' });
      setDeleteDialogOpen(false);
      setEventToDelete(null);
      fetchEvents();
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.message || t('events.errorDeletingEvent')
        : t('events.errorDeletingEvent');
      setToast({ message: errorMessage, type: 'error' });
    }
  }, [t, fetchEvents]);

  // Join event
  const handleJoinEvent = useCallback(async (eventId: string | number) => {
    try {
      await eventsAPI.join(eventId);
      setToast({ message: t('events.eventJoined'), type: 'success' });
      fetchEvents();
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.message || t('events.errorJoiningEvent')
        : t('events.errorJoiningEvent');
      setToast({ message: errorMessage, type: 'error' });
    }
  }, [t, fetchEvents]);

  // Leave event
  const handleLeaveEvent = useCallback(async (eventId: string | number) => {
    try {
      await eventsAPI.leave(eventId);
      setToast({ message: t('events.leftEvent'), type: 'success' });
      fetchEvents();
    } catch (err: unknown) {
      const errorMessage = err instanceof AxiosError 
        ? err.response?.data?.message || t('events.failedToLeaveEvent')
        : t('events.failedToLeaveEvent');
      setToast({ message: errorMessage, type: 'error' });
    }
  }, [t, fetchEvents]);

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
    } catch {
      setToast({ 
        message: t('events.exportError') || 'Failed to export events', 
        type: 'error' 
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle search/filter
  const handleSearch = useCallback((filters: EventSearchParams) => {
    setSearchFilters(filters);
    setPage(1);
    const paramsObj = Object.entries({ ...filters, page: '1' })
      .filter(([_, v]) => v !== undefined && v !== null)
      .reduce((acc, [k, v]) => { acc[k] = String(v); return acc; }, {} as Record<string, string>);
    setSearchParams(paramsObj, { replace: false });
  }, [setSearchParams]);

  // Modal handlers
  const handleModalClose = useCallback(() => {
    setModalOpen(false);
  }, []);

  const handleModalSuccess = useCallback(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleCreateEvent = useCallback(() => {
    setEditEvent(undefined);
    setModalOpen(true);
  }, []);

  const handleEditEvent = useCallback((event: EventWithDetails) => {
    setEditEvent(event);
    setModalOpen(true);
  }, []);

  // Handle page change - pagination removed

  // Get event status
  const getEventStatus = (event: EventWithDetails): { label: string; status: StatusType } => {
    const now = new Date();
    const eventDate = new Date(event.startTime);
    const isFull = event.maxPlayers && event.participants && event.participants.length >= event.maxPlayers;
    const isJoined = event.participants?.some((p: EventParticipant) => p.id === user?.id);
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

  // Enhanced event filtering and sorting logic
  const filteredEvents = useMemo(() => {
    // Guards: always work with arrays, and require user to be defined
    if (!user || !Array.isArray(events) || !Array.isArray(groups)) return [];
    const now = new Date();
    // Get group IDs where user is a member
    const userGroupIds = groups
      .filter(g => Array.isArray(g.members) && g.members.some((m: GroupMember) => m.id === user.id))
      .map(g => g.id);

    // Always use events as an array
    const eventsArray = Array.isArray(events) ? events : [];

    let filtered: EventWithDetails[] = [];

    if (tab === 'my') {
      filtered = eventsArray.filter(event => {
        const eventDate = new Date(event.startTime);
        const isJoined = Array.isArray(event.participants) && event.participants.some((p: EventParticipant) => p.userId === user.id);
        const isCreator = event.creatorId === user.id;
        const result = eventDate >= now && (isJoined || isCreator);
        return result;
      });
    } else if (tab === 'upcoming') {
      filtered = eventsArray.filter(event => {
        const eventDate = new Date(event.startTime);
        const isUserGroup = event.group && userGroupIds.includes(event.group.id);
        const isJoined = Array.isArray(event.participants) && event.participants.some((p: EventParticipant) => p.userId === user.id);
        const isCreator = event.creatorId === user.id;
        const result = (
          eventDate >= now &&
          !isJoined &&
          !isCreator &&
          ((isUserGroup) || (!isUserGroup && event.isPublic))
        );
        return result;
      });
    } else {
      filtered = eventsArray.filter(event => {
        const eventDate = new Date(event.startTime);
        const isJoined = Array.isArray(event.participants) && event.participants.some((p: EventParticipant) => p.userId === user.id);
        const isCreator = event.creatorId === user.id;
        const result = eventDate < now && (isJoined || isCreator);
        return result;
      });
    }

    return filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [events, groups, tab, user]);

  // Robust loading and error handling
  if (userLoading) {
    return <LoadingSpinner message={t('events.loadingUser')} />;
  }
  if (!user || !user.id) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh"><Typography variant="h6">{t('events.userNotFoundOrLoggedOut')}</Typography></Box>;
  }
  if (isLoading) {
    return <LoadingSpinner message={t('events.loadingEvents')} />;
  }

  // DEBUG: Log every render and key data 

  // Defensive: Never call hooks inside any conditional, loop, or callback below this point
  // Main render
  return (
    <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 3, md: 4 }, mb: { xs: 2, sm: 3, md: 4 }, px: { xs: 1, sm: 2, md: 3 } }}>
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

      <Box 
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: { xs: 2, sm: 0 },
          mb: 3
        }}
      >
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 0.5, fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
            {t('events.allEvents')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
            {events.length} {events.length !== 1 ? t('events.eventsFound') : t('events.eventFound')}
          </Typography>
        </Box>
        <Box 
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1.5, sm: 2 },
            '& > button': { minHeight: '44px' }
          }}
        >
          <Button
            variant="outlined"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            disabled={isExporting || events.length === 0}
            sx={{ 
              fontSize: '0.875rem',
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            {isExporting ? t('events.exporting', 'Exporting...') : t('events.export', 'Export')}
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddIcon />}
            onClick={handleCreateEvent}
            sx={{ 
              fontSize: '0.875rem',
              width: { xs: '100%', sm: 'auto' }
            }}
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

      {/* Tabs for My/Upcoming/Past */}
      <Box mb={2}>
        <Tabs 
          value={tab} 
          onChange={(e, v) => setTab(v)} 
          aria-label="event tabs"
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            '& .MuiTab-root': {
              minHeight: '48px',
              fontSize: '0.875rem',
              px: { xs: 2, sm: 3 }
            }
          }}
        >
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
          actions={Object.keys(searchFilters).length === 0 ? [
            { label: t('events.createFirstEvent'), onClick: handleCreateEvent }
          ] : []}
          gradient="linear-gradient(135deg, rgba(245, 0, 87, 0.05) 0%, rgba(245, 0, 87, 0.02) 100%)"
        />
      ) : (
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, 
          gap: { xs: 2, sm: 3, md: 4 }
        }}>
          {filteredEvents.map((event: EventWithDetails, _idx) => {
            // DEBUG: Log each event in the map
            const status = getEventStatus(event);
            const participantCount = event.participants?.length || 0;
            const spotsLeft = event.maxPlayers ? event.maxPlayers - participantCount : null;
            const isJoined = event.participants?.some((p: EventParticipant) => p.userId === user.id);
            const isAdmin = event.creatorId === user.id;
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
                  <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 2.5 } }}>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={1.5}>
                      <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1, pr: 1, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' } }}>
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
                              onClick={() => handleEditEvent(event)}
                              sx={{ ml: 0.5, minWidth: '44px', minHeight: '44px' }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => { setEventToDelete(event); setDeleteDialogOpen(true); }}
                              sx={{ minWidth: '44px', minHeight: '44px' }}
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
                          {formatEventTime(typeof event.startTime === 'string' ? event.startTime : event.startTime.toISOString())}
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
                  <CardActions sx={{ px: { xs: 2, sm: 2.5 }, pb: { xs: 2, sm: 2.5 }, pt: 0, flexDirection: 'column', gap: 1 }}>
                    <Button 
                      variant="contained"
                      fullWidth
                      color="secondary"
                      onClick={() => navigate(`/events/${event.id}`)}
                      sx={{ minHeight: '44px' }}
                    >
                      {t('common.viewDetails')}
                    </Button>
                    {/* Join/Leave actions, only if not past */}
                    {status.label !== t('common.past') && !isAdmin && !isJoined && (
                      <Button
                        variant="contained"
                        fullWidth
                        color="success"
                        onClick={() => handleJoinEvent(event.id)}
                        disabled={isFetching || status.label === t('common.full')}
                        sx={{ minHeight: '44px' }}
                      >
                        {t('events.joinEvent')}
                      </Button>
                    )}
                    {status.label !== t('common.past') && !isAdmin && isJoined && (
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={() => handleLeaveEvent(event.id)}
                        disabled={isFetching}
                        sx={{ minHeight: '44px' }}
                      >
                        {t('events.leaveEvent')}
                      </Button>
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
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
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
            sx={{
              '& .MuiPaginationItem-root': {
                minWidth: { xs: '32px', sm: '40px' },
                height: { xs: '32px', sm: '40px' },
                fontSize: { xs: '0.75rem', sm: '0.875rem' }
              }
            }}
          />
        </Box>
      )}
    </Container>
  );
};

export default EventsList;
