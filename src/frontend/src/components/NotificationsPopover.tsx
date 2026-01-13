import React, { useState } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Paper,
  Typography,
  List,
  ListItemText,
  Box,
  CircularProgress,
  Divider,
  ListItemButton,
  Button,
  Chip,
  Stack,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import { useEnhancedNotifications } from '../hooks/useEnhancedNotifications';
import { Notification } from '../../../shared/types/notification.types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const NotificationsPopover: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { notifications, loading, stats, refresh, markAsRead } = useEnhancedNotifications({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const open = Boolean(anchorEl);
  const id = open ? 'notifications-popover' : undefined;

  // Check if notifications are muted
  const areNotificationsMuted = user?.emailNotifications === false;

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    refresh();
  };

  const handleClose = async () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (notif: Notification) => {
    // Mark this notification as read
    try {
      await markAsRead([notif.id]);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }

    // Navigate based on notification type
    if ('eventId' in notif && notif.eventId) {
      navigate(`/events/${notif.eventId}`);
    } else if ('groupId' in notif && notif.groupId) {
      navigate(`/groups/${notif.groupId}`);
    } else if ('teamUpRequestId' in notif && notif.teamUpRequestId) {
      navigate(`/teamup/${notif.teamUpRequestId}`);
    }
    handleClose();
  };

  const handleMarkAllRead = async () => {
    try {
      await markAsRead();
      refresh();
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
      refresh();
    }
  };

  const handleViewAll = () => {
    navigate('/notifications');
    handleClose();
  };

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

  return (
    <>
      <IconButton
        aria-describedby={id}
        onClick={handleClick}
        sx={{ color: 'inherit', '&:hover': { backgroundColor: 'rgba(255,255,255,0.12)' }, transition: 'background 0.2s' }}
      >
        <Badge badgeContent={stats?.unread || 0} color="error" sx={{ '& .MuiBadge-badge': { fontWeight: 600, fontSize: 13, minWidth: 22, height: 22 } }}>
          {areNotificationsMuted ? <NotificationsOffIcon /> : <NotificationsIcon />}
        </Badge>
      </IconButton>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 1.5, width: 420, maxWidth: '90vw', maxHeight: 600, borderRadius: 3, boxShadow: 8, background: 'rgba(30,34,54,0.98)', backdropFilter: 'blur(6px)' } } }}
      >
        <Paper sx={{ p: 2, background: 'transparent', boxShadow: 'none' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>{t('notifications.title')}</Typography>
            <Stack direction="row" spacing={1}>
              {notifications.length > 0 && (
                <Button size="small" onClick={handleMarkAllRead} sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 500, color: 'primary.main', px: 1.5, py: 0.5, '&:hover': { bgcolor: 'primary.light', color: 'white' } }}>
                  {t('notifications.markAllRead')}
                </Button>
              )}
              <Button size="small" onClick={handleViewAll} sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 500, color: 'secondary.main', px: 1.5, py: 0.5, '&:hover': { bgcolor: 'secondary.light', color: 'white' } }}>
                {t('notifications.viewAll')}
              </Button>
            </Stack>
          </Box>

          {/* Stats chips */}
          {stats && (
            <Stack direction="row" spacing={1} mb={2}>
              <Chip
                label={`${stats.unreadEvent} ${t('notifications.events')}`}
                size="small"
                color="primary"
                variant="filled"
                sx={{ borderRadius: 1, fontWeight: 500, bgcolor: 'primary.dark', color: 'white' }}
              />
              <Chip
                label={`${stats.unreadGroup} ${t('notifications.groups')}`}
                size="small"
                color="secondary"
                variant="filled"
                sx={{ borderRadius: 1, fontWeight: 500, bgcolor: 'secondary.dark', color: 'white' }}
              />
            </Stack>
          )}

          {loading ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress size={32} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box textAlign="center" py={3}>
              <Typography variant="body2" color="text.secondary">
                {t('notifications.noNotifications')}
              </Typography>
            </Box>
          ) : (
            <List sx={{ maxHeight: 400, overflow: 'auto', p: 0 }}>
              {notifications.map((notif, idx) => {
                const timestamp = new Date(notif.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const isClickable = notif.metadata?.actionUrl ||
                  (notif.notificationType === 'event' && notif.event?.id) ||
                  (notif.notificationType === 'group' && notif.group?.id);

                return (
                  <React.Fragment key={notif.id || idx}>
                    {idx > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />}
                    <ListItemButton
                      onClick={() => handleNotificationClick(notif as unknown as Notification)}
                      disabled={!isClickable}
                      sx={{
                        cursor: isClickable ? 'pointer' : 'default',
                        borderRadius: 2,
                        mb: 0.5,
                        px: 2,
                        py: 1.2,
                        transition: 'background 0.18s',
                        '&:hover': isClickable ? { bgcolor: 'primary.light', color: 'white' } : {},
                        bgcolor: !notif.read ? 'rgba(58,134,255,0.08)' : 'transparent',
                        boxShadow: !notif.read ? 2 : 'none',
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight={!notif.read ? 700 : 400} sx={{ color: !notif.read ? 'primary.main' : 'inherit' }}>
                              {notif.title}
                            </Typography>
                            {notif.metadata?.priority && notif.metadata.priority !== 'low' && (
                              <Chip
                                label={notif.metadata.priority}
                                size="small"
                                color={getPriorityColor(notif.metadata.priority)}
                                sx={{ height: 20, fontSize: '0.7rem', borderRadius: 1 }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {notif.message}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {timestamp}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </Paper>
      </Popover>
    </>
  );
};

export default NotificationsPopover;
