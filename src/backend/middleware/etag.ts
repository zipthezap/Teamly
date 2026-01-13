/**
 * ETag Middleware for Conditional Requests
 * 
 * Implements HTTP caching with ETags (Entity Tags) to reduce bandwidth
 * and improve performance by allowing clients to cache responses.
 * 
 * Benefits:
 * - Reduces bandwidth usage
 * - Improves response times for unchanged resources
 * - Standards-compliant HTTP caching
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Generate an ETag from response body
 */
export function generateETag(body: string | Buffer): string {
  return crypto
    .createHash('md5')
    .update(body)
    .digest('hex');
}

/**
 * Weak ETag generator (faster but less precise)
 * Use for responses that may have insignificant differences
 */
export function generateWeakETag(body: string | Buffer): string {
  return `W/"${crypto.createHash('md5').update(body).digest('hex')}"`;
}

/**
 * Strong ETag generator (slower but precise)
 * Use for responses where exact content matters
 */
export function generateStrongETag(body: string | Buffer): string {
  return `"${crypto.createHash('sha256').update(body).digest('hex')}"`;
}

/**
 * Compare client's ETag with current ETag
 */
function matchesETag(clientETag: string | undefined, currentETag: string): boolean {
  if (!clientETag) {
    return false;
  }

  // Handle multiple ETags (comma-separated)
  const clientETags = clientETag.split(',').map(tag => tag.trim());
  
  // Check for wildcard
  if (clientETags.includes('*')) {
    return true;
  }

  // Check for exact match (handle both weak and strong ETags)
  return clientETags.some(tag => {
    // Remove W/ prefix for weak comparison
    const normalizedClient = tag.replace(/^W\//, '');
    const normalizedCurrent = currentETag.replace(/^W\//, '');
    return normalizedClient === normalizedCurrent;
  });
}

/**
 * ETag middleware options
 */
export interface ETagOptions {
  weak?: boolean; // Use weak ETags (default: true)
  algorithm?: 'md5' | 'sha256'; // Hash algorithm (default: md5)
}

/**
 * ETag middleware for response caching
 * 
 * @example
 * app.get('/api/resource', etagMiddleware(), async (req, res) => {
 *   const data = await fetchData();
 *   res.json(data);
 * });
 */
export function etagMiddleware(options: ETagOptions = {}) {
  const useWeak = options.weak !== false; // Default to weak ETags
  const algorithm = options.algorithm || 'md5';

  return (req: Request, res: Response, next: NextFunction): void => {
    // Only apply to GET and HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    // Store original res.json method
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Override res.json to add ETag
    res.json = function (body: any): Response {
      // Serialize body to string
      const bodyString = JSON.stringify(body);

      // Generate ETag based on configuration
      let etag: string;
      if (useWeak) {
        etag = generateWeakETag(bodyString);
      } else if (algorithm === 'sha256') {
        etag = generateStrongETag(bodyString);
      } else {
        etag = `"${generateETag(bodyString)}"`;
      }

      // Set ETag header
      res.setHeader('ETag', etag);

      // Check if client's ETag matches
      const clientETag = req.headers['if-none-match'];
      if (matchesETag(clientETag, etag)) {
        // Resource hasn't changed - return 304 Not Modified
        res.status(304).end();
        return res;
      }

      // Resource has changed - return full response
      return originalJson(body);
    };

    // Override res.send to add ETag for non-JSON responses
    res.send = function (body?: any): Response {
      // Only handle string and buffer responses
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        // Generate ETag
        let etag: string;
        if (useWeak) {
          etag = generateWeakETag(body);
        } else if (algorithm === 'sha256') {
          etag = generateStrongETag(body);
        } else {
          etag = `"${generateETag(body)}"`;
        }

        // Set ETag header
        res.setHeader('ETag', etag);

        // Check if client's ETag matches
        const clientETag = req.headers['if-none-match'];
        if (matchesETag(clientETag, etag)) {
          // Resource hasn't changed - return 304 Not Modified
          res.status(304).end();
          return res;
        }
      }

      // Return full response
      return originalSend(body);
    };

    next();
  };
}

/**
 * Last-Modified header middleware
 * 
 * Works alongside ETag for better cache control.
 * Use this for resources that have a known modification timestamp.
 * 
 * @example
 * app.get('/api/resource', lastModifiedMiddleware(), async (req, res) => {
 *   const data = await fetchData();
 *   res.lastModified = data.updatedAt;
 *   res.json(data);
 * });
 */
export function lastModifiedMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only apply to GET and HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    // Add helper method to set Last-Modified
    (res as any).setLastModified = function (date: Date | string | number): void {
      const lastModified = new Date(date);
      res.setHeader('Last-Modified', lastModified.toUTCString());

      // Check If-Modified-Since header
      const ifModifiedSince = req.headers['if-modified-since'];
      if (ifModifiedSince) {
        const clientDate = new Date(ifModifiedSince);
        if (lastModified <= clientDate) {
          // Resource hasn't been modified - return 304
          res.status(304).end();
        }
      }
    };

    next();
  };
}

/**
 * Cache-Control header helper
 * 
 * @example
 * app.get('/api/resource', (req, res) => {
 *   setCacheControl(res, 'public', 3600); // Cache for 1 hour
 *   res.json(data);
 * });
 */
export function setCacheControl(
  res: Response,
  type: 'public' | 'private' | 'no-cache' | 'no-store',
  maxAge?: number
): void {
  let cacheControl = type;
  
  if (maxAge !== undefined && type !== 'no-store' && type !== 'no-cache') {
    cacheControl += `, max-age=${maxAge}`;
  }

  res.setHeader('Cache-Control', cacheControl);
}

/**
 * Middleware to disable caching
 */
export function noCache() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  };
}

/**
 * Middleware for public cacheable resources
 */
export function publicCache(maxAge: number = 3600) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    setCacheControl(res, 'public', maxAge);
    next();
  };
}

/**
 * Middleware for private cacheable resources
 */
export function privateCache(maxAge: number = 300) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    setCacheControl(res, 'private', maxAge);
    next();
  };
}

logger.info('ETag middleware initialized', 'ETag');
