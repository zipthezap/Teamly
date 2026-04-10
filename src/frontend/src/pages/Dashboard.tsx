import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import { useTheme, alpha } from '@mui/material/styles';
import { groupsAPI, eventsAPI } from '../services/api';
import { LoadingSpinner, EmptyState } from '../components/common';
import UserStatistics from '../components/dashboard/UserStatistics';
import UpcomingEventsCalendar from '../components/dashboard/UpcomingEventsCalendar';
import RecentActivityTimeline from '../components/dashboard/RecentActivityTimeline';
import QuickLinks from '../components/dashboard/QuickLinks';
import GroupIcon from '@mui/icons-material/Group';
import EventIcon from '@mui/icons-material/Event';
import { useAuth } from '../contexts/AuthContext';
import { getImageUrl, getInitials } from '../utils/imageUtils';
import { EventWithDetails, GroupWithDetails, EventParticipant } from '../../../shared/types';

const Dashboard = () => {
  const [groups, setGroups] = useState<GroupWithDetails[]>([]);
  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();
  const theme = useTheme();

  useEffect(() => {
    fetchData();
  }, [location.key]);

  const fetchData = async () => {
    try {
      const [groupsRes, eventsRes] = await Promise.all([
        groupsAPI.getAll(),
        eventsAPI.getAll(),
      ]);
      // Ensure groupsRes.data is always an array
      const groupsArray = Array.isArray(groupsRes.data) ? groupsRes.data : (groupsRes.data?.data ?? []);
      setGroups(groupsArray);
      // Ensure eventsRes.data is always an array
      const eventsArray = Array.isArray(eventsRes.data) ? eventsRes.data : (eventsRes.data?.data ?? []);
      const sortedEvents = eventsArray.sort((a: EventWithDetails, b: EventWithDetails) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      setEvents(sortedEvents);
    } catch {
      // Error fetching dashboard data
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message={t('dashboard.loadingDashboard')} />;
  }

  // Defensive: ensure events is always an array
  const safeEvents = Array.isArray(events) ? events : [];
  // Calculate statistics
  // Only show upcoming events the user is confirmed on or organizing
  const upcomingEvents = safeEvents.filter(e => {
    const isSoon = new Date(e.startTime) > new Date();
    if (!isSoon) return false;
    // Show if user is the organizer
    if (e.creatorId === user?.id) return true;
    // Show if user is a confirmed participant
    const isConfirmed = e.participants?.some((p: EventParticipant) => p.userId === user?.id && p.status === 'confirmed');
    return isConfirmed;
  });
  const _myEvents = safeEvents.filter(e => 
    e.participants?.some((p: EventParticipant) => p.userId === user?.id)
  );

  return (
    <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 3, md: 4 }, mb: { xs: 2, sm: 3, md: 4 }, px: { xs: 1, sm: 2, md: 3 } }}>
      {/* Welcome Section */}
      <Box sx={{ mb: { xs: 2, md: 3 }, px: { xs: 1, sm: 0 } }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 0.5, fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
          {t('dashboard.welcomeBack', { name: user?.name || 'User' })}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
          {t('dashboard.whatsHappening')}
        </Typography>
      </Box>

      {/* Responsive flex layout: sidebar always first on mobile, left on desktop */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'flex-start',
          gap: { xs: 2, sm: 3, md: 4 },
        }}
      >
        {/* Sidebar */}
        <Box
          sx={{
            width: { xs: '100%', md: 340, lg: 360 },
            flexShrink: 0,
            mb: { xs: 2, md: 0 },
            position: { md: 'sticky' },
            top: { md: 80 },
            alignSelf: { md: 'flex-start' },
            maxHeight: { md: 'calc(100vh - 100px)' },
            overflowY: { md: 'auto' },
             background: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.9 : 0.96),
             borderRadius: { xs: 2, md: 3 },
             border: `1px solid ${theme.palette.divider}`,
             p: { xs: 2, sm: 2.5, md: 3 },
           }}
         >
          <Stack spacing={3}>
            {/* Recent Activity */}
            <RecentActivityTimeline
              events={events}
              groups={groups}
              userId={typeof user?.id === 'string' ? user.id : String(user?.id)}
              onActivityClick={(id, type) => {
                if (type === 'event') {
                  navigate(`/events/${id}`);
                } else {
                  navigate(`/groups/${id}`);
                }
              }}
            />

            {/* Upcoming Schedule */}
            <UpcomingEventsCalendar
              events={events}
              onEventClick={(eventId) => navigate(`/events/${eventId}`)}
              userId={typeof user?.id === 'string' ? user.id : String(user?.id)}
            />

            {/* Quick Links */}
            <QuickLinks
              links={[
                {
                  label: t('dashboard.myGroups'),
                  icon: <GroupIcon sx={{ color: 'white' }} />,
                  path: '/groups',
                  color: 'bg-blue-500',
                },
                {
                  label: t('dashboard.allEvents'),
                  icon: <EventIcon sx={{ color: 'white' }} />,
                  path: '/events',
                  color: 'bg-pink-500',
                },
                {
                  label: t('dashboard.discoverGroups'),
                  icon: <EventIcon sx={{ color: 'white' }} />,
                  path: '/public-groups',
                  color: 'bg-green-500',
                },
                {
                  label: t('teamup.title', 'TeamUp'),
                  icon: <EventIcon sx={{ color: 'white' }} />,
                  path: '/teamup',
                  color: 'bg-purple-500',
                },
                {
                  label: t('tournament.title', 'Tournament'),
                  icon: <EventIcon sx={{ color: 'white' }} />,
                  path: '/tournaments',
                  color: 'bg-yellow-500',
                },
              ]}
              onNavigate={(path) => navigate(path)}
            />
          </Stack>
        </Box>

        {/* Main Content */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            background: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.9 : 0.96),
            borderRadius: { xs: 2, md: 3 },
            border: `1px solid ${theme.palette.divider}`,
            p: { xs: 2, sm: 2.5, md: 3 },
          }}
        >
          {/* Statistics Section */}
          <Box sx={{ mb: { xs: 3, md: 4 } }}>
            <UserStatistics />
          </Box>

          {/* Upcoming Events */}
          <Box sx={{ mb: { xs: 3, md: 4 } }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.5rem' } }}>{t('dashboard.upcomingEvents')}</Typography>
              <Button
                variant="text"
                size="small"
                onClick={() => navigate('/events')}
                sx={{ textTransform: 'none', minWidth: 'auto' }}
              >
                {t('common.viewAll')}
              </Button>
            </Box>
            <Box
              sx={(() => {
                const count = Math.min(upcomingEvents.length, 4);
                let columns = 1;
                if (count === 2) columns = 2;
                if (count >= 3) columns = 2;
                return {
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: `repeat(${columns}, 1fr)`, md: `repeat(${columns}, 1fr)` },
                  gap: { xs: 2, sm: 3, md: 4 },
                  minHeight: count === 0 ? 700 : undefined,
                };
              })()}
            >
              {upcomingEvents.slice(0, 4).map((event) => {
                const _isParticipating = event.participants?.some(p => p.userId === user?.id);
                const isFull = event.maxPlayers && event.participants && event.participants.length >= event.maxPlayers;
                return (
                  <Card
                    key={event.id}
                    sx={{
                      height: { xs: 'auto', md: 340 },
                      minHeight: { xs: 'auto', md: 340 },
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.25s',
                      background: theme.palette.background.paper,
                      borderRadius: 1.5,
                      boxShadow: 'none',
                      border: `1px solid ${theme.palette.divider}`,
                      '&:hover': { transform: 'translateY(-2px)', borderColor: 'primary.main' },
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 2.5, md: 3 } }}>
                      <Box display="flex" gap={2} mb={1.5}>
                          <Box sx={{ width: { xs: 50, sm: 60 }, height: { xs: 50, sm: 60 }, bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.12), borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {(() => {
                              const dateObj = new Date(event.startTime);
                              const month = dateObj.toLocaleString('en-US', { month: 'short' });
                              const day = dateObj.getDate();
                              return (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                   <span style={{ fontSize: 12, fontWeight: 700, color: theme.palette.primary.main, lineHeight: 1 }}>{month}</span>
                                   <span style={{ fontSize: 21, fontWeight: 800, color: theme.palette.text.primary, lineHeight: 1 }}>{day}</span>
                                </Box>
                              );
                            })()}
                          </Box>
                        <Box flexGrow={1} minWidth={0}>
                          <Box display="flex" justifyContent="space-between" alignItems="start" mb={0.5} flexWrap="wrap" gap={0.5}>
                            <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1, pr: 1, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' }, wordBreak: 'break-word' }}>
                              {event.title}
                            </Typography>
                            <Box display="flex" gap={0.5} flexShrink={0}>
                              <Chip label={event.eventType} size="small" color="primary" />
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          minHeight: { xs: 'auto', md: 40 },
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          fontSize: { xs: '0.813rem', sm: '0.875rem' }
                        }}
                      >
                        📅 {new Date(event.startTime).toLocaleDateString()} • 🕐 {new Date(event.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        {event.location && ` • 📍 ${event.location}`}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={2} mb={2} flexWrap="wrap">
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <GroupIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>
                            {event.participants?.length || 0}{event.maxPlayers && ` / ${event.maxPlayers}`} {t('common.participants')}
                          </Typography>
                        </Box>
                        {isFull && (
                          <Chip label={t('common.full')} size="small" color="warning" />
                        )}
                        {/* Attendance status chip will be handled in next step */}
                        {(() => {
                          if (!event.participants) return null;
                          const participant = event.participants.find(p => p.userId === user?.id);
                          if (!participant) return null;
                          if (participant.status === 'confirmed') {
                            return <Chip label={t('common.confirmed')} size="small" color="success" />;
                          } else if (participant.status === 'declined') {
                            return <Chip label={t('common.declined')} size="small" color="error" />;
                          }
                          return null;
                        })()}
                      </Box>
                    </CardContent>
                    <CardActions sx={{ px: { xs: 2, sm: 2.5, md: 3 }, pb: { xs: 2, sm: 2.5, md: 3 }, pt: 0 }}>
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={() => navigate(`/events/${event.id}`)}
                        sx={{ minHeight: '44px' }}
                      >
                        {t('common.viewDetails')}
                      </Button>
                    </CardActions>
                  </Card>
                );
              })}
              {upcomingEvents.length === 0 && (
                <Box gridColumn="1 / -1">
                  <EmptyState
                    icon={<EventIcon />}
                    title={t('dashboard.noUpcomingEvents')}
                    description={t('dashboard.noUpcomingEventsDesc')}
                    actions={[
                      { label: t('dashboard.createFirstEvent'), onClick: () => navigate('/events/new') },
                      { label: t('dashboard.findEvents'), onClick: () => navigate('/events') }
                    ]}
                    gradient="linear-gradient(135deg, rgba(245, 0, 87, 0.05) 0%, rgba(245, 0, 87, 0.02) 100%)"
                  />
                </Box>
              )}
            </Box>
          </Box>

          {/* Your Groups */}
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.5rem' } }}>{t('dashboard.yourGroups')}</Typography>
              <Button
                variant="text"
                size="small"
                onClick={() => navigate('/groups')}
                sx={{ textTransform: 'none', minWidth: 'auto' }}
              >
                {t('common.viewAll')}
              </Button>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: { xs: 2, sm: 2.5, md: 3 } }}>
              {groups.slice(0, 3).map((group) => {
                const memberCount = group._count?.members ?? group.memberCount ?? group.members?.length ?? 0;
                // Only count future events for this group
                const now = new Date();
                let eventCount = 0;
                if (Array.isArray(group.events)) {
                  eventCount = group.events.filter(e => new Date(e.startTime) > now).length;
                } else if (typeof group._count?.events === 'number') {
                  // If only a count is available, fallback to it (may include past events)
                  eventCount = group._count.events;
                } else if (typeof group.eventCount === 'number') {
                  eventCount = group.eventCount;
                }
                const hasJoined = group.members?.some(m => m.id === user?.id);
                const recentMembers = hasJoined ? (group.members?.slice(0, 4) || []) : [];
                return (
                  <Card
                    key={group.id}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.25s',
                      background: theme.palette.background.paper,
                      borderRadius: 1.5,
                      boxShadow: 'none',
                      border: `1px solid ${theme.palette.divider}`,
                      '&:hover': { transform: 'translateY(-2px)', borderColor: 'primary.main' },
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 2.5, md: 3 } }}>
                      <Box display="flex" gap={2} mb={1.5}>
                        <Avatar
                          src={getImageUrl(group.picture) || undefined}
                          sx={{ width: { xs: 50, sm: 60 }, height: { xs: 50, sm: 60 }, borderRadius: '8px', bgcolor: 'primary.main', flexShrink: 0 }}
                          variant="rounded"
                        >
                          {!group.picture && getInitials(group.name)}
                        </Avatar>
                        <Box flexGrow={1} minWidth={0}>
                          <Box display="flex" justifyContent="space-between" alignItems="start" mb={0.5} flexWrap="wrap" gap={0.5}>
                            <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1, pr: 1, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' }, wordBreak: 'break-word' }}>
                              {group.name}
                            </Typography>
                            <Box display="flex" gap={0.5} flexShrink={0}>
                              {group.isPublic ? (
                                <Chip label={t('groups.public')} size="small" color="primary" />
                              ) : (
                                <Chip label={t('groups.private')} size="small" />
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: { xs: 'auto', md: 40 }, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
                        {group.description || t('common.noDescription')}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={2} mb={2} flexWrap="wrap">
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <GroupIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>
                            {t('groups.membersCount', { count: memberCount })}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <EventIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>
                            {t('groups.eventsCount', { count: eventCount })}
                          </Typography>
                        </Box>
                      </Box>
                      {recentMembers.length > 0 && (
                        <AvatarGroup max={4} sx={{ justifyContent: 'flex-start' }}>
                          {recentMembers.map((member) => {
                            const currentPic = member.user?.profilePictures?.find((p) => p.isCurrent && !p.deletedAt);
                            const profilePictureUrl = getImageUrl(currentPic?.url || member.user?.profilePicture);
                            return (
                              <Avatar
                                key={member.id}
                                src={profilePictureUrl || undefined}
                                sx={{ width: { xs: 28, sm: 32 }, height: { xs: 28, sm: 32 }, fontSize: '0.75rem', bgcolor: 'primary.main' }}
                              >
                                {!profilePictureUrl && getInitials(member.user?.name)}
                              </Avatar>
                            );
                          })}
                        </AvatarGroup>
                      )}
                    </CardContent>
                    <CardActions sx={{ px: { xs: 2, sm: 2.5, md: 3 }, pb: { xs: 2, sm: 2.5, md: 3 }, pt: 0 }}>
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={() => navigate(`/groups/${group.id}`)}
                        sx={{ minHeight: '44px' }}
                      >
                        {t('common.viewDetails')}
                      </Button>
                    </CardActions>
                  </Card>
                );
              })}
              {groups.length === 0 && (
                <Box>
                  <EmptyState
                    icon={<GroupIcon />}
                    title={t('dashboard.noGroupsYet')}
                    description={t('dashboard.noGroupsYetDesc')}
                    actions={[
                      { label: t('dashboard.createFirstGroup'), onClick: () => navigate('/groups/new') },
                      { label: t('dashboard.discoverGroups'), onClick: () => navigate('/groups') }
                    ]}
                    gradient="linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(33, 150, 243, 0.02) 100%)"
                  />
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default Dashboard;
