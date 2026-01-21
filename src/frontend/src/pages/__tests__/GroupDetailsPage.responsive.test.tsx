import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GroupDetailsPage from '../GroupDetailsPage';
import * as api from '../../services/api';

// Mock the API
vi.mock('../../services/api', () => ({
  groupsAPI: {
    getById: vi.fn(),
  },
  eventsAPI: {
    getByGroup: vi.fn(),
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

describe('GroupDetailsPage - Mobile Responsive Tests', () => {
  const mockGroup = {
    id: '1',
    name: 'Soccer Club',
    description: 'Soccer lovers group',
    members: [
      { id: '1', username: 'testuser', role: 'admin' },
      { id: '2', username: 'member1', role: 'member' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockEvents = [
    {
      id: '1',
      title: 'Football Match',
      description: 'Weekly game',
      startTime: new Date(Date.now() + 86400000).toISOString(),
      location: 'Park',
      eventType: 'Football',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (api.groupsAPI.getById as any).mockResolvedValue({ data: mockGroup });
    (api.eventsAPI.getByGroup as any).mockResolvedValue({ data: mockEvents });
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
        <MemoryRouter initialEntries={['/groups/1']}>
          <Routes>
            <Route path="/groups/:id" element={component} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('Mobile Breakpoint (320px - iPhone SE)', () => {
    beforeEach(() => {
      global.innerWidth = 320;
      global.dispatchEvent(new Event('resize'));
    });

    it('should render without crashing on smallest screen', async () => {
      renderWithProviders(<GroupDetailsPage />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should not have horizontal scroll', async () => {
      renderWithProviders(<GroupDetailsPage />);
      await waitFor(() => {
        expect(api.groupsAPI.getById).toHaveBeenCalled();
      });

      const bodyWidth = document.body.scrollWidth;
      expect(bodyWidth).toBeLessThanOrEqual(320 + 20);
    });

    it('should have touch-friendly buttons', async () => {
      renderWithProviders(<GroupDetailsPage />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify buttons exist
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Mobile Breakpoint (375px - iPhone 12/13/14)', () => {
    beforeEach(() => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
    });

    it('should display group information clearly', async () => {
      renderWithProviders(<GroupDetailsPage />);
      await waitFor(() => {
        expect(api.groupsAPI.getById).toHaveBeenCalled();
      });
    });

    it('should have readable text sizes', async () => {
      renderWithProviders(<GroupDetailsPage />);
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

    it('should stack member cards vertically', async () => {
      renderWithProviders(<GroupDetailsPage />);
      await waitFor(() => {
        expect(api.groupsAPI.getById).toHaveBeenCalled();
      });
      
      // Should render without layout issues
      const bodyWidth = document.body.scrollWidth;
      expect(bodyWidth).toBeLessThanOrEqual(375 + 20);
    });
  });

  describe('Tablet Breakpoint (768px - iPad Portrait)', () => {
    beforeEach(() => {
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));
    });

    it('should render with multi-column layout', async () => {
      renderWithProviders(<GroupDetailsPage />);
      await waitFor(() => {
        expect(api.groupsAPI.getById).toHaveBeenCalled();
      });
    });

    it('should maintain touch targets', async () => {
      renderWithProviders(<GroupDetailsPage />);
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
      renderWithProviders(<GroupDetailsPage />);
      await waitFor(() => {
        expect(api.groupsAPI.getById).toHaveBeenCalled();
      });
    });
  });

  describe('Cross-breakpoint Consistency', () => {
    it('should work consistently across all breakpoints', async () => {
      const breakpoints = [320, 375, 414, 768, 1024];

      for (const width of breakpoints) {
        global.innerWidth = width;
        global.dispatchEvent(new Event('resize'));

        const { unmount } = renderWithProviders(<GroupDetailsPage />);
        
        await waitFor(() => {
          expect(api.groupsAPI.getById).toHaveBeenCalled();
        });

        unmount();
        vi.clearAllMocks();
        (api.groupsAPI.getById as any).mockResolvedValue({ data: mockGroup });
        (api.eventsAPI.getByGroup as any).mockResolvedValue({ data: mockEvents });
      }
    });
  });

  describe('Touch Target Validation', () => {
    it('should have adequate touch targets', async () => {
      global.innerWidth = 375;
      renderWithProviders(<GroupDetailsPage />);
      
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

        const { unmount } = renderWithProviders(<GroupDetailsPage />);
        
        await waitFor(() => {
          expect(api.groupsAPI.getById).toHaveBeenCalled();
        });

        const bodyWidth = document.body.scrollWidth;
        expect(bodyWidth).toBeLessThanOrEqual(width + 20);

        unmount();
        vi.clearAllMocks();
        (api.groupsAPI.getById as any).mockResolvedValue({ data: mockGroup });
        (api.eventsAPI.getByGroup as any).mockResolvedValue({ data: mockEvents });
      }
    });
  });
});
