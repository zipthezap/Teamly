/**
 * Structured Error Handling Utilities
 * 
 * Provides consistent error handling patterns across the application
 */

import { logger } from './logger';
import { Response } from 'express';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error context for better debugging
 */
export interface ErrorContext {
  userId?: string;
  resource?: string;
  resourceId?: string;
  operation?: string;
  [key: string]: unknown;
}

/**
 * Log and handle errors with proper context
 */
export class ErrorHandler {
  /**
   * Log an error with context
   */
  static logError(
    error: unknown,
    context: ErrorContext,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error(errorMessage, 'ErrorHandler', {
      ...context,
      severity,
      stack: errorStack,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle database errors with proper logging
   */
  static handleDatabaseError(
    error: unknown,
    context: ErrorContext,
    res: Response
  ): void {
    this.logError(error, { ...context, errorType: 'database' }, ErrorSeverity.HIGH);
    
    // Handle specific Prisma errors
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const prismaError = error as { code: string };
      
      if (prismaError.code === 'P2002') {
        res.status(409).json({ 
          error: 'A record with this information already exists' 
        });
        return;
      }
      
      if (prismaError.code === 'P2025') {
        res.status(404).json({ 
          error: 'Record not found' 
        });
        return;
      }
    }
    
    // Generic database error
    res.status(500).json({ 
      error: 'A database error occurred' 
    });
  }

  /**
   * Handle validation errors
   */
  static handleValidationError(
    error: unknown,
    context: ErrorContext,
    res: Response
  ): void {
    this.logError(error, { ...context, errorType: 'validation' }, ErrorSeverity.LOW);
    
    const message = error instanceof Error ? error.message : 'Validation failed';
    res.status(400).json({ error: message });
  }

  /**
   * Handle authorization errors
   */
  static handleAuthorizationError(
    context: ErrorContext,
    res: Response,
    message: string = 'You do not have permission to perform this action'
  ): void {
    this.logError(new Error(message), { ...context, errorType: 'authorization' }, ErrorSeverity.MEDIUM);
    res.status(403).json({ error: message });
  }

  /**
   * Handle not found errors
   */
  static handleNotFoundError(
    resource: string,
    context: ErrorContext,
    res: Response
  ): void {
    const message = `${resource} not found`;
    this.logError(new Error(message), { ...context, errorType: 'notFound' }, ErrorSeverity.LOW);
    res.status(404).json({ error: message });
  }

  /**
   * Handle rate limit errors
   */
  static handleRateLimitError(
    context: ErrorContext,
    res: Response
  ): void {
    this.logError(new Error('Rate limit exceeded'), { ...context, errorType: 'rateLimit' }, ErrorSeverity.MEDIUM);
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
}

/**
 * Async operation wrapper with error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  onError?: (error: unknown) => T
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    ErrorHandler.logError(error, context);
    return onError ? onError(error) : null;
  }
}
