import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Chip,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Avatar,
  AvatarGroup,
  Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import GroupIcon from '@mui/icons-material/Group';
import EventIcon from '@mui/icons-material/Event';
import { groupsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const GroupsList = () => {
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchGroups();
  }, []);

  const filterGroups = useCallback(() => {
    let filtered = [...groups];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(group =>
        group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Public/Private filter
    if (filter === 'public') {
      filtered = filtered.filter(group => group.isPublic);
    } else if (filter === 'private') {
      filtered = filtered.filter(group => !group.isPublic);
    } else if (filter === 'admin') {
      filtered = filtered.filter(group =>
        group.members?.some(m => m.userId === user?.id && m.role === 'admin')
      );
    }

    setFilteredGroups(filtered);
  }, [groups, searchTerm, filter, user?.id]);

  useEffect(() => {
    filterGroups();
  }, [filterGroups]);

  const fetchGroups = async () => {
    try {
      const response = await groupsAPI.getAll();
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserRole = (group) => {
    const member = group.members?.find(m => m.userId === user?.id);
    return member?.role || 'member';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress size={60} thickness={4} />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            My Groups
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {filteredGroups.length} group{filteredGroups.length !== 1 ? 's' : ''} found
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/groups/new')}
          sx={{ 
            background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
            boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)',
          }}
        >
          Create Group
        </Button>
      </Box>

      {/* Search and Filters */}
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <ToggleButtonGroup
              value={filter}
              exclusive
              onChange={(e, newFilter) => newFilter && setFilter(newFilter)}
              fullWidth
              sx={{ 
                '& .MuiToggleButton-root': {
                  textTransform: 'none',
                  fontWeight: 500,
                }
              }}
            >
              <ToggleButton value="all">
                All Groups
              </ToggleButton>
              <ToggleButton value="public">
                <PublicIcon sx={{ mr: 0.5, fontSize: 18 }} />
                Public
              </ToggleButton>
              <ToggleButton value="private">
                <LockIcon sx={{ mr: 0.5, fontSize: 18 }} />
                Private
              </ToggleButton>
              <ToggleButton value="admin">
                Admin
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
      </Box>

      {filteredGroups.length === 0 ? (
        <Box textAlign="center" py={8}>
          <GroupIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchTerm || filter !== 'all' 
              ? 'No groups match your filters'
              : "You haven't joined any groups yet"}
          </Typography>
          {!searchTerm && filter === 'all' && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/groups/new')}
              sx={{ mt: 2 }}
            >
              Create Your First Group
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredGroups.map((group) => {
            const role = getUserRole(group);
            const memberCount = group.members?.length || 0;
            const eventCount = group.events?.length || 0;
            const recentMembers = group.members?.slice(0, 4) || [];
            
            return (
              <Grid item xs={12} sm={6} md={4} key={group.id}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    position: 'relative',
                  }}
                >
                  <Box 
                    sx={{ 
                      position: 'absolute', 
                      top: 12, 
                      right: 12, 
                      zIndex: 1,
                      display: 'flex',
                      gap: 0.5,
                    }}
                  >
                    {group.isPublic ? (
                      <Chip 
                        icon={<PublicIcon />}
                        label="Public" 
                        size="small" 
                        color="primary"
                        sx={{ fontWeight: 600 }}
                      />
                    ) : (
                      <Chip 
                        icon={<LockIcon />}
                        label="Private" 
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    )}
                  </Box>
                  
                  <CardContent sx={{ flexGrow: 1, pt: 3 }}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, pr: 10 }}>
                          {group.name}
                        </Typography>
                        {role === 'admin' && (
                          <Chip 
                            label="Admin" 
                            size="small" 
                            color="secondary"
                            sx={{ mb: 1, fontWeight: 600 }}
                          />
                        )}
                      </Box>
                      
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ 
                          minHeight: 60,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {group.description || 'No description provided'}
                      </Typography>
                      
                      <Box>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <GroupIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                            {memberCount} member{memberCount !== 1 ? 's' : ''}
                          </Typography>
                        </Box>
                        
                        {recentMembers.length > 0 && (
                          <AvatarGroup 
                            max={4} 
                            sx={{ 
                              justifyContent: 'flex-start',
                              mb: 1,
                              '& .MuiAvatar-root': { 
                                width: 32, 
                                height: 32,
                                fontSize: '0.75rem',
                              }
                            }}
                          >
                            {recentMembers.map((member, idx) => (
                              <Avatar 
                                key={idx}
                                sx={{ bgcolor: ['primary.main', 'secondary.main', 'success.main', 'warning.main'][idx % 4] }}
                              >
                                {getInitials(member.user?.name)}
                              </Avatar>
                            ))}
                          </AvatarGroup>
                        )}
                        
                        <Box display="flex" alignItems="center" gap={1}>
                          <EventIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                            {eventCount} event{eventCount !== 1 ? 's' : ''}
                          </Typography>
                        </Box>
                      </Box>
                    </Stack>
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
            );
          })}
        </Grid>
      )}
    </Container>
  );
};

export default GroupsList;
