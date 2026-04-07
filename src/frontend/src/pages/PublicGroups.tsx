import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Avatar,
  Typography,
  Box,
} from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { GoogleMap, LoadScript, Autocomplete, Circle } from '@react-google-maps/api';
import { groupsAPI } from '../services/api';
import { getErrorMessage } from '../utils/errorHandler';
import { useTranslation } from 'react-i18next';
import { getImageUrl, getInitials,  } from '../utils/imageUtils';
import { GroupWithDetails } from '../types/group';
import { Coordinates } from '../../../shared/types/common.types';

// Type definitions
// Using Coordinates from shared types for consistency
type Location = Coordinates;

interface LatLng {
  lat: number;
  lng: number;
}

// Extended Group interface for public groups with distance calculation
interface PublicGroup extends GroupWithDetails {
  distance?: number | null;
}

interface PublicGroupsResponse {
  groups?: PublicGroup[];
}

// Helper to validate Location objects
function isValidLocation(obj: Location | null): obj is Location {
  if (!obj) return false;
  
  return (
    typeof obj.latitude === 'number' &&
    typeof obj.longitude === 'number' &&
    isFinite(obj.latitude) &&
    isFinite(obj.longitude)
  );
}

// Helper to convert Location to LatLng
function toLatLng(location: Location | null): LatLng | null {
  if (!isValidLocation(location)) return null;
  return {
    lat: location.latitude,
    lng: location.longitude
  };
}

function extractPublicGroups(payload: unknown): PublicGroup[] {
  if (Array.isArray(payload)) {
    return payload as PublicGroup[];
  }

  if (payload && typeof payload === 'object' && Array.isArray((payload as PublicGroupsResponse).groups)) {
    return (payload as PublicGroupsResponse).groups || [];
  }

  return [];
}

const GOOGLE_MAPS_API_KEY = typeof import.meta.env.VITE_GOOGLE_MAPS_API_KEY !== 'undefined' ? import.meta.env.VITE_GOOGLE_MAPS_API_KEY : '';
const libraries: ("places")[] = ["places"];

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '8px',
};

