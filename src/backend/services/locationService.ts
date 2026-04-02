/**
 * Location Service
 * 
 * Provides utilities for location-based operations including:
 * - Distance calculation using Haversine formula
 * - Location filtering by radius
 * - Google Maps URL generation
 */

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const toRad = (deg: number) => deg * Math.PI / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Check if a location is within a given radius from a center point
 * @param centerLat Center point latitude
 * @param centerLon Center point longitude
 * @param pointLat Point latitude to check
 * @param pointLon Point longitude to check
 * @param radiusKm Radius in kilometers
 * @returns true if point is within radius, false otherwise
 */
export function isWithinRadius(
  centerLat: number,
  centerLon: number,
  pointLat: number,
  pointLon: number,
  radiusKm: number
): boolean {
  const distance = calculateDistance(centerLat, centerLon, pointLat, pointLon);
  return distance <= radiusKm;
}

/**
 * Filter items by location and radius
 * @param items Array of items with latitude and longitude
 * @param centerLat Center point latitude
 * @param centerLon Center point longitude
 * @param radiusKm Radius in kilometers
 * @returns Filtered array with distance added to each item
 */
export function filterByLocation<T extends { latitude: number | null; longitude: number | null }>(
  items: T[],
  centerLat: number,
  centerLon: number,
  radiusKm: number
): Array<T & { distance: number }> {
  return items
    .filter(item => item.latitude !== null && item.longitude !== null)
    .map(item => {
      const distance = calculateDistance(
        centerLat,
        centerLon,
        item.latitude!,
        item.longitude!
      );
      return {
        ...item,
        distance
      };
    })
    .filter(item => item.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance); // Sort by distance ascending
}

/**
 * Calculate a geographic bounding box around a center point and radius.
 * Uses a minimum cosine clamp to avoid extreme longitude deltas near the poles.
 */
export function calculateBoundingBox(centerLat: number, radiusKm: number): {
  latDelta: number;
  lonDelta: number;
} {
  const KM_PER_DEGREE_LAT = 111;
  const MIN_LATITUDE_COSINE = 0.01;

  const latDelta = radiusKm / KM_PER_DEGREE_LAT;
  const latitudeCosine = Math.max(Math.cos((centerLat * Math.PI) / 180), MIN_LATITUDE_COSINE);
  const lonDelta = radiusKm / (KM_PER_DEGREE_LAT * latitudeCosine);

  return { latDelta, lonDelta };
}

/**
 * Generate a Google Maps URL for a location
 * @param latitude Latitude
 * @param longitude Longitude
 * @param locationName Optional location name for the label
 * @returns Google Maps URL
 */
export function generateGoogleMapsUrl(
  latitude: number,
  longitude: number,
  locationName?: string
): string {
  // Use the coordinates-based URL format which works reliably
  const coords = `${latitude},${longitude}`;
  
  if (locationName) {
    // Include location name as query parameter for better UX
    const encodedName = encodeURIComponent(locationName);
    return `https://www.google.com/maps/search/?api=1&query=${coords}&query_place_id=${encodedName}`;
  }
  
  return `https://www.google.com/maps/search/?api=1&query=${coords}`;
}

/**
 * Generate a Google Maps direction URL from user's location to destination
 * @param destLat Destination latitude
 * @param destLon Destination longitude
 * @param destName Optional destination name
 * @returns Google Maps direction URL
 */
export function generateGoogleMapsDirectionUrl(
  destLat: number,
  destLon: number,
  destName?: string
): string {
  const destination = `${destLat},${destLon}`;
  
  if (destName) {
    const encodedName = encodeURIComponent(destName);
    return `https://www.google.com/maps/dir/?api=1&destination=${destination}&destination_place_id=${encodedName}`;
  }
  
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

/**
 * Validate latitude and longitude values
 * @param lat Latitude
 * @param lon Longitude
 * @returns Object with valid flag and error message if invalid
 */
export function validateCoordinates(lat: number, lon: number): { valid: boolean; error?: string } {
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return { valid: false, error: 'Latitude and longitude must be numbers' };
  }
  
  if (isNaN(lat) || isNaN(lon)) {
    return { valid: false, error: 'Latitude and longitude cannot be NaN' };
  }
  
  if (lat < -90 || lat > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90' };
  }
  
  if (lon < -180 || lon > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180' };
  }
  
  return { valid: true };
}

/**
 * Add location information to an item including Google Maps URL
 * @param item Item with location data
 * @returns Item with added locationInfo
 */
export function enrichWithLocationInfo<T extends {
  latitude: number | null;
  longitude: number | null;
  locationName?: string | null;
  city?: string | null;
  country?: string | null;
}>(item: T): T & { locationInfo?: { googleMapsUrl: string; googleMapsDirectionUrl: string } } {
  if (item.latitude && item.longitude) {
    return {
      ...item,
      locationInfo: {
        googleMapsUrl: generateGoogleMapsUrl(
          item.latitude,
          item.longitude,
          item.locationName || undefined
        ),
        googleMapsDirectionUrl: generateGoogleMapsDirectionUrl(
          item.latitude,
          item.longitude,
          item.locationName || undefined
        )
      }
    };
  }
  
  return item;
}
