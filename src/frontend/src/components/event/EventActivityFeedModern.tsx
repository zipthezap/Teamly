import React from 'react';
import { Paper, Typography, Box, Tooltip, List, ListItem, ListItemText, ListItemIcon } from '@mui/material';

const statusMap = {
  confirmed: { color: '#4caf50', label: 'Confirmed', icon: '✔️' },
  declined: { color: '#f44336', label: 'Declined', icon: '❌' },
  late: { color: '#ff9800', label: 'Late', icon: '⏰' },
  join: { color: '#2196f3', label: 'Joined', icon: '➕' },
  leave: { color: '#607d8b', label: 'Left', icon: '➖' },
  unmark_late: { color: '#00bcd4', label: 'Undo Late', icon: '↩️' },
};

function formatActivity(notif) {
  const user = notif.user?.name || 'Someone';
  switch (notif.type) {
    case 'confirmed': return `${user} confirmed attendance`;
    case 'declined': return `${user} declined`;
    case 'late': return `${user} marked as late`;
    case 'join': return `${user} joined the event`;
    case 'leave': return `${user} left the event`;
    case 'unmark_late': return `${user} undid late status`;
    default: return `${user} ${notif.type}`;
  }
}

const formatTime = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
  });
};


const EventActivityFeedModern = ({ notifications }) => (
  <Paper sx={{ p: 1.5, minWidth: 0, boxShadow: 0, bgcolor: 'background.paper', borderRadius: 2 }}>
    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
      Recent Activity
    </Typography>
    <List dense sx={{ p: 0, m: 0, maxHeight: 220, overflowY: 'auto' }}>
      {notifications && notifications.length > 0 ? notifications.slice(0, 8).map((notif, idx) => {
        const status = statusMap[notif.type] || { color: '#90caf9', label: notif.type, icon: '•' };
        return (
          <ListItem key={notif.id || idx} sx={{ py: 0.5, px: 0, minHeight: 0 }} disableGutters>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <span style={{ fontSize: 18, color: status.color }}>{status.icon}</span>
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', fontSize: 14 }}>{formatActivity(notif)}</Typography>}
              secondary={<Tooltip title={status.label}><span style={{ color: '#90a4ae', fontSize: 12 }}>{formatTime(notif.createdAt)}</span></Tooltip>}
              sx={{ m: 0 }}
            />
          </ListItem>
        );
      }) : (
        <ListItem>
          <ListItemText primary={<Typography variant="body2" color="text.secondary">No activity yet</Typography>} />
        </ListItem>
      )}
    </List>
  </Paper>
);

export default EventActivityFeedModern;
