/**
 * Query Cache Service
 * 
 * Provides caching for database query results to reduce database load.
 * Uses the existing CacheService with sensible defaults for different types of data.
 */

import { CacheService } from './cacheService';
import { logger } from '../utils/logger';

/**
 * Cache TTL (Time To Live) configurations in seconds
 */
export const CACHE_TTL = {
  // User data - rarely changes
  USER_PROFILE: 300, // 5 minutes
  USER_PREFERENCES: 600, // 10 minutes
  
  // Group data - changes moderately
  GROUP_DETAILS: 180, // 3 minutes
  GROUP_MEMBERS: 120, // 2 minutes
  
  // Event data - changes frequently
  EVENT_DETAILS: 60, // 1 minute
  EVENT_PARTICIPANTS: 60, // 1 minute
  EVENT_LIST: 30, // 30 seconds
  
  // Tournament data
  TOURNAMENT_DETAILS: 120, // 2 minutes
  TOURNAMENT_STANDINGS: 60, // 1 minute
  
  // Frequently accessed lists
  USER_GROUPS: 120, // 2 minutes
  USER_EVENTS: 60, // 1 minute
  
  // Static/rarely changing data
  SPORT_TYPES: 3600, // 1 hour
  SYSTEM_CONFIG: 1800, // 30 minutes
  
  // Short-lived caches for API responses
  SEARCH_RESULTS: 30, // 30 seconds
  NEARBY_EVENTS: 60, // 1 minute
};

/**
 * Generate cache key for a query
 */
