/**
 * Custom Hook for Error Handling
 * Provides a consistent way to handle errors in React components
 */

import { useState, useCallback } from 'react';
import { getUserFriendlyMessage, logError } from '../utils/errorHandler';

interface UseErrorHandlerOptions {
  showToast?: (message: string) => void;
  onError?: (error: unknown) => void;
}

interface ErrorState {
  error: unknown | null;
  message: string | null;
  hasError: boolean;
}

interface UseErrorHandlerReturn extends ErrorState {
  setError: (error: unknown) => void;
  clearError: () => void;
  handleError: (error: unknown, context?: string) => void;
}

/**
 * Hook for managing error state and handling errors
 */
export const useErrorHandler = (options?: UseErrorHandlerOptions): UseErrorHandlerReturn => {
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    message: null,
    hasError: false,
  });

  const setError = useCallback((error: unknown) => {
    const message = getUserFriendlyMessage(error);
    setErrorState({
      error,
      message,
      hasError: true,
    });
  }, []);

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      message: null,
      hasError: false,
    });
  }, []);

  const handleError = useCallback(
    (error: unknown, context?: string) => {
      logError(error, context);
      
      const message = getUserFriendlyMessage(error);
      
      setErrorState({
        error,
        message,
        hasError: true,
      });

      // Show toast if callback provided
      if (options?.showToast) {
        options.showToast(message);
      }

      // Call custom error handler if provided
      if (options?.onError) {
        options.onError(error);
      }
    },
    [options]
  );

  return {
    ...errorState,
    setError,
    clearError,
    handleError,
  };
};

/**
 * Hook for handling async operations with error handling
 */
export const useAsyncError = () => {
  const [isPending, setIsPending] = useState(false);
  const errorHandler = useErrorHandler();

  const execute = useCallback(
    async <T,>(
      asyncFn: () => Promise<T>,
      options?: {
        onSuccess?: (data: T) => void;
        onError?: (error: unknown) => void;
        context?: string;
      }
    ): Promise<T | null> => {
      setIsPending(true);
      errorHandler.clearError();

      try {
        const result = await asyncFn();
        
        if (options?.onSuccess) {
          options.onSuccess(result);
        }
        
        return result;
      } catch (error) {
        errorHandler.handleError(error, options?.context);
        
        if (options?.onError) {
          options.onError(error);
        }
        
        return null;
      } finally {
        setIsPending(false);
      }
    },
    [errorHandler]
  );

  return {
    execute,
    isPending,
    ...errorHandler,
  };
};

/**
 * Hook for form submission with error handling
 */
export const useFormError = () => {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const errorHandler = useErrorHandler();

  const setFieldError = useCallback((field: string, message: string) => {
    setFieldErrors((prev) => ({
      ...prev,
      [field]: message,
    }));
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const clearAllFieldErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  const handleFormError = useCallback(
    (error: unknown) => {
      errorHandler.handleError(error);
      
      // Extract field-specific errors if available
      // This assumes the API returns errors in a specific format
      // Adjust based on your API's error format
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { data?: { errors?: Record<string, string> } } }).response;
        if (response?.data?.errors && typeof response.data.errors === 'object') {
          setFieldErrors(response.data.errors);
        }
      }
    },
    [errorHandler]
  );

  return {
    ...errorHandler,
    fieldErrors,
    setFieldError,
    clearFieldError,
    clearAllFieldErrors,
    handleFormError,
  };
};
