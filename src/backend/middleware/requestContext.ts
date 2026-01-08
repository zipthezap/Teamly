/**
 * Request Context Middleware
 * Adds request ID and timing information for better debugging and monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import crypto from 'crypto';

// Extend Express Request type to include request context
declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}

/**
 * Generates a unique request ID
 */
const generateRequestId = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Adds request ID and start time to each request
 */
export const requestContext = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  req.id = req.headers['x-request-id'] as string || generateRequestId();
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.id);

  // Log incoming request
  logger.info(`${req.method} ${req.path}`, 'RequestContext', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || 0);
    logger.info(`${req.method} ${req.path} completed`, 'RequestContext', {
      requestId: req.id,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
};

/**
 * Tracks API response times and logs slow requests
 */
export const performanceMonitor = (slowThresholdMs: number = 1000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      const duration = Date.now() - (req.startTime || 0);
      
      if (duration > slowThresholdMs) {
        logger.warn(`Slow request detected`, 'PerformanceMonitor', {
          requestId: req.id,
          method: req.method,
          path: req.path,
          duration: `${duration}ms`,
          threshold: `${slowThresholdMs}ms`
        });
      }
    });

    next();
  };
};
