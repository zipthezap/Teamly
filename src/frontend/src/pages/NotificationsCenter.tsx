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
import { useEnhancedNotifications, Notification } from '../hooks/useEnhancedNotifications';
import { useTranslation } from 'react-i18next';

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
    } catch {
      // Failed to mark notification as read
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
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3, md: 4 }, px: { xs: 1, sm: 2, md: 3 } }}>
      {/* Header */}
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
        <Box display="flex" alignItems="center" gap={2}>
          <NotificationsIcon fontSize="large" color="primary" />
          <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' } }}>
            {t('notifications.title')}
          </Typography>
        </Box>
        <Stack 
          direction={{ xs: 'row', sm: 'row' }} 
          spacing={1}
          sx={{ '& > *': { minHeight: '44px' } }}
        >
          <IconButton onClick={refresh} disabled={loading} sx={{ minWidth: '44px', minHeight: '44px' }}>
            <RefreshIcon />
          </IconButton>
          <Button
            variant="outlined"
            size="small"
            onClick={() => markAsRead()}
            disabled={!notifications.length || filters.includeRead}
            sx={{ 
              minHeight: '44px',
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              px: { xs: 2, sm: 3 }
            }}
          >
            {t('notifications.markAllRead')}
          </Button>
        </Stack>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={{ xs: 2, sm: 2, md: 3 }} mb={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent sx={{ p: { xs: 2, sm: 2, md: 3 } }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <NotificationsIcon color="primary" />
                  <Box>
                    <Typography variant="h4" sx={{ fontSize: { xs: '1.75rem', sm: '2rem', md: '2.125rem' } }}>{stats.unread}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                      {t('notifications.unread')}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent sx={{ p: { xs: 2, sm: 2, md: 3 } }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <EventIcon color="primary" />
                  <Box>
                    <Typography variant="h4" sx={{ fontSize: { xs: '1.75rem', sm: '2rem', md: '2.125rem' } }}>{stats.totalEvent}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                      {t('notifications.eventNotifications')}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent sx={{ p: { xs: 2, sm: 2, md: 3 } }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <GroupIcon color="secondary" />
                  <Box>
                    <Typography variant="h4" sx={{ fontSize: { xs: '1.75rem', sm: '2rem', md: '2.125rem' } }}>{stats.totalGroup}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
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
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            '& .MuiTab-root': {
              minHeight: '48px',
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              px: { xs: 1.5, sm: 2 }
            }
          }}
        >
          <Tab label={`${t('notifications.unread')} (${stats?.unread || 0})`} />
          <Tab label={`${t('notifications.events')} (${stats?.unreadEvent || 0})`} />
          <Tab label={`${t('notifications.groups')} (${stats?.unreadGroup || 0})`} />
          <Tab label={t('notifications.all')} />
        </Tabs>

        <Box p={{ xs: 2, sm: 2, md: 3 }}>
          {/* Search and Filters */}
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={2} 
            mb={2}
          >
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
              sx={{
                '& .MuiInputBase-root': {
                  minHeight: '44px'
                }
              }}
            />
            <IconButton 
              onClick={() => setShowFilters(!showFilters)}
              sx={{ 
                minWidth: '44px', 
                minHeight: '44px',
                alignSelf: { xs: 'flex-start', sm: 'auto' }
              }}
            >
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
                          py: { xs: 1.5, sm: 2 },
                          px: { xs: 2, sm: 3 },
                          minHeight: '60px',
                          bgcolor: !notif.read ? 'action.hover' : 'transparent',
                          '&:hover': {
                            bgcolor: !notif.read ? 'action.selected' : 'action.hover',
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box 
                              sx={{
                                display: 'flex',
                                flexDirection: { xs: 'column', sm: 'row' },
                                alignItems: { xs: 'flex-start', sm: 'center' },
                                justifyContent: 'space-between',
                                mb: 1,
                                gap: { xs: 0.5, sm: 0 }
                              }}
                            >
                              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                <Typography variant="body1" fontWeight={!notif.read ? 600 : 400} sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                                  {String(t(`notifications.${notif.type}`, notif.params || {}))}
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
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                {formatDate(notif.createdAt)}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary" mb={0.5} sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                                {String(t(`notifications.${notif.type}Message`, notif.params || {}))}
                              </Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap">
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
                  <Button 
                    onClick={loadMore} 
                    disabled={loading} 
                    variant="outlined"
                    sx={{ minHeight: '44px' }}
                  >
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
