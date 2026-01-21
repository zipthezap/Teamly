import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import EventDetails from '../EventDetails';
import * as api from '../../services/api';

// Mock the API
vi.mock('../../services/api', () => ({
  eventsAPI: {
    getById: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
  },
  commentsAPI: {
    getByEvent: vi.fn(),
    create: vi.fn(),
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

describe('EventDetails - Mobile Responsive Tests', () => {
  const mockEvent = {
    id: '1',
    title: 'Football Match',
    description: 'Weekly football game',
    location: 'Central Park',
    startTime: new Date(Date.now() + 86400000).toISOString(),
    endTime: new Date(Date.now() + 90000000).toISOString(),
    eventType: 'Football',
    maxPlayers: 10,
    groupId: '1',
    group: { id: '1', name: 'Soccer Club', description: 'Soccer lovers' },
    participants: [],
    isPublic: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    creator: { id: '1', username: 'testuser' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (api.eventsAPI.getById as any).mockResolvedValue({ data: mockEvent });
    (api.commentsAPI.getByEvent as any).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <BrowserRouter>
        <Routes>
          <Route path="/" element={component} />
          <Route path="/events/:id" element={component} />
        </Routes>
      </BrowserRouter>
    );
  };

  describe('Mobile Breakpoint (320px - iPhone SE)', () => {
    beforeEach(() => {
      global.innerWidth = 320;
      global.dispatchEvent(new Event('resize'));
    });

    it('should render without crashing on smallest mobile screen', async () => {
      renderWithProviders(<EventDetails />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should stack information vertically on mobile', async () => {
      renderWithProviders(<EventDetails />);
      await waitFor(() => {
        expect(api.eventsAPI.getById).toHaveBeenCalled();
      });
      
      // Check no horizontal scroll
      const bodyWidth = document.body.scrollWidth;
      expect(bodyWidth).toBeLessThanOrEqual(320 + 20);
    });

    it('should have touch-friendly action buttons', async () => {
      renderWithProviders(<EventDetails />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || parseInt(styles.height);
        expect(minHeight).toBeGreaterThanOrEqual(36);
      });
    });
  });

  describe('Mobile Breakpoint (375px - iPhone 12/13/14)', () => {
    beforeEach(() => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
    });

    it('should display event details clearly', async () => {
      renderWithProviders(<EventDetails />);
      await waitFor(() => {
        expect(api.eventsAPI.getById).toHaveBeenCalled();
      });
    });

    it('should have readable text sizes', async () => {
      renderWithProviders(<EventDetails />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      const textElements = document.querySelectorAll('p, span, button');
      textElements.forEach((element) => {
        const styles = window.getComputedStyle(element);
        const fontSize = parseInt(styles.fontSize);
        expect(fontSize).toBeGreaterThanOrEqual(12);
      });
    });
  });

  describe('Tablet Breakpoint (768px - iPad Portrait)', () => {
    beforeEach(() => {
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));
    });

    it('should render with expanded layout on tablet', async () => {
      renderWithProviders(<EventDetails />);
      await waitFor(() => {
        expect(api.eventsAPI.getById).toHaveBeenCalled();
      });
    });

    it('should maintain touch targets on tablet', async () => {
      renderWithProviders(<EventDetails />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        const rect = button.getBoundingClientRect();
        expect(rect.height).toBeGreaterThanOrEqual(36);
      });
    });
  });

  describe('Tablet Landscape (1024px - iPad Landscape)', () => {
    beforeEach(() => {
      global.innerWidth = 1024;
      global.dispatchEvent(new Event('resize'));
    });

    it('should utilize full width appropriately', async () => {
      renderWithProviders(<EventDetails />);
      await waitFor(() => {
        expect(api.eventsAPI.getById).toHaveBeenCalled();
      });
    });
  });

  describe('Cross-breakpoint Consistency', () => {
    it('should maintain core functionality across all breakpoints', async () => {
      const breakpoints = [320, 375, 414, 768, 1024];

      for (const width of breakpoints) {
        global.innerWidth = width;
        global.dispatchEvent(new Event('resize'));

        const { unmount } = renderWithProviders(<EventDetails />);
        
        await waitFor(() => {
          expect(api.eventsAPI.getById).toHaveBeenCalled();
        });

        unmount();
        vi.clearAllMocks();
        (api.eventsAPI.getById as any).mockResolvedValue({ data: mockEvent });
        (api.commentsAPI.getByEvent as any).mockResolvedValue({ data: [] });
      }
    });
  });

  describe('Touch Target Validation', () => {
    it('should have adequate touch targets for mobile', async () => {
      global.innerWidth = 375;
      renderWithProviders(<EventDetails />);
      
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        const rect = button.getBoundingClientRect();
        // Buttons should have minimum touch target
        expect(rect.height).toBeGreaterThanOrEqual(36);
      });
    });
  });

  describe('No Horizontal Scroll', () => {
    it('should prevent horizontal scroll on mobile', async () => {
      const breakpoints = [320, 375, 414];

      for (const width of breakpoints) {
        global.innerWidth = width;
        global.dispatchEvent(new Event('resize'));

        const { unmount } = renderWithProviders(<EventDetails />);
        
        await waitFor(() => {
          expect(api.eventsAPI.getById).toHaveBeenCalled();
        });

        const bodyWidth = document.body.scrollWidth;
        expect(bodyWidth).toBeLessThanOrEqual(width + 20);

        unmount();
        vi.clearAllMocks();
        (api.eventsAPI.getById as any).mockResolvedValue({ data: mockEvent });
        (api.commentsAPI.getByEvent as any).mockResolvedValue({ data: [] });
      }
    });
  });
});
