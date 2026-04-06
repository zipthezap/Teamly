import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Typography,
  Box as MuiBox,
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
  IconButton,
  Badge,
  Popover,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  CircularProgress,
  Alert as _Alert,
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
import { getNotificationText } from '../utils/notificationText';
import UserPlusIcon from '../components/icons/UserPlusIcon';
import { useEnhancedNotifications } from '../hooks/useEnhancedNotifications';

import { GroupNotificationType, GroupWithDetails, GroupMember } from '../../../shared/types';

type GroupAccessLevel = 'owner' | 'admin' | 'member';

const getGroupAccessLevel = (group: GroupWithDetails, userId?: string): GroupAccessLevel => {
  if (!userId) {
    return 'member';
  }

  if (group.creatorId === userId) {
    return 'owner';
  }

  const membership = group.members?.find((member: GroupMember) => member.userId === userId);
  return membership?.role === 'admin' ? 'admin' : 'member';
};

const getGroupSortPriority = (group: GroupWithDetails, userId?: string) => {
  const accessLevel = getGroupAccessLevel(group, userId);

  if (accessLevel === 'owner') {
    return 0;
  }

  if (accessLevel === 'admin') {
    return 1;
  }

  return 2;
};


const GroupsList = () => {
  // All hooks at top level, never inside conditionals or loops
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    data: groups = [],
    isLoading: groupsLoading,
    isError: groupsError,
    error: _groupsErrorObj,
    refetch
  } = useQuery<GroupWithDetails[]>(
    {
      queryKey: ['groupsList', 'withEvents'],
      queryFn: async () => {
        const response = await groupsAPI.getAll(true);
        return response.data as GroupWithDetails[];
      },
      staleTime: 0,
      refetchOnWindowFocus: true,
    }
  );

  // Invalidate groupsList cache if navigated from a group details page (after leave)
  useEffect(() => {
    if (location.state && location.state.justLeftGroup) {
      // Explicitly refetch the groups list when returning from group details after deletion/leave
      refetch();
    }
  }, [location.state, refetch]);

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
      filtered = filtered.filter(group => getGroupAccessLevel(group, user?.id) !== 'member');
    }
    filtered.sort((leftGroup, rightGroup) => {
      const priorityDifference = getGroupSortPriority(leftGroup, user?.id) - getGroupSortPriority(rightGroup, user?.id);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return new Date(rightGroup.updatedAt).getTime() - new Date(leftGroup.updatedAt).getTime();
    });

    return filtered;
  }, [groups, searchTerm, filter, user?.id]);

  const groupStats = useMemo(() => ({
    total: Array.isArray(groups) ? groups.length : 0,
    public: Array.isArray(groups) ? groups.filter((g: GroupWithDetails) => g.isPublic).length : 0,
    private: Array.isArray(groups) ? groups.filter((g: GroupWithDetails) => !g.isPublic).length : 0,
    admin: Array.isArray(groups) ? groups.filter((g: GroupWithDetails) => getGroupAccessLevel(g, user?.id) !== 'member').length : 0,
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
      await groupsAPI.joinByInvite(notif.group.id);
      await markInvitesAsRead([notifId]);
      await refetch(); // Refresh groups list
      // Invalidate group details cache so GroupDetailsPage is fresh
      queryClient.invalidateQueries({ queryKey: ["groupDetails", notif.group.id] });
      refreshInvites();
    } catch {
      // Optionally show error feedback
    }
  };
  const handleDecline = async (notifId: string) => {
    try {
      await markInvitesAsRead([notifId]);
      refreshInvites();
    } catch {
      // Optionally show error feedback
    }
  };

  // Robust loading and error handling
  if (loading) {
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

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3, md: 4 }, px: { xs: 2, sm: 3 } }}>
      <MuiBox display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Typography variant="h4" fontWeight={700} sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' } }}>{t('groups.myGroups')}</Typography>
        <MuiBox display="flex" gap={{ xs: 1, sm: 2 }} alignItems="center" flexWrap="wrap">
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
            slotProps={{ paper: { sx: { mt: 1.5, width: { xs: '90vw', sm: 380 }, maxWidth: 380, maxHeight: 500, borderRadius: 2 } } }}
          >
            <MuiBox sx={{ p: { xs: 2, sm: 2.5 }, borderBottom: '1px solid rgba(0,0,0,0.08)', background: 'linear-gradient(135deg, rgba(33,150,243,0.05) 0%, rgba(33,150,243,0.02) 100%)' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                {t('groups.inviteRequests', 'Group Invites')}
                {inviteCount > 0 && (
                  <MuiBox component="span" sx={{ ml: 1, px: 1.5, py: 0.5, bgcolor: 'error.main', color: 'white', borderRadius: 2, fontSize: '0.875rem', fontWeight: 700 }}>{inviteCount}</MuiBox>
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('groups.inviteRequestsDesc', 'You have pending group invitations')}
              </Typography>
            </MuiBox>
            <MuiBox sx={{ p: { xs: 1.5, sm: 2 } }}>
              {inviteLoading ? (
                <MuiBox display="flex" justifyContent="center" py={4}><CircularProgress size={36} /></MuiBox>
              ) : inviteCount === 0 ? (
                <MuiBox textAlign="center" py={4}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    🎉 {t('groups.noInvites', 'No pending group invites!')}
                  </Typography>
                </MuiBox>
              ) : (
                <List sx={{ maxHeight: 320, overflow: 'auto', p: 0 }}>
                  {groupInviteRequests.map((notif) => (
                    <ListItem key={notif.id} alignItems="flex-start" sx={{ px: 1, py: 1.5, flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 0 } }}>
                      <ListItemText
                        primary={<>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: { xs: '0.875rem', sm: '0.938rem' } }}>{notif.group?.name || t('groups.unknownGroup')}</Typography>
                          {notif.user?.name && (
                            <Typography variant="caption" color="text.secondary">{t('groups.invitedBy', { name: notif.user.name })}</Typography>
                          )}
                        </>}
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {getNotificationText(t, notif).message}
                          </Typography>
                        }
                      />
                      <MuiBox display="flex" flexDirection={{ xs: 'row', sm: 'column' }} gap={1} ml={{ xs: 0, sm: 2 }} width={{ xs: '100%', sm: 'auto' }}>
                        <Button size="small" color="success" variant="contained" onClick={() => handleAccept(notif.id)} sx={{ minHeight: '36px', width: { xs: '100%', sm: 'auto' } }}>{t('common.accept', 'Accept')}</Button>
                        <Button size="small" color="error" variant="outlined" onClick={() => handleDecline(notif.id)} sx={{ minHeight: '36px', width: { xs: '100%', sm: 'auto' } }}>{t('common.decline', 'Decline')}</Button>
                      </MuiBox>
                    </ListItem>
                  ))}
                </List>
              )}
            </MuiBox>
          </Popover>
          {/* ...existing code... */}
          <Button
            variant="outlined"
            startIcon={<SearchIcon sx={{ display: { xs: 'none', sm: 'inline' } }} />}
            onClick={() => navigate('/public-groups')}
            sx={{ minHeight: '44px', fontSize: { xs: '0.813rem', sm: '0.875rem' }, px: { xs: 2, sm: 3 } }}
          >
            <MuiBox component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{t('groups.discoverGroups')}</MuiBox>
            <MuiBox component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{t('common.discover')}</MuiBox>
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon sx={{ display: { xs: 'none', sm: 'inline' } }} />}
            onClick={() => navigate('/groups/new')}
            sx={{ minHeight: '44px', fontSize: { xs: '0.813rem', sm: '0.875rem' }, px: { xs: 2, sm: 3 } }}
          >
            <MuiBox component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{t('groups.createGroup')}</MuiBox>
            <MuiBox component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{t('common.add')}</MuiBox>
          </Button>
        </MuiBox>
      </MuiBox>

      {/* Statistics Overview */}
      {groups.length > 0 && (
        <MuiBox sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: { xs: 1.5, sm: 2 }, mb: { xs: 2, sm: 3 } }}>
          <Card sx={{ background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white', fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
                {groupStats.total}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: { xs: '0.688rem', sm: '0.75rem' } }}>
                {t('groups.allGroups')}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white', fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
                {groupStats.public}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: { xs: '0.688rem', sm: '0.75rem' } }}>
                {t('groups.public')}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white', fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
                {groupStats.private}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: { xs: '0.688rem', sm: '0.75rem' } }}>
                {t('groups.private')}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white', fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
                {groupStats.admin}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: { xs: '0.688rem', sm: '0.75rem' } }}>
                {t('groups.admin')}
              </Typography>
            </CardContent>
          </Card>
        </MuiBox>
      )}
      
      {/* Search and Filters */}
      <MuiBox sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: { xs: 1.5, sm: 2 }, mb: { xs: 2, sm: 3 } }}>
        <TextField
          fullWidth
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder={t('groups.searchGroups')}
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
          sx={{ 
            '& .MuiToggleButton-root': { 
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              px: { xs: 1, sm: 2 }
            } 
          }}
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
      </MuiBox>
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
        <MuiBox sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: { xs: 2, sm: 2.5, md: 3 } }}>


          {filteredGroups.map((group, _idx) => {
            // DEBUG: Log each group in the map
            // Inline getUserRole logic
            const accessLevel = getGroupAccessLevel(group, user.id);
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
                  <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 2.5, md: 3 } }}>
                    <MuiBox display="flex" gap={2} mb={1.5}>
                      <Avatar
                        src={getImageUrl(group.picture) || undefined}
                        sx={{ 
                          width: { xs: 50, sm: 56, md: 60 }, 
                          height: { xs: 50, sm: 56, md: 60 },
                          borderRadius: '8px',
                          bgcolor: 'primary.main',
                          flexShrink: 0
                        }}
                        variant="rounded"
                      >
                        {!group.picture && getInitials(group.name)}
                      </Avatar>
                      <MuiBox flexGrow={1} minWidth={0}>
                        <MuiBox display="flex" justifyContent="space-between" alignItems="start" mb={0.5} flexWrap="wrap" gap={0.5}>
                          <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1, pr: 1, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' }, wordBreak: 'break-word' }}>
                            {group.name}
                          </Typography>
                          <MuiBox display="flex" gap={0.5} flexShrink={0}>
                            {group.isPublic ? (
                              <Chip label={t('groups.public')} size="small" color="primary" />
                            ) : (
                              <Chip label={t('groups.private')} size="small" />
                            )}
                            {accessLevel === 'owner' && (
                              <Chip label={t('groups.owner')} size="small" color="success" />
                            )}
                            {accessLevel === 'admin' && (
                              <Chip label={t('groups.admin')} size="small" color="secondary" />
                            )}
                          </MuiBox>
                        </MuiBox>
                      </MuiBox>
                    </MuiBox>
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mb: 2, 
                        minHeight: { xs: 'auto', md: 40 },
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        fontSize: { xs: '0.813rem', sm: '0.875rem' },
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {group.description || t('groups.noDescriptionProvided')}
                    </Typography>
                    <MuiBox display="flex" alignItems="center" gap={2} mb={2} flexWrap="wrap">
                      <MuiBox display="flex" alignItems="center" gap={0.5}>
                        <GroupIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>
                          {t('groups.membersCount', { count: memberCount })}
                        </Typography>
                      </MuiBox>
                      <MuiBox display="flex" alignItems="center" gap={0.5}>
                        <EventIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.813rem' } }}>
                          {t('groups.eventsCount', { count: eventCount })}
                        </Typography>
                      </MuiBox>
                    </MuiBox>
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
                                width: { xs: 28, sm: 32 }, 
                                height: { xs: 28, sm: 32 },
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
        </MuiBox>
      )}
    </Container>
  );
};

export default GroupsList;
