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
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NotificationsPopover: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { notifications, loading, stats, refresh, markAsRead } = useEnhancedNotifications({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const handleNotificationClick = async (notif: any) => {
    // Mark this notification as read
    try {
      await markAsRead([notif.id]);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }

    // Navigate based on metadata or fallback to type
    if (notif.metadata?.actionUrl) {
      navigate(notif.metadata.actionUrl);
    } else if (notif.notificationType === 'event' && notif.event?.id) {
      navigate(`/events/${notif.event.id}`);
    } else if (notif.notificationType === 'group' && notif.group?.id) {
      navigate(`/groups/${notif.group.id}`);
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
        sx={{ color: 'inherit', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
      >
        <Badge badgeContent={stats?.unread || 0} color="error">
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
        slotProps={{ paper: { sx: { mt: 1.5, width: 420, maxHeight: 600 } } }}
      >
        <Paper sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Notifications</Typography>
            <Stack direction="row" spacing={1}>
              {notifications.length > 0 && (
                <Button size="small" onClick={handleMarkAllRead} sx={{ textTransform: 'none' }}>
                  Mark all read
                </Button>
              )}
              <Button size="small" onClick={handleViewAll} sx={{ textTransform: 'none' }}>
                View All
              </Button>
            </Stack>
          </Box>
          
          {/* Stats chips */}
          {stats && (
            <Stack direction="row" spacing={1} mb={2}>
              <Chip
                label={`${stats.unreadEvent} Events`}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={`${stats.unreadGroup} Groups`}
                size="small"
                color="secondary"
                variant="outlined"
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
                No notifications
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
                    {idx > 0 && <Divider />}
                    <ListItemButton
                      onClick={() => handleNotificationClick(notif)}
                      disabled={!isClickable}
                      sx={{
                        cursor: isClickable ? 'pointer' : 'default',
                        '&:hover': isClickable ? { bgcolor: 'rgba(0, 0, 0, 0.04)' } : {},
                        bgcolor: !notif.read ? 'action.hover' : 'transparent',
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight={!notif.read ? 600 : 400}>
                              {notif.title}
                            </Typography>
                            {notif.metadata?.priority && notif.metadata.priority !== 'low' && (
                              <Chip
                                label={notif.metadata.priority}
                                size="small"
                                color={getPriorityColor(notif.metadata.priority)}
                                sx={{ height: 20, fontSize: '0.7rem' }}
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
