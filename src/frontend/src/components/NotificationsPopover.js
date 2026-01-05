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
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';

const NotificationsPopover = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const { notifications, loading, refresh, markAsRead } = useNotifications();
  const navigate = useNavigate();
  const open = Boolean(anchorEl);
  const id = open ? 'notifications-popover' : undefined;

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    refresh();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };
  
  const handleNotificationClick = (notif) => {
    // Navigate to relevant page based on notification type
    if (notif.notificationType === 'event' && notif.event?.id) {
      navigate(`/events/${notif.event.id}`);
      handleClose();
    } else if (notif.notificationType === 'group' && notif.group?.id) {
      navigate(`/groups/${notif.group.id}`);
      handleClose();
    }
  };

  const handleMarkAllRead = async () => {
    await markAsRead();
    refresh();
  };

  return (
    <>
      <IconButton
        aria-describedby={id}
        onClick={handleClick}
        sx={{ color: 'inherit', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
      >
        <Badge badgeContent={notifications.length} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 1.5, width: 400, maxHeight: 500 } } }}
      >
        <Paper sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Notifications
            </Typography>
            {notifications.length > 0 && (
              <Button 
                size="small" 
                onClick={handleMarkAllRead}
                sx={{ textTransform: 'none' }}
              >
                Mark all read
              </Button>
            )}
          </Box>
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
            <List sx={{ maxHeight: 350, overflow: 'auto', p: 0 }}>
              {notifications.map((notif, idx) => {
                let primary = '';
                let secondary = '';
                if (notif.notificationType === 'group') {
                  if (notif.type === 'join_request') {
                    primary = `New join request for "${notif.group?.name || 'group'}"`;
                    secondary = 'Someone wants to join your group';
                  } else if (notif.type === 'accepted') {
                    primary = `Welcome to "${notif.group?.name || 'group'}"!`;
                    secondary = 'Your join request was accepted';
                  } else if (notif.type === 'nearby_created') {
                    primary = `New group near you: "${notif.group?.name || 'group'}"`;
                    secondary = 'Check it out and join!';
                  } else {
                    primary = `Group update: ${notif.group?.name || 'group'}`;
                    secondary = '';
                  }
                } else if (notif.notificationType === 'event') {
                  const userName = notif.user?.name || 'Someone';
                  if (notif.type === 'created') {
                    primary = `New event: "${notif.event?.title || 'event'}"`;
                    secondary = 'Check out the details and join!';
                  } else if (notif.type === 'reminder') {
                    primary = `Reminder: "${notif.event?.title || 'event'}" starts soon`;
                    secondary = 'Don\'t forget to attend!';
                  } else if (notif.type === 'join') {
                    primary = `${userName} joined "${notif.event?.title || 'your event'}"`;
                    secondary = 'New participant added';
                  } else if (notif.type === 'leave') {
                    primary = `${userName} left "${notif.event?.title || 'your event'}"`;
                    secondary = 'Participant has left the event';
                  } else if (notif.type === 'late') {
                    primary = `${userName} will be late to "${notif.event?.title || 'your event'}"`;
                    secondary = 'Participant marked as late';
                  } else if (notif.type === 'confirmed') {
                    primary = `${userName} confirmed for "${notif.event?.title || 'your event'}"`;
                    secondary = 'Attendance confirmed';
                  } else if (notif.type === 'declined') {
                    primary = `${userName} declined "${notif.event?.title || 'your event'}"`;
                    secondary = 'Attendance declined';
                  } else {
                    primary = `Event update: ${notif.event?.title || 'event'}`;
                    secondary = '';
                  }
                } else {
                  primary = notif.title || notif.message || 'Notification';
                  secondary = notif.time ? new Date(notif.time).toLocaleString() : '';
                }
                
                // Add timestamp to secondary text
                const timestamp = new Date(notif.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                secondary = secondary ? `${secondary} • ${timestamp}` : timestamp;
                
                const isClickable = (notif.notificationType === 'event' && notif.event?.id) || 
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
                      }}
                    >
                      <ListItemText
                        primary={primary}
                        secondary={secondary}
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
