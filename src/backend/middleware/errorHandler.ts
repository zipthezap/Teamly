/**
 * Enhanced Error Handler Middleware
 * Provides consistent error responses and logging
 */

import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';

interface ErrorResponse {
  error: string;
  code?: string;
  stack?: string;
}

/**
 * Centralized error handling middleware
 * Formats errors consistently and logs them appropriately
 */
export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Default to 500 if not an ApiError
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const code = err instanceof ApiError ? err.code : undefined;
  
  // Log the error with appropriate level
  if (statusCode >= 500) {
    logger.error(err.message, 'ErrorHandler', {
      statusCode,
      code,
      path: req.path,
      method: req.method,
      stack: err.stack
    });
  } else if (statusCode >= 400) {
    logger.warn(err.message, 'ErrorHandler', {
      statusCode,
      code,
      path: req.path,
      method: req.method
    });
  }

  // Prepare error response
  const response: ErrorResponse = {
    error: err.message || 'Internal server error',
    code
  };

  // Include stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * Converts Prisma errors to ApiErrors
 */
export const prismaErrorHandler = (err: any): ApiError => {
  // Handle Prisma unique constraint violations
  if (err.code === 'P2002') {
    const target = err.meta?.target?.[0] || 'field';
    return new ApiError(`A record with this ${target} already exists`, 409, true, 'DUPLICATE_RECORD');
  }

  // Handle Prisma foreign key constraint violations
  if (err.code === 'P2003') {
    return new ApiError('Related record not found', 400, true, 'INVALID_REFERENCE');
  }

  // Handle Prisma record not found
  if (err.code === 'P2025') {
    return new ApiError('Record not found', 404, true, 'NOT_FOUND');
  }

  // Handle validation errors (check by name instead of import)
  if (err.name === 'PrismaClientValidationError') {
    return new ApiError('Invalid data provided', 400, true, 'VALIDATION_ERROR');
  }

  // Default to internal server error for unknown Prisma errors
  return new ApiError('Database operation failed', 500, false, 'DATABASE_ERROR');
};
