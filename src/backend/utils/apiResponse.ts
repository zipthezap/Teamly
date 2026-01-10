/**
 * Standardized API Response Utilities
 * Provides consistent response formatting across all endpoints
 */

import { Response } from 'express';
import { ApiSuccessResponse, ApiErrorResponse, PaginationMeta } from '../../shared/types';

export { ApiSuccessResponse, ApiErrorResponse, PaginationMeta };

/**
 * Send a standardized success response
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  options?: {
    message?: string;
    statusCode?: number;
    pagination?: PaginationMeta;
    requestId?: string;
  }
): void => {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    message: options?.message,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
      pagination: options?.pagination,
    },
  };

  res.status(options?.statusCode || 200).json(response);
};

/**
 * Send a standardized error response
 */
export const sendError = (
  res: Response,
  error: {
    code: string;
    message: string;
    details?: any;
  },
  options?: {
    statusCode?: number;
    requestId?: string;
  }
): void => {
  const response: ApiErrorResponse = {
    success: false,
    error,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
    },
  };

  res.status(options?.statusCode || 500).json(response);
};

/**
 * Calculate pagination metadata
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

/**
 * Standard error codes for the API
 */
export const ErrorCodes = {
  // Authentication & Authorization (1000-1099)
  UNAUTHORIZED: 'AUTH_1000',
  INVALID_TOKEN: 'AUTH_1001',
  TOKEN_EXPIRED: 'AUTH_1002',
  INSUFFICIENT_PERMISSIONS: 'AUTH_1003',
  ACCOUNT_LOCKED: 'AUTH_1004',
  INVALID_CREDENTIALS: 'AUTH_1005',
  
  // Validation (2000-2099)
  VALIDATION_ERROR: 'VALID_2000',
  INVALID_INPUT: 'VALID_2001',
  REQUIRED_FIELD_MISSING: 'VALID_2002',
  INVALID_FORMAT: 'VALID_2003',
  
  // Resource (3000-3099)
  RESOURCE_NOT_FOUND: 'RES_3000',
  RESOURCE_ALREADY_EXISTS: 'RES_3001',
  RESOURCE_CONFLICT: 'RES_3002',
  
  // Database (4000-4099)
  DATABASE_ERROR: 'DB_4000',
  QUERY_TIMEOUT: 'DB_4001',
  CONNECTION_ERROR: 'DB_4002',
  
  // Rate Limiting (5000-5099)
  RATE_LIMIT_EXCEEDED: 'RATE_5000',
  
  // Server (9000-9099)
  INTERNAL_SERVER_ERROR: 'SERVER_9000',
  SERVICE_UNAVAILABLE: 'SERVER_9001',
  EXTERNAL_SERVICE_ERROR: 'SERVER_9002',
} as const;
