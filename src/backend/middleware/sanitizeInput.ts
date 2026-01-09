/**
 * Input Sanitization Middleware
 * Sanitizes request body, query, and params to prevent XSS attacks
 */

import { Request, Response, NextFunction } from 'express';
import { escapeHtml } from '../utils/validation';

/**
 * Recursively sanitizes an object's string values
 */
const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return escapeHtml(obj.trim());
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
 * List of fields that should NOT be sanitized (e.g., passwords, tokens)
 * These fields need to maintain their exact values
 */
const EXCLUDE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'accessToken',
  'refreshToken',
  'twoFactorToken',
  'twoFactorSecret',
  'passwordResetToken',
  'emailVerificationToken'
];

/**
 * Checks if a field should be excluded from sanitization
 */
const shouldExclude = (key: string): boolean => {
  return EXCLUDE_FIELDS.some(field => 
    key.toLowerCase().includes(field.toLowerCase())
  );
};

/**
 * Sanitizes object but preserves excluded fields
 */
const sanitizeObjectWithExclusions = (obj: any, parentKey: string = ''): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return shouldExclude(parentKey) ? obj.trim() : escapeHtml(obj.trim());
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) => 
      sanitizeObjectWithExclusions(item, `${parentKey}[${index}]`)
    );
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const fullKey = parentKey ? `${parentKey}.${key}` : key;
        sanitized[key] = sanitizeObjectWithExclusions(obj[key], fullKey);
      }
    }
    return sanitized;
  }

  return obj;
};

/**
 * Middleware to sanitize all incoming request data
 * Sanitizes body, query params, and route params
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) {
    req.body = sanitizeObjectWithExclusions(req.body);
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