const PublicGroups = () => {
  // Store marker instances so we can clean them up
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [groups, setGroups] = useState<PublicGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<PublicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<Record<string, boolean>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'success' });
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [distanceRadius, setDistanceRadius] = useState(25); // km
  const [mapCenter, setMapCenter] = useState<Location | null>(null);
  const [customSearchLocation, setCustomSearchLocation] = useState<Location | null>(null);
  const [searchAddress, setSearchAddress] = useState('');
  const [mapZoom, setMapZoom] = useState(2);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const navigate = useNavigate();
  const _location = useLocation();
  const { t } = useTranslation();

  // Helper to clear all markers from the map
  const clearMarkers = () => {
    if (markersRef.current && markersRef.current.length) {
      markersRef.current.forEach((marker) => {
        // Note: AdvancedMarkerElement uses the 'map' property, not setMap() method
        // Setting map to null removes the marker from the map
        marker.map = null;
      });
      markersRef.current = [];
    }
  };

  // Calculate appropriate zoom level based on radius
  const calculateZoomLevel = useCallback((radiusKm: number) => {
    // Approximate zoom levels for different radius ranges
    // These values are empirically chosen to fit the radius well in the viewport
    if (radiusKm <= 1) return 14;
    if (radiusKm <= 2) return 13;
    if (radiusKm <= 5) return 12;
    if (radiusKm <= 10) return 11;
    if (radiusKm <= 20) return 10;
    if (radiusKm <= 50) return 9;
    if (radiusKm <= 100) return 8;
    return 7;
  }, []);

  // Add AdvancedMarkerElement markers after map loads or data changes
  useEffect(() => {
    if (!window.google?.maps?.marker?.AdvancedMarkerElement || !mapRef.current) return;
    clearMarkers();
    // Custom search location marker
    if (customSearchLocation) {
      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: {
          lat: customSearchLocation.latitude,
          lng: customSearchLocation.longitude,
        },
        title: 'Custom Location',
      });
      markersRef.current.push(marker);
    }
    // User location marker
    if (userLocation && !customSearchLocation) {
      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: {
          lat: userLocation.latitude,
          lng: userLocation.longitude,
        },
        title: 'Your Location',
      });
      markersRef.current.push(marker);
    }
    // Group markers
    filteredGroups.forEach((group) => {
      if (group.latitude && group.longitude) {
        const marker = new window.google.maps.marker.AdvancedMarkerElement({
          map: mapRef.current,
          position: { lat: group.latitude, lng: group.longitude },
          title: group.name,
        });
        markersRef.current.push(marker);
      }
    });
    // Cleanup markers on unmount
    return clearMarkers;
  }, [distanceRadius, mapCenter, locationEnabled, customSearchLocation, calculateZoomLevel, filteredGroups, userLocation]);

  const fetchPublicGroups = useCallback(async () => {
    try {
      const response = await groupsAPI.getPublic();
      const publicGroups = extractPublicGroups(response.data);
      setGroups(publicGroups);
      setFilteredGroups(publicGroups);
    } catch {
      setSnackbar({
        open: true,
        message: t('groups.publicGroups.failedToLoad'),
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPublicGroups();
  }, [fetchPublicGroups]);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
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

  // Update zoom level when radius changes and a location is set
  useEffect(() => {
    if (mapCenter && (locationEnabled || customSearchLocation)) {
      setMapZoom(calculateZoomLevel(distanceRadius));
    }
  }, [distanceRadius, mapCenter, locationEnabled, customSearchLocation, calculateZoomLevel]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSnackbar({
        open: true,
        message: t('groups.publicGroups.geolocationNotSupported'),
        severity: 'error',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (
          typeof lat === 'number' &&
          typeof lng === 'number' &&
          isFinite(lat) &&
          isFinite(lng)
        ) {
          const location = { latitude: lat, longitude: lng };
          setUserLocation(location);
          setMapCenter(location);
          setMapZoom(calculateZoomLevel(distanceRadius));
          setLocationEnabled(true);
          setCustomSearchLocation(null); // Reset custom location when using current location
          setSnackbar({
            open: true,
            message: t('groups.publicGroups.locationDetected'),
            severity: 'success',
          });
        } else {
          setSnackbar({
            open: true,
            message: t('groups.publicGroups.invalidCoordinates'),
            severity: 'error',
          });
        }
      },
      (error) => {
        setSnackbar({
          open: true,
          message: t('groups.publicGroups.unableToGetLocation', { error: error.message }),
          severity: 'error',
        });
      }
    );
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    if (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      isFinite(lat) &&
      isFinite(lng)
    ) {
      const clickedLocation: Location = {
        latitude: lat,
        longitude: lng,
      };
      setCustomSearchLocation(clickedLocation);
      setMapCenter(clickedLocation);
      setMapZoom(calculateZoomLevel(distanceRadius));
      setLocationEnabled(true);
      setSnackbar({
        open: true,
        message: t('groups.publicGroups.customLocationSet'),
        severity: 'success',
      });
    } else {
      setSnackbar({
        open: true,
        message: t('groups.publicGroups.invalidCoordinates'),
        severity: 'error',
      });
    }
  };

  const onAutocompleteLoad = (autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (!place.geometry || !place.geometry.location) {
        setSnackbar({
          open: true,
          message: t('groups.publicGroups.addressSearchFailed'),
          severity: 'error',
        });
        return;
      }
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      if (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        isFinite(lat) &&
        isFinite(lng)
      ) {
        const searchLocation = {
          latitude: lat,
          longitude: lng,
        };
        setCustomSearchLocation(searchLocation);
        setMapCenter(searchLocation);
        setMapZoom(calculateZoomLevel(distanceRadius));
        setLocationEnabled(true);
        setSearchAddress(place.formatted_address || place.name || '');
        setSnackbar({
          open: true,
          message: t('groups.publicGroups.addressSearchSuccess'),
          severity: 'success',
        });
      } else {
        setSnackbar({
          open: true,
          message: t('groups.publicGroups.invalidCoordinates'),
          severity: 'error',
        });
      }
    }
  };

  const handleRequestJoin = async (groupId: string) => {
    setRequesting(prev => ({ ...prev, [groupId]: true }));
    try {
      await groupsAPI.requestJoin(groupId);
      setSnackbar({
        open: true,
        message: t('groups.publicGroups.joinRequestSent'),
        severity: 'success',
      });
      fetchPublicGroups();
    } catch (error: unknown) {
      const message = getErrorMessage(error) || t('groups.publicGroups.failedToSendJoinRequest');
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
    return <LoadingSpinner message={t('groups.publicGroups.loading')} />;
  }

  const renderContent = () => (
    <Box sx={{ maxWidth: '1200px', mx: 'auto', py: { xs: 2, sm: 3, md: 4 }, px: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 3, sm: 4, md: 6 } }}>
        {/* Globe SVG icon */}
        <Box component="span" sx={{ mr: { xs: 1.5, sm: 2, md: 3 } }}>
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" className="text-blue-600"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M2 12h20M12 2c2.5 2.5 4 6.5 4 10s-1.5 7.5-4 10c-2.5-2.5-4-6.5-4-10s1.5-7.5 4-10z" stroke="currentColor" strokeWidth="2" /></svg>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'grey.100', fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' } }}>
          {t('groups.publicGroups.title')}
        </Typography>
      </Box>

      {/* Location Filter Section */}
      <Box sx={{ 
        bgcolor: '#1a202c', 
        borderRadius: 2, 
        boxShadow: 1, 
        p: { xs: 2, sm: 2.5, md: 3 }, 
        mb: { xs: 3, sm: 4, md: 6 }, 
        border: 1, 
        borderColor: 'grey.800' 
      }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: { xs: 1.5, sm: 2 }, color: 'white', fontSize: { xs: '1rem', sm: '1.125rem' } }}>
          {t('groups.publicGroups.filterByLocation')}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, mb: { xs: 1.5, sm: 2 }, flexWrap: 'wrap' }}>
          <Button
            onClick={getCurrentLocation}
            disabled={locationEnabled && !customSearchLocation}
            startIcon={
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', bgcolor: 'rgba(255, 255, 255, 0.1)', border: 1, borderColor: 'primary.light', mr: { xs: 0.5, sm: 1 } }}>
                <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
                </svg>
              </Box>
            }
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              fontWeight: 600,
              borderRadius: 1,
              px: { xs: 2, sm: 3 },
              py: 1,
              minHeight: '44px',
              fontSize: { xs: '0.813rem', sm: '0.875rem' },
              boxShadow: 2,
              border: 1,
              borderColor: 'primary.dark',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
              '&:focus': {
                outline: 2,
                outlineColor: 'primary.light',
              }
            }}
          >
            {locationEnabled && !customSearchLocation ? t('groups.publicGroups.usingCurrentLocation') : t('groups.publicGroups.useMyLocation')}
          </Button>
          {(userLocation || customSearchLocation) && (
            <Typography variant="caption" sx={{ color: 'primary.light', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              Search from: {customSearchLocation
                ? `Custom point (${customSearchLocation.latitude.toFixed(4)}, ${customSearchLocation.longitude.toFixed(4)})`
                : `Your location (${userLocation?.latitude.toFixed(4)}, ${userLocation?.longitude.toFixed(4)})`}
            </Typography>
          )}
        </Box>

        {/* Google Maps Integration */}
        {GOOGLE_MAPS_API_KEY ? (
          <>
            <Box sx={{ mb: { xs: 2, sm: 3 } }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                {t('groups.publicGroups.clickMapToSetLocation')}
              </Typography>
              <GoogleMap
                mapContainerStyle={{
                  ...mapContainerStyle,
                  height: window.innerWidth < 600 ? '300px' : '400px',
                }}
                center={toLatLng(mapCenter) || { lat: 0, lng: 0 }}
                zoom={mapCenter ? mapZoom : 2}
                onClick={handleMapClick}
                onLoad={(map) => { mapRef.current = map; }}
              >
                {/* Show radius circle when location is enabled */}
                {(customSearchLocation || (locationEnabled && userLocation)) && (
                  <Circle
                    center={{
                      lat: (customSearchLocation?.latitude ?? userLocation?.latitude) || 0,
                      lng: (customSearchLocation?.longitude ?? userLocation?.longitude) || 0,
                    }}
                    radius={distanceRadius * 1000} // Convert km to meters
                    options={{
                      fillColor: '#4A90E2',
                      fillOpacity: 0.15,
                      strokeColor: '#4A90E2',
                      strokeOpacity: 0.5,
                      strokeWeight: 2,
                    }}
                  />
                )}
                {/* Markers are now handled by AdvancedMarkerElement in useEffect above */}
              </GoogleMap>
            </Box>

            {/* Address Search with Autocomplete */}
            <Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
              <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
                <Box 
                  component="input"
                  sx={{ 
                    width: '100%', 
                    px: { xs: 2, sm: 3 }, 
                    py: { xs: 1.5, sm: 2 }, 
                    minHeight: { xs: '44px', sm: '48px' },
                    border: 1, 
                    borderColor: 'grey.700', 
                    borderRadius: 1, 
                    bgcolor: '#0f1419', 
                    color: 'white',
                    fontSize: { xs: '0.875rem', sm: '1rem' },
                    '&:focus': {
                      outline: 2,
                      outlineColor: 'primary.main',
                    }
                  }}
                  placeholder={t('groups.searchByAddress')}
                  value={searchAddress}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchAddress(e.target.value)}
                  type="text"
                />
              </Autocomplete>
            </Box>
          </>
        ) : (
          <>
            <Box sx={{ mb: { xs: 2, sm: 3 }, p: 2, bgcolor: 'warning.light', color: 'warning.dark', borderRadius: 1, border: 1, borderColor: 'warning.main' }}>
              <Typography component="span" sx={{ fontWeight: 'bold' }}>{t('groups.publicGroups.apiKeyNotConfigured')}</Typography>{' '}
              <Typography component="span" sx={{ fontFamily: 'monospace' }}>VITE_GOOGLE_MAPS_API_KEY</Typography>{' '}
              {t('groups.publicGroups.apiKeyRequired')}<br />
              {t('groups.publicGroups.locationFilteringWithoutMap')}
            </Box>
            <Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
              <Box 
                component="input"
                sx={{ 
                  width: '100%', 
                  px: { xs: 2, sm: 3 }, 
                  py: { xs: 1.5, sm: 2 }, 
                  minHeight: { xs: '44px', sm: '48px' },
                  border: 1, 
                  borderColor: 'grey.700', 
                  borderRadius: 1, 
                  bgcolor: '#0f1419', 
                  color: 'white',
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  '&:disabled': {
                    opacity: 0.5,
                  }
                }}
                placeholder={t('groups.searchByAddress')}
                value={searchAddress}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchAddress(e.target.value)}
                type="text"
                disabled
              />
            </Box>
          </>
        )}

        {(locationEnabled && (userLocation || customSearchLocation)) && (
          <Box>
            <Typography variant="body2" sx={{ mb: 1, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
              {t('groups.publicGroups.distanceRadius', { count: distanceRadius })}
            </Typography>
            <Box 
              component="input"
              type="range"
              min={1}
              max={100}
              step={1}
              value={distanceRadius}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDistanceRadius(Number(e.target.value))}
              sx={{
                width: '100%',
                minHeight: '44px',
                cursor: 'pointer',
                accentColor: 'primary.main',
              }}
            />
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              {t('groups.publicGroups.showingGroupsWithin', { count: distanceRadius, location: customSearchLocation ? t('groups.publicGroups.customPoint') : t('groups.publicGroups.yourLocation') })}
            </Typography>
          </Box>
        )}
      </Box>

      {filteredGroups.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M2 12h20M12 2c2.5 2.5 4 6.5 4 10s-1.5 7.5-4 10c-2.5-2.5-4-6.5-4-10s1.5-7.5 4-10z" stroke="currentColor" strokeWidth="2" /></svg>
          }
          title={locationEnabled ? t('groups.publicGroups.noGroupsInRadius') : t('groups.publicGroups.noGroupsAvailable')}
          description={locationEnabled ? t('groups.publicGroups.tryIncreasingRadius') : t('groups.publicGroups.checkBackOrCreate')}
          actions={[
            {
              label: t('groups.createPublicGroup'),
              onClick: () => navigate('/groups/new')
            }
          ]}
        />
      ) : (
        <>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: { xs: 1.5, sm: 2 }, fontSize: { xs: '0.813rem', sm: '0.875rem' } }}>
            {t('groups.publicGroups.showingGroups', { count: filteredGroups.length, total: groups.length })}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: { xs: 2, sm: 3, md: 4 } }}>
            {filteredGroups.map((group) => {
              const memberCount = group._count?.members ?? group.memberCount ?? group.members?.length ?? 0;
              const _eventCount = group._count?.events ?? group.eventCount ?? group.events?.length ?? 0;
              // Don't show member avatars in public groups page since user hasn't joined
              const _recentMembers = [];
              return (
                <Card key={group.id} sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  transition: 'all 0.3s', 
                  '&:hover': { 
                    transform: 'translateY(-4px)', 
                    boxShadow: 6 
                  } 
                }}>
                  <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 2.5, md: 3 } }}>
                    <Box display="flex" gap={{ xs: 1.5, sm: 2 }} mb={1.5}>
                      <Avatar
                        src={getImageUrl(group.picture) || undefined}
                        sx={{ 
                          width: { xs: 48, sm: 56, md: 60 }, 
                          height: { xs: 48, sm: 56, md: 60 }, 
                          borderRadius: '8px', 
                          bgcolor: 'primary.main' 
                        }}
                        variant="rounded"
                      >
                        {!group.picture && getInitials(group.name)}
                      </Avatar>
                      <Box flexGrow={1} minWidth={0}>
                        <Box display="flex" justifyContent="space-between" alignItems="start" mb={0.5}>
                          <Typography variant="h6" sx={{ 
                            fontWeight: 600, 
                            flexGrow: 1, 
                            pr: 1,
                            fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' }
                          }}>
                            {group.name}
                          </Typography>
                          <Box display="flex" gap={0.5} flexShrink={0}>
                            <Chip label={t('groups.public')} size="small" color="primary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }} />
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ 
                      mb: 2, 
                      minHeight: { xs: 36, sm: 40 }, 
                      display: '-webkit-box', 
                      WebkitLineClamp: 2, 
                      WebkitBoxOrient: 'vertical', 
                      overflow: 'hidden',
                      fontSize: { xs: '0.813rem', sm: '0.875rem' }
                    }}>
                      {group.description || t('groups.publicGroups.noDescriptionAvailable')}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={{ xs: 1.5, sm: 2 }} mb={2} flexWrap="wrap">
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <GroupIcon sx={{ fontSize: { xs: 16, sm: 18 }, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                          {t('groups.membersCount', { count: memberCount })}
                        </Typography>
                      </Box>
                      {/* Google Maps Directions Button for group location */}
                      {(group.latitude && group.longitude) || group.locationName ? (
                        <Box 
                          component="a"
                          href={
                            group.latitude && group.longitude
                              ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(group.latitude + ',' + group.longitude)}`
                              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(group.locationName || group.name)}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ 
                            color: 'primary.main', 
                            fontSize: { xs: '0.7rem', sm: '0.75rem' }, 
                            textDecoration: 'underline',
                            minHeight: '44px',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                          title="Open in Google Maps"
                        >
                          {group.latitude && group.longitude ? 'Directions' : 'Map'}
                        </Box>
                      ) : null}
                    </Box>
                  </CardContent>
                  <CardActions sx={{ px: { xs: 2, sm: 2.5, md: 3 }, pb: { xs: 2, sm: 2.5, md: 3 }, pt: 0 }}>
                    <Button 
                      variant="contained"
                      fullWidth
                      onClick={() => handleRequestJoin(group.id)}
                      disabled={requesting[group.id]}
                      sx={{ minHeight: '44px', fontSize: { xs: '0.875rem', sm: '1rem' } }}
                    >
                      {requesting[group.id] ? t('groups.publicGroups.requesting') : t('groups.publicGroups.applyToJoin')}
                    </Button>
                  </CardActions>
                </Card>
              );
            })}
          </Box>
        </>
      )}
      {/* Snackbar/Alert replacement */}
      {snackbar.open && (
        <Box sx={{
          position: 'fixed',
          bottom: { xs: 16, sm: 24 },
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1400,
          minWidth: { xs: '90%', sm: '250px' },
          maxWidth: { xs: '90%', sm: '400px' },
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, sm: 2 },
          borderRadius: 1,
          boxShadow: 6,
          color: 'white',
          bgcolor: snackbar.severity === 'success' ? 'success.main' : snackbar.severity === 'error' ? 'error.main' : 'info.main',
        }}
          role="alert"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>{snackbar.message}</Typography>
            <Box 
              component="button" 
              onClick={handleCloseSnackbar} 
              aria-label="Close notification"
              sx={{ 
                ml: 2, 
                color: 'rgba(255, 255, 255, 0.8)', 
                bgcolor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&:hover': { color: 'white' } 
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );

  return GOOGLE_MAPS_API_KEY ? (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={libraries}>
      {renderContent()}
    </LoadScript>
  ) : (
    renderContent()
  );
};

export default PublicGroups;
