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
  TextField,
  IconButton,
} from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SearchIcon from '@mui/icons-material/Search';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { groupsAPI } from '../services/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '8px',
};

const PublicGroups = () => {
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [userLocation, setUserLocation] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [distanceRadius, setDistanceRadius] = useState(25); // km
  const [mapCenter, setMapCenter] = useState(null);
  const [customSearchLocation, setCustomSearchLocation] = useState(null);
  const [searchAddress, setSearchAddress] = useState('');
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
    const searchLoc = customSearchLocation || userLocation;
    if (!searchLoc) {
      setFilteredGroups(groups);
      return;
    }

    const filtered = groups
      .map((group) => {
        if (!group.latitude || !group.longitude) {
          return { ...group, distance: null };
        }
        const distance = calculateDistance(
          searchLoc.latitude,
          searchLoc.longitude,
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
  }, [customSearchLocation, userLocation, groups, distanceRadius, calculateDistance]);

  useEffect(() => {
    if ((locationEnabled && userLocation) || customSearchLocation) {
      filterGroupsByDistance();
    } else {
      setFilteredGroups(groups);
    }
  }, [groups, locationEnabled, userLocation, customSearchLocation, distanceRadius, filterGroupsByDistance]);

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
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(location);
        setMapCenter(location);
        setLocationEnabled(true);
        setCustomSearchLocation(null); // Reset custom location when using current location
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

  const handleMapClick = (e) => {
    const clickedLocation = {
      latitude: e.latLng.lat(),
      longitude: e.latLng.lng(),
    };
    setCustomSearchLocation(clickedLocation);
    setMapCenter(clickedLocation);
    setLocationEnabled(true);
    setSnackbar({
      open: true,
      message: 'Custom search location set!',
      severity: 'success',
    });
  };

  const handleSearchAddress = async () => {
    if (!searchAddress.trim()) return;
    
    // Note: In production, you would use Google Geocoding API here
    setSnackbar({
      open: true,
      message: 'Address search requires Google Maps Geocoding API configuration',
      severity: 'info',
    });
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
        
        <Box display="flex" alignItems="center" gap={2} mb={2} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<MyLocationIcon />}
            onClick={getCurrentLocation}
            disabled={locationEnabled && !customSearchLocation}
          >
            {locationEnabled && !customSearchLocation ? 'Using Current Location' : 'Use My Location'}
          </Button>
          
          {(userLocation || customSearchLocation) && (
            <Typography variant="body2" color="text.secondary">
              Search from: {customSearchLocation 
                ? `Custom point (${customSearchLocation.latitude.toFixed(4)}, ${customSearchLocation.longitude.toFixed(4)})`
                : `Your location (${userLocation?.latitude.toFixed(4)}, ${userLocation?.longitude.toFixed(4)})`
              }
            </Typography>
          )}
        </Box>

        {/* Google Maps Integration */}
        {GOOGLE_MAPS_API_KEY ? (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Click on the map to set a custom search location
            </Typography>
            <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={mapCenter || { lat: 0, lng: 0 }}
                zoom={mapCenter ? 12 : 2}
                onClick={handleMapClick}
              >
                {customSearchLocation && (
                  <Marker
                    position={{
                      lat: customSearchLocation.latitude,
                      lng: customSearchLocation.longitude,
                    }}
                    icon={{
                      url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                    }}
                  />
                )}
                {userLocation && !customSearchLocation && (
                  <Marker
                    position={{
                      lat: userLocation.latitude,
                      lng: userLocation.longitude,
                    }}
                  />
                )}
                {/* Show group locations */}
                {filteredGroups.map((group) => 
                  group.latitude && group.longitude ? (
                    <Marker
                      key={group.id}
                      position={{
                        lat: group.latitude,
                        lng: group.longitude,
                      }}
                      title={group.name}
                      icon={{
                        url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                      }}
                    />
                  ) : null
                )}
              </GoogleMap>
            </LoadScript>
          </Box>
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Google Maps API key not configured. Set REACT_APP_GOOGLE_MAPS_API_KEY environment variable to enable map view.
            You can still use location-based filtering without the map visualization.
          </Alert>
        )}

        {/* Address Search */}
        <Box display="flex" gap={1} mb={2}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by address or city"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearchAddress()}
          />
          <IconButton color="primary" onClick={handleSearchAddress}>
            <SearchIcon />
          </IconButton>
        </Box>

        {(locationEnabled && (userLocation || customSearchLocation)) && (
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
              Showing groups within {distanceRadius} km of {customSearchLocation ? 'custom point' : 'your location'}
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
                    
                    {(group.city || group.country || group.locationName) && (
                      <Box display="flex" alignItems="center" mb={1}>
                        <LocationOnIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {[group.city, group.country, group.locationName].filter(Boolean).join(', ')}
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
