import { getRedisClient, isRedisEnabled } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * In-memory cache for when Redis is not available
 */
class InMemoryCache {
  private cache = new Map<string, { value: any; expiry: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const expiry = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiry });

    // Prevent memory leaks by limiting cache size
    if (this.cache.size > 10000) {
      logger.warn('In-memory cache size exceeded 10000 entries, cleaning up', 'Cache');
      this.cleanup();
    }
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expiry) {
      return 0;
    }
    return 1;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      entry.expiry = Date.now() + ttlSeconds * 1000;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    // Simple pattern matching for in-memory cache
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.cache.keys()).filter((key) => regex.test(key));
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    // Convert iterator to array to avoid iteration issues
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiry) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      logger.debug(`Cleaned up ${keysToDelete.length} expired cache entries`, 'Cache');
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Singleton instance
let inMemoryCache: InMemoryCache | null = null;

/**
 * Get cache instance (Redis or in-memory fallback)
 */
const getCacheInstance = () => {
  if (isRedisEnabled()) {
    return getRedisClient();
  }

  if (!inMemoryCache) {
    inMemoryCache = new InMemoryCache();
    logger.info('Using in-memory cache (Redis not available)', 'Cache');
  }

  return inMemoryCache;
};

/**
 * Cache service for storing and retrieving data
 */
export class CacheService {
  /**
   * Get a value from cache
   */
  static async get<T = any>(key: string): Promise<T | null> {
    try {
      const cache = getCacheInstance();
      if (!cache) {
        return null;
      }

      const value = await cache.get(key);
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error', 'Cache', { key, error });
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   */
  static async set(key: string, value: any, ttlSeconds: number = 60): Promise<void> {
    try {
      const cache = getCacheInstance();
      if (!cache) {
        return;
      }

      const serialized = JSON.stringify(value);
      
      if (isRedisEnabled() && cache) {
        // Redis client
        await (cache as any).setEx(key, ttlSeconds, serialized);
      } else {
        // In-memory cache
        await cache.set(key, serialized, ttlSeconds);
      }
    } catch (error) {
      logger.error('Cache set error', 'Cache', { key, error });
    }
  }

  /**
   * Delete a value from cache
   */
  static async del(key: string): Promise<void> {
    try {
      const cache = getCacheInstance();
      if (!cache) {
        return;
      }

      await cache.del(key);
    } catch (error) {
      logger.error('Cache delete error', 'Cache', { key, error });
    }
  }

  /**
   * Check if key exists in cache
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const cache = getCacheInstance();
      if (!cache) {
        return false;
      }

      const result = await cache.exists(key);
      return result > 0;
    } catch (error) {
      logger.error('Cache exists error', 'Cache', { key, error });
      return false;
    }
  }

  /**
   * Set expiration time for a key
   */
  static async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      const cache = getCacheInstance();
      if (!cache) {
        return;
      }

      await cache.expire(key, ttlSeconds);
    } catch (error) {
      logger.error('Cache expire error', 'Cache', { key, error });
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  static async deletePattern(pattern: string): Promise<void> {
    try {
      const cache = getCacheInstance();
      if (!cache) {
        return;
      }

      const keys = await cache.keys(pattern);
      if (keys.length > 0) {
        for (const key of keys) {
          await cache.del(key);
        }
      }
    } catch (error) {
      logger.error('Cache delete pattern error', 'Cache', { pattern, error });
    }
  }

  /**
   * Cache wrapper function for easy caching of function results
   */
  static async wrap<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, ttlSeconds);
    return result;
  }

  /**
   * Invalidate cache for a specific resource
   */
  static async invalidate(resourceType: string, resourceId?: string): Promise<void> {
    try {
      const pattern = resourceId 
        ? `${resourceType}:${resourceId}*` 
        : `${resourceType}:*`;
      
      await this.deletePattern(pattern);
      logger.debug('Cache invalidated', 'Cache', { pattern });
    } catch (error) {
      logger.error('Cache invalidation error', 'Cache', { resourceType, resourceId, error });
    }
  }
}

/**
 * Cleanup in-memory cache on shutdown
 */
export const cleanupCache = (): void => {
  if (inMemoryCache) {
    inMemoryCache.destroy();
    inMemoryCache = null;
  }
};
