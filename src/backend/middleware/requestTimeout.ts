/**
 * Request Timeout Middleware
 * Prevents long-running requests from hanging indefinitely
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Middleware to set a timeout on incoming requests
 * @param timeoutMs - Timeout in milliseconds (default: 30000ms / 30 seconds)
 */
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Set a timeout for the request
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', 'RequestTimeout', {
          method: req.method,
          path: req.path,
          timeout: `${timeoutMs}ms`,
          ip: req.ip,
        });

        res.status(408).json({
          error: 'Request timeout',
          message: 'The server took too long to process your request. Please try again.',
        });
      }
    }, timeoutMs);

    // Clear timeout when response is finished
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    // Clear timeout when response is closed
    res.on('close', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

/**
 * Different timeout durations for different types of endpoints
 */
export const TimeoutDurations = {
  SHORT: 10000,     // 10 seconds - for fast operations
  MEDIUM: 30000,    // 30 seconds - default for most operations
  LONG: 60000,      // 60 seconds - for complex queries
  UPLOAD: 120000,   // 2 minutes - for file uploads
} as const;
