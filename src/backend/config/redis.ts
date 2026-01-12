import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

/**
 * Redis client instance
 * Used for caching, session storage, and distributed rate limiting
 */
let redisClient: RedisClientType | null = null;

// Configuration constants
const REDIS_MAX_RETRIES = parseInt(process.env.REDIS_MAX_RETRIES || '10', 10);
const REDIS_RETRY_MAX_DELAY_MS = parseInt(process.env.REDIS_RETRY_MAX_DELAY_MS || '3000', 10);

/**
 * Check if Redis is enabled based on environment configuration
 */
export const isRedisEnabled = (): boolean => {
  return !!process.env.REDIS_URL;
};

/**
 * Initialize Redis client
 */
export const initializeRedis = async (): Promise<void> => {
  if (!isRedisEnabled()) {
    logger.info('Redis is not configured (REDIS_URL not set), using in-memory caching', 'Redis');
    return;
  }

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || '5000', 10),
        reconnectStrategy: (retries) => {
          // Exponential backoff: retry after 50ms, 100ms, 200ms, etc., up to max delay
          if (retries > REDIS_MAX_RETRIES) {
            logger.error(`Redis connection failed after ${REDIS_MAX_RETRIES} retries`, 'Redis');
            return new Error('Redis connection failed');
          }
          const delay = Math.min(50 * Math.pow(2, retries), REDIS_RETRY_MAX_DELAY_MS);
          logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`, 'Redis');
          return delay;
        },
      },
    });

    // Error handler
    redisClient.on('error', (err) => {
      logger.error('Redis client error', 'Redis', { error: err });
    });

    // Connection handler
    redisClient.on('connect', () => {
      logger.info('Redis client connecting...', 'Redis');
    });

    // Ready handler
    redisClient.on('ready', () => {
      logger.info('Redis client ready', 'Redis');
    });

    // Reconnecting handler
    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting...', 'Redis');
    });

    await redisClient.connect();
    logger.info('Redis client connected successfully', 'Redis');
  } catch (error) {
    logger.error('Failed to initialize Redis client', 'Redis', { error });
    // Don't throw - allow app to continue with in-memory caching
    redisClient = null;
  }
};

/**
 * Get Redis client instance
 */
export const getRedisClient = (): RedisClientType | null => {
  return redisClient;
};

/**
 * Close Redis connection
 */
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed', 'Redis');
    } catch (error) {
      logger.error('Error closing Redis connection', 'Redis', { error });
    }
  }
};

/**
 * Check Redis connection health
 */
export const checkRedisHealth = async (): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number; error?: string }> => {
  if (!isRedisEnabled() || !redisClient) {
    return { status: 'healthy' }; // Redis is optional, so not having it is fine
  }

  try {
    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;
    return { status: 'healthy', latency };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

export default redisClient;
