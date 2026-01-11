/**
 * Controller Helper Utilities
 * Provides common functions to reduce boilerplate code in controllers
 */

import { Response } from 'express';
import { logger } from './logger';
import { ApiSuccessResponse, PaginationMeta } from '../../shared/types';

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
