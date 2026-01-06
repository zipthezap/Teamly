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
  city?: string;
  country?: string;
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
    city: value.city || '',
    country: value.country || '',
  });

  useEffect(() => {
    if (value.latitude || value.longitude || value.locationName || value.city || value.country) {
      setLocation({
        latitude: value.latitude || '',
        longitude: value.longitude || '',
        locationName: value.locationName || '',
        city: value.city || '',
        country: value.country || '',
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
          ...location, // Preserve existing city and country
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
      city: '',
      country: '',
    };
    setLocation(emptyLocation);
    if (onChange) {
      onChange(emptyLocation);
    }
  };

  const hasAnyLocationData = () => {
    return location.latitude || location.longitude || location.city || location.country || location.locationName;
  };

  const formatCoordinate = (coord: number | string): string => {
    const num = Number(coord);
    if (isNaN(num)) return 'N/A';
    return num.toFixed(4);
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
        {/* City and Country - Primary fields */}
        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <TextField
            label="City"
            fullWidth
            value={location.city}
            onChange={(e) => handleLocationChange('city', e.target.value)}
            placeholder="e.g., New York"
            helperText="City where your group is located"
          />
          <TextField
            label="Country"
            fullWidth
            value={location.country}
            onChange={(e) => handleLocationChange('country', e.target.value)}
            placeholder="e.g., United States"
            helperText="Country where your group is located"
          />
        </Box>

        {/* Location Name - Optional descriptive field */}
        <TextField
          label="Location Name (Optional)"
          fullWidth
          value={location.locationName}
          onChange={(e) => handleLocationChange('locationName', e.target.value)}
          placeholder="e.g., Central Park Sports Complex"
          helperText="Optional: A specific venue or landmark"
        />

        {/* Coordinates - Advanced/Optional */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
            Coordinates (Optional - for precise location)
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField
              label="Latitude"
              fullWidth
              type="number"
              value={location.latitude}
              onChange={(e) => handleLocationChange('latitude', e.target.value)}
              placeholder="40.7128"
              inputProps={{ step: 'any' }}
              size="small"
            />
            <TextField
              label="Longitude"
              fullWidth
              type="number"
              value={location.longitude}
              onChange={(e) => handleLocationChange('longitude', e.target.value)}
              placeholder="-74.0060"
              inputProps={{ step: 'any' }}
              size="small"
            />
          </Box>
        </Box>
      </Box>

      <Box display="flex" gap={1} mt={2} flexWrap="wrap">
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={20} /> : <MyLocationIcon />}
          onClick={getCurrentLocation}
          disabled={loading}
        >
          {loading ? 'Getting Location...' : 'Use Current Location'}
        </Button>
        {hasAnyLocationData() && (
          <Button variant="outlined" onClick={clearLocation}>
            Clear All
          </Button>
        )}
      </Box>

      {hasAnyLocationData() && (
        <Box mt={2}>
          <Alert severity="success">
            {(location.city || location.country) && (
              <>
                Location: {[location.city, location.country].filter(Boolean).join(', ')}
                {location.locationName && ` - ${location.locationName}`}
              </>
            )}
            {!(location.city || location.country) && location.locationName && (
              <>Location: {location.locationName}</>
            )}
            {location.latitude && location.longitude && (
              <Typography variant="caption" display="block" sx={{ mt: (location.city || location.country || location.locationName) ? 0.5 : 0 }}>
                Coordinates: {formatCoordinate(location.latitude)}, {formatCoordinate(location.longitude)}
              </Typography>
            )}
            {!(location.city || location.country || location.locationName) && (location.latitude || location.longitude) && (
              <>Coordinates set</>
            )}
          </Alert>
        </Box>
      )}
    </Paper>
  );
};

export default LocationPicker;
