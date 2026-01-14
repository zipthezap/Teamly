import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // Refetch when window regains focus
      retry: 1,
      staleTime: 0, // Data is immediately considered stale - always refetch
      gcTime: 5 * 60 * 1000, // 5 minutes - keep unused data in cache briefly for back navigation
    },
    mutations: {
      retry: 0,
    },
  },
});
