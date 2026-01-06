import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
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
    return <LoadingSpinner message="Loading public groups..." />;
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 mb-8 px-4">
      <div className="flex items-center mb-6">
        {/* Globe SVG icon */}
        <span className="mr-3">
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" className="text-blue-600"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M2 12h20M12 2c2.5 2.5 4 6.5 4 10s-1.5 7.5-4 10c-2.5-2.5-4-6.5-4-10s1.5-7.5 4-10z" stroke="currentColor" strokeWidth="2" /></svg>
        </span>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Discover Public Groups</h1>
      </div>

      {/* Location Filter Section */}
      <div className="bg-white dark:bg-[#1a2233] rounded-xl shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Filter by Location</h2>
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <Button
            onClick={getCurrentLocation}
            disabled={locationEnabled && !customSearchLocation}
            startIcon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            }
            className="border border-blue-600 bg-white text-blue-600 hover:bg-blue-50"
          >
            {locationEnabled && !customSearchLocation ? 'Using Current Location' : 'Use My Location'}
          </Button>
          {(userLocation || customSearchLocation) && (
            <span className="text-sm text-gray-500">
              Search from: {customSearchLocation
                ? `Custom point (${customSearchLocation.latitude.toFixed(4)}, ${customSearchLocation.longitude.toFixed(4)})`
                : `Your location (${userLocation?.latitude.toFixed(4)}, ${userLocation?.longitude.toFixed(4)})`}
            </span>
          )}
        </div>

        {/* Google Maps Integration (unchanged, keep as is) */}
        {GOOGLE_MAPS_API_KEY ? (
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">Click on the map to set a custom search location</div>
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
                    icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' }}
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
                {filteredGroups.map((group) =>
                  group.latitude && group.longitude ? (
                    <Marker
                      key={group.id}
                      position={{ lat: group.latitude, lng: group.longitude }}
                      title={group.name}
                      icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
                    />
                  ) : null
                )}
              </GoogleMap>
            </LoadScript>
          </div>
        ) : (
          <div className="mb-2 p-3 bg-yellow-100 text-yellow-800 rounded">
            <strong>Google Maps API key not configured.</strong> Set <span className="font-mono">REACT_APP_GOOGLE_MAPS_API_KEY</span> environment variable to enable map view.<br />
            You can still use location-based filtering without the map visualization.
          </div>
        )}

        {/* Address Search */}
        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search by address or city"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchAddress()}
            type="text"
          />
          <button
            className="p-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleSearchAddress}
            aria-label="Search"
          >
            {/* Search SVG */}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        {(locationEnabled && (userLocation || customSearchLocation)) && (
          <div>
            <div className="text-sm mb-1">Distance Radius: {distanceRadius} km</div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={distanceRadius}
              onChange={e => setDistanceRadius(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="text-xs text-gray-500 mt-1">
              Showing groups within {distanceRadius} km of {customSearchLocation ? 'custom point' : 'your location'}
            </div>
          </div>
        )}
      </div>
      </Paper>

      {filteredGroups.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M2 12h20M12 2c2.5 2.5 4 6.5 4 10s-1.5 7.5-4 10c-2.5-2.5-4-6.5-4-10s1.5-7.5 4-10z" stroke="currentColor" strokeWidth="2" /></svg>
          }
          title={locationEnabled ? 'No public groups found within your selected radius' : 'No public groups available at the moment'}
          description={locationEnabled ? 'Try increasing the distance radius or disable location filter' : 'Check back later or create your own public group!'}
          actionLabel="Create a Public Group"
          onAction={() => navigate('/groups/new')}
        />
      ) : (
        <>
          <div className="text-sm text-gray-500 mb-2">
            Showing {filteredGroups.length} of {groups.length} groups
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filteredGroups.map((group) => (
              <div key={group.id} className="bg-white dark:bg-[#1a2233] rounded-xl shadow-md flex flex-col h-full p-5">
                <div className="flex items-center mb-2">
                  <div className="flex-1 text-lg font-semibold text-gray-900 dark:text-white">{group.name}</div>
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium">
                    {/* Globe SVG */}
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M2 12h20M12 2c2.5 2.5 4 6.5 4 10s-1.5 7.5-4 10c-2.5-2.5-4-6.5-4-10s1.5-7.5 4-10z" stroke="currentColor" strokeWidth="2" /></svg>
                    Public
                  </span>
                </div>
                <div className="text-sm text-gray-500 mb-2">{group.description || 'No description available'}</div>
                {(group.city || group.country || group.locationName) && (
                  <div className="flex items-center text-xs text-gray-400 mb-1">
                    {/* Location SVG */}
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 21c-4.418 0-8-3.582-8-8 0-4.418 3.582-8 8-8s8 3.582 8 8c0 4.418-3.582 8-8 8z" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /></svg>
                    {[group.city, group.country, group.locationName].filter(Boolean).join(', ')}
                  </div>
                )}
                {group.distance !== null && group.distance !== undefined && (
                  <span className="inline-block bg-blue-50 text-blue-700 text-xs rounded px-2 py-0.5 mb-1">
                    {group.distance.toFixed(1)} km away
                  </span>
                )}
                <div className="text-xs text-gray-400 mb-2">{group.memberCount || group.members?.length || 0} members</div>
                <Button
                  onClick={() => handleRequestJoin(group.id)}
                  loading={requesting[group.id]}
                  startIcon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4c0 2.21 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" stroke="currentColor" strokeWidth="2" /></svg>
                  }
                  className="mt-auto w-full"
                  disabled={requesting[group.id]}
                >
                  {requesting[group.id] ? 'Requesting...' : 'Request to Join'}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
      {/* Snackbar/Alert replacement */}
      {snackbar.open && (
        <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 min-w-[250px] max-w-xs px-4 py-3 rounded shadow-lg text-white transition-all
          ${snackbar.severity === 'success' ? 'bg-green-600' : snackbar.severity === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}
          role="alert"
        >
          <div className="flex items-center justify-between">
            <span>{snackbar.message}</span>
            <button className="ml-4 text-white/80 hover:text-white" onClick={handleCloseSnackbar} aria-label="Close notification">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicGroups;
