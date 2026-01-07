import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { groupsAPI } from '../services/api';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

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
        message: t('publicGroups.failedToLoad'),
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
        message: t('publicGroups.geolocationNotSupported'),
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
          message: t('publicGroups.locationDetected'),
          severity: 'success',
        });
      },
      (error) => {
        setSnackbar({
          open: true,
          message: t('publicGroups.unableToGetLocation', { error: error.message }),
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
      message: t('publicGroups.customLocationSet'),
      severity: 'success',
    });
  };

  const handleSearchAddress = async () => {
    if (!searchAddress.trim()) return;
    
    // Note: In production, you would use Google Geocoding API here
    setSnackbar({
      open: true,
      message: t('publicGroups.addressSearchRequiresApi'),
      severity: 'info',
    });
  };

  const handleRequestJoin = async (groupId) => {
    setRequesting(prev => ({ ...prev, [groupId]: true }));
    try {
      await groupsAPI.requestJoin(groupId);
      setSnackbar({
        open: true,
        message: t('publicGroups.joinRequestSent'),
        severity: 'success',
      });
      fetchPublicGroups();
    } catch (error) {
      const message = error.response?.data?.error || t('publicGroups.failedToSendJoinRequest');
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
    return <LoadingSpinner message={t('publicGroups.loading')} />;
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 mb-8 px-4">
      <div className="flex items-center mb-6">
        {/* Globe SVG icon */}
        <span className="mr-3">
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" className="text-blue-600"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M2 12h20M12 2c2.5 2.5 4 6.5 4 10s-1.5 7.5-4 10c-2.5-2.5-4-6.5-4-10s1.5-7.5 4-10z" stroke="currentColor" strokeWidth="2" /></svg>
        </span>
        <h1 className="text-3xl font-bold text-gray-100">{t('publicGroups.title')}</h1>
      </div>

      {/* Location Filter Section */}
      <div className="bg-[#202334] rounded-lg shadow p-4 mb-6 border border-gray-800">
        <h2 className="text-base font-bold mb-2 text-white">{t('publicGroups.filterByLocation')}</h2>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Button
            onClick={getCurrentLocation}
            disabled={locationEnabled && !customSearchLocation}
            startIcon={
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/10 border border-blue-400 mr-2">
                <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
                </svg>
              </span>
            }
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded px-4 py-1.5 text-sm shadow transition border border-blue-500 focus:ring-2 focus:ring-blue-400 focus:outline-none gap-2"
          >
            {locationEnabled && !customSearchLocation ? t('publicGroups.usingCurrentLocation') : t('publicGroups.useMyLocation')}
          </Button>
          {(userLocation || customSearchLocation) && (
            <span className="text-xs text-blue-200 font-normal">
              Search from: {customSearchLocation
                ? `Custom point (${customSearchLocation.latitude.toFixed(4)}, ${customSearchLocation.longitude.toFixed(4)})`
                : `Your location (${userLocation?.latitude.toFixed(4)}, ${userLocation?.longitude.toFixed(4)})`}
            </span>
          )}
        </div>

        {/* Google Maps Integration (unchanged, keep as is) */}
        {GOOGLE_MAPS_API_KEY ? (
          <div className="mb-3">
            <div className="text-xs text-gray-400 mb-1">{t('publicGroups.clickMapToSetLocation')}</div>
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
          <div className="mb-3 p-2 bg-yellow-100 text-yellow-900 rounded border border-yellow-300">
            <strong>{t('publicGroups.apiKeyNotConfigured')}</strong> <span className="font-mono">REACT_APP_GOOGLE_MAPS_API_KEY</span> {t('publicGroups.apiKeyRequired')}<br />
            {t('publicGroups.locationFilteringWithoutMap')}
          </div>
        )}

        {/* Address Search */}
        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 px-2 py-2 border border-gray-700 rounded bg-[#181c24] text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder={t('groups.searchByAddress')}
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchAddress()}
            type="text"
          />
          <button
            className="p-2 rounded bg-blue-600 hover:bg-blue-700 text-white shadow"
            onClick={handleSearchAddress}
            aria-label="Search"
          >
            {/* Search SVG */}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        {(locationEnabled && (userLocation || customSearchLocation)) && (
          <div>
            <div className="text-sm mb-1">{t('publicGroups.distanceRadius', { count: distanceRadius })}</div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={distanceRadius}
              onChange={e => setDistanceRadius(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="text-xs text-gray-400 mt-1">
              {t('publicGroups.showingGroupsWithin', { count: distanceRadius, location: customSearchLocation ? t('publicGroups.customPoint') : t('publicGroups.yourLocation') })}
            </div>
          </div>
        )}
      </div>

      {filteredGroups.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M2 12h20M12 2c2.5 2.5 4 6.5 4 10s-1.5 7.5-4 10c-2.5-2.5-4-6.5-4-10s1.5-7.5 4-10z" stroke="currentColor" strokeWidth="2" /></svg>
          }
          title={locationEnabled ? t('publicGroups.noGroupsInRadius') : t('publicGroups.noGroupsAvailable')}
          description={locationEnabled ? t('publicGroups.tryIncreasingRadius') : t('publicGroups.checkBackOrCreate')}
          actionLabel={t('groups.createPublicGroup')}
          onAction={() => navigate('/groups/new')}
        />
      ) : (
        <>
          <div className="text-sm text-gray-400 mb-2">
            {t('publicGroups.showingGroups', { count: filteredGroups.length, total: groups.length })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filteredGroups.map((group) => (
              <div key={group.id} className="relative bg-[#1a202c] rounded-xl shadow-md border border-gray-700 p-5 flex flex-col h-full transition hover:shadow-lg">
                <div className="absolute top-4 right-4 flex gap-1 z-10">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-900/50 text-blue-300 border border-blue-700">{t('groups.public')}</span>
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <h2 className="text-lg font-bold flex-1 truncate text-gray-100 mb-1">{group.name}</h2>
                  <div className="text-sm text-gray-400 min-h-[48px] line-clamp-3">{group.description || t('publicGroups.noDescriptionAvailable')}</div>
                  {(group.city || group.country || group.locationName) && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 21c-4.418 0-8-3.582-8-8 0-4.418 3.582-8 8-8s8 3.582 8 8c0 4.418-3.582 8-8 8z" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /></svg>
                      {[group.city, group.country, group.locationName].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {group.distance !== null && group.distance !== undefined && (
                    <span className="inline-block bg-blue-50 text-blue-700 text-xs rounded px-2 py-0.5 mb-1">
                      {t('publicGroups.kmAway', { count: group.distance.toFixed(1) })}
                    </span>
                  )}
                  <div className="text-xs text-gray-400 mb-2">{t('groups.membersCount', { count: group.memberCount || group.members?.length || 0 })}</div>
                </div>
                <Button
                  onClick={() => handleRequestJoin(group.id)}
                  loading={requesting[group.id]}
                  startIcon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4c0 2.21 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" stroke="currentColor" strokeWidth="2" /></svg>
                  }
                  className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-4 py-2 text-base shadow transition"
                  disabled={requesting[group.id]}
                >
                  {requesting[group.id] ? t('publicGroups.requesting') : t('publicGroups.requestToJoin')}
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
