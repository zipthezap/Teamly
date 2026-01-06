import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    return <LoadingSpinner message="Loading your dashboard..." />;
  }

  // Calculate statistics
  const upcomingEvents = events.filter(e => new Date(e.startTime) > new Date());
  const myEvents = events.filter(e => 
    e.participants?.some(p => p.userId === user?.id)
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Welcome Section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 0.5 }}>
          Welcome back, {user?.name}! 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's what's happening with your sports activities
        </Typography>
      </Box>

      {/* Statistics Section */}
      <Box sx={{ mb: 3 }}>
        <UserStatistics />
      </Box>

      <Grid container spacing={3}>
        {/* Main Content - Left Side */}
        <Grid item xs={12} lg={9}>
          {/* Recent Groups */}
          <Box sx={{ mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>Your Groups</Typography>
              <Button
                variant="text"
                size="small"
                onClick={() => navigate('/groups')}
                sx={{ textTransform: 'none' }}
              >
                View All
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
                          <Chip label="Public" size="small" color="primary" />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, minHeight: 40 }}>
                        {group.description || 'No description'}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <GroupIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                          {group.members?.length || 0} members
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
                        View Details
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
              {groups.length === 0 && (
                <Grid item xs={12}>
                  <EmptyState
                    icon={GroupIcon}
                    title="No groups yet"
                    description="You haven't joined any groups yet. Create one to get started and connect with other sports enthusiasts!"
                    actionLabel="Create Your First Group"
                    onAction={() => navigate('/groups/new')}
                    gradient="linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(33, 150, 243, 0.02) 100%)"
                  />
                </Grid>
              )}
            </Grid>
          </Box>

          {/* Upcoming Events */}
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>Upcoming Events</Typography>
              <Button
                variant="text"
                size="small"
                onClick={() => navigate('/events')}
                sx={{ textTransform: 'none' }}
              >
                View All
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
                                label="Full"
                              />
                            )}
                            {isParticipating && (
                              <StatusBadge 
                                status="success"
                                label="Joined"
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
                            {event.maxPlayers && ` / ${event.maxPlayers}`} participants
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
                          View Details
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })}
              {upcomingEvents.length === 0 && (
                <Grid item xs={12}>
                  <EmptyState
                    icon={EventIcon}
                    title="No upcoming events"
                    description="No upcoming events scheduled. Create an event to start organizing your sports activities!"
                    actionLabel="Create Your First Event"
                    onAction={() => navigate('/events/new')}
                    gradient="linear-gradient(135deg, rgba(245, 0, 87, 0.05) 0%, rgba(245, 0, 87, 0.02) 100%)"
                  />
                </Grid>
              )}
            </Grid>
          </Box>
        </Grid>

        {/* Right Sidebar */}
        <Grid item xs={12} lg={3}>
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
