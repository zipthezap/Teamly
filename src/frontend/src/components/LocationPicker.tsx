import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { GoogleMap, LoadScript, Marker, Autocomplete } from '@react-google-maps/api';
import { parseAddressComponents } from '../utils/addressHelpers';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const libraries: ("places")[] = ["places"];

const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '8px',
};

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
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [searchAddress, setSearchAddress] = useState('');
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (value.latitude || value.longitude || value.locationName || value.city || value.country) {
      setLocation({
        latitude: value.latitude || '',
        longitude: value.longitude || '',
        locationName: value.locationName || '',
        city: value.city || '',
        country: value.country || '',
      });
      
      // Update map center if coordinates exist
      if (value.latitude && value.longitude) {
        setMapCenter({
          lat: Number(value.latitude),
          lng: Number(value.longitude),
        });
      }
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
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Try to get address from coordinates using reverse geocoding
        if (GOOGLE_MAPS_API_KEY) {
          try {
            const response = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
            );
            const data = await response.json();
            
            if (data.status === 'OK' && data.results && data.results.length > 0) {
              const result = data.results[0];
              const { city, country } = parseAddressComponents(result.address_components);
              
              const newLocation = {
                latitude: lat,
                longitude: lng,
                locationName: result.formatted_address,
                city: city || location.city,
                country: country || location.country,
              };
              
              setLocation(newLocation);
              setMapCenter({ lat, lng });
              if (onChange) {
                onChange(newLocation);
              }
              setLoading(false);
              return;
            }
          } catch (err) {
            console.error('Reverse geocoding error:', err);
          }
        }
        
        // Fallback if geocoding fails or no API key
        const newLocation = {
          ...location,
          latitude: lat,
          longitude: lng,
          locationName: location.locationName || `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        };
        setLocation(newLocation);
        setMapCenter({ lat, lng });
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
    setMapCenter(null);
    setSearchAddress('');
    if (onChange) {
      onChange(emptyLocation);
    }
  };

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    
    setLoading(true);
    
    // Use reverse geocoding to get address
    if (GOOGLE_MAPS_API_KEY) {
      fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
      )
        .then(response => response.json())
        .then(data => {
          if (data.status === 'OK' && data.results && data.results.length > 0) {
            const result = data.results[0];
            const { city, country } = parseAddressComponents(result.address_components);
            
            const newLocation = {
              latitude: lat,
              longitude: lng,
              locationName: result.formatted_address,
              city: city || location.city,
              country: country || location.country,
            };
            
            setLocation(newLocation);
            setMapCenter({ lat, lng });
            if (onChange) {
              onChange(newLocation);
            }
          }
        })
        .catch(err => {
          console.error('Reverse geocoding error:', err);
          // Fallback without address
          const newLocation = {
            ...location,
            latitude: lat,
            longitude: lng,
          };
          setLocation(newLocation);
          setMapCenter({ lat, lng });
          if (onChange) {
            onChange(newLocation);
          }
        })
        .finally(() => setLoading(false));
    } else {
      const newLocation = {
        ...location,
        latitude: lat,
        longitude: lng,
      };
      setLocation(newLocation);
      setMapCenter({ lat, lng });
      if (onChange) {
        onChange(newLocation);
      }
      setLoading(false);
    }
  }, [location, onChange]);

  const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    // Reuse the same logic as handleMapClick
    handleMapClick(e);
  }, [handleMapClick]);

  const onAutocompleteLoad = (autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      
      if (!place.geometry || !place.geometry.location) {
        setError(t('locationPicker.addressSearchFailed'));
        return;
      }
      
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      
      const { city, country } = place.address_components 
        ? parseAddressComponents(place.address_components)
        : { city: '', country: '' };
      
      const newLocation = {
        latitude: lat,
        longitude: lng,
        locationName: place.formatted_address || place.name || '',
        city: city,
        country: country,
      };
      
      setLocation(newLocation);
      setMapCenter({ lat, lng });
      setSearchAddress(place.formatted_address || place.name || '');
      
      if (onChange) {
        onChange(newLocation);
      }
    }
  };

  const hasAnyLocationData = () => {
    return hasValidCoordinate(location.latitude) || hasValidCoordinate(location.longitude) || 
           location.city || location.country || location.locationName;
  };

  const hasNamedLocation = () => {
    return location.city || location.country || location.locationName;
  };

  const hasValidCoordinate = (coord: number | string | undefined): boolean => {
    return coord !== undefined && coord !== null && coord !== '';
  };

  const formatCoordinate = (coord: number | string | undefined): string => {
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

      {/* Google Maps with Autocomplete */}
      {GOOGLE_MAPS_API_KEY ? (
        <Box sx={{ mb: 2 }}>
          <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={libraries}>
            {/* Address Search with Autocomplete */}
            <Box sx={{ mb: 1 }}>
              <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
                <TextField
                  fullWidth
                  label={t('locationPicker.searchAddress')}
                  placeholder={t('locationPicker.searchAddressPlaceholder')}
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  size="small"
                  helperText={t('locationPicker.searchAddressHelper')}
                />
              </Autocomplete>
            </Box>
            
            {/* Map */}
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              {t('locationPicker.clickMapToSetLocation')}
            </Typography>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter || { lat: 0, lng: 0 }}
              zoom={mapCenter ? 13 : 2}
              onClick={handleMapClick}
            >
              {mapCenter && (
                <Marker
                  position={mapCenter}
                  draggable={true}
                  onDragEnd={handleMarkerDragEnd}
                />
              )}
            </GoogleMap>
          </LoadScript>
        </Box>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>{t('locationPicker.apiKeyNotConfigured')}</strong> {t('locationPicker.apiKeyRequired')}
          </Typography>
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
