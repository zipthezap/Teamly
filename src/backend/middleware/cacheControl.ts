/**
 * Cache Control Middleware
 * Adds appropriate caching headers to responses for scalability
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Sets cache-control headers for responses
 * @param maxAge - Cache duration in seconds
 * @param options - Additional cache control options
 */
export const cacheControl = (
  maxAge: number,
  options: {
    private?: boolean;
    noTransform?: boolean;
    mustRevalidate?: boolean;
    staleWhileRevalidate?: number;
  } = {}
) => {
  return (_req: Request, res: Response, next: NextFunction) => {
    const directives: string[] = [];

    // Set cache visibility
    if (options.private) {
      directives.push('private');
    } else {
      directives.push('public');
    }

    // Set max age
    directives.push(`max-age=${maxAge}`);

    // Additional options
    if (options.noTransform) {
      directives.push('no-transform');
    }

    if (options.mustRevalidate) {
      directives.push('must-revalidate');
    }

    if (options.staleWhileRevalidate) {
      directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
    }

    res.setHeader('Cache-Control', directives.join(', '));
    next();
  };
};

/**
 * Sets no-cache headers for responses that should never be cached
 */
export const noCache = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

/**
 * Sets ETag for conditional requests
 * Helps reduce bandwidth by returning 304 Not Modified when content hasn't changed
 */
export const setETag = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.json.bind(res);

  res.json = function (body: unknown) {
    // Generate ETag from response body
    const etag = generateETag(body);
    res.setHeader('ETag', etag);

    // Check if client has current version
    const clientETag = req.headers['if-none-match'];
    if (clientETag === etag) {
      return res.status(304).end();
    }

    return originalSend(body);
  };

  next();
};

/**
 * Generates an ETag from response body using MD5 hash
 */
function generateETag(body: unknown): string {
  const content = typeof body === 'string' ? body : JSON.stringify(body);
  const hash = crypto.createHash('md5').update(content).digest('hex');
  return `"${hash}"`;
}

/**
 * Vary header middleware
 * Indicates which request headers affect the response (important for caching proxies)
 */
export const varyOn = (...headers: string[]) => {
  return (_req: Request, res: Response, next: NextFunction) => {
    const existing = res.getHeader('Vary');
    const varyHeaders = existing ? `${existing}, ${headers.join(', ')}` : headers.join(', ');
    res.setHeader('Vary', varyHeaders);
    next();
  };
};
