import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  CircularProgress,
} from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import LocationOnIcon from '@mui/icons-material/LocationOn';

interface LocationValue {
  latitude?: number | string;
  longitude?: number | string;
  locationName?: string;
}

interface LocationPickerProps {
  value?: LocationValue;
  onChange?: (location: LocationValue) => void;
}

const LocationPicker: React.FC<LocationPickerProps> = ({ value = {}, onChange }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<LocationValue>({
    latitude: value.latitude || '',
    longitude: value.longitude || '',
    locationName: value.locationName || '',
  });

  useEffect(() => {
    if (value.latitude || value.longitude || value.locationName) {
      setLocation({
        latitude: value.latitude || '',
        longitude: value.longitude || '',
        locationName: value.locationName || '',
      });
    }
  }, [value]);

  const handleLocationChange = (field: keyof LocationValue, val: string | number) => {
    const newLocation = { ...location, [field]: val };
    setLocation(newLocation);
    if (onChange) {
      onChange(newLocation);
    }
  };

  const getCurrentLocation = () => {
    setLoading(true);
    setError('');

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          locationName: location.locationName || `Location: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
        };
        setLocation(newLocation);
        if (onChange) {
          onChange(newLocation);
        }
        setLoading(false);
      },
      (err) => {
        setError('Unable to retrieve your location: ' + err.message);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  };

  const clearLocation = () => {
    const emptyLocation = {
      latitude: '',
      longitude: '',
      locationName: '',
    };
    setLocation(emptyLocation);
    if (onChange) {
      onChange(emptyLocation);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Box display="flex" alignItems="center" mb={2}>
        <LocationOnIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6">Location (Optional)</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Location Name"
          fullWidth
          value={location.locationName}
          onChange={(e) => handleLocationChange('locationName', e.target.value)}
          placeholder="e.g., Central Park, NYC"
          helperText="A descriptive name for this location"
        />
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <TextField
            label="Latitude"
            fullWidth
            type="number"
            value={location.latitude}
            onChange={(e) => handleLocationChange('latitude', e.target.value)}
            placeholder="40.7128"
            inputProps={{ step: 'any' }}
          />
          <TextField
            label="Longitude"
            fullWidth
            type="number"
            value={location.longitude}
            onChange={(e) => handleLocationChange('longitude', e.target.value)}
            placeholder="-74.0060"
            inputProps={{ step: 'any' }}
          />
        </Box>
      </Box>

      <Box display="flex" gap={1} mt={2}>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={20} /> : <MyLocationIcon />}
          onClick={getCurrentLocation}
          disabled={loading}
        >
          {loading ? 'Getting Location...' : 'Use Current Location'}
        </Button>
        {(location.latitude || location.longitude) && (
          <Button variant="outlined" onClick={clearLocation}>
            Clear Location
          </Button>
        )}
      </Box>

      {location.latitude && location.longitude && (
        <Box mt={2}>
          <Alert severity="info">
            Location set to: {typeof location.latitude === 'number' ? location.latitude.toFixed(4) : parseFloat(String(location.latitude)).toFixed(4)}, {typeof location.longitude === 'number' ? location.longitude.toFixed(4) : parseFloat(String(location.longitude)).toFixed(4)}
            {location.locationName && ` (${location.locationName})`}
          </Alert>
        </Box>
      )}
    </Paper>
  );
};

export default LocationPicker;
