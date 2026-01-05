import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  CircularProgress,
  Chip,
  Avatar,
  Stack,
} from '@mui/material';
import { groupsAPI, eventsAPI } from '../services/api';
import GroupIcon from '@mui/icons-material/Group';
import EventIcon from '@mui/icons-material/Event';
import AddIcon from '@mui/icons-material/Add';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ScheduleIcon from '@mui/icons-material/Schedule';
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
        new Date(a.startTime) - new Date(b.startTime)
      );
      setEvents(sortedEvents);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress size={60} thickness={4} />
      </Box>
    );
  }

  // Calculate statistics
  const upcomingEvents = events.filter(e => new Date(e.startTime) > new Date());
  const myEvents = events.filter(e => 
    e.participants?.some(p => p.userId === user?.id)
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Welcome Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
          Welcome back, {user?.name}! 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's what's happening with your sports activities
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Main Content - Left Side */}
        <Grid item xs={12} lg={9}>
          {/* Recent Groups */}
          <Box sx={{ mb: 4 }}>
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
            <Grid container spacing={3}>
              {groups.slice(0, 3).map((group) => (
                <Grid item xs={12} sm={6} md={4} key={group.id}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                          {group.name}
                        </Typography>
                        {group.isPublic && (
                          <Chip label="Public" size="small" color="primary" />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                        {group.description || 'No description'}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <GroupIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                          {group.members?.length || 0} members
                        </Typography>
                      </Box>
                    </CardContent>
                    <CardActions sx={{ px: 2, pb: 2 }}>
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
                  <Paper 
                    sx={{ 
                      p: 4, 
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(33, 150, 243, 0.02) 100%)',
                    }}
                  >
                    <GroupIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                    <Typography variant="h6" gutterBottom>
                      No groups yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      You haven't joined any groups yet. Create one to get started!
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => navigate('/groups/new')}
                    >
                      Create Your First Group
                    </Button>
                  </Paper>
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
            <Grid container spacing={3}>
              {upcomingEvents.slice(0, 3).map((event) => {
                const isParticipating = event.participants?.some(p => p.userId === user?.id);
                const isFull = event.maxPlayers && event.participants?.length >= event.maxPlayers;
                
                return (
                  <Grid item xs={12} sm={6} md={4} key={event.id}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, pr: 1 }}>
                            {event.title}
                          </Typography>
                          <Chip 
                            label={event.eventType} 
                            size="small" 
                            color="secondary"
                            sx={{ flexShrink: 0 }}
                          />
                        </Box>
                        
                        {isFull && (
                          <Chip 
                            label="Full" 
                            size="small" 
                            color="warning" 
                            sx={{ mb: 1 }}
                          />
                        )}
                        {isParticipating && (
                          <Chip 
                            label="Joined" 
                            size="small" 
                            color="success" 
                            sx={{ mb: 1, ml: isFull ? 1 : 0 }}
                          />
                        )}
                        
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            📅 {new Date(event.startTime).toLocaleDateString()}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            🕐 {new Date(event.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </Typography>
                          {event.location && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              📍 {event.location}
                            </Typography>
                          )}
                          <Typography variant="body2" color="text.secondary">
                            👥 {event.participants?.length || 0}
                            {event.maxPlayers && ` / ${event.maxPlayers}`} participants
                          </Typography>
                        </Box>
                      </CardContent>
                      <CardActions sx={{ px: 2, pb: 2 }}>
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
                  <Paper 
                    sx={{ 
                      p: 4, 
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, rgba(245, 0, 87, 0.05) 0%, rgba(245, 0, 87, 0.02) 100%)',
                    }}
                  >
                    <EventIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                    <Typography variant="h6" gutterBottom>
                      No upcoming events
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      No upcoming events. Create one to start organizing!
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => navigate('/events/new')}
                    >
                      Create Your First Event
                    </Button>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Box>
        </Grid>

        {/* Right Sidebar */}
        <Grid item xs={12} lg={3}>
          {/* Enhanced Stats Section */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
              Statistics
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={6} sm={6} md={6} lg={6}>
                <Paper 
                  sx={{ 
                    p: 1.5, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 150, 243, 0.05) 100%)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 8px rgba(33, 150, 243, 0.2)',
                    }
                  }}
                  onClick={() => navigate('/groups')}
                >
                  <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, mb: 0.5 }}>
                    <GroupIcon sx={{ fontSize: 16 }} />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0 }}>
                    {groups.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, textAlign: 'center' }}>
                    Your Groups
                  </Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={6} sm={6} md={6} lg={6}>
                <Paper 
                  sx={{ 
                    p: 1.5, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    background: 'linear-gradient(135deg, rgba(245, 0, 87, 0.1) 0%, rgba(245, 0, 87, 0.05) 100%)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 8px rgba(245, 0, 87, 0.2)',
                    }
                  }}
                  onClick={() => navigate('/events')}
                >
                  <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32, mb: 0.5 }}>
                    <EventIcon sx={{ fontSize: 16 }} />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0 }}>
                    {events.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, textAlign: 'center' }}>
                    Total Events
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={6} sm={6} md={6} lg={6}>
                <Paper 
                  sx={{ 
                    p: 1.5, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.05) 100%)',
                  }}
                >
                  <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32, mb: 0.5 }}>
                    <ScheduleIcon sx={{ fontSize: 16 }} />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0 }}>
                    {upcomingEvents.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, textAlign: 'center' }}>
                    Upcoming
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={6} sm={6} md={6} lg={6}>
                <Paper 
                  sx={{ 
                    p: 1.5, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%)',
                  }}
                >
                  <Avatar sx={{ bgcolor: 'warning.main', width: 32, height: 32, mb: 0.5 }}>
                    <TrendingUpIcon sx={{ fontSize: 16 }} />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0 }}>
                    {myEvents.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, textAlign: 'center' }}>
                    Your Events
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>

          {/* Quick Actions */}
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
              Quick Actions
            </Typography>
            <Stack spacing={1}>
              <Button
                variant="contained"
                size="small"
                fullWidth
                startIcon={<AddIcon />}
                onClick={() => navigate('/groups/new')}
                sx={{ 
                  py: 0.75,
                  justifyContent: 'flex-start',
                  background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                }}
              >
                Create New Group
              </Button>
              <Button
                variant="contained"
                size="small"
                fullWidth
                startIcon={<AddIcon />}
                onClick={() => navigate('/events/new')}
                sx={{ 
                  py: 0.75,
                  justifyContent: 'flex-start',
                  background: 'linear-gradient(135deg, #f50057 0%, #c51162 100%)',
                }}
              >
                Create New Event
              </Button>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                onClick={() => navigate('/public-groups')}
                sx={{ py: 0.75, justifyContent: 'flex-start' }}
              >
                Discover Groups
              </Button>
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
