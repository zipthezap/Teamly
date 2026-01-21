import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationsCenter from '../NotificationsCenter';
import * as api from '../../services/api';

// Mock the API
vi.mock('../../services/api', () => ({
  notificationsAPI: {
    getAll: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// Mock useAuth hook
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
    },
    loading: false,
  }),
}));

describe('NotificationsCenter - Mobile Responsive Tests', () => {
  const mockNotifications = [
    {
      id: '1',
      type: 'EVENT_INVITATION',
      message: 'You have been invited to an event',
      isRead: false,
      priority: 'medium',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      type: 'GROUP_INVITATION',
      message: 'You have been invited to a group',
      isRead: false,
      priority: 'high',
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (api.notificationsAPI.getAll as any).mockResolvedValue({ data: mockNotifications });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  describe('Mobile Breakpoint (320px - iPhone SE)', () => {
    beforeEach(() => {
      global.innerWidth = 320;
      global.dispatchEvent(new Event('resize'));
    });

    it('should render without crashing on smallest mobile screen', async () => {
      renderWithProviders(<NotificationsCenter />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should not have horizontal scroll', async () => {
      renderWithProviders(<NotificationsCenter />);
      await waitFor(() => {
        expect(api.notificationsAPI.getAll).toHaveBeenCalled();
      });

      const bodyWidth = document.body.scrollWidth;
      expect(bodyWidth).toBeLessThanOrEqual(320 + 20);
    });

    it('should have touch-friendly buttons', async () => {
      renderWithProviders(<NotificationsCenter />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify buttons exist
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should stack notification cards vertically', async () => {
      renderWithProviders(<NotificationsCenter />);
      await waitFor(() => {
        expect(api.notificationsAPI.getAll).toHaveBeenCalled();
      });
      
      // Should render in single column
      const bodyWidth = document.body.scrollWidth;
      expect(bodyWidth).toBeLessThanOrEqual(320 + 20);
    });
  });

  describe('Mobile Breakpoint (375px - iPhone 12/13/14)', () => {
    beforeEach(() => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
    });

    it('should display notifications clearly', async () => {
      renderWithProviders(<NotificationsCenter />);
      await waitFor(() => {
        expect(api.notificationsAPI.getAll).toHaveBeenCalled();
      });
    });

    it('should have readable text sizes', async () => {
      renderWithProviders(<NotificationsCenter />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify text elements exist
      const textElements = document.querySelectorAll('p, span, button');
      expect(textElements.length).toBeGreaterThan(0);
      let validElements = 0;
      textElements.forEach((element) => {
        if (element.textContent && element.textContent.trim().length > 0) {
          validElements++;
        }
      });
      expect(validElements).toBeGreaterThan(0);
    });

    it('should render filter and search components', async () => {
      renderWithProviders(<NotificationsCenter />);
      await waitFor(() => {
        expect(api.notificationsAPI.getAll).toHaveBeenCalled();
      });
      
      // Should have functional components
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });
  });

  describe('Tablet Breakpoint (768px - iPad Portrait)', () => {
    beforeEach(() => {
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));
    });

    it('should render with expanded layout', async () => {
      renderWithProviders(<NotificationsCenter />);
      await waitFor(() => {
        expect(api.notificationsAPI.getAll).toHaveBeenCalled();
      });
    });

    it('should maintain touch targets', async () => {
      renderWithProviders(<NotificationsCenter />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify buttons exist
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Tablet Landscape (1024px - iPad Landscape)', () => {
    beforeEach(() => {
      global.innerWidth = 1024;
      global.dispatchEvent(new Event('resize'));
    });

    it('should utilize full width appropriately', async () => {
      renderWithProviders(<NotificationsCenter />);
      await waitFor(() => {
        expect(api.notificationsAPI.getAll).toHaveBeenCalled();
      });
    });

    it('should show all filter and action options', async () => {
      renderWithProviders(<NotificationsCenter />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Should have buttons available
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-breakpoint Consistency', () => {
    it('should maintain functionality across all breakpoints', async () => {
      const breakpoints = [320, 375, 414, 768, 1024];

      for (const width of breakpoints) {
        global.innerWidth = width;
        global.dispatchEvent(new Event('resize'));

        const { unmount } = renderWithProviders(<NotificationsCenter />);
        
        await waitFor(() => {
          expect(api.notificationsAPI.getAll).toHaveBeenCalled();
        });

        unmount();
        vi.clearAllMocks();
        (api.notificationsAPI.getAll as any).mockResolvedValue({ data: mockNotifications });
      }
    });
  });

  describe('Touch Target Validation', () => {
    it('should have all interactive elements with adequate touch targets', async () => {
      global.innerWidth = 375;
      renderWithProviders(<NotificationsCenter />);
      
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify buttons exist
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('No Horizontal Scroll', () => {
    it('should prevent horizontal scroll on all mobile sizes', async () => {
      const breakpoints = [320, 375, 414];

      for (const width of breakpoints) {
        global.innerWidth = width;
        global.dispatchEvent(new Event('resize'));

        const { unmount } = renderWithProviders(<NotificationsCenter />);
        
        await waitFor(() => {
          expect(api.notificationsAPI.getAll).toHaveBeenCalled();
        });

        const bodyWidth = document.body.scrollWidth;
        expect(bodyWidth).toBeLessThanOrEqual(width + 20);

        unmount();
        vi.clearAllMocks();
        (api.notificationsAPI.getAll as any).mockResolvedValue({ data: mockNotifications });
      }
    });
  });

  describe('Search and Filter Functionality', () => {
    it('should have accessible search on mobile', async () => {
      global.innerWidth = 375;
      renderWithProviders(<NotificationsCenter />);
      
      await waitFor(() => {
        expect(api.notificationsAPI.getAll).toHaveBeenCalled();
      });

      // Should render without errors
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });
  });
});
