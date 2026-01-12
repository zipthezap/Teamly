/**
 * Controller Helper Utilities
 * Provides common functions to reduce boilerplate code in controllers
 */

import { Response } from 'express';
import { logger } from './logger';
import { ApiSuccessResponse, PaginationMeta } from '../../shared/types';
import { 
  BadRequestError, 
  NotFoundError, 
  UnauthorizedError, 
  ForbiddenError 
} from './errors';

/**
 * Standard success response helper
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  options?: {
    message?: string;
    statusCode?: number;
    pagination?: PaginationMeta;
  }
): void => {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    message: options?.message,
    meta: {
      timestamp: new Date().toISOString(),
      pagination: options?.pagination,
    },
  };

  res.status(options?.statusCode || 200).json(response);
};

/**
 * Standard error response helper (deprecated - use error classes instead)
 */
export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  context?: string
): void => {
  if (context) {
    logger.error(message, context, { statusCode });
  }
  res.status(statusCode).json({ error: message });
};

/**
 * Extracts user ID from request
 */
export const getUserId = (req: any): string => {
  return req.user?.id;
};

/**
 * Validates required fields in request body
 * @throws BadRequestError if validation fails
 */
export const validateRequiredFields = (
  body: any,
  requiredFields: string[]
): { valid: boolean; missing?: string[] } => {
  const missing = requiredFields.filter(field => !body[field]);
  
  if (missing.length > 0) {
    return { valid: false, missing };
  }
  
  return { valid: true };
};

/**
 * Validates required fields and throws error if missing
 * @throws BadRequestError if validation fails
 */
export const requireFields = (body: any, requiredFields: string[]): void => {
  const missing = requiredFields.filter(field => !body[field]);
  
  if (missing.length > 0) {
    throw new BadRequestError(
      `Missing required fields: ${missing.join(', ')}`,
      'MISSING_REQUIRED_FIELDS'
    );
  }
};

/**
 * Validates that a resource exists
 * @throws NotFoundError if resource is null or undefined
 */
export const ensureResourceExists = <T>(
  resource: T | null | undefined,
  resourceName: string = 'Resource'
): T => {
  if (!resource) {
    throw new NotFoundError(`${resourceName} not found`, 'RESOURCE_NOT_FOUND');
  }
  return resource;
};

/**
 * Validates user authorization
 * @throws UnauthorizedError if user is not authenticated
 */
export const ensureAuthenticated = (userId: any): void => {
  if (!userId) {
    throw new UnauthorizedError('Authentication required', 'NOT_AUTHENTICATED');
  }
};

/**
 * Validates user permission
 * @throws ForbiddenError if user lacks permission
 */
export const ensurePermission = (hasPermission: boolean, message: string = 'Insufficient permissions'): void => {
  if (!hasPermission) {
    throw new ForbiddenError(message, 'INSUFFICIENT_PERMISSIONS');
  }
};

/**
 * Parses integer from string safely
 */
export const parseIntSafe = (value: any, defaultValue: number = 0): number => {
  const parsed = parseInt(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Parses float from string safely
 */
export const parseFloatSafe = (value: any, defaultValue: number = 0): number => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Calculates pagination metadata
 */
export const calculatePagination = (
  page: number,
  perPage: number,
  total: number
): PaginationMeta => {
  const totalPages = Math.ceil(total / perPage);
  
  return {
    page,
    perPage,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};
