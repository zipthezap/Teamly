import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateCacheKey, cachedQuery } from '../../services/queryCache';
import { CacheService } from '../../services/cacheService';

vi.mock('../../services/cacheService', () => ({
  CacheService: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    deletePattern: vi.fn(),
    wrap: vi.fn(),
  },
  // Also suppress the module-level logger.info call in queryCache
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const cacheMock = CacheService as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

describe('queryCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── generateCacheKey ──────────────────────────────────────────────────────
  describe('generateCacheKey', () => {
    it('produces a stable key regardless of param insertion order', () => {
      const key1 = generateCacheKey('user', { id: 'u-1', page: 1 });
      const key2 = generateCacheKey('user', { page: 1, id: 'u-1' });
      expect(key1).toBe(key2);
    });

    it('includes the prefix in the key', () => {
      const key = generateCacheKey('group', { id: 'g-1' });
      expect(key).toContain('group');
    });

    it('produces different keys for different params', () => {
      const key1 = generateCacheKey('user', { id: 'u-1' });
      const key2 = generateCacheKey('user', { id: 'u-2' });
      expect(key1).not.toBe(key2);
    });

    it('handles null/undefined params without throwing', () => {
      expect(() => generateCacheKey('test', { a: null, b: undefined })).not.toThrow();
    });
  });

  // ─── cachedQuery ───────────────────────────────────────────────────────────
  describe('cachedQuery', () => {
    it('returns cached value on cache hit without calling queryFn', async () => {
      const cachedData = { id: 'u-1', name: 'Alice' };
      cacheMock.get.mockResolvedValue(cachedData);

      const queryFn = vi.fn().mockResolvedValue({ id: 'u-1', name: 'From DB' });
      const result = await cachedQuery('user', { id: 'u-1' }, 300, queryFn);

      expect(result).toEqual(cachedData);
      expect(queryFn).not.toHaveBeenCalled();
    });

    it('calls queryFn and stores result on cache miss', async () => {
      const dbData = { id: 'u-2', name: 'Bob' };
      cacheMock.get.mockResolvedValue(null); // cache miss
      cacheMock.set.mockResolvedValue(undefined);

      const queryFn = vi.fn().mockResolvedValue(dbData);
      const result = await cachedQuery('user', { id: 'u-2' }, 300, queryFn);

      expect(result).toEqual(dbData);
      expect(queryFn).toHaveBeenCalledOnce();
      expect(cacheMock.set).toHaveBeenCalledOnce();
    });

    it('does not call CacheService.set when queryFn returns null', async () => {
      cacheMock.get.mockResolvedValue(null);
      const queryFn = vi.fn().mockResolvedValue(null);

      await cachedQuery('user', { id: 'u-3' }, 300, queryFn);

      expect(cacheMock.set).not.toHaveBeenCalled();
    });

    it('falls back to queryFn when CacheService.get throws', async () => {
      const dbData = { id: 'u-4', name: 'Carol' };
      cacheMock.get.mockRejectedValue(new Error('Redis unavailable'));

      const queryFn = vi.fn().mockResolvedValue(dbData);
      const result = await cachedQuery('user', { id: 'u-4' }, 300, queryFn);

      // Should still return the DB data despite cache error
      expect(result).toEqual(dbData);
      expect(queryFn).toHaveBeenCalledOnce();
    });

    it('uses consistent cache key (sorted params) for get and set', async () => {
      cacheMock.get.mockResolvedValue(null);
      cacheMock.set.mockResolvedValue(undefined);
      const queryFn = vi.fn().mockResolvedValue({ data: true });

      await cachedQuery('test', { z: 'last', a: 'first' }, 60, queryFn);

      const getKey = cacheMock.get.mock.calls[0][0] as string;
      const setKey = cacheMock.set.mock.calls[0][0] as string;
      expect(getKey).toBe(setKey);
      // Sorted keys should put 'a' before 'z'
      expect(getKey.indexOf('a:')).toBeLessThan(getKey.indexOf('z:'));
    });
  });
});
