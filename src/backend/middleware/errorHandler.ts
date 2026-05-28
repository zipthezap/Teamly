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
  field?: string;
  fields?: string[];
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
  // Convert Prisma errors to ApiErrors
  let error = err;
  if (isPrismaError(err)) {
    error = prismaErrorHandler(err);
  }
  
  // Default to 500 if not an ApiError
  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  const code = error instanceof ApiError ? error.code : undefined;
  
  // Log the error with appropriate level
  if (statusCode >= 500) {
    logger.error(error.message, 'ErrorHandler', {
      statusCode,
      code,
      path: req.path,
      method: req.method,
      stack: error.stack,
      originalError: err.name
    });
  } else if (statusCode >= 400) {
    logger.warn(error.message, 'ErrorHandler', {
      statusCode,
      code,
      path: req.path,
      method: req.method
    });
  }

  // Prepare error response
  const response: ErrorResponse = {
    error: error.message || 'Internal server error',
    code
  };

  // Include field context when available (from BadRequestError)
  if (error instanceof ApiError) {
    if (error.field) response.field = error.field;
    if (error.fields && error.fields.length > 0) response.fields = error.fields;
  }

  // Include stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * Check if error is a Prisma error
 */
export const isPrismaError = (err: unknown): boolean => {
  const error = err as Record<string, unknown>;
  return (typeof error.code === 'string' && error.code.startsWith('P')) || 
         (typeof error.name === 'string' && error.name.includes('Prisma'));
};

/**
 * Converts Prisma errors to ApiErrors
 */
export const prismaErrorHandler = (err: unknown): ApiError => {
  const error = err as Record<string, unknown>;
  const errorCode = error.code as string;
  const errorName = error.name as string;

  // Handle Prisma unique constraint violations
  if (errorCode === 'P2002') {
    // Do NOT expose raw column/field names from Prisma metadata to clients
    return new ApiError('A record with these details already exists', 409, true, 'DUPLICATE_RECORD');
  }

  // Handle Prisma foreign key constraint violations
  if (errorCode === 'P2003') {
    return new ApiError('Related record not found', 400, true, 'INVALID_REFERENCE');
  }

  if (errorCode === 'P2014') {
    return new ApiError('Operation violates a required relation', 400, true, 'REQUIRED_RELATION_VIOLATION');
  }

  if (errorCode === 'P2023' || errorCode === 'P2006') {
    return new ApiError('Invalid value provided for database field', 400, true, 'INVALID_DATABASE_VALUE');
  }

  // Handle Prisma record not found
  if (errorCode === 'P2025') {
    return new ApiError('Record not found', 404, true, 'NOT_FOUND');
  }

  // Handle Prisma connection errors
  if (errorCode === 'P1001' || errorCode === 'P1002') {
    return new ApiError('Database connection error', 503, false, 'DATABASE_CONNECTION_ERROR');
  }

  // Handle Prisma timeout errors
  if (errorCode === 'P2024') {
    return new ApiError('Database operation timed out', 504, false, 'DATABASE_TIMEOUT');
  }

  // Handle validation errors (check by name instead of import)
  if (errorName === 'PrismaClientValidationError') {
    return new ApiError('Invalid data provided', 400, true, 'VALIDATION_ERROR');
  }

  // Handle Prisma initialization errors
  if (errorName === 'PrismaClientInitializationError') {
    return new ApiError('Database initialization error', 503, false, 'DATABASE_INIT_ERROR');
  }

  // Handle Prisma known request errors
  if (errorName === 'PrismaClientKnownRequestError') {
    return new ApiError('Database error', 500, false, 'DATABASE_REQUEST_ERROR');
  }

  // Default to internal server error for unknown Prisma errors
  return new ApiError('Database error', 500, false, 'DATABASE_ERROR');
};
