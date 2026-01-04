import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
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
} from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import { groupsAPI } from '../services/api';

const PublicGroups = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const navigate = useNavigate();

  useEffect(() => {
    fetchPublicGroups();
  }, []);

  const fetchPublicGroups = async () => {
    try {
      const response = await groupsAPI.getPublic();
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching public groups:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load public groups',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestJoin = async (groupId) => {
    setRequesting({ ...requesting, [groupId]: true });
    try {
      await groupsAPI.requestJoin(groupId);
      setSnackbar({
        open: true,
        message: 'Join request sent successfully!',
        severity: 'success',
      });
      // Refresh the list
      fetchPublicGroups();
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to send join request';
      setSnackbar({
        open: true,
        message,
        severity: 'error',
      });
    } finally {
      setRequesting({ ...requesting, [groupId]: false });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
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
      <Box display="flex" alignItems="center" mb={3}>
        <PublicIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
        <Typography variant="h4">Discover Public Groups</Typography>
      </Box>

      {groups.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No public groups available at the moment
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Check back later or create your own public group!
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/groups/new')}
            sx={{ mt: 2 }}
          >
            Create a Public Group
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {groups.map((group) => (
            <Grid item xs={12} sm={6} md={4} key={group.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      {group.name}
                    </Typography>
                    <Chip
                      label="Public"
                      size="small"
                      color="primary"
                      icon={<PublicIcon />}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {group.description || 'No description available'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {group.memberCount || group.members?.length || 0} members
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<GroupAddIcon />}
                    onClick={() => handleRequestJoin(group.id)}
                    disabled={requesting[group.id]}
                    fullWidth
                  >
                    {requesting[group.id] ? 'Requesting...' : 'Request to Join'}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PublicGroups;
