import React, { useState, useEffect, useCallback } from 'react';
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
  Slider,
  Paper,
} from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { groupsAPI } from '../services/api';

const PublicGroups = () => {
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [userLocation, setUserLocation] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [distanceRadius, setDistanceRadius] = useState(25); // km
  const navigate = useNavigate();

  useEffect(() => {
    fetchPublicGroups();
  }, []);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const filterGroupsByDistance = useCallback(() => {
    if (!userLocation) {
      setFilteredGroups(groups);
      return;
    }

    const filtered = groups
      .map((group) => {
        if (!group.latitude || !group.longitude) {
          return { ...group, distance: null };
        }
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          group.latitude,
          group.longitude
        );
        return { ...group, distance };
      })
      .filter((group) => group.distance === null || group.distance <= distanceRadius)
      .sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });

    setFilteredGroups(filtered);
  }, [userLocation, groups, distanceRadius, calculateDistance]);

  useEffect(() => {
    if (locationEnabled && userLocation) {
      filterGroupsByDistance();
    } else {
      setFilteredGroups(groups);
    }
  }, [groups, locationEnabled, userLocation, distanceRadius, filterGroupsByDistance]);

  const fetchPublicGroups = async () => {
    try {
      const response = await groupsAPI.getPublic();
      setGroups(response.data);
      setFilteredGroups(response.data);
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

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSnackbar({
        open: true,
        message: 'Geolocation is not supported by your browser',
        severity: 'error',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationEnabled(true);
        setSnackbar({
          open: true,
          message: 'Location detected successfully!',
          severity: 'success',
        });
      },
      (error) => {
        setSnackbar({
          open: true,
          message: 'Unable to get your location: ' + error.message,
          severity: 'error',
        });
      }
    );
  };

  const handleRequestJoin = async (groupId) => {
    setRequesting(prev => ({ ...prev, [groupId]: true }));
    try {
      await groupsAPI.requestJoin(groupId);
      setSnackbar({
        open: true,
        message: 'Join request sent successfully!',
        severity: 'success',
      });
      fetchPublicGroups();
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to send join request';
      setSnackbar({
        open: true,
        message,
        severity: 'error',
      });
    } finally {
      setRequesting(prev => ({ ...prev, [groupId]: false }));
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

      {/* Location Filter Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Filter by Location
        </Typography>
        
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Button
            variant="outlined"
            startIcon={<MyLocationIcon />}
            onClick={getCurrentLocation}
            disabled={locationEnabled}
          >
            {locationEnabled ? 'Location Enabled' : 'Enable Location'}
          </Button>
          
          {userLocation && (
            <Typography variant="body2" color="text.secondary">
              Your location: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
            </Typography>
          )}
        </Box>

        {locationEnabled && userLocation && (
          <Box>
            <Typography variant="body2" gutterBottom>
              Distance Radius: {distanceRadius} km
            </Typography>
            <Slider
              value={distanceRadius}
              onChange={(e, newValue) => setDistanceRadius(newValue)}
              min={1}
              max={100}
              step={1}
              marks={[
                { value: 1, label: '1km' },
                { value: 25, label: '25km' },
                { value: 50, label: '50km' },
                { value: 100, label: '100km' },
              ]}
              valueLabelDisplay="auto"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Showing groups within {distanceRadius} km of your location
            </Typography>
          </Box>
        )}
      </Paper>

      {filteredGroups.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {locationEnabled 
              ? 'No public groups found within your selected radius'
              : 'No public groups available at the moment'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {locationEnabled 
              ? 'Try increasing the distance radius or disable location filter'
              : 'Check back later or create your own public group!'}
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
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Showing {filteredGroups.length} of {groups.length} groups
          </Typography>
          <Grid container spacing={3}>
            {filteredGroups.map((group) => (
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
                    
                    {group.locationName && (
                      <Box display="flex" alignItems="center" mb={1}>
                        <LocationOnIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {group.locationName}
                        </Typography>
                      </Box>
                    )}
                    
                    {group.distance !== null && group.distance !== undefined && (
                      <Chip
                        label={`${group.distance.toFixed(1)} km away`}
                        size="small"
                        color="info"
                        sx={{ mb: 1 }}
                      />
                    )}
                    
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
        </>
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
