import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';

/**
 * Creates a test QueryClient with appropriate settings for tests
 * - Disables retries to make tests faster
 * - Sets gcTime to 0 to prevent memory leaks between tests
 */
export const createTestQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
};

/**
 * Wraps a component with QueryClientProvider for testing
 */
interface QueryWrapperProps {
  children: React.ReactNode;
  client?: QueryClient;
}

export const QueryWrapper: React.FC<QueryWrapperProps> = ({ 
  children, 
  client = createTestQueryClient() 
}) => {
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
};

/**
 * Wraps a component with both QueryClientProvider and BrowserRouter for testing
 */
export const QueryAndRouterWrapper: React.FC<QueryWrapperProps> = ({ 
  children, 
  client = createTestQueryClient() 
}) => {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

/**
 * Wraps a component with QueryClientProvider and MemoryRouter for testing
 * Useful for testing components that require route parameters
 */
interface MemoryRouterWrapperProps extends QueryWrapperProps {
  initialEntries?: string[];
}

export const QueryAndMemoryRouterWrapper: React.FC<MemoryRouterWrapperProps> = ({ 
  children, 
  client = createTestQueryClient(),
  initialEntries = ['/']
}) => {
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

/**
 * Custom render function that includes QueryClientProvider
 */
export const renderWithQueryClient = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const queryClient = createTestQueryClient();
  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    ),
    ...options,
  });
};

/**
 * Custom render function that includes QueryClientProvider and BrowserRouter
 */
export const renderWithQueryAndRouter = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const queryClient = createTestQueryClient();
  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </QueryClientProvider>
    ),
    ...options,
  });
};

/**
 * Custom render function that includes QueryClientProvider and MemoryRouter
 */
export const renderWithQueryAndMemoryRouter = (
  ui: React.ReactElement,
  initialEntries: string[] = ['/'],
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const queryClient = createTestQueryClient();
  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    ),
    ...options,
  });
};
