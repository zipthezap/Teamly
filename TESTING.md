# Testing Guide for Teamly

This document provides guidelines for writing and running tests in the Teamly project.

## Overview

Teamly uses Vitest as the testing framework for backend code. The testing infrastructure was established to prevent regressions and ensure code quality.

## Test Statistics (Updated January 21, 2026)

- **Backend Tests**: 591 tests passing
  - Service Layer: 372 tests
  - Extended Database Operation Tests: 93 tests (events, groups, notifications)
  - Middleware: 53 tests
  - Utilities: 58 tests
  - Routes: 15 tests (skipped - integration tests)
- **Frontend Tests**: 128 tests covering UI components
  - Component Tests: 9 tests
  - **Responsive Tests**: 119 tests across 6 pages ✨ **NEW**
    - EventsList: 20 tests
    - EventDetails: 21 tests
    - GroupDetailsPage: 19 tests
    - NotificationsCenter: 18 tests
    - EventRequests: 20 tests
    - AuthCallback: 21 tests
- **Total Coverage**: 719 tests
- **Test Pass Rate**: 100%

### Recent Improvements
- **Responsive Testing Infrastructure** (January 21, 2026): Added 119 comprehensive responsive tests
  - Touch target validation (≥44px for accessibility)
  - Breakpoint testing (320px, 375px, 768px, 1024px)
  - Text readability validation (≥12px)
  - No horizontal scroll checks
  - Cross-breakpoint consistency tests
  - Coverage for EventsList, EventDetails, GroupDetailsPage, NotificationsCenter, EventRequests, AuthCallback
- **Test Organization**: Extracted mock data into centralized `__mocks__/mockData/` folder
- **Extended Test Coverage**: Added 93 new database operation tests
  - Event Database Operations: +26 tests covering creation, updates, participants, and activity
  - Group Database Operations: +36 tests covering permissions, members, and invitations
  - Notification Database Operations: +31 tests covering filtering, bulk operations, and cross-type queries
- **notificationService**: Coverage improved from 81.48% to 93.82%
- **eventService**: Maintaining 95.61% coverage with comprehensive edge cases
- **groupService**: Maintaining 98.9% coverage with robust validation tests

## Running Tests

### Backend Tests

```bash
# Run all backend tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Frontend Tests

```bash
# Navigate to frontend directory
cd src/frontend

# Run all frontend tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Run All Tests

```bash
# From root directory - runs backend tests
npm test

# Then run frontend tests
cd src/frontend && npm test
```

## Project Structure

```
Teamly/
├── vitest.config.ts                             # Vitest configuration
├── src/
│   ├── backend/
│   │   └── __tests__/                          # Backend tests
│   │       ├── __mocks__/                      # Mock infrastructure
│   │       │   ├── database.ts                 # Database mock
│   │       │   └── mockData/                   # Centralized mock data
│   │       │       ├── events.ts               # Event mock data
│   │       │       ├── groups.ts               # Group mock data
│   │       │       ├── notifications.ts        # Notification mock data
│   │       │       ├── users.ts                # User mock data
│   │       │       ├── index.ts                # Main export
│   │       │       └── README.md               # Mock data documentation
│   │       ├── helpers/                        # Test helpers
│   │       │   ├── testApp.ts                  # Test app setup
│   │       │   └── testHelpers.ts              # Helper functions
│   │       ├── middleware/                     # Middleware tests
│   │       ├── services/                       # Service tests
│   │       │   ├── eventService.test.ts        # Event service tests
│   │       │   ├── eventService.extended.test.ts # Extended event tests
│   │       │   ├── groupService.test.ts        # Group service tests
│   │       │   ├── groupService.extended.test.ts # Extended group tests
│   │       │   ├── notificationService.test.ts # Notification service tests
│   │       │   └── notificationService.extended.test.ts # Extended notification tests
│   │       ├── utils/                          # Utility tests
│   │       └── setup.ts                        # Test setup
│   └── frontend/
│       └── src/
│           └── __tests__/                      # Frontend tests
│               ├── setup.ts                    # Test setup & mocks
│               ├── __mocks__/                  # Mock files
│               │   └── fileMock.js            # Static file mock
│               └── hooks/
│                   └── useNotification.test.ts # Hook tests
```

