import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  Chip,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Avatar,
  AvatarGroup,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import GroupIcon from '@mui/icons-material/Group';
import EventIcon from '@mui/icons-material/Event';
import AddIcon from '@mui/icons-material/Add';
import { groupsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner, EmptyState } from '../components/common';
import { getImageUrl, getInitials } from '../utils/imageUtils';
import { GroupWithDetails } from '../../../shared/types';

const GroupsList = () => {
  const [groups, setGroups] = useState<GroupWithDetails[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<GroupWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
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
        group.members?.some(m => m.id === user?.id && m.role === 'admin')
      );
    }

    setFilteredGroups(filtered);
  }, [groups, searchTerm, filter, user?.id]);

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

  const getUserRole = (group: GroupWithDetails) => {
    const member = group.members?.find((m: { id: string }) => m.id === user?.id);
    return member?.role || 'member';
  };

  if (loading) {
    return <LoadingSpinner message={t('groups.loadingGroups')} />;
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 0.5 }}>
            {t('groups.myGroups')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('groups.groupsFound', { count: filteredGroups.length })}
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<SearchIcon />}
            onClick={() => navigate('/public-groups')}
          >
            {t('groups.discoverGroups')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/groups/new')}
          >
            {t('groups.createGroup')}
          </Button>
        </Box>
      </Box>
      
      {/* Statistics Overview */}
      {groups.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <Card sx={{ background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                {groups.length}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                {t('groups.allGroups')}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                {groups.filter(g => g.isPublic).length}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                {t('groups.public')}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                {groups.filter(g => !g.isPublic).length}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                {t('groups.private')}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                {groups.filter(g => g.members?.some(m => m.id === user?.id && m.role === 'admin')).length}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                {t('groups.admin')}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}
      
      {/* Search and Filters */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder={t('groups.searchGroups')}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(e, newFilter) => newFilter && setFilter(newFilter)}
          fullWidth
          size="medium"
        >
          <ToggleButton value="all">
            {t('groups.allGroups')}
          </ToggleButton>
          <ToggleButton value="public">
            {t('groups.public')}
          </ToggleButton>
          <ToggleButton value="private">
            {t('groups.private')}
          </ToggleButton>
          <ToggleButton value="admin">
            {t('groups.admin')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      {filteredGroups.length === 0 ? (
        <EmptyState
          icon={<GroupIcon />}
          title={searchTerm || filter !== 'all' ? t('groups.noGroupsMatch') : t('groups.noGroupsYet')}
          description={!searchTerm && filter === 'all' ? t('groups.createFirstGroupDesc') : ''}
          actions={!searchTerm && filter === 'all' ? [
            { label: t('groups.createFirstGroup'), onClick: () => navigate('/groups/new') }
          ] : (searchTerm || filter !== 'all' ? [
            { label: t('groups.allGroups'), onClick: () => { setSearchTerm(''); setFilter('all'); } }
          ] : [])}
          gradient="linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(156, 39, 176, 0.05) 100%)"
        />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
          {filteredGroups.map((group) => {
            const role = getUserRole(group);
            const memberCount = group.members?.length || 0;
            // Only count future events
            const now = new Date();
            const eventCount = Array.isArray(group.events)
              ? group.events.filter(e => new Date(e.startTime) >= now).length
              : 0;
            const hasJoined = group.members?.some(m => m.id === user?.id);
            const recentMembers = hasJoined ? (group.members?.slice(0, 4) || []) : [];
            return (
              <Card 
                key={group.id}
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
                  <CardContent sx={{ flexGrow: 1, p: 3 }}>
                    <Box display="flex" gap={2} mb={1.5}>
                      <Avatar
                        src={getImageUrl(group.picture) || undefined}
                        sx={{ 
                          width: 60, 
                          height: 60,
                          borderRadius: '8px',
                          bgcolor: 'primary.main'
                        }}
                        variant="rounded"
                      >
                        {!group.picture && getInitials(group.name)}
                      </Avatar>
                      <Box flexGrow={1} minWidth={0}>
                        <Box display="flex" justifyContent="space-between" alignItems="start" mb={0.5}>
                          <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1, pr: 1 }}>
                            {group.name}
                          </Typography>
                          <Box display="flex" gap={0.5} flexShrink={0}>
                            {group.isPublic ? (
                              <Chip label={t('groups.public')} size="small" color="primary" />
                            ) : (
                              <Chip label={t('groups.private')} size="small" />
                            )}
                            {role === 'admin' && (
                              <Chip label={t('groups.admin')} size="small" color="secondary" />
                            )}
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mb: 2, 
                        minHeight: 40,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {group.description || t('groups.noDescriptionProvided')}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <GroupIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {t('groups.membersCount', { count: memberCount })}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <EventIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {t('groups.eventsCount', { count: eventCount })}
                        </Typography>
                      </Box>
                    </Box>
                    {recentMembers.length > 0 && (
                      <AvatarGroup max={4} sx={{ justifyContent: 'flex-start' }}>
                        {recentMembers.map((member, idx) => {
                          // Prefer current profile picture from history if available
                          const currentPic = member.user?.profilePictures?.find((p) => p.isCurrent && !p.deletedAt);
                          const profilePictureUrl = getImageUrl(currentPic?.url || member.user?.profilePicture);
                          return (
                            <Avatar 
                              key={idx}
                              src={profilePictureUrl || undefined}
                              sx={{ 
                                width: 32, 
                                height: 32,
                                fontSize: '0.75rem',
                                bgcolor: 'primary.main'
                              }}
                            >
                              {!profilePictureUrl && getInitials(member.user?.name)}
                            </Avatar>
                          );
                        })}
                      </AvatarGroup>
                    )}
                  </CardContent>
                  <CardActions sx={{ px: 3, pb: 3, pt: 0 }}>
                    <Button 
                      variant="contained"
                      fullWidth
                      onClick={() => navigate(`/groups/${group.id}`)}
                    >
                      {t('common.viewDetails')}
                    </Button>
                  </CardActions>
                </Card>
            );
          })}
        </Box>
      )}
    </Container>
  );
};

export default GroupsList;
