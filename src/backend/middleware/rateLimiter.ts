import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Custom key generator that considers both IP and user ID for authenticated requests
 * This prevents abuse through multiple IPs by the same user
 */
const authAwareKeyGenerator = (req: Request): string => {
  // For authenticated requests, use user ID (ensure it's a valid non-empty value)
  const userId = req.user?.id;
  if (userId && typeof userId === 'string' && userId.length > 0) {
    return `user:${userId}`;
  }
  // For unauthenticated requests, use IPv6-safe IP key
  return `ip:${ipKeyGenerator(req.ip)}`;
};

/**
 * Custom rate limit handler with logging
 */
const rateLimitHandler = (req: Request, res: Response): void => {
  const userId = req.user?.id;
  const identifier = userId ? `User ${userId}` : `IP ${req.ip}`;
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
  keyGenerator: (req) => `auth:${ipKeyGenerator(req.ip)}`,
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

// Stricter limiter for TeamUp comments to prevent spam bursts
export const teamUpCommentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many TeamUp comments, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: authAwareKeyGenerator,
});

// TeamUp post limiter to prevent request creation spam
export const teamUpCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many TeamUp requests created, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: authAwareKeyGenerator,
});

// TeamUp response limiter to prevent application spam bursts
export const teamUpRespondLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { error: 'Too many TeamUp responses submitted, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: authAwareKeyGenerator,
});

// TeamUp report limiter to reduce report endpoint abuse
export const teamUpReportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many TeamUp reports submitted, please try again later.' },
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
  keyGenerator: (req) => `pwd-reset:${ipKeyGenerator(req.ip)}`,
});

// Limiter for email verification to prevent spam
export const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Only 5 verification requests per hour
  message: { error: 'Too many verification requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => `email-verify:${ipKeyGenerator(req.ip)}`,
});
