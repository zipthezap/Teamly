import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import { groupsAPI, groupChatAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const GroupDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);

  const fetchJoinRequests = useCallback(async () => {
    try {
      const response = await groupsAPI.getJoinRequests(id);
      setJoinRequests(response.data);
    } catch (error) {
      console.error('Error fetching join requests:', error);
    }
  }, [id]);

  const fetchGroup = useCallback(async () => {
    try {
      const response = await groupsAPI.getById(id);
      setGroup(response.data);
      
      // Fetch join requests if user is admin
      const currentMember = response.data.members?.find(m => m.userId === user?.id);
      if (currentMember?.role === 'admin') {
        fetchJoinRequests();
      }
    } catch (error) {
      console.error('Error fetching group:', error);
      setError('Failed to load group');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, fetchJoinRequests]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  const fetchMessages = useCallback(async () => {
    setChatLoading(true);
    try {
      const res = await groupChatAPI.getMessages(id);
      setMessages(res.data);
    } catch (e) {
      // Optionally handle error
    } finally {
      setChatLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMessages();
    // Optionally poll for new messages every 10s
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleJoinRequest = async (requestId, action) => {
    try {
      await groupsAPI.handleJoinRequest(id, requestId, action);
      setSuccess(`Join request ${action === 'approve' ? 'approved' : 'rejected'}`);
      fetchJoinRequests();
      fetchGroup();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to process join request');
    }
  };

  const handleInvite = async () => {
    setError('');
    setSuccess('');
    try {
      await groupsAPI.invite(id, inviteEmail);
      setSuccess('Member invited successfully');
      setInviteEmail('');
      setInviteDialogOpen(false);
      fetchGroup();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to invite member');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;

    try {
      await groupsAPI.removeMember(id, memberId);
      setSuccess('Member removed successfully');
      fetchGroup();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      await groupChatAPI.sendMessage(id, newMessage);
      setNewMessage('');
      fetchMessages();
    } catch (e) {
      // Optionally handle error
    }
  };

  const isAdmin = group?.members?.find(
    (m) => m.userId === user?.id && m.role === 'admin'
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!group) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">Group not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="start">
          <Box>
            <Typography variant="h4" gutterBottom>
              {group.name}
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              {group.description || 'No description'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Created by {group.creator?.name} on {new Date(group.createdAt).toLocaleDateString()}
            </Typography>
          </Box>
          {isAdmin && (
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                startIcon={<HowToVoteIcon />}
                onClick={() => navigate(`/event-requests/${id}`)}
              >
                Event Requests
              </Button>
              <Button
                variant="outlined"
                startIcon={<PersonAddIcon />}
                onClick={() => setInviteDialogOpen(true)}
              >
                Invite Member
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Join Requests Section (Admin Only) */}
      {isAdmin && joinRequests.length > 0 && (
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'info.dark', borderColor: 'info.main', borderWidth: 1, borderStyle: 'solid' }}>
          <Typography variant="h6" gutterBottom>
            Pending Join Requests ({joinRequests.length})
          </Typography>
          <List>
            {joinRequests.map((request) => (
              <ListItem key={request.id} sx={{ bgcolor: 'background.paper', mb: 1, borderRadius: 1 }}>
                <ListItemText
                  primary={request.user?.name}
                  secondary={request.user?.email}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => handleJoinRequest(request.id, 'approve')}
                    color="success"
                    sx={{ mr: 1 }}
                  >
                    <CheckIcon />
                  </IconButton>
                  <IconButton
                    edge="end"
                    onClick={() => handleJoinRequest(request.id, 'reject')}
                    color="error"
                  >
                    <CloseIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Members ({group.members?.length || 0})
              </Typography>
              <List>
                {group.members?.map((member) => (
                  <ListItem key={member.id}>
                    <ListItemText
                      primary={member.user?.name}
                      secondary={
                        <>
                          {member.user?.email}
                          {member.role === 'admin' && (
                            <Chip label="Admin" size="small" sx={{ ml: 1 }} />
                          )}
                        </>
                      }
                    />
                    {isAdmin && member.userId !== user.id && (
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Events ({group.events?.length || 0})
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => navigate('/events/new', { state: { groupId: id } })}
                >
                  Create Event
                </Button>
              </Box>
              <List>
                {group.events?.map((event) => (
                  <ListItem
                    key={event.id}
                    button
                    onClick={() => navigate(`/events/${event.id}`)}
                    sx={{
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                        boxShadow: 3,
                      },
                    }}
                  >
                    <ListItemText
                      primary={event.title}
                      secondary={`${event.eventType} - ${new Date(event.startTime).toLocaleDateString()}`}
                    />
                  </ListItem>
                ))}
                {(!group.events || group.events.length === 0) && (
                  <ListItem>
                    <ListItemText secondary="No events yet" />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Group Chat</Typography>
              <Box sx={{ maxHeight: 250, overflowY: 'auto', mb: 2, bgcolor: 'background.default', p: 1, borderRadius: 1, border: 1, borderColor: 'divider' }}>
                {chatLoading ? (
                  <CircularProgress size={24} />
                ) : messages.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No messages yet.</Typography>
                ) : (
                  messages.map((msg) => (
                    <Box key={msg.id} sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" color="primary.main">{msg.user?.name || 'User'}</Typography>
                      <Typography variant="body2">{msg.content}</Typography>
                      <Typography variant="caption" color="text.secondary">{new Date(msg.createdAt).toLocaleString()}</Typography>
                    </Box>
                  ))
                )}
              </Box>
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 8 }}>
                <TextField
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  size="small"
                  fullWidth
                />
                <Button type="submit" variant="contained" disabled={!newMessage.trim()}>Send</Button>
              </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)}>
        <DialogTitle>Invite Member</DialogTitle>
        <DialogContent>
          <TextField
            label="Email Address"
            type="email"
            fullWidth
            margin="normal"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleInvite} variant="contained">
            Invite
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default GroupDetails;