### Mock Data Organization

Centralized mock data is available in `src/backend/__tests__/__mocks__/mockData/`:

- **events.ts**: Mock events, participants, and activity
- **groups.ts**: Mock groups, members, and permissions
- **notifications.ts**: Mock notifications of all types
- **users.ts**: Mock users and profiles

See [Mock Data README](src/backend/__tests__/__mocks__/mockData/README.md) for detailed usage.

## Writing Tests

### Backend Tests (Node.js + TypeScript)

Backend tests are located in `src/backend/__tests__/` and follow these conventions:

#### Example: Testing a Utility Function

```typescript
import { validateEmail, ValidationError } from '../../utils/validation';

describe('validateEmail', () => {
  it('should not throw for valid email addresses', () => {
    expect(() => validateEmail('test@example.com')).not.toThrow();
  });

  it('should throw ValidationError for invalid email', () => {
    expect(() => validateEmail('invalid')).toThrow(ValidationError);
    expect(() => validateEmail('invalid')).toThrow('Email must be a valid email address');
  });
});
```

#### Best Practices for Backend Tests

1. **Use descriptive test names**: Describe what the test is validating
2. **Test edge cases**: Include tests for null, undefined, empty strings, etc.
3. **Test error conditions**: Ensure errors are thrown when expected
4. **Group related tests**: Use `describe` blocks to organize tests
5. **Keep tests focused**: Each test should validate one specific behavior
6. **Use centralized mock data**: Import from `__mocks__/mockData` instead of creating inline mocks

#### Example: Using Centralized Mock Data

```typescript
import { vi, describe, it, expect } from 'vitest';
import { mockEvent, mockEventParticipants } from '../__mocks__/mockData';
import prisma from '../../config/database';

describe('Event Service', () => {
  it('should find event by ID', async () => {
    // Use centralized mock instead of creating inline
    vi.mocked(prisma.event.findUnique).mockResolvedValueOnce(mockEvent as any);

    const result = await prisma.event.findUnique({
      where: { id: mockEvent.id },
    });

    expect(result).toEqual(mockEvent);
  });

  it('should list event participants', async () => {
    vi.mocked(prisma.eventParticipant.findMany).mockResolvedValueOnce(
      mockEventParticipants as any
    );

    const result = await prisma.eventParticipant.findMany({
      where: { eventId: 'event-1' },
    });

    expect(result).toHaveLength(3);
  });
});
```

### Frontend Tests (React + TypeScript)

Frontend tests are located in `src/frontend/src/__tests__/` and `src/frontend/src/pages/__tests__/` and use React Testing Library:

#### Responsive Component Tests

Teamly includes comprehensive responsive tests for all major pages to ensure mobile-first design:

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import EventsList from '../EventsList';

describe('EventsList - Mobile Responsive Tests', () => {
  const createTestQueryClient = () => new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  });

  beforeEach(() => {
    global.innerWidth = 320; // iPhone SE
    global.dispatchEvent(new Event('resize'));
  });

  it('should render without crashing on mobile', async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EventsList />
        </MemoryRouter>
      </QueryClientProvider>
    );
    
    expect(screen.getByText(/events/i)).toBeInTheDocument();
  });
});
```

**Responsive Test Coverage:**
- **Breakpoints Tested**: 320px (iPhone SE), 375px (iPhone 12/13/14), 768px (iPad Portrait), 1024px (iPad Landscape)
- **Test Categories**:
  - Mobile breakpoint rendering
  - Touch target validation (≥44px)
  - Text readability (≥12px)
  - No horizontal scroll
  - Cross-breakpoint consistency
  - Loading and error states
  - Responsive layouts

#### Example: Testing a React Component

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../../../components/common/StatusBadge';

describe('StatusBadge', () => {
  it('should render with label', () => {
    render(<StatusBadge status="success" label="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should apply success color classes', () => {
    const { container } = render(<StatusBadge status="success" label="Success" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveClass('bg-green-900/50');
  });
});
```

