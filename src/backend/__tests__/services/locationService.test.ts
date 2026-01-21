/**
 * Location Service Tests
 * Tests for location-based operations
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  isWithinRadius,
  filterByLocation,
  generateGoogleMapsUrl,
  validateCoordinates,
} from '../../services/locationService';

describe('Location Service', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points using Haversine formula', () => {
      // Distance between New York and Los Angeles
      const nyLat = 40.7128;
      const nyLon = -74.0060;
      const laLat = 34.0522;
      const laLon = -118.2437;

      const distance = calculateDistance(nyLat, nyLon, laLat, laLon);

      // Expected distance is approximately 3944 km
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });

    it('should return 0 for same coordinates', () => {
      const distance = calculateDistance(40.7128, -74.0060, 40.7128, -74.0060);

      expect(distance).toBe(0);
    });

    it('should calculate short distances accurately', () => {
      // Two points 0.11 km apart (approximately)
      const lat1 = 40.7128;
      const lon1 = -74.0060;
      const lat2 = 40.7138; // ~0.11 km north
      const lon2 = -74.0060;

      const distance = calculateDistance(lat1, lon1, lat2, lon2);

      expect(distance).toBeGreaterThan(0.05);
      expect(distance).toBeLessThan(0.20);
    });
  });

  describe('isWithinRadius', () => {
    it('should return true if point is within radius', () => {
      const centerLat = 40.7128;
      const centerLon = -74.0060;
      const pointLat = 40.7138; // ~1 km away
      const pointLon = -74.0060;
      const radiusKm = 5;

      const result = isWithinRadius(centerLat, centerLon, pointLat, pointLon, radiusKm);

      expect(result).toBe(true);
    });

    it('should return false if point is outside radius', () => {
      const centerLat = 40.7128;
      const centerLon = -74.0060;
      const pointLat = 34.0522; // Los Angeles, ~3944 km away
      const pointLon = -118.2437;
      const radiusKm = 100;

      const result = isWithinRadius(centerLat, centerLon, pointLat, pointLon, radiusKm);

      expect(result).toBe(false);
    });

    it('should return true for same coordinates', () => {
      const lat = 40.7128;
      const lon = -74.0060;
      const radiusKm = 1;

      const result = isWithinRadius(lat, lon, lat, lon, radiusKm);

      expect(result).toBe(true);
    });
  });

  describe('filterByLocation', () => {
    it('should filter items by location and add distance', () => {
      const items = [
        { id: '1', name: 'Item 1', latitude: 40.7138, longitude: -74.0060 },
        { id: '2', name: 'Item 2', latitude: 34.0522, longitude: -118.2437 },
        { id: '3', name: 'Item 3', latitude: 40.7148, longitude: -74.0070 },
      ];

      const centerLat = 40.7128;
      const centerLon = -74.0060;
      const radiusKm = 5;

      const result = filterByLocation(items, centerLat, centerLon, radiusKm);

      expect(result).toHaveLength(2); // Only items 1 and 3 within 5km
      expect(result[0]).toHaveProperty('distance');
      expect(result[0].distance).toBeLessThanOrEqual(radiusKm);
      expect(result[1].distance).toBeLessThanOrEqual(radiusKm);
    });

    it('should sort results by distance ascending', () => {
      const items = [
        { id: '1', name: 'Item 1', latitude: 40.7148, longitude: -74.0070 }, // ~1.5 km
        { id: '2', name: 'Item 2', latitude: 40.7138, longitude: -74.0060 }, // ~1.1 km
        { id: '3', name: 'Item 3', latitude: 40.7128, longitude: -74.0060 }, // 0 km
      ];

      const centerLat = 40.7128;
      const centerLon = -74.0060;
      const radiusKm = 10;

      const result = filterByLocation(items, centerLat, centerLon, radiusKm);

      expect(result[0].id).toBe('3'); // Closest
      expect(result[1].id).toBe('2');
      expect(result[2].id).toBe('1'); // Farthest
      expect(result[0].distance).toBeLessThan(result[1].distance);
      expect(result[1].distance).toBeLessThan(result[2].distance);
    });

    it('should exclude items with null coordinates', () => {
      const items = [
        { id: '1', name: 'Item 1', latitude: 40.7138, longitude: -74.0060 },
        { id: '2', name: 'Item 2', latitude: null, longitude: null },
        { id: '3', name: 'Item 3', latitude: 40.7148, longitude: null },
      ];

      const centerLat = 40.7128;
      const centerLon = -74.0060;
      const radiusKm = 10;

      const result = filterByLocation(items, centerLat, centerLon, radiusKm);

      expect(result).toHaveLength(1); // Only item 1 has valid coordinates
      expect(result[0].id).toBe('1');
    });

    it('should return empty array if no items within radius', () => {
      const items = [
        { id: '1', name: 'Item 1', latitude: 34.0522, longitude: -118.2437 }, // LA
        { id: '2', name: 'Item 2', latitude: 41.8781, longitude: -87.6298 }, // Chicago
      ];

      const centerLat = 40.7128; // New York
      const centerLon = -74.0060;
      const radiusKm = 100; // 100km radius

      const result = filterByLocation(items, centerLat, centerLon, radiusKm);

      expect(result).toHaveLength(0);
    });
  });

  describe('generateGoogleMapsUrl', () => {
    it('should generate Google Maps URL with coordinates', () => {
      const url = generateGoogleMapsUrl(40.7128, -74.0060);

      expect(url).toContain('https://www.google.com/maps/search/');
      expect(url).toContain('40.7128');
      expect(url).toContain('-74.006');
    });

    it('should include location name in URL', () => {
      const url = generateGoogleMapsUrl(40.7128, -74.0060, 'Central Park');

      expect(url).toContain('Central');
      expect(url).toContain('Park');
    });

    it('should properly encode location name', () => {
      const url = generateGoogleMapsUrl(40.7128, -74.0060, 'Times Square, NY');

      expect(url).toContain('Times');
      expect(url).toContain('Square');
    });
  });

  describe('validateCoordinates', () => {
    it('should return valid true for valid coordinates', () => {
      const result = validateCoordinates(40.7128, -74.0060);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid false for invalid latitude', () => {
      const result1 = validateCoordinates(91, -74.0060);
      const result2 = validateCoordinates(-91, -74.0060);

      expect(result1.valid).toBe(false);
      expect(result1.error).toBeDefined();
      expect(result2.valid).toBe(false);
      expect(result2.error).toBeDefined();
    });

    it('should return valid false for invalid longitude', () => {
      const result1 = validateCoordinates(40.7128, 181);
      const result2 = validateCoordinates(40.7128, -181);

      expect(result1.valid).toBe(false);
      expect(result1.error).toBeDefined();
      expect(result2.valid).toBe(false);
      expect(result2.error).toBeDefined();
    });

    it('should accept boundary values', () => {
      const result1 = validateCoordinates(90, 180);
      const result2 = validateCoordinates(-90, -180);

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });
  });
});
