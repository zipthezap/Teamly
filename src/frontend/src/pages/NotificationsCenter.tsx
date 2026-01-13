/**
 * Notifications Center Page
 * Comprehensive notification management with filtering, search, and history
 */

import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Button,
  Chip,
  Stack,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import NotificationsIcon from '@mui/icons-material/Notifications';
import EventIcon from '@mui/icons-material/Event';
import GroupIcon from '@mui/icons-material/Group';
import { useNavigate } from 'react-router-dom';
import { useEnhancedNotifications } from '../hooks/useEnhancedNotifications';
import { useTranslation } from 'react-i18next';
import { Notification } from '../../../shared/types';

const NotificationsCenter: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');

  const { notifications, stats, loading, filters, hasMore, total, markAsRead, loadMore, refresh, updateFilters } =
    useEnhancedNotifications({
      autoRefresh: true,
      refreshInterval: 30000,
      initialFilters: { includeRead: false },
    });

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    if (newValue === 0) {
      updateFilters({ includeRead: false, notificationType: undefined });
    } else if (newValue === 1) {
      updateFilters({ includeRead: false, notificationType: 'event' });
    } else if (newValue === 2) {
      updateFilters({ includeRead: false, notificationType: 'group' });
    } else if (newValue === 3) {
      updateFilters({ includeRead: true, notificationType: undefined });
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notif: Notification) => {
    try {
      await markAsRead([notif.id]);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }

    if ('metadata' in notif && notif.metadata?.actionUrl) {
      navigate(notif.metadata.actionUrl);
    } else if (notif.notificationType === 'event' && notif.event?.id) {
      navigate(`/events/${notif.event.id}`);
    } else if (notif.notificationType === 'group' && notif.group?.id) {
      navigate(`/groups/${notif.group.id}`);
    }
  };

  // Filter notifications by search query
  const filteredNotifications = notifications.filter((notif) => {
    const matchesSearch =
      searchQuery === '' ||
      notif.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notif.message.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === 'all' || notif.type === selectedType;

    return matchesSearch && matchesType;
  });

  // Get unique notification types for filter
  const notificationTypes = Array.from(new Set(notifications.map((n) => n.type)));

  // Get priority color
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('notifications.justNow');
    if (diffMins < 60) return t('notifications.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('notifications.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('notifications.daysAgo', { count: diffDays });

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <NotificationsIcon fontSize="large" color="primary" />
          <Typography variant="h4" fontWeight="bold">
            {t('notifications.title')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <IconButton onClick={refresh} disabled={loading}>
            <RefreshIcon />
          </IconButton>
          <Button
            variant="outlined"
            size="small"
            onClick={() => markAsRead()}
            disabled={!notifications.length || filters.includeRead}
          >
            {t('notifications.markAllRead')}
          </Button>
        </Stack>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} mb={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <NotificationsIcon color="primary" />
                  <Box>
                    <Typography variant="h4">{stats.unread}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('notifications.unread')}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <EventIcon color="primary" />
                  <Box>
                    <Typography variant="h4">{stats.totalEvent}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('notifications.eventNotifications')}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <GroupIcon color="secondary" />
                  <Box>
                    <Typography variant="h4">{stats.totalGroup}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('notifications.groupNotifications')}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main Content */}
      <Paper>
        {/* Tabs */}
        <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth">
          <Tab label={`${t('notifications.unread')} (${stats?.unread || 0})`} />
          <Tab label={`${t('notifications.events')} (${stats?.unreadEvent || 0})`} />
          <Tab label={`${t('notifications.groups')} (${stats?.unreadGroup || 0})`} />
          <Tab label={t('notifications.all')} />
        </Tabs>

        <Box p={2}>
          {/* Search and Filters */}
          <Stack direction="row" spacing={2} mb={2}>
            <TextField
              fullWidth
              placeholder={t('notifications.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              size="small"
            />
            <IconButton onClick={() => setShowFilters(!showFilters)}>
              <FilterListIcon />
            </IconButton>
          </Stack>

          {/* Advanced Filters */}
          {showFilters && (
            <Box mb={2} p={2} bgcolor="action.hover" borderRadius={1}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{t('notifications.type')}</InputLabel>
                    <Select
                      value={selectedType}
                      label={t('notifications.type')}
                      onChange={(e) => setSelectedType(e.target.value)}
                    >
                      <MenuItem value="all">{t('notifications.allTypes')}</MenuItem>
                      {notificationTypes.map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Notifications List */}
          {loading && notifications.length === 0 ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : filteredNotifications.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="text.secondary">
                {t('notifications.noNotificationsFound')}
              </Typography>
            </Box>
          ) : (
            <>
              <List sx={{ p: 0 }}>
                {filteredNotifications.map((notif, idx) => {
                  const isClickable =
                    notif.metadata?.actionUrl ||
                    (notif.notificationType === 'event' && notif.event?.id) ||
                    (notif.notificationType === 'group' && notif.group?.id);

                  return (
                    <React.Fragment key={notif.id}>
                      {idx > 0 && <Divider />}
                      <ListItemButton
                        onClick={() => handleNotificationClick(notif)}
                        disabled={!isClickable}
                        sx={{
                          py: 2,
                          bgcolor: !notif.read ? 'action.hover' : 'transparent',
                          '&:hover': {
                            bgcolor: !notif.read ? 'action.selected' : 'action.hover',
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body1" fontWeight={!notif.read ? 600 : 400}>
                                  {t(`notifications.${notif.type}`, notif.params || {})}
                                </Typography>
                                {!notif.read && (
                                  <Chip label={t('notifications.new')} size="small" color="primary" sx={{ height: 20 }} />
                                )}
                                {notif.metadata?.priority && notif.metadata.priority !== 'low' && (
                                  <Chip
                                    label={notif.metadata.priority}
                                    size="small"
                                    color={getPriorityColor(notif.metadata.priority)}
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                )}
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(notif.createdAt)}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary" mb={0.5}>
                                {t(`notifications.${notif.type}Message`, notif.params || {})}
                              </Typography>
                              <Stack direction="row" spacing={1}>
                                <Chip
                                  label={notif.notificationType}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: '0.65rem' }}
                                />
                                <Chip
                                  label={notif.type}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: '0.65rem' }}
                                />
                              </Stack>
                            </Box>
                          }
                        />
                      </ListItemButton>
                    </React.Fragment>
                  );
                })}
              </List>

              {/* Load More */}
              {hasMore && (
                <Box display="flex" justifyContent="center" mt={2}>
                  <Button onClick={loadMore} disabled={loading} variant="outlined">
                    {loading ? t('notifications.loading') : t('notifications.loadMore')}
                  </Button>
                </Box>
              )}

              {/* Total count */}
              <Box textAlign="center" mt={2}>
                <Typography variant="body2" color="text.secondary">
                  {t('notifications.showing', { count: filteredNotifications.length, total })}
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default NotificationsCenter;
