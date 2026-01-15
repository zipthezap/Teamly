import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner, EmptyState } from '../components/common';
import { ErrorState } from '../components/common/StateComponents';
import { getImageUrl, getInitials } from '../utils/imageUtils';
import UserPlusIcon from '../components/icons/UserPlusIcon';
import {
  IconButton,
  Badge,
  Popover,
  List,
  ListItem,
  ListItemText,
  Box as MuiBox,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useEnhancedNotifications } from '../hooks/useEnhancedNotifications';

import { GroupNotificationType, GroupWithDetails } from '../../../shared/types';


const GroupsList = () => {
  // All hooks at top level, never inside conditionals or loops
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: userLoading } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    data: groups = [],
    isLoading: groupsLoading,
    isError: groupsError,
    error: groupsErrorObj,
    refetch
  } = useQuery<GroupWithDetails[]>(
    {
      queryKey: ['groupsList'],
      queryFn: async () => {
        const response = await groupsAPI.getAll();
        return response.data as GroupWithDetails[];
      },
      staleTime: 0,
      refetchOnWindowFocus: true,
    }
  );

  // Invalidate groupsList cache if navigated from a group details page (after leave)
  useEffect(() => {
    if (location.state && location.state.justLeftGroup) {
      queryClient.invalidateQueries({ queryKey: ['groupsList'] });
    }
  }, [location.state, queryClient]);

  // Filtered groups (search/filter)
  const filteredGroups = useMemo(() => {
    let filtered = Array.isArray(groups) ? [...groups] : [];
    if (searchTerm) {
      filtered = filtered.filter(group =>
        group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filter === 'public') {
      filtered = filtered.filter(group => group.isPublic);
    } else if (filter === 'private') {
      filtered = filtered.filter(group => !group.isPublic);
    } else if (filter === 'admin') {
      filtered = filtered.filter(group =>
        group.members?.some((m: any) => m.id === user?.id && m.role === 'admin')
      );
    }
    return filtered;
  }, [groups, searchTerm, filter, user?.id]);

  const groupStats = useMemo(() => ({
    total: Array.isArray(groups) ? groups.length : 0,
    public: Array.isArray(groups) ? groups.filter((g: any) => g.isPublic).length : 0,
    private: Array.isArray(groups) ? groups.filter((g: any) => !g.isPublic).length : 0,
    admin: Array.isArray(groups) ? groups.filter((g: any) => g.members?.some((m: any) => m.id === user?.id && m.role === 'admin')).length : 0,
  }), [groups, user?.id]);

    // --- Group Invite Requests Popover State ---
  const [inviteAnchorEl, setInviteAnchorEl] = useState<null | HTMLElement>(null);
  const {
    notifications: inviteNotifications,
    loading: inviteLoading,
    markAsRead: markInvitesAsRead,
    refresh: refreshInvites,
  } = useEnhancedNotifications({ autoRefresh: true, refreshInterval: 30000 });
  // Only group invite notifications, unread
  const groupInviteRequests = inviteNotifications.filter(
    n => n.notificationType === 'group' && n.type === GroupNotificationType.invited && !n.read
  );
  const inviteCount = groupInviteRequests.length;

  const handleInviteClick = (event: React.MouseEvent<HTMLElement>) => {
    setInviteAnchorEl(event.currentTarget);
    // Do NOT mark as read here; only after accept/decline
  };
  const handleInviteClose = () => setInviteAnchorEl(null);

  // Accept/Decline actions for group invite notifications
  const handleAccept = async (notifId: string) => {
    const notif = groupInviteRequests.find(n => n.id === notifId);
    if (!notif || !notif.group?.id || !user?.id) return;
    try {
      await groupsAPI.joinByInvite(user.id, notif.group.id);
      await markInvitesAsRead([notifId]);
      await refetch(); // Refresh groups list
      // Invalidate group details cache so GroupDetailsPage is fresh
      queryClient.invalidateQueries({ queryKey: ["groupDetails", notif.group.id] });
      refreshInvites();
    } catch (err) {
      // Optionally show error feedback
      console.error('Failed to accept group invite:', err);
    }
  };
  const handleDecline = async (notifId: string) => {
    try {
      await markInvitesAsRead([notifId]);
      refreshInvites();
    } catch (err) {
      // Optionally show error feedback
      console.error('Failed to decline group invite:', err);
    }
  };

  // Robust loading and error handling
  if (userLoading) {
    return <LoadingSpinner message={t('groups.loadingUser')} />;
  }
  if (!user || !user.id) {
    return <ErrorState message={t('groups.userNotFoundOrLoggedOut')} />;
  }
  if (groupsLoading) {
    return <LoadingSpinner message={t('groups.loadingGroups')} />;
  }
  if (groupsError) {
    return <ErrorState message={t('groups.failedToLoadGroups')} />;
  }

  // DEBUG: Log every render and key data (after all hooks/vars)
  console.log('[GroupsList] render');
  console.log('[GroupsList] user:', user);
  console.log('[GroupsList] groups:', groups);
  console.log('[GroupsList] filteredGroups:', filteredGroups);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700}>{t('groups.myGroups')}</Typography>
        <Box display="flex" gap={2} alignItems="center">
          {/* Invite Requests Popover Button */}
          <Tooltip title={t('groups.inviteRequests', 'Group Invites')}>
            <span>
              <IconButton
                aria-label="Group Invites"
                onClick={handleInviteClick}
                color={inviteCount > 0 ? 'primary' : 'default'}
                disabled={inviteCount === 0 && !inviteLoading}
              >
                <Badge badgeContent={inviteCount} color="error" invisible={inviteCount === 0}>
                  <UserPlusIcon />
                </Badge>
              </IconButton>
            </span>
          </Tooltip>
          <Popover
            open={Boolean(inviteAnchorEl)}
            anchorEl={inviteAnchorEl}
            onClose={handleInviteClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { mt: 1.5, width: 380, maxHeight: 500, borderRadius: 2 } } }}
          >
            <MuiBox sx={{ p: 2.5, borderBottom: '1px solid rgba(0,0,0,0.08)', background: 'linear-gradient(135deg, rgba(33,150,243,0.05) 0%, rgba(33,150,243,0.02) 100%)' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t('groups.inviteRequests', 'Group Invites')}
                {inviteCount > 0 && (
                  <Box component="span" sx={{ ml: 1, px: 1.5, py: 0.5, bgcolor: 'error.main', color: 'white', borderRadius: 2, fontSize: '0.875rem', fontWeight: 700 }}>{inviteCount}</Box>
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('groups.inviteRequestsDesc', 'You have pending group invitations')}
              </Typography>
            </MuiBox>
            <MuiBox sx={{ p: 2 }}>
              {inviteLoading ? (
                <Box display="flex" justifyContent="center" py={4}><CircularProgress size={36} /></Box>
              ) : inviteCount === 0 ? (
                <Box textAlign="center" py={4}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    🎉 {t('groups.noInvites', 'No pending group invites!')}
                  </Typography>
                </Box>
              ) : (
                <List sx={{ maxHeight: 320, overflow: 'auto', p: 0 }}>
                  {groupInviteRequests.map((notif) => (
                    <ListItem key={notif.id} alignItems="flex-start" sx={{ px: 1, py: 1.5 }}>
                      <ListItemText
                        primary={<>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{notif.group?.name || t('groups.unknownGroup')}</Typography>
                          {notif.user?.name && (
                            <Typography variant="caption" color="text.secondary">{t('groups.invitedBy', { name: notif.user.name })}</Typography>
                          )}
                        </>}
                        secondary={<Typography variant="caption" color="text.secondary">{notif.message}</Typography>}
                      />
                      <Box display="flex" flexDirection="column" gap={1} ml={2}>
                        <Button size="small" color="success" variant="contained" onClick={() => handleAccept(notif.id)}>{t('common.accept', 'Accept')}</Button>
                        <Button size="small" color="error" variant="outlined" onClick={() => handleDecline(notif.id)}>{t('common.decline', 'Decline')}</Button>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </MuiBox>
          </Popover>
          {/* ...existing code... */}
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
                {groupStats.total}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                {t('groups.allGroups')}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                {groupStats.public}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                {t('groups.public')}
              </Typography>
            </CardContent>
            <Button
              variant="outlined"
              onClick={() => refetch()}
              sx={{ ml: 1 }}
            >
              {t('groups.refresh', 'Refresh')}
            </Button>
          </Card>
          <Card sx={{ background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                {groupStats.private}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                {t('groups.private')}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                {groupStats.admin}
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


          {filteredGroups.map((group, idx) => {
            // DEBUG: Log each group in the map
            console.log(`[GroupsList] rendering group #${idx}:`, group);
            // Inline getUserRole logic
            const role = group.members?.find((m: any) => m.id === user.id)?.role;
            const memberCount = group.members?.length || 0;
            // Only count future events
            const now = new Date();
            const eventCount = Array.isArray(group.events)
              ? group.events.filter(e => new Date(e.startTime) >= now).length
              : 0;
            const hasJoined = group.members?.some(m => m.id === user.id);
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
                        {recentMembers.map((member) => {
                          // Prefer current profile picture from history if available
                          const currentPic = member.user?.profilePictures?.find((p) => p.isCurrent && !p.deletedAt);
                          const profilePictureUrl = getImageUrl(currentPic?.url || member.user?.profilePicture);
                          return (
                            <Avatar 
                              key={member.id}
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
