import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Chip,
  Alert,
  Snackbar,
  Grid,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AddIcon from '@mui/icons-material/Add';
import { eventRequestsAPI, groupsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const EventRequests = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    title: '',
    description: '',
    eventType: 'football',
    location: '',
    startTime: '',
    endTime: '',
    maxPlayers: '',
  });

  const eventTypes = ['football', 'basketball', 'tennis', 'volleyball', 'badminton', 'cricket', 'other'];

  useEffect(() => {
    if (groupId) {
      fetchGroup();
      fetchEventRequests();
    }
  }, [groupId]);

  const fetchGroup = async () => {
    try {
      const response = await groupsAPI.getById(groupId);
      setGroup(response.data);
    } catch (error) {
      console.error('Error fetching group:', error);
    }
  };

  const fetchEventRequests = async () => {
    try {
      const response = await eventRequestsAPI.getByGroup(groupId);
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching event requests:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load event requests',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (requestId, vote) => {
    setVoting({ ...voting, [requestId]: true });
    try {
      await eventRequestsAPI.vote(requestId, vote);
      setSnackbar({
        open: true,
        message: 'Vote recorded successfully!',
        severity: 'success',
      });
      fetchEventRequests();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to vote',
        severity: 'error',
      });
    } finally {
      setVoting({ ...voting, [requestId]: false });
    }
  };

  const handleFinalize = async (requestId) => {
    try {
      await eventRequestsAPI.finalize(requestId);
      setSnackbar({
        open: true,
        message: 'Event request finalized successfully!',
        severity: 'success',
      });
      fetchEventRequests();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to finalize request',
        severity: 'error',
      });
    }
  };

  const handleCancel = async (requestId) => {
    try {
      await eventRequestsAPI.cancel(requestId);
      setSnackbar({
        open: true,
        message: 'Event request cancelled',
        severity: 'info',
      });
      fetchEventRequests();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to cancel request',
        severity: 'error',
      });
    }
  };

  const handleCreateRequest = async () => {
    try {
      await eventRequestsAPI.create({ ...newRequest, groupId });
      setSnackbar({
        open: true,
        message: 'Event request created successfully!',
        severity: 'success',
      });
      setCreateDialogOpen(false);
      setNewRequest({
        title: '',
        description: '',
        eventType: 'football',
        location: '',
        startTime: '',
        endTime: '',
        maxPlayers: '',
      });
      fetchEventRequests();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to create event request',
        severity: 'error',
      });
    }
  };

  const isAdmin = group?.members?.some(
    (m) => m.userId === user?.id && m.role === 'admin'
  );

  const getVotePercentage = (request) => {
    const total = request.yesVotes + request.noVotes;
    if (total === 0) return 0;
    return (request.yesVotes / total) * 100;
  };

  const getUserVote = (request) => {
    return request.votes?.find((v) => v.userId === user?.id)?.vote;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">Event Requests</Typography>
          {group && (
            <Typography variant="body2" color="text.secondary">
              {group.name}
            </Typography>
          )}
        </Box>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Event Request
          </Button>
        )}
      </Box>

      {requests.length === 0 ? (
        <Box textAlign="center" py={8}>
          <HowToVoteIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No event requests yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isAdmin
              ? 'Create an event request for members to vote on!'
              : 'Check back later for new event proposals'}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {requests.map((request) => {
            const userVote = getUserVote(request);
            const votePercentage = getVotePercentage(request);

            return (
              <Grid item xs={12} key={request.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Typography variant="h6">{request.title}</Typography>
                      <Chip
                        label={request.status}
                        color={
                          request.status === 'voting'
                            ? 'info'
                            : request.status === 'finalized'
                            ? 'success'
                            : 'default'
                        }
                        size="small"
                      />
                    </Box>

                    {request.description && (
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {request.description}
                      </Typography>
                    )}

                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Type: {request.eventType}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Location: {request.location || 'TBD'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Start: {new Date(request.startTime).toLocaleString()}
                        </Typography>
                      </Grid>
                      {request.maxPlayers && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">
                            Max Players: {request.maxPlayers}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>

                    {request.status === 'voting' && (
                      <>
                        <Box sx={{ mb: 1 }}>
                          <Box display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="body2">
                              Yes: {request.yesVotes} | No: {request.noVotes}
                            </Typography>
                            <Typography variant="body2">
                              {votePercentage.toFixed(0)}% approval
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={votePercentage}
                            color={votePercentage >= 50 ? 'success' : 'error'}
                          />
                        </Box>

                        {userVote && (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            You voted: {userVote === 'yes' ? 'Yes' : 'No'}
                          </Alert>
                        )}
                      </>
                    )}
                  </CardContent>

                  <CardActions>
                    {request.status === 'voting' && (
                      <>
                        <Button
                          size="small"
                          variant={userVote === 'yes' ? 'contained' : 'outlined'}
                          startIcon={<ThumbUpIcon />}
                          onClick={() => handleVote(request.id, 'yes')}
                          disabled={voting[request.id]}
                          color="success"
                        >
                          Yes
                        </Button>
                        <Button
                          size="small"
                          variant={userVote === 'no' ? 'contained' : 'outlined'}
                          startIcon={<ThumbDownIcon />}
                          onClick={() => handleVote(request.id, 'no')}
                          disabled={voting[request.id]}
                          color="error"
                        >
                          No
                        </Button>
                        {isAdmin && (
                          <>
                            <Box sx={{ flexGrow: 1 }} />
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<CheckCircleIcon />}
                              onClick={() => handleFinalize(request.id)}
                            >
                              Finalize
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<CancelIcon />}
                              onClick={() => handleCancel(request.id)}
                              color="error"
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </>
                    )}
                    {request.status === 'finalized' && (
                      <Alert severity="success" sx={{ width: '100%' }}>
                        Event created successfully!
                      </Alert>
                    )}
                    {request.status === 'cancelled' && (
                      <Alert severity="error" sx={{ width: '100%' }}>
                        Request cancelled
                      </Alert>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Create Event Request Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Event Request</DialogTitle>
        <DialogContent>
          <TextField
            label="Title"
            fullWidth
            margin="normal"
            value={newRequest.title}
            onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
            required
          />
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={3}
            value={newRequest.description}
            onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
          />
          <TextField
            label="Event Type"
            select
            fullWidth
            margin="normal"
            value={newRequest.eventType}
            onChange={(e) => setNewRequest({ ...newRequest, eventType: e.target.value })}
            required
          >
            {eventTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Location"
            fullWidth
            margin="normal"
            value={newRequest.location}
            onChange={(e) => setNewRequest({ ...newRequest, location: e.target.value })}
          />
          <TextField
            label="Start Time"
            type="datetime-local"
            fullWidth
            margin="normal"
            value={newRequest.startTime}
            onChange={(e) => setNewRequest({ ...newRequest, startTime: e.target.value })}
            InputLabelProps={{ shrink: true }}
            required
          />
          <TextField
            label="End Time"
            type="datetime-local"
            fullWidth
            margin="normal"
            value={newRequest.endTime}
            onChange={(e) => setNewRequest({ ...newRequest, endTime: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Max Players"
            type="number"
            fullWidth
            margin="normal"
            value={newRequest.maxPlayers}
            onChange={(e) => setNewRequest({ ...newRequest, maxPlayers: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateRequest} variant="contained" disabled={!newRequest.title || !newRequest.startTime}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default EventRequests;
