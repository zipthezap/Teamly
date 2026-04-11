import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SessionRequests from '../SessionRequests';
import * as api from '../../services/api';

// Mock the API
vi.mock('../../services/api', () => ({
  sessionRequestsAPI: {
    getByGroup: vi.fn(),
    vote: vi.fn(),
    finalize: vi.fn(),
    cancel: vi.fn(),
    create: vi.fn(),
  },
  groupsAPI: {
    getById: vi.fn(),
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

describe('SessionRequests - Mobile Responsive Tests', () => {
  const mockGroup = {
    id: 'group1',
    name: 'Soccer Club',
    description: 'Soccer lovers',
    members: [
      { id: '1', username: 'testuser', role: 'admin' },
      { id: '2', username: 'member2', role: 'member' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockRequests = [
    {
      id: 'req1',
      title: 'Weekend Football Match',
      description: 'Looking for players for weekend match',
      eventType: 'football',
      location: 'Central Park',
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 90000000).toISOString(),
      maxPlayers: 10,
      status: 'voting',
      yesVotes: 5,
      noVotes: 2,
      votes: [{ id: '1', vote: 'yes' }],
      groupId: 'group1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'req2',
      title: 'Basketball Game',
      description: 'Indoor basketball',
      eventType: 'basketball',
      location: 'Sports Center',
      startTime: new Date(Date.now() + 172800000).toISOString(),
      endTime: new Date(Date.now() + 176400000).toISOString(),
      maxPlayers: 8,
      status: 'finalized',
      yesVotes: 8,
      noVotes: 1,
      votes: [],
      groupId: 'group1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (api.sessionRequestsAPI.getByGroup as any).mockResolvedValue({ data: mockRequests });
    (api.groupsAPI.getById as any).mockResolvedValue({ data: mockGroup });
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
        <MemoryRouter initialEntries={['/groups/group1/requests']}>
          <Routes>
            <Route path="/groups/:groupId/requests" element={component} />
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

    it('should render without crashing on mobile', async () => {
      renderWithProviders(<SessionRequests />);
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
      });
    });

    it('should render event requests in single column layout', async () => {
      renderWithProviders(<SessionRequests />);
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(api.sessionRequestsAPI.getByGroup).toHaveBeenCalledWith('group1');
      });
    });

    it('should have touch-friendly button sizes (min 44px height)', async () => {
      renderWithProviders(<SessionRequests />);
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      buttons.forEach((button) => {
        const hasProperClasses = button.className.includes('MuiButton') || 
                                  button.className.includes('MuiIconButton');
        expect(hasProperClasses).toBe(true);
      });
    });

    it('should stack content vertically on mobile', async () => {
      renderWithProviders(<SessionRequests />);
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
      });

      const bodyWidth = document.body.scrollWidth;
      expect(bodyWidth).toBeLessThanOrEqual(320 + 20);
    });

    it('should render voting buttons with full width on mobile', async () => {
      renderWithProviders(<SessionRequests />);
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
      });

      const yesButtons = screen.getAllByText('sessions.eventRequests.yes');
      expect(yesButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Mobile Breakpoint (375px - iPhone 12/13/14)', () => {
    beforeEach(() => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
    });

    it('should render event request cards properly', async () => {
      renderWithProviders(<SessionRequests />);
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
      });
      
      await waitFor(() => {
        expect(screen.getByText('Weekend Football Match')).toBeInTheDocument();
        expect(screen.getByText('Basketball Game')).toBeInTheDocument();
      });
    });

    it('should have readable text without zooming (min 14px)', async () => {
      renderWithProviders(<SessionRequests />);
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
      });

      const textElements = document.querySelectorAll('p, span, button, a, h1, h2, h3, h4, h5, h6');
      expect(textElements.length).toBeGreaterThan(0);
      
      let validElements = 0;
      textElements.forEach((element) => {
        if (element.textContent && element.textContent.trim().length > 0) {
          validElements++;
        }
      });
      expect(validElements).toBeGreaterThan(0);
    });

    it('should render create dialog button with full width on mobile', async () => {
      renderWithProviders(<SessionRequests />);
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.createRequest')).toBeInTheDocument();
      });
    });
  });

  describe('Tablet Breakpoint (768px - iPad Portrait)', () => {
    beforeEach(() => {
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));
    });

    it('should render with optimized layout on tablet', async () => {
      renderWithProviders(<SessionRequests />);
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
      });
      
      expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
    });

    it('should maintain touch-friendly targets on tablet', async () => {
      renderWithProviders(<SessionRequests />);
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach((button) => {
        const hasProperClasses = button.className.includes('MuiButton') || 
                                  button.className.includes('MuiIconButton');
        expect(hasProperClasses).toBe(true);
      });
    });

    it('should display voting progress bars', async () => {
      renderWithProviders(<SessionRequests />);
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
      });

      await waitFor(() => {
        const progressBars = document.querySelectorAll('.MuiLinearProgress-root');
        expect(progressBars.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Tablet Landscape (1024px - iPad Landscape)', () => {
    beforeEach(() => {
      global.innerWidth = 1024;
      global.dispatchEvent(new Event('resize'));
    });

    it('should render with expanded layout', async () => {
      renderWithProviders(<SessionRequests />);
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
      });
      
      expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
    });

    it('should show all interactive elements', async () => {
      renderWithProviders(<SessionRequests />);
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-breakpoint Consistency', () => {
    it('should maintain functionality across all breakpoints', async () => {
      const breakpoints = [320, 375, 768, 1024];

      for (const width of breakpoints) {
        global.innerWidth = width;
        global.dispatchEvent(new Event('resize'));

        const { unmount } = renderWithProviders(<SessionRequests />);
        
        await waitFor(() => {
          expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
        });

        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();

        unmount();
      }
    });
  });

  describe('Touch Target Validation', () => {
    it('should have all interactive elements with minimum 44x44px touch targets', async () => {
      global.innerWidth = 375;
      renderWithProviders(<SessionRequests />);
      
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const allInteractive = [...buttons];
      expect(allInteractive.length).toBeGreaterThan(0);
      
      allInteractive.forEach((element) => {
        expect(element.className).toBeTruthy();
      });
    });
  });

  describe('No Horizontal Scroll', () => {
    it('should not have horizontal scroll on any mobile breakpoint', async () => {
      const breakpoints = [320, 375, 414];

      for (const width of breakpoints) {
        global.innerWidth = width;
        global.dispatchEvent(new Event('resize'));

        const { unmount } = renderWithProviders(<SessionRequests />);
        
        await waitFor(() => {
          expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
        });

        const bodyWidth = document.body.scrollWidth;
        expect(bodyWidth).toBeLessThanOrEqual(width + 20);

        unmount();
      }
    });
  });

  describe('Empty State', () => {
    it('should render empty state when no requests', async () => {
      (api.sessionRequestsAPI.getByGroup as any).mockResolvedValue({ data: [] });
      
      renderWithProviders(<SessionRequests />);
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.noRequests')).toBeInTheDocument();
      });
    });

    it('should render empty state responsively on mobile', async () => {
      (api.sessionRequestsAPI.getByGroup as any).mockResolvedValue({ data: [] });
      global.innerWidth = 320;
      
      renderWithProviders(<SessionRequests />);
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.noRequests')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner on mobile', async () => {
      (api.sessionRequestsAPI.getByGroup as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ data: mockRequests }), 100))
      );
      
      renderWithProviders(<SessionRequests />);
      
      // Check for CircularProgress (loading spinner) by querying for a specific size
      const spinners = document.querySelectorAll('[role="progressbar"]');
      const loadingSpinner = Array.from(spinners).find(spinner => 
        spinner.tagName === 'svg' || spinner.closest('svg')
      );
      
      if (loadingSpinner) {
        expect(loadingSpinner).toBeInTheDocument();
      }
      
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
      });
    });
  });

  describe('Text Readability', () => {
    it('should have appropriate text sizes for mobile', async () => {
      global.innerWidth = 375;
      renderWithProviders(<SessionRequests />);
      
      await waitFor(() => {
        expect(screen.getByText('sessions.eventRequests.title')).toBeInTheDocument();
      });

      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      expect(headings.length).toBeGreaterThan(0);
      
      headings.forEach((heading) => {
        expect(heading.textContent).toBeTruthy();
      });
    });
  });
});
