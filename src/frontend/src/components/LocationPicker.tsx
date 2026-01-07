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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
      setError(t('locationPicker.geolocationNotSupported'));
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
        setError(t('locationPicker.unableToRetrieveLocation', { error: err.message }));
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
    return hasValidCoordinate(location.latitude) || hasValidCoordinate(location.longitude) || 
           location.city || location.country || location.locationName;
  };

  const hasNamedLocation = () => {
    return location.city || location.country || location.locationName;
  };

  const hasValidCoordinate = (coord: number | string): boolean => {
    return coord !== undefined && coord !== null && coord !== '';
  };

  const formatCoordinate = (coord: number | string): string => {
    if (coord === undefined || coord === null || coord === '') return 'N/A';
    const num = Number(coord);
    if (isNaN(num)) return 'N/A';
    return num.toFixed(4);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Box display="flex" alignItems="center" mb={2}>
        <LocationOnIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6">{t('locationPicker.title')}</Typography>
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
            label={t('locationPicker.city')}
            fullWidth
            value={location.city}
            onChange={(e) => handleLocationChange('city', e.target.value)}
            placeholder={t('locationPicker.cityPlaceholder')}
            helperText={t('locationPicker.cityHelper')}
          />
          <TextField
            label={t('locationPicker.country')}
            fullWidth
            value={location.country}
            onChange={(e) => handleLocationChange('country', e.target.value)}
            placeholder={t('locationPicker.countryPlaceholder')}
            helperText={t('locationPicker.countryHelper')}
          />
        </Box>

        {/* Location Name - Optional descriptive field */}
        <TextField
          label={t('locationPicker.locationName')}
          fullWidth
          value={location.locationName}
          onChange={(e) => handleLocationChange('locationName', e.target.value)}
          placeholder={t('locationPicker.locationNamePlaceholder')}
          helperText={t('locationPicker.locationNameHelper')}
        />

        {/* Coordinates - Advanced/Optional */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
            {t('locationPicker.coordinates')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField
              label={t('locationPicker.latitude')}
              fullWidth
              type="number"
              value={location.latitude}
              onChange={(e) => handleLocationChange('latitude', e.target.value)}
              placeholder={t('locationPicker.latitudePlaceholder')}
              inputProps={{ step: 'any' }}
              size="small"
            />
            <TextField
              label={t('locationPicker.longitude')}
              fullWidth
              type="number"
              value={location.longitude}
              onChange={(e) => handleLocationChange('longitude', e.target.value)}
              placeholder={t('locationPicker.longitudePlaceholder')}
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
          {loading ? t('locationPicker.gettingLocation') : t('locationPicker.useCurrentLocation')}
        </Button>
        {hasAnyLocationData() && (
          <Button variant="outlined" onClick={clearLocation}>
            {t('locationPicker.clearAll')}
          </Button>
        )}
      </Box>

      {hasAnyLocationData() && (
        <Box mt={2}>
          <Alert severity="success">
            {(location.city || location.country) && (
              <>
                {t('locationPicker.locationSet', { 
                  location: [location.city, location.country].filter(Boolean).join(', ')
                })}
                {location.locationName && ` - ${location.locationName}`}
              </>
            )}
            {!(location.city || location.country) && location.locationName && (
              <>{t('locationPicker.locationSet', { location: location.locationName })}</>
            )}
            {hasValidCoordinate(location.latitude) && hasValidCoordinate(location.longitude) && (
              <Typography variant="caption" display="block" sx={{ mt: hasNamedLocation() ? 0.5 : 0 }}>
                {t('locationPicker.coordinatesSet', { 
                  lat: formatCoordinate(location.latitude), 
                  lng: formatCoordinate(location.longitude)
                })}
              </Typography>
            )}
            {!hasNamedLocation() && (hasValidCoordinate(location.latitude) || hasValidCoordinate(location.longitude)) && (
              <>Coordinates set</>
            )}
          </Alert>
        </Box>
      )}
    </Paper>
  );
};

export default LocationPicker;
