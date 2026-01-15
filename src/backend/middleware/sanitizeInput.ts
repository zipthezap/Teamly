/**
 * Input Sanitization Middleware
 * Sanitizes request body, query, and params by trimming whitespace
 * XSS protection is handled by React in the frontend
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Recursively sanitizes an object's string values by trimming whitespace
 */
const sanitizeObject = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return obj.trim();
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject((obj as Record<string, unknown>)[key]);
      }
    }
    return sanitized;
  }

  return obj;
};

/**
 * Middleware to sanitize all incoming request data
 * Sanitizes body, query params, and route params by trimming whitespace
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    const sanitizedQuery = sanitizeObject(req.query) as Record<string, unknown>;
    Object.keys(req.query).forEach(key => { delete (req.query as Record<string, unknown>)[key]; });
    Object.assign(req.query, sanitizedQuery);
  }

  if (req.params) {
    const sanitizedParams = sanitizeObject(req.params);
    req.params = sanitizedParams as typeof req.params;
  }

  next();
};
