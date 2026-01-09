import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Custom key generator that considers both IP and user ID for authenticated requests
 * This prevents abuse through multiple IPs by the same user
 */
const authAwareKeyGenerator = (req: Request): string => {
  // For authenticated requests, use user ID (ensure it's a valid non-empty value)
  if (req.user?.id && typeof req.user.id === 'string' && req.user.id.length > 0) {
    return `user:${req.user.id}`;
  }
  // For unauthenticated requests, use IP
  return `ip:${req.ip}`;
};

/**
 * Custom rate limit handler with logging
 */
const rateLimitHandler = (req: Request, res: Response): void => {
  const identifier = req.user?.id ? `User ${req.user.id}` : `IP ${req.ip}`;
  logger.warn('Rate limit exceeded', 'RateLimiter', {
    identifier,
    path: req.path,
    method: req.method,
  });
  
  res.status(429).json({ 
    error: 'Too many requests, please try again later.',
    retryAfter: res.getHeader('Retry-After'),
  });
};

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Skip rate limiting for health check endpoint
  skip: (req) => req.path === '/health',
});

// Stricter limiter for authentication routes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Increased from 5 to 10 for better UX while still preventing brute force
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Use IP-based limiting for auth endpoints (users aren't authenticated yet)
  keyGenerator: (req) => `auth:${req.ip}`,
});

// Moderate limiter for authenticated routes
export const authenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Higher limit for authenticated users
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: authAwareKeyGenerator,
});

// Stricter limiter for file uploads to prevent abuse
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Increased from 10 to 20 for better UX
  message: { error: 'Too many upload attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: authAwareKeyGenerator,
});

// Limiter for password reset to prevent abuse
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 password reset requests per hour
  message: { error: 'Too many password reset attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => `pwd-reset:${req.ip}`,
});

// Limiter for email verification to prevent spam
export const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Only 5 verification requests per hour
  message: { error: 'Too many verification requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => `email-verify:${req.ip}`,
});
