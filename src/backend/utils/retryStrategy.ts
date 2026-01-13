/**
 * Retry Strategy with Exponential Backoff
 * 
 * Provides a generic retry mechanism with exponential backoff for operations
 * that may fail temporarily (database operations, external API calls, etc.)
 */

import { logger } from './logger';

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[]; // Error messages that should trigger retry
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * Sleep for a specified duration
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Check if an error is retryable
 */
const isRetryableError = (error: Error, retryableErrors?: string[]): boolean => {
  if (!retryableErrors || retryableErrors.length === 0) {
    // By default, retry on common transient errors
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('lock') ||
      message.includes('deadlock') ||
      message.includes('serialization')
    );
  }

  return retryableErrors.some((retryableMsg) =>
    error.message.toLowerCase().includes(retryableMsg.toLowerCase())
  );
};

/**
 * Execute an operation with retry and exponential backoff
 * 
 * @param operation - The async operation to retry
 * @param options - Retry configuration
 * @returns The result of the operation
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if this is the last attempt or error is not retryable
      if (attempt === opts.maxRetries || !isRetryableError(lastError, opts.retryableErrors)) {
        throw lastError;
      }

      // Log retry attempt
      logger.warn(`Operation failed, retrying`, 'RetryStrategy', {
        attempt: attempt + 1,
        maxRetries: opts.maxRetries,
        error: lastError.message,
        nextDelayMs: delay,
      });

      // Call onRetry callback if provided
      if (opts.onRetry) {
        opts.onRetry(lastError, attempt + 1);
      }

      // Wait before retrying
      await sleep(delay);

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError || new Error('Operation failed after retries');
}

/**
 * Create a retry wrapper with pre-configured options
 * 
 * @example
 * const dbRetry = createRetryWrapper({
 *   maxRetries: 3,
 *   initialDelayMs: 100,
 * });
 * 
 * const result = await dbRetry(() => prisma.user.findMany());
 */
export function createRetryWrapper(options: Partial<RetryOptions> = {}) {
  return <T>(operation: () => Promise<T>): Promise<T> => {
    return withRetry(operation, options);
  };
}

/**
 * Pre-configured retry strategies for common use cases
 */

// Database operations - retry on connection and lock errors
export const dbRetry = createRetryWrapper({
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
  retryableErrors: [
    'connection',
    'timeout',
    'lock',
    'deadlock',
    'serialization',
    'ECONNREFUSED',
    'ECONNRESET',
  ],
});

// External API calls - retry on network errors
export const apiRetry = createRetryWrapper({
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableErrors: [
    'timeout',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    '503',
    '502',
    '504',
  ],
});

// Cache operations - fast retry with low max retries
export const cacheRetry = createRetryWrapper({
  maxRetries: 2,
  initialDelayMs: 50,
  maxDelayMs: 500,
  backoffMultiplier: 2,
  retryableErrors: ['connection', 'timeout', 'ECONNREFUSED'],
});
