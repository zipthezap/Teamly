import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
} from '@mui/material';
import { groupsAPI, eventsAPI } from '../services/api';
import { LoadingSpinner, EmptyState, StatusBadge } from '../components/common';
import UserStatistics from '../components/dashboard/UserStatistics';
import UpcomingEventsCalendar from '../components/dashboard/UpcomingEventsCalendar';
import RecentActivityTimeline from '../components/dashboard/RecentActivityTimeline';
import QuickLinks from '../components/dashboard/QuickLinks';
import GroupIcon from '@mui/icons-material/Group';
import EventIcon from '@mui/icons-material/Event';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const [groups, setGroups] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [groupsRes, eventsRes] = await Promise.all([
        groupsAPI.getAll(),
        eventsAPI.getAll(),
      ]);
      setGroups(groupsRes.data);
      // Sort events by startTime
      const sortedEvents = eventsRes.data.sort((a, b) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      setEvents(sortedEvents);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message={t('dashboard.loadingDashboard')} />;
  }

  // Calculate statistics
  // Only show soon-to-happen events the user is NOT confirmed on yet
  const upcomingEvents = events.filter(e => {
    const isSoon = new Date(e.startTime) > new Date();
    const isConfirmed = e.participants?.some(p => p.userId === user?.id && p.status === 'confirmed');
    return isSoon && !isConfirmed;
  });
  const myEvents = events.filter(e => 
    e.participants?.some(p => p.userId === user?.id)
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Welcome Section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 0.5 }}>
          {t('dashboard.welcomeBack', { name: user?.name || 'User' })}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('dashboard.whatsHappening')}
        </Typography>
      </Box>

      {/* Main Content and Sidebar Row */}
      <Grid container spacing={3} alignItems="flex-start">
        {/* Main Content - Left Side */}
        <Grid item xs={12} lg={9}>
          {/* Statistics Section */}
          <Box sx={{ mb: 3 }}>
            <UserStatistics />
          </Box>

          {/* Upcoming Events */}
          <Box sx={{ mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>{t('dashboard.upcomingEvents')}</Typography>
              <Button
                variant="text"
                size="small"
                onClick={() => navigate('/events')}
                sx={{ textTransform: 'none' }}
              >
                {t('common.viewAll')}
              </Button>
            </Box>
            <Grid container spacing={2}>
              {upcomingEvents.slice(0, 3).map((event) => {
                const isParticipating = event.participants?.some(p => p.userId === user?.id);
                const isFull = event.maxPlayers && event.participants?.length >= event.maxPlayers;
                return (
                  <Grid item xs={12} sm={6} md={4} key={event.id}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <CardContent sx={{ flexGrow: 1, p: 2 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="start" mb={1.5}>
                          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, pr: 1, mb: 0 }}>
                            {event.title}
                          </Typography>
                          <StatusBadge 
                            status="info"
                            label={event.eventType}
                            sx={{ flexShrink: 0 }}
                          />
                        </Box>
                        {(isFull || isParticipating) && (
                          <Box display="flex" gap={0.5} mb={1}>
                            {isFull && (
                              <StatusBadge 
                                status="warning"
                                label={t('common.full')}
                              />
                            )}
                            {isParticipating && (
                              <StatusBadge 
                                status="success"
                                label={t('common.joined')}
                              />
                            )}
                          </Box>
                        )}
                        <Box sx={{ mt: 1.5 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            📅 {new Date(event.startTime).toLocaleDateString()}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            🕐 {new Date(event.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </Typography>
                          {event.location && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              📍 {event.location}
                            </Typography>
                          )}
                          <Typography variant="body2" color="text.secondary">
                            👥 {event.participants?.length || 0}
                            {event.maxPlayers && ` / ${event.maxPlayers}`} {t('common.participants')}
                          </Typography>
                        </Box>
                      </CardContent>
                      <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                        <Button 
                          size="small" 
                          variant="contained"
                          onClick={() => navigate(`/events/${event.id}`)}
                          fullWidth
                        >
                          {t('common.viewDetails')}
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })}
              {upcomingEvents.length === 0 && (
                <Grid item xs={12}>
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
                </Grid>
              )}
            </Grid>
          </Box>

          {/* Your Groups */}
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>{t('dashboard.yourGroups')}</Typography>
              <Button
                variant="text"
                size="small"
                onClick={() => navigate('/groups')}
                sx={{ textTransform: 'none' }}
              >
                {t('common.viewAll')}
              </Button>
            </Box>
            <Grid container spacing={2}>
              {groups.slice(0, 3).map((group) => (
                <Grid item xs={12} sm={6} md={4} key={group.id}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1, p: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={1.5}>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 0 }}>
                          {group.name}
                        </Typography>
                        {group.isPublic && (
                          <Chip label={t('common.public')} size="small" color="primary" />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, minHeight: 40 }}>
                        {group.description || t('common.noDescription')}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <GroupIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                          {group.members?.length || 0} {t('common.members')}
                        </Typography>
                      </Box>
                    </CardContent>
                    <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                      <Button 
                        size="small" 
                        variant="contained"
                        onClick={() => navigate(`/groups/${group.id}`)}
                        fullWidth
                      >
                        {t('common.viewDetails')}
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
              {groups.length === 0 && (
                <Grid item xs={12}>
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
                </Grid>
              )}
            </Grid>
          </Box>
        </Grid>

        {/* Right Sidebar - aligns with stats and main content */}
        <Grid 
          item 
          xs={12} 
          lg={3} 
          sx={{ 
            position: { lg: 'sticky' }, 
            top: { lg: 80 }, 
            alignSelf: { lg: 'flex-start' },
            maxHeight: { lg: 'calc(100vh - 100px)' },
            overflowY: { lg: 'auto' },
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(156, 163, 175, 0.3)',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: 'rgba(156, 163, 175, 0.5)',
            },
          }}
        >
          <Stack spacing={3}>
            {/* Recent Activity */}
            <RecentActivityTimeline
              events={events}
              groups={groups}
              userId={user?.id}
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
            />

            {/* Quick Links */}
            <QuickLinks onNavigate={(path) => navigate(path)} />
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
