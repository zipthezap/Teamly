import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { getRedisClient, isRedisEnabled } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Rate limiter configuration
 */
interface RateLimiterConfig {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
}

/**
 * Create a rate limiter instance (Redis or in-memory)
 */
const createRateLimiter = (config: RateLimiterConfig) => {
  const points = config.max;
  const duration = Math.floor(config.windowMs / 1000); // Convert to seconds

  if (isRedisEnabled()) {
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        // Redis client is compatible with rate-limiter-flexible's expected interface
        // Using type assertion here is safe as we control the Redis client type
        return new RateLimiterRedis({
          storeClient: redisClient,
          keyPrefix: config.keyPrefix || 'rl',
          points,
          duration,
        } as any);
      } catch (error) {
        logger.error('Failed to create Redis rate limiter, falling back to memory', 'RateLimiter', { error });
      }
    }
  }

  // Fallback to in-memory rate limiter
  return new RateLimiterMemory({
    keyPrefix: config.keyPrefix || 'rl',
    points,
    duration,
  });
};

/**
 * Rate limiter middleware factory
 */
export const createRateLimiterMiddleware = (config: RateLimiterConfig) => {
  const rateLimiter = createRateLimiter(config);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Generate key based on user or IP
      const userId = (req.user as any)?.id;
      const key = userId ? `user:${userId}` : `ip:${req.ip}`;

      await rateLimiter.consume(key);
      next();
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        // Rate limit exceeded
        const retryAfter = Math.ceil(error.msBeforeNext / 1000);
        
        const userId = (req.user as any)?.id;
        const identifier = userId ? `User ${userId}` : `IP ${req.ip}`;
        logger.warn('Rate limit exceeded', 'RateLimiter', {
          identifier,
          path: req.path,
          method: req.method,
          retryAfter,
        });

        res.set('Retry-After', String(retryAfter));
        res.status(429).json({
          error: 'Too many requests, please try again later.',
          retryAfter,
        });
      } else {
        // Other errors - log but don't block request
        logger.error('Rate limiter error', 'RateLimiter', { error });
        next();
      }
    }
  };
};

/**
 * Distributed rate limiters with the same configuration as existing ones
 */

// General API rate limiter
export const distributedApiLimiter = createRateLimiterMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  keyPrefix: 'rl:api',
});

// Stricter limiter for authentication routes
export const distributedAuthLimiter = createRateLimiterMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  keyPrefix: 'rl:auth',
});

// Moderate limiter for authenticated routes
export const distributedAuthenticatedLimiter = createRateLimiterMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  keyPrefix: 'rl:authenticated',
});

// Stricter limiter for file uploads
export const distributedUploadLimiter = createRateLimiterMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  keyPrefix: 'rl:upload',
});

// Limiter for password reset
export const distributedPasswordResetLimiter = createRateLimiterMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  keyPrefix: 'rl:pwd-reset',
});

// Limiter for email verification
export const distributedEmailVerificationLimiter = createRateLimiterMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyPrefix: 'rl:email-verify',
});

/**
 * Role-based rate limiting (future enhancement)
 * Different limits based on user role
 */
export const createRoleBasedRateLimiter = (limits: {
  [role: string]: { windowMs: number; max: number };
}) => {
  const rateLimiters = new Map<string, ReturnType<typeof createRateLimiter>>();

  // Create rate limiters for each role
  for (const [role, config] of Object.entries(limits)) {
    rateLimiters.set(
      role,
      createRateLimiter({
        ...config,
        keyPrefix: `rl:role:${role}`,
      })
    );
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req.user as any)?.id;
      const userRole = (req.user as any)?.role || 'member';

      // Get appropriate rate limiter for user's role
      const rateLimiter = rateLimiters.get(userRole) || rateLimiters.get('member');
      if (!rateLimiter) {
        return next();
      }

      const key = userId ? `user:${userId}` : `ip:${req.ip}`;
      await rateLimiter.consume(key);
      next();
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        const retryAfter = Math.ceil(error.msBeforeNext / 1000);
        res.set('Retry-After', String(retryAfter));
        res.status(429).json({
          error: 'Too many requests, please try again later.',
          retryAfter,
        });
      } else {
        logger.error('Role-based rate limiter error', 'RateLimiter', { error });
        next();
      }
    }
  };
};