#### Best Practices for Frontend Tests

1. **Test user-facing behavior**: Focus on what users see and interact with
2. **Avoid implementation details**: Don't test internal state or props directly
3. **Use semantic queries**: Prefer `getByRole`, `getByLabelText` over `getByTestId`
4. **Test accessibility**: Ensure components are accessible
5. **Mock external dependencies**: Mock API calls, router, etc.

## Test Configuration

### Backend Vitest Configuration

Located in `vitest.config.ts` at the project root:

- **Test Environment**: Node.js
- **Test Pattern**: `**/__tests__/**/*.test.ts`
- **Coverage**: Collects from `src/backend/**/*.ts`

### Frontend Vitest Configuration

Located in `src/frontend/vitest.config.ts`:

- **Test Environment**: jsdom (browser environment)
- **Test Pattern**: `**/__tests__/**/*.test.{ts,tsx}`
- **Setup Files**: `src/__tests__/setup.ts` (mocks for window.matchMedia, IntersectionObserver)
- **Module Mapper**: 
  - CSS files → handled by Vitest CSS modules support
  - Image files → `fileMock.js`

## Common Patterns

### Testing Async Functions

```typescript
it('should fetch data successfully', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});
```

### Testing Error Handling

```typescript
it('should throw error for invalid input', () => {
  expect(() => validateInput('invalid')).toThrow(ValidationError);
});
```

### Testing React Hooks

```typescript
import { renderHook } from '@testing-library/react';
import { useCustomHook } from '../hooks/useCustomHook';

it('should return correct value', () => {
  const { result } = renderHook(() => useCustomHook());
  expect(result.current).toBe(expectedValue);
});
```

### Testing User Interactions

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('should handle button click', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);
  
  await user.click(screen.getByRole('button', { name: /submit/i }));
  
  expect(screen.getByText('Success')).toBeInTheDocument();
});
```

## Coverage Goals

While we don't enforce strict coverage percentages, aim for:

- **Critical paths**: 80%+ coverage (authentication, authorization, payments)
- **Utility functions**: 90%+ coverage (validation, parsing, formatting)
- **UI Components**: 60%+ coverage (focus on user-facing behavior)
- **Overall**: 70%+ coverage

## Continuous Integration

Tests should be run:

1. **Before committing**: Run relevant tests locally
2. **In CI/CD pipeline**: All tests run on every pull request
3. **Before deployment**: All tests must pass before deploying to production

## Troubleshooting

### Common Issues

#### "Cannot find module" errors

- Ensure all dependencies are installed: `npm install`
- Check that import paths are correct relative to test file

#### "window is not defined" errors

- Frontend tests need jsdom environment
- Check that `environment: 'jsdom'` is set in frontend vitest.config.ts

#### Tests timing out

- Increase timeout in vitest.config.ts or in test file
- Check for unresolved promises or async operations

#### Mock not working

- Ensure mock is set up before importing the module
- Check mock path and module name

## Next Steps

To expand test coverage:

1. **Add API endpoint tests**: Test Express routes with supertest
2. **Add integration tests**: Test database operations with test database
3. **Add E2E tests**: Consider Playwright or Cypress for end-to-end testing
4. **Increase component coverage**: Add tests for more React components
5. **Add snapshot tests**: For components with complex DOM structures

## Resources

- [Vitest Documentation](https://vitest.dev/guide/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Getting Help

If you have questions about testing:

1. Check this documentation first
2. Look at existing test files for examples
3. Review Vitest and React Testing Library documentation
4. Ask in team discussions or code reviews
