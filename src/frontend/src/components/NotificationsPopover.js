import React, { useState, useRef } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  Box,
  CircularProgress,
  Divider,
  Alert,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNotifications } from '../hooks/useNotifications';

const NotificationsPopover = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const { notifications, loading, refresh } = useNotifications();
  const open = Boolean(anchorEl);
  const id = open ? 'notifications-popover' : undefined;

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    refresh();
  };

  const handleClose = () => {
    setAnchorEl(null);
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
          <Typography variant="h6" gutterBottom>
            Notifications
          </Typography>
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
            <List sx={{ maxHeight: 350, overflow: 'auto' }}>
              {notifications.map((notif, idx) => {
                let primary = '';
                let secondary = '';
                if (notif.notificationType === 'group') {
                  if (notif.type === 'join_request') {
                    primary = `New join request for group: ${notif.group?.name || ''}`;
                  } else if (notif.type === 'accepted') {
                    primary = `You were accepted to group: ${notif.group?.name || ''}`;
                  } else if (notif.type === 'nearby_created') {
                    primary = `A new group was created near you: ${notif.group?.name || ''}`;
                  } else {
                    primary = `Group notification: ${notif.group?.name || ''}`;
                  }
                  secondary = new Date(notif.createdAt).toLocaleString();
                } else if (notif.notificationType === 'event') {
                  if (notif.type === 'created') {
                    primary = `New event created: ${notif.event?.title || ''}`;
                  } else if (notif.type === 'reminder') {
                    primary = `Event starting soon: ${notif.event?.title || ''}`;
                  } else if (notif.type === 'join') {
                    primary = `Someone joined your event: ${notif.event?.title || ''}`;
                  } else if (notif.type === 'leave') {
                    primary = `Someone left your event: ${notif.event?.title || ''}`;
                  } else {
                    primary = `Event notification: ${notif.event?.title || ''}`;
                  }
                  secondary = new Date(notif.createdAt).toLocaleString();
                } else {
                  primary = notif.title || notif.message || 'Notification';
                  secondary = notif.time ? new Date(notif.time).toLocaleString() : '';
                }
                return (
                  <React.Fragment key={notif.id || idx}>
                    {idx > 0 && <Divider />}
                    <ListItem>
                      <ListItemText
                        primary={primary}
                        secondary={secondary}
                      />
                    </ListItem>
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
