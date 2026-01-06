import React, { useState, useRef, useEffect } from 'react';
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
  Tooltip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useJoinRequests } from '../hooks/useJoinRequests';

interface JoinRequestsPopoverProps {
  groupId?: string | number | null;
}

interface Feedback {
  type: 'success' | 'error';
  message: string;
}

const JoinRequestsPopover: React.FC<JoinRequestsPopoverProps> = ({ groupId = null }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string | number, boolean>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const { joinRequests, loading, handleJoinRequest } = useJoinRequests(groupId);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setFeedback(null);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setFeedback(null);
  };

  const handleAction = async (requestGroupId: string | number, requestId: string | number, action: string) => {
    setActionLoading({ [requestId]: true });
    setFeedback(null);
    
    // Clear any existing timeout
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    
    const result = await handleJoinRequest(requestGroupId, requestId, action);
    
    setActionLoading({ [requestId]: false });
    
    if (result.success) {
      setFeedback({ type: 'success', message: result.message });
      // Auto-close feedback after 2 seconds
      feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 2000);
    } else {
      setFeedback({ type: 'error', message: result.message });
    }
  };

  const open = Boolean(anchorEl);
  const id = open ? 'join-requests-popover' : undefined;
  const requestCount = joinRequests.length;

  return (
    <>
      <IconButton
        aria-describedby={id}
        onClick={handleClick}
        sx={{
          color: 'inherit',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          }
        }}
      >
        <Badge badgeContent={requestCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          paper: {
            sx: {
              mt: 1.5,
              width: 420,
              maxHeight: 550,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              borderRadius: 2,
            }
          }
        }}
      >
        <Paper sx={{ p: 0 }}>
          <Box sx={{ 
            p: 2.5, 
            borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
            background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(33, 150, 243, 0.02) 100%)',
          }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Join Requests {requestCount > 0 && (
                <Box component="span" sx={{ 
                  ml: 1, 
                  px: 1.5, 
                  py: 0.5, 
                  bgcolor: 'error.main', 
                  color: 'white', 
                  borderRadius: 2,
                  fontSize: '0.875rem',
                  fontWeight: 700,
                }}>
                  {requestCount}
                </Box>
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Pending requests to join your groups
            </Typography>
          </Box>
          
          <Box sx={{ p: 2 }}>
            {feedback && (
              <Alert severity={feedback.type} sx={{ mb: 2 }}>
                {feedback.message}
              </Alert>
            )}

            {loading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress size={36} />
              </Box>
            ) : requestCount === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  🎉 All caught up!
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  No pending join requests at the moment
                </Typography>
              </Box>
            ) : (
              <List sx={{ maxHeight: 380, overflow: 'auto', p: 0 }}>
                {joinRequests.map((request, index) => (
                  <React.Fragment key={request.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 2,
                        py: 1.5,
                        '&:hover': {
                          bgcolor: 'rgba(0, 0, 0, 0.02)',
                        }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {request.user?.name}
                            </Typography>
                            {!groupId && request.groupName && (
                              <Typography variant="caption" sx={{ 
                                color: 'primary.main',
                                display: 'block',
                                fontWeight: 500,
                                mb: 0.5,
                              }}>
                                📍 {request.groupName}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              {request.user?.email}
                            </Typography>
                          </Box>
                        }
                      />
                      <Box display="flex" gap={0.5} alignItems="center">
                        <Tooltip title="Approve">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => request.groupId && handleAction(request.groupId, request.id, 'approve')}
                            disabled={actionLoading[request.id]}
                            sx={{
                              bgcolor: 'success.light',
                              '&:hover': { bgcolor: 'success.main' },
                              width: 32,
                              height: 32,
                            }}
                          >
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reject">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => request.groupId && handleAction(request.groupId, request.id, 'reject')}
                            disabled={actionLoading[request.id]}
                            sx={{
                              bgcolor: 'error.light',
                              '&:hover': { bgcolor: 'error.main' },
                              width: 32,
                              height: 32,
                            }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        </Paper>
      </Popover>
    </>
  );
};

export default JoinRequestsPopover;
