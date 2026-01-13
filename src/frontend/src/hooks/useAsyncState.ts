/**
 * Async State Hook
 * Provides reusable loading and error state management for async operations
 */

import { useState, useCallback } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseAsyncStateReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  setData: (data: T | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  execute: (asyncFn: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
}

/**
 * Hook for managing async operations with loading and error states
 * Reduces boilerplate for common loading/error/success patterns
 */
export const useAsyncState = <T = unknown>(
  initialData: T | null = null
): UseAsyncStateReturn<T> => {
  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    loading: false,
    error: null,
  });

  const setData = useCallback((data: T | null) => {
    setState((prev) => ({ ...prev, data, error: null }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error, loading: false }));
  }, []);

  const execute = useCallback(async (asyncFn: () => Promise<T>): Promise<T | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await asyncFn();
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error 
        || (error as { message?: string }).message 
        || 'An error occurred';
      setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: initialData, loading: false, error: null });
  }, [initialData]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    setData,
    setLoading,
    setError,
    execute,
    reset,
  };
};
