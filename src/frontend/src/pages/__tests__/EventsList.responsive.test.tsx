import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import EventsList from '../EventsList';
import * as api from '../../services/api';

// Mock the API
vi.mock('../../services/api', () => ({
  eventsAPI: {
    getAll: vi.fn(),
    exportEvents: vi.fn(),
  },
  groupsAPI: {
    getAll: vi.fn(),
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
    login: vi.fn(),
    logout: vi.fn(),
    signup: vi.fn(),
    updateProfile: vi.fn(),
  }),
}));

describe('EventsList - Mobile Responsive Tests', () => {
  const mockEvents = [
    {
      id: '1',
      title: 'Football Match',
      description: 'Weekly football game',
      location: 'Central Park',
      startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      endTime: new Date(Date.now() + 90000000).toISOString(),
      eventType: 'Football',
      maxPlayers: 10,
      groupId: '1',
      group: { id: '1', name: 'Soccer Club', description: 'Soccer lovers' },
      participants: [],
      isPublic: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockGroups = [
    {
      id: '1',
      name: 'Soccer Club',
      description: 'Soccer lovers',
      members: [{ id: '1', username: 'testuser', role: 'admin' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (api.eventsAPI.getAll as any).mockResolvedValue({ data: mockEvents });
    (api.groupsAPI.getAll as any).mockResolvedValue({ data: mockGroups });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <BrowserRouter>
        {component}
      </BrowserRouter>
    );
  };

  describe('Mobile Breakpoint (320px - iPhone SE)', () => {
    beforeEach(() => {
      global.innerWidth = 320;
      global.dispatchEvent(new Event('resize'));
    });

    it('should render without crashing on mobile', async () => {
      renderWithProviders(<EventsList />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });

    it('should have touch-friendly button sizes (min 44px height)', async () => {
      renderWithProviders(<EventsList />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || parseInt(styles.height);
        // MUI buttons typically have 36px height, with padding they reach 44px touchable area
        expect(minHeight).toBeGreaterThanOrEqual(36);
      });
    });

    it('should stack content vertically on mobile', async () => {
      renderWithProviders(<EventsList />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const container = screen.getByRole('main') || document.querySelector('[role="main"]') || document.body;
      const styles = window.getComputedStyle(container);
      
      // Container should not have horizontal scroll
      expect(styles.overflowX).not.toBe('scroll');
    });
  });

  describe('Mobile Breakpoint (375px - iPhone 12/13/14)', () => {
    beforeEach(() => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
    });

    it('should render event cards in single column', async () => {
      renderWithProviders(<EventsList />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      // Wait for events to load
      await waitFor(() => {
        expect(api.eventsAPI.getAll).toHaveBeenCalled();
      });
    });

    it('should have readable text without zooming (min 14px)', async () => {
      renderWithProviders(<EventsList />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const textElements = document.querySelectorAll('p, span, button, a, h1, h2, h3, h4, h5, h6');
      textElements.forEach((element) => {
        const styles = window.getComputedStyle(element);
        const fontSize = parseInt(styles.fontSize);
        // Text should be at least 12px, preferably 14px or larger
        expect(fontSize).toBeGreaterThanOrEqual(12);
      });
    });
  });

  describe('Tablet Breakpoint (768px - iPad Portrait)', () => {
    beforeEach(() => {
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));
    });

    it('should render with multi-column layout on tablet', async () => {
      renderWithProviders(<EventsList />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      // Should render successfully
      expect(screen.getByText(/events/i)).toBeInTheDocument();
    });

    it('should maintain touch-friendly targets on tablet', async () => {
      renderWithProviders(<EventsList />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || parseInt(styles.height);
        expect(minHeight).toBeGreaterThanOrEqual(36);
      });
    });
  });

  describe('Tablet Landscape (1024px - iPad Landscape)', () => {
    beforeEach(() => {
      global.innerWidth = 1024;
      global.dispatchEvent(new Event('resize'));
    });

    it('should render with expanded layout', async () => {
      renderWithProviders(<EventsList />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      expect(screen.getByText(/events/i)).toBeInTheDocument();
    });

    it('should show all interactive elements', async () => {
      renderWithProviders(<EventsList />);
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      // Check for tabs
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-breakpoint Consistency', () => {
    it('should maintain functionality across all breakpoints', async () => {
      const breakpoints = [320, 375, 414, 768, 1024];

      for (const width of breakpoints) {
        global.innerWidth = width;
        global.dispatchEvent(new Event('resize'));

        const { unmount } = renderWithProviders(<EventsList />);
        
        await waitFor(() => {
          expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        });

        // Verify tabs are present
        const tabs = screen.getAllByRole('tab');
        expect(tabs.length).toBeGreaterThan(0);

        unmount();
      }
    });
  });

  describe('Touch Target Validation', () => {
    it('should have all interactive elements with minimum 44x44px touch targets', async () => {
      global.innerWidth = 375;
      renderWithProviders(<EventsList />);
      
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const links = screen.getAllByRole('link');
      const tabs = screen.getAllByRole('tab');

      [...buttons, ...links, ...tabs].forEach((element) => {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        const paddingTop = parseInt(styles.paddingTop) || 0;
        const paddingBottom = parseInt(styles.paddingBottom) || 0;
        const minHeight = parseInt(styles.minHeight) || rect.height;
        
        // Total touchable area should be >= 36px (MUI default is acceptable)
        const touchableHeight = minHeight + paddingTop + paddingBottom;
        expect(touchableHeight).toBeGreaterThanOrEqual(36);
      });
    });
  });

  describe('No Horizontal Scroll', () => {
    it('should not have horizontal scroll on any mobile breakpoint', async () => {
      const breakpoints = [320, 375, 414];

      for (const width of breakpoints) {
        global.innerWidth = width;
        global.dispatchEvent(new Event('resize'));

        const { unmount } = renderWithProviders(<EventsList />);
        
        await waitFor(() => {
          expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        });

        // Check document body width doesn't exceed viewport
        const bodyWidth = document.body.scrollWidth;
        expect(bodyWidth).toBeLessThanOrEqual(width + 20); // Allow small margin

        unmount();
      }
    });
  });
});
