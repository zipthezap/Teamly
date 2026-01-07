import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';

interface EventActivityFeedProps {
  event: any;
  activityDialogOpen: boolean;
  onOpenDialog: () => void;
  onCloseDialog: () => void;
}

const getActivityMessage = (notif: any) => {
  const userName = notif.user?.name || 'Someone';
  const metadata = notif.metadata || {};
  
  switch (notif.type) {
    case 'join':
      return `${userName} joined the event`;
    case 'leave':
      return `${userName} left the event`;
    case 'late':
      return `${userName} will be late`;
    case 'confirmed':
      return `${userName} confirmed attendance`;
    case 'declined':
      return `${userName} declined`;
    case 'status_change':
      return `Event status changed to ${metadata.newStatus || 'updated'}`;
    case 'comment':
      return `${userName} commented on the event`;
    default:
      return `${userName} ${notif.type}`;
  }
};

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'join':
      return '➕';
    case 'leave':
      return '➖';
    case 'late':
      return '⏰';
    case 'confirmed':
      return '✅';
    case 'declined':
      return '❌';
    case 'status_change':
      return '🔄';
    case 'comment':
      return '💬';
    default:
      return '📌';
  }
};

const EventActivityFeed: React.FC<EventActivityFeedProps> = ({
  event,
  activityDialogOpen,
  onOpenDialog,
  onCloseDialog,
}) => {
  const recentActivity = event.eventNotifications?.slice(0, 3) || [];
  const recentParticipants = event.participants?.slice(-3) || [];

  return (
    <>
      <Paper sx={{ p: 2, bgcolor: 'rgba(76, 175, 80, 0.03)' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Recent Activity
          </Typography>
          {event.eventNotifications && event.eventNotifications.length > 3 && (
            <Button
              size="small"
              startIcon={<HistoryIcon />}
              onClick={onOpenDialog}
            >
              View All
            </Button>
          )}
        </Box>
        <Box
          sx={{
            maxHeight: '180px',
            overflowY: 'auto',
            overflowX: 'hidden',
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(76, 175, 80, 0.2)',
              borderRadius: '4px',
            },
          }}
        >
          <Stack spacing={0.5}>
            {recentActivity.length > 0 ? (
              recentActivity.map((notif: any, idx: number) => (
                <Box
                  key={notif.id || idx}
                  sx={{
                    p: 0.75,
                    borderRadius: 1,
                    bgcolor: 'rgba(255,255,255,0.8)',
                    border: '1px solid rgba(76,175,80,0.07)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Typography sx={{ fontSize: '1rem' }}>
                    {getActivityIcon(notif.type)}
                  </Typography>
                  <Box flexGrow={1}>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.95rem' }} noWrap>
                      {getActivityMessage(notif)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(notif.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Typography>
                  </Box>
                </Box>
              ))
            ) : recentParticipants.length > 0 ? (
              recentParticipants.map((p: any, idx: number) => (
                <Box
                  key={p.id || idx}
                  sx={{
                    p: 0.75,
                    borderRadius: 1,
                    bgcolor: 'rgba(255,255,255,0.8)',
                    border: '1px solid rgba(76,175,80,0.07)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Typography sx={{ fontSize: '1rem' }}>
                    {getActivityIcon('join')}
                  </Typography>
                  <Box flexGrow={1}>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.95rem' }} noWrap>
                      {p.user?.name} joined the event
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(p.joinedAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Typography>
                  </Box>
                </Box>
              ))
            ) : (
              <Box textAlign="center" py={1}>
                <Typography variant="body2" color="text.secondary">
                  No activity yet
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>
      </Paper>

      {/* Activity History Dialog */}
      <Dialog
        open={activityDialogOpen}
        onClose={onCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={1}>
              <HistoryIcon />
              <Typography variant="h6">Complete Activity History</Typography>
            </Box>
            <IconButton onClick={onCloseDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            {event.eventNotifications && event.eventNotifications.length > 0 ? (
              event.eventNotifications
                .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((notif: any, idx: number) => (
                  <Box 
                    key={notif.id || idx}
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      bgcolor: 'rgba(76, 175, 80, 0.05)',
                      border: '1px solid rgba(76, 175, 80, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <Typography sx={{ fontSize: '1.5rem' }}>
                      {getActivityIcon(notif.type)}
                    </Typography>
                    <Box flexGrow={1}>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {getActivityMessage(notif)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(notif.createdAt).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Typography>
                    </Box>
                  </Box>
                ))
            ) : (
              <Box textAlign="center" py={4}>
                <Typography variant="body2" color="text.secondary">
                  No activity recorded yet
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseDialog}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EventActivityFeed;
