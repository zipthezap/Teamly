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

const JoinRequestsPopover = ({ groupId = null }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [feedback, setFeedback] = useState(null);
  const { joinRequests, loading, handleJoinRequest } = useJoinRequests(groupId);
  const feedbackTimeoutRef = useRef(null);

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    setFeedback(null);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setFeedback(null);
  };

  const handleAction = async (requestGroupId, requestId, action) => {
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
              width: 400,
              maxHeight: 500,
            }
          }
        }}
      >
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Join Requests {requestCount > 0 && `(${requestCount})`}
          </Typography>
          
          {feedback && (
            <Alert severity={feedback.type} sx={{ mb: 2 }}>
              {feedback.message}
            </Alert>
          )}

          {loading ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress size={32} />
            </Box>
          ) : requestCount === 0 ? (
            <Box textAlign="center" py={3}>
              <Typography variant="body2" color="text.secondary">
                No pending join requests
              </Typography>
            </Box>
          ) : (
            <List sx={{ maxHeight: 350, overflow: 'auto' }}>
              {joinRequests.map((request, index) => (
                <React.Fragment key={request.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      px: 0,
                      py: 2,
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {request.user?.name}
                          </Typography>
                          {!groupId && request.groupName && (
                            <Typography variant="caption" color="primary.main" sx={{ display: 'block' }}>
                              {request.groupName}
                            </Typography>
                          )}
                        </Box>
                      }
                      secondary={request.user?.email}
                      sx={{ mb: 1 }}
                    />
                    <Box display="flex" gap={0.5} alignItems="center">
                      <Tooltip title="Approve">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleAction(request.groupId, request.id, 'approve')}
                          disabled={actionLoading[request.id]}
                          sx={{
                            bgcolor: 'success.main',
                            color: 'white',
                            '&:hover': {
                              bgcolor: 'success.dark',
                            },
                            '&:disabled': {
                              bgcolor: 'action.disabledBackground',
                            }
                          }}
                        >
                          <CheckIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reject">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleAction(request.groupId, request.id, 'reject')}
                          disabled={actionLoading[request.id]}
                          sx={{
                            bgcolor: 'error.main',
                            color: 'white',
                            '&:hover': {
                              bgcolor: 'error.dark',
                            },
                            '&:disabled': {
                              bgcolor: 'action.disabledBackground',
                            }
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
        </Paper>
      </Popover>
    </>
  );
};

export default JoinRequestsPopover;