export function generateCacheKey(prefix: string, params: Record<string, string | number | boolean | null | undefined>): string {
  // Sort keys for consistent cache keys
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${JSON.stringify(params[key])}`)
    .join('|');
  
  return `query:${prefix}:${sortedParams}`;
}

/**
 * Cached query wrapper
 * 
 * @example
 * const user = await cachedQuery(
 *   'user',
 *   { id: userId },
 *   CACHE_TTL.USER_PROFILE,
 *   async () => prisma.user.findUnique({ where: { id: userId } })
 * );
 */
export async function cachedQuery<T>(
  prefix: string,
  params: Record<string, string | number | boolean | null | undefined>,
  ttl: number,
  queryFn: () => Promise<T>
): Promise<T> {
  const cacheKey = generateCacheKey(prefix, params);
  
  try {
    // Try to get from cache
    const cached = await CacheService.get<T>(cacheKey);
    if (cached !== null) {
      logger.debug('Cache hit', 'QueryCache', { key: cacheKey });
      return cached;
    }
    
    logger.debug('Cache miss', 'QueryCache', { key: cacheKey });
    
    // Execute query
    const result = await queryFn();
    
    // Cache the result
    if (result !== null && result !== undefined) {
      await CacheService.set(cacheKey, result, ttl);
    }
    
    return result;
  } catch (error) {
    // On cache error, fall back to direct query
    logger.error('Cache query error, falling back to direct query', 'QueryCache', { 
      key: cacheKey, 
      error 
    });
    return await queryFn();
  }
}

/**
 * Invalidate cache for a specific resource type
 * 
 * @example
 * await invalidateQueryCache('user', { id: userId });
 */
export async function invalidateQueryCache(prefix: string, params?: Record<string, string | number | boolean | null | undefined>): Promise<void> {
  try {
    if (params) {
      const cacheKey = generateCacheKey(prefix, params);
      await CacheService.del(cacheKey);
      logger.debug('Cache invalidated', 'QueryCache', { key: cacheKey });
    } else {
      // Invalidate all keys with this prefix
      await CacheService.deletePattern(`query:${prefix}:*`);
      logger.debug('Cache pattern invalidated', 'QueryCache', { pattern: `query:${prefix}:*` });
    }
  } catch (error) {
    logger.error('Failed to invalidate cache', 'QueryCache', { prefix, params, error });
  }
}

/**
 * Batch cache invalidation for multiple resources
 * 
 * @example
 * await invalidateMultiple([
 *   { prefix: 'user', params: { id: userId } },
 *   { prefix: 'group', params: { id: groupId } }
 * ]);
 */
export async function invalidateMultiple(
  items: Array<{ prefix: string; params?: Record<string, string | number | boolean | null | undefined> }>
): Promise<void> {
  await Promise.all(
    items.map(item => invalidateQueryCache(item.prefix, item.params))
  );
}

/**
 * User-related query cache helpers
 */
export const UserQueryCache = {
  /**
   * Cache user profile
   */
  async getProfile<T = unknown>(userId: string, queryFn: () => Promise<T>) {
    return cachedQuery('user:profile', { userId }, CACHE_TTL.USER_PROFILE, queryFn);
  },
  
  /**
   * Cache user groups
   */
  async getGroups<T = unknown>(userId: string, queryFn: () => Promise<T>) {
    return cachedQuery('user:groups', { userId }, CACHE_TTL.USER_GROUPS, queryFn);
  },
  
  /**
   * Cache user events
   */
  async getEvents<T = unknown>(userId: string, filters: Record<string, string | number | boolean | null | undefined>, queryFn: () => Promise<T>) {
    return cachedQuery('user:events', { userId, ...filters }, CACHE_TTL.USER_EVENTS, queryFn);
  },
  
  /**
   * Invalidate all user caches
   */
  async invalidate(userId: string) {
    await invalidateMultiple([
      { prefix: 'user:profile', params: { userId } },
      { prefix: 'user:groups', params: { userId } },
      { prefix: 'user:events' }, // Invalidate all user event queries
    ]);
  },
};

/**
 * Group-related query cache helpers
 */
export const GroupQueryCache = {
  /**
   * Cache group details
   */
  async getDetails<T = unknown>(groupId: string, queryFn: () => Promise<T>) {
    return cachedQuery('group:details', { groupId }, CACHE_TTL.GROUP_DETAILS, queryFn);
  },
  
  /**
   * Cache group members
   */
  async getMembers<T = unknown>(groupId: string, queryFn: () => Promise<T>) {
    return cachedQuery('group:members', { groupId }, CACHE_TTL.GROUP_MEMBERS, queryFn);
  },
  
  /**
   * Invalidate all group caches
   */
  async invalidate(groupId: string) {
    await invalidateMultiple([
      { prefix: 'group:details', params: { groupId } },
      { prefix: 'group:members', params: { groupId } },
    ]);
  },
};

/**
 * Event-related query cache helpers
 */
export const EventQueryCache = {
  /**
   * Cache event details
   */
  async getDetails<T = unknown>(eventId: string, queryFn: () => Promise<T>) {
    return cachedQuery('event:details', { eventId }, CACHE_TTL.EVENT_DETAILS, queryFn);
  },
  
  /**
   * Cache event participants
   */
  async getParticipants<T = unknown>(eventId: string, queryFn: () => Promise<T>) {
    return cachedQuery('event:participants', { eventId }, CACHE_TTL.EVENT_PARTICIPANTS, queryFn);
  },
  
  /**
   * Cache event list for a group
   */
  async getList<T = unknown>(groupId: string, filters: Record<string, string | number | boolean | null | undefined>, queryFn: () => Promise<T>) {
    return cachedQuery('event:list', { groupId, ...filters }, CACHE_TTL.EVENT_LIST, queryFn);
  },
  
  /**
   * Invalidate all event caches
   */
  async invalidate(eventId: string) {
    await invalidateMultiple([
      { prefix: 'event:details', params: { eventId } },
      { prefix: 'event:participants', params: { eventId } },
      { prefix: 'event:list' }, // Invalidate all event lists
    ]);
  },
};

/**
 * Tournament-related query cache helpers
 */
export const TournamentQueryCache = {
  /**
   * Cache tournament details
   */
  async getDetails<T = unknown>(tournamentId: string, queryFn: () => Promise<T>) {
    return cachedQuery('tournament:details', { tournamentId }, CACHE_TTL.TOURNAMENT_DETAILS, queryFn);
  },
  
  /**
   * Cache tournament standings
   */
  async getStandings<T = unknown>(tournamentId: string, queryFn: () => Promise<T>) {
    return cachedQuery('tournament:standings', { tournamentId }, CACHE_TTL.TOURNAMENT_STANDINGS, queryFn);
  },
  
  /**
   * Invalidate all tournament caches
   */
  async invalidate(tournamentId: string) {
    await invalidateMultiple([
      { prefix: 'tournament:details', params: { tournamentId } },
      { prefix: 'tournament:standings', params: { tournamentId } },
    ]);
  },
};

logger.info('Query cache service initialized', 'QueryCache');
