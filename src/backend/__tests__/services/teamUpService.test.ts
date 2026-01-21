/**
 * TeamUp Service Tests
 * Tests for TeamUp request data sanitization
 */

import { describe, it, expect, vi } from 'vitest';
import { sanitizeTeamUpData } from '../../services/teamUpService';

// Mock validation utility
vi.mock('../../utils/validation', () => ({
  sanitizeString: vi.fn((str: string) => str.trim()),
}));

describe('TeamUp Service', () => {
  describe('sanitizeTeamUpData', () => {
    it('should sanitize all string fields', () => {
      const result = sanitizeTeamUpData({
        title: '  Looking for players  ',
        description: '  Need 2 more players  ',
        sportType: '  soccer  ',
        location: '  Central Park  ',
        locationName: '  Field 3  ',
        city: '  New York  ',
        country: '  USA  ',
        skillLevel: '  intermediate  ',
        message: '  Let me know if interested  ',
      });

      expect(result.title).toBe('Looking for players');
      expect(result.description).toBe('Need 2 more players');
      expect(result.sportType).toBe('soccer');
      expect(result.location).toBe('Central Park');
      expect(result.locationName).toBe('Field 3');
      expect(result.city).toBe('New York');
      expect(result.country).toBe('USA');
      expect(result.skillLevel).toBe('intermediate');
      expect(result.message).toBe('Let me know if interested');
    });

    it('should handle undefined fields', () => {
      const result = sanitizeTeamUpData({});

      expect(result.title).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.sportType).toBeUndefined();
      expect(result.location).toBeUndefined();
      expect(result.locationName).toBeUndefined();
      expect(result.city).toBeUndefined();
      expect(result.country).toBeUndefined();
      expect(result.skillLevel).toBeUndefined();
      expect(result.message).toBeUndefined();
    });

    it('should handle partial data', () => {
      const result = sanitizeTeamUpData({
        title: '  Looking for players  ',
        sportType: '  soccer  ',
        city: '  New York  ',
      });

      expect(result.title).toBe('Looking for players');
      expect(result.sportType).toBe('soccer');
      expect(result.city).toBe('New York');
      expect(result.description).toBeUndefined();
      expect(result.location).toBeUndefined();
    });

    it('should handle empty strings', () => {
      const result = sanitizeTeamUpData({
        title: '',
        description: '',
      });

      expect(result.title).toBeUndefined();
      expect(result.description).toBeUndefined();
    });
  });
});
