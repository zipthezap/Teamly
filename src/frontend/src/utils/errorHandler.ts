/**
 * Frontend Error Handling Utilities
 * Provides consistent error handling and user-friendly error messages
 */

import { AxiosError } from 'axios';

export interface ApiErrorResponse {
  error: string;
  code?: string;
  stack?: string;
}

/**
 * Extract error message from various error types
 */
export const getErrorMessage = (error: unknown): string => {
  if (!error) {
    return 'An unexpected error occurred';
  }

  // Handle AxiosError
  if (error instanceof AxiosError) {
    // Server responded with error
    if (error.response?.data) {
      const data = error.response.data as ApiErrorResponse;
      return data.error || error.message || 'Server error occurred';
    }
    
    // Request was made but no response received
    if (error.request) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }
    
    // Something else happened
    return error.message || 'An error occurred while making the request';
  }

  // Handle standard Error
  if (error instanceof Error) {
    return error.message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle unknown error types
  return 'An unexpected error occurred';
};

/**
 * Get error code from error object
 */
export const getErrorCode = (error: unknown): string | undefined => {
  if (error instanceof AxiosError && error.response?.data) {
    const data = error.response.data as ApiErrorResponse;
    return data.code;
  }
  return undefined;
};

/**
 * Get HTTP status code from error
 */
export const getStatusCode = (error: unknown): number | undefined => {
  if (error instanceof AxiosError) {
    return error.response?.status;
  }
  return undefined;
};

/**
 * Check if error is a specific type
 */
export const isErrorType = (error: unknown, errorCode: string): boolean => {
  return getErrorCode(error) === errorCode;
};

/**
 * Check if error is a network error
 */
export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof AxiosError) {
    return !error.response && !!error.request;
  }
  return false;
};

/**
 * Check if error is a validation error
 */
export const isValidationError = (error: unknown): boolean => {
  const statusCode = getStatusCode(error);
  return statusCode === 400 || statusCode === 422;
};

/**
 * Check if error is an authentication error
 */
export const isAuthError = (error: unknown): boolean => {
  const statusCode = getStatusCode(error);
  return statusCode === 401;
};

/**
 * Check if error is an authorization error
 */
export const isForbiddenError = (error: unknown): boolean => {
  const statusCode = getStatusCode(error);
  return statusCode === 403;
};

/**
 * Check if error is a not found error
 */
export const isNotFoundError = (error: unknown): boolean => {
  const statusCode = getStatusCode(error);
  return statusCode === 404;
};

/**
 * Check if error is a server error
 */
export const isServerError = (error: unknown): boolean => {
  const statusCode = getStatusCode(error);
  return statusCode ? statusCode >= 500 : false;
};

/**
 * Get user-friendly error message based on error type
 */
export const getUserFriendlyMessage = (error: unknown): string => {
  if (isNetworkError(error)) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  if (isAuthError(error)) {
    return 'Your session has expired. Please log in again.';
  }

  if (isForbiddenError(error)) {
    return 'You do not have permission to perform this action.';
  }

  if (isNotFoundError(error)) {
    return 'The requested resource was not found.';
  }

  if (isServerError(error)) {
    return 'A server error occurred. Please try again later.';
  }

  if (isValidationError(error)) {
    return getErrorMessage(error);
  }

  return getErrorMessage(error);
};

/**
 * Log error to console in development mode
 */
export const logError = (error: unknown, context?: string): void => {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[Error${context ? ` - ${context}` : ''}]:`, error);
    
    if (error instanceof AxiosError) {
      console.error('Request:', error.config);
      console.error('Response:', error.response?.data);
    }
  }
};

/**
 * Handle error with optional callback
 */
export const handleError = (
  error: unknown,
  options?: {
    context?: string;
    showToast?: (message: string) => void;
    onAuthError?: () => void;
    onNetworkError?: () => void;
  }
): string => {
  const message = getUserFriendlyMessage(error);
  
  logError(error, options?.context);

  // Handle authentication errors
  if (isAuthError(error) && options?.onAuthError) {
    options.onAuthError();
  }

  // Handle network errors
  if (isNetworkError(error) && options?.onNetworkError) {
    options.onNetworkError();
  }

  // Show toast notification if callback provided
  if (options?.showToast) {
    options.showToast(message);
  }

  return message;
};

/**
 * Retry failed request with exponential backoff
 */
export const retryRequest = async <T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
  }
): Promise<T> => {
  const maxRetries = options?.maxRetries ?? 3;
  const initialDelay = options?.initialDelay ?? 1000;
  const maxDelay = options?.maxDelay ?? 10000;
  const shouldRetry = options?.shouldRetry ?? isNetworkError;

  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if it's the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Don't retry if error type shouldn't be retried
      if (!shouldRetry(error)) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * (1 << attempt), maxDelay);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};
