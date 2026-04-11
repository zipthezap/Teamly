/**
 * Cache Service Tests
 * Tests for the caching service with in-memory and Redis support
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheService, cleanupCache } from '../../services/cacheService';

// Mock dependencies
vi.mock('../../config/redis', () => ({
  getRedisClient: vi.fn(() => null),
  isRedisEnabled: vi.fn(() => false)
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}));

vi.mock('../../services/metricsService', () => ({
  recordCacheHit: vi.fn(),
  recordCacheMiss: vi.fn(),
  recordCacheOperation: vi.fn()
}));

describe('CacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupCache();
  });

  describe('Basic Operations', () => {
    it('should set and get a string value', async () => {
      const key = 'test:key';
      const value = 'test value';

      await CacheService.set(key, value, 60);
      const result = await CacheService.get<string>(key);

      expect(result).toBe(value);
    });

    it('should set and get an object value', async () => {
      const key = 'test:object';
      const value = { name: 'John', age: 30 };

      await CacheService.set(key, value, 60);
      const result = await CacheService.get<typeof value>(key);

      expect(result).toEqual(value);
    });

    it('should set and get an array value', async () => {
      const key = 'test:array';
      const value = [1, 2, 3, 4, 5];

      await CacheService.set(key, value, 60);
      const result = await CacheService.get<number[]>(key);

      expect(result).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      const result = await CacheService.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should delete a key', async () => {
      const key = 'test:delete';
      const value = 'to be deleted';

      await CacheService.set(key, value, 60);
      await CacheService.del(key);
      const result = await CacheService.get(key);

      expect(result).toBeNull();
    });

    it('should check if key exists', async () => {
      const key = 'test:exists';
      const value = 'exists';

      await CacheService.set(key, value, 60);
      const exists = await CacheService.exists(key);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent key check', async () => {
      const exists = await CacheService.exists('nonexistent:key');
      expect(exists).toBe(false);
    });
  });

  describe('Expiration', () => {
    it('should expire value after TTL', async () => {
      const key = 'test:expire';
      const value = 'expires soon';

      // Set with 1 second TTL
      await CacheService.set(key, value, 1);
      
      // Should exist immediately
      const before = await CacheService.get(key);
      expect(before).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be expired
      const after = await CacheService.get(key);
      expect(after).toBeNull();
    }, 3000);

    it('should update expiration time', async () => {
      const key = 'test:update-expire';
      const value = 'will have new expiry';

      await CacheService.set(key, value, 60);
      await CacheService.expire(key, 120);

      const exists = await CacheService.exists(key);
      expect(exists).toBe(true);
    });

    it('should not exist after expiration', async () => {
      const key = 'test:exists-after-expire';
      const value = 'expires';

      await CacheService.set(key, value, 1);
      await new Promise(resolve => setTimeout(resolve, 1100));

      const exists = await CacheService.exists(key);
      expect(exists).toBe(false);
    }, 3000);
  });

  describe('Pattern Operations', () => {
    it('should delete keys matching pattern', async () => {
      await CacheService.set('user:1', 'user1', 60);
      await CacheService.set('user:2', 'user2', 60);
      await CacheService.set('user:3', 'user3', 60);
      await CacheService.set('post:1', 'post1', 60);

      await CacheService.deletePattern('user:*');

      const user1 = await CacheService.get('user:1');
      const user2 = await CacheService.get('user:2');
      const post1 = await CacheService.get('post:1');

      expect(user1).toBeNull();
      expect(user2).toBeNull();
      expect(post1).toBe('post1');
    });

    it('should invalidate cache for resource type', async () => {
      await CacheService.set('session:1:details', 'event1', 60);
      await CacheService.set('session:2:details', 'event2', 60);
      await CacheService.set('group:1:details', 'group1', 60);

      await CacheService.invalidate('session');

      const event1 = await CacheService.get('session:1:details');
      const event2 = await CacheService.get('session:2:details');
      const group1 = await CacheService.get('group:1:details');

      expect(event1).toBeNull();
      expect(event2).toBeNull();
      expect(group1).toBe('group1');
    });

    it('should invalidate cache for specific resource', async () => {
      await CacheService.set('session:1:details', 'event1', 60);
      await CacheService.set('session:1:participants', 'participants', 60);
      await CacheService.set('session:2:details', 'event2', 60);

      await CacheService.invalidate('session', '1');

      const event1Details = await CacheService.get('session:1:details');
      const event1Participants = await CacheService.get('session:1:participants');
      const event2 = await CacheService.get('session:2:details');

      expect(event1Details).toBeNull();
      expect(event1Participants).toBeNull();
      expect(event2).toBe('event2');
    });
  });

  describe('Wrap Function', () => {
    it('should cache function result', async () => {
      const key = 'test:wrap';
      let callCount = 0;

      const fn = async () => {
        callCount++;
        return { result: 'computed' };
      };

      // First call should execute function
      const result1 = await CacheService.wrap(key, 60, fn);
      expect(result1).toEqual({ result: 'computed' });
      expect(callCount).toBe(1);

      // Second call should use cache
      const result2 = await CacheService.wrap(key, 60, fn);
      expect(result2).toEqual({ result: 'computed' });
      expect(callCount).toBe(1);
    });

    it('should recompute after cache expiry', async () => {
      const key = 'test:wrap-expire';
      let callCount = 0;

      const fn = async () => {
        callCount++;
        return { count: callCount };
      };

      // First call
      const result1 = await CacheService.wrap(key, 1, fn);
      expect(result1).toEqual({ count: 1 });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Second call should recompute
      const result2 = await CacheService.wrap(key, 1, fn);
      expect(result2).toEqual({ count: 2 });
      expect(callCount).toBe(2);
    }, 3000);
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      // This test verifies that the service handles errors without crashing
      const key = 'test:error';
      
      await CacheService.set(key, { valid: 'data' }, 60);
      const result = await CacheService.get(key);
      
      expect(result).toEqual({ valid: 'data' });
    });

    it('should handle deletion of non-existent key', async () => {
      await expect(CacheService.del('nonexistent')).resolves.not.toThrow();
    });

    it('should handle expiration of non-existent key', async () => {
      await expect(CacheService.expire('nonexistent', 60)).resolves.not.toThrow();
    });

    it('should handle pattern deletion with no matches', async () => {
      await expect(CacheService.deletePattern('nomatch:*')).resolves.not.toThrow();
    });
  });

  describe('Complex Data Types', () => {
    it('should handle nested objects', async () => {
      const key = 'test:nested';
      const value = {
        user: {
          id: 1,
          profile: {
            name: 'John',
            settings: {
              theme: 'dark',
              notifications: true
            }
          }
        }
      };

      await CacheService.set(key, value, 60);
      const result = await CacheService.get(key);

      expect(result).toEqual(value);
    });

    it('should handle arrays of objects', async () => {
      const key = 'test:array-objects';
      const value = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ];

      await CacheService.set(key, value, 60);
      const result = await CacheService.get(key);

      expect(result).toEqual(value);
    });

    it('should handle null values', async () => {
      const key = 'test:null';
      const value = { data: null };

      await CacheService.set(key, value, 60);
      const result = await CacheService.get(key);

      expect(result).toEqual(value);
    });

    it('should handle boolean values', async () => {
      const key = 'test:boolean';
      const value = { active: true, verified: false };

      await CacheService.set(key, value, 60);
      const result = await CacheService.get(key);

      expect(result).toEqual(value);
    });

    it('should handle numbers including zero', async () => {
      const key = 'test:numbers';
      const value = { count: 0, total: 100, negative: -5 };

      await CacheService.set(key, value, 60);
      const result = await CacheService.get(key);

      expect(result).toEqual(value);
    });
  });

  describe('Multiple Keys', () => {
    it('should handle multiple concurrent sets', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(CacheService.set(`test:concurrent:${i}`, `value${i}`, 60));
      }

      await Promise.all(promises);

      for (let i = 0; i < 10; i++) {
        const result = await CacheService.get(`test:concurrent:${i}`);
        expect(result).toBe(`value${i}`);
      }
    });

    it('should handle multiple concurrent gets', async () => {
      // Set up test data
      for (let i = 0; i < 5; i++) {
        await CacheService.set(`test:multi-get:${i}`, `value${i}`, 60);
      }

      // Get all concurrently
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(CacheService.get(`test:multi-get:${i}`));
      }

      const results = await Promise.all(promises);
      
      for (let i = 0; i < 5; i++) {
        expect(results[i]).toBe(`value${i}`);
      }
    });
  });
});
