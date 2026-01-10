/**
 * Input Sanitization Middleware
 * Sanitizes request body, query, and params by trimming whitespace
 * XSS protection is handled by React in the frontend
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Recursively sanitizes an object's string values by trimming whitespace
 */
const sanitizeObject = (obj: any): any => {
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
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
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
    const sanitizedQuery = sanitizeObject(req.query);
    Object.keys(req.query).forEach(key => { delete (req.query as any)[key]; });
    Object.assign(req.query, sanitizedQuery);
  }

  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};
