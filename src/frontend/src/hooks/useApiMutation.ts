/**
 * useApiMutation Hook
 * Provides consistent mutation handling with automatic error handling and cache invalidation
 */

import { useMutation, useQueryClient, UseMutationOptions, MutationFunction } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useCallback } from 'react';

export interface UseApiMutationOptions<TData, TVariables> {
  /** React Query mutation function */
  mutationFn: MutationFunction<TData, TVariables>;
  /** Query keys to invalidate on success */
  invalidateKeys?: string[][];
  /** Success message to display */
  successMessage?: string;
  /** Callback on success */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Callback on error */
  onError?: (error: string, variables: TVariables) => void;
  /** Additional React Query mutation options */
  options?: Omit<UseMutationOptions<TData, unknown, TVariables>, 'mutationFn' | 'onSuccess' | 'onError'>;
}

export const useApiMutation = <TData = unknown, TVariables = void>({
  mutationFn,
  invalidateKeys = [],
  successMessage,
  onSuccess,
  onError,
  options = {},
}: UseApiMutationOptions<TData, TVariables>) => {
  const queryClient = useQueryClient();

  const mutation = useMutation<TData, unknown, TVariables>({
    mutationFn,
    onSuccess: useCallback((data: TData, variables: TVariables) => {
      // Invalidate queries
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      // Call custom success handler
      onSuccess?.(data, variables);
    }, [queryClient, invalidateKeys, onSuccess]),
    onError: useCallback((err: unknown, variables: TVariables) => {
      // Extract error message
      const errorMessage = err instanceof AxiosError
        ? err.response?.data?.error || 'An error occurred'
        : 'An error occurred';

      // Call custom error handler
      onError?.(errorMessage, variables);
    }, [onError]),
    ...options,
  });

  return {
    ...mutation,
    isLoading: mutation.isPending,
  };
};

export default useApiMutation;
