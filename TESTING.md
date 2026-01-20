# Testing Guide for Teamly

This document provides guidelines for writing and running tests in the Teamly project.

## Overview

Teamly uses Jest as the testing framework for both backend and frontend code. The testing infrastructure was established to prevent regressions and ensure code quality.

## Test Statistics

- **Backend Tests**: 69 tests covering validation utilities
- **Frontend Tests**: 9 tests covering UI components
- **Total Coverage**: 78 tests

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
├── jest.config.js                              # Backend Jest configuration
├── src/
│   ├── backend/
│   │   └── __tests__/                          # Backend tests
│   │       └── utils/
│   │           └── validation.test.ts          # Validation utility tests
│   └── frontend/
│       ├── jest.config.js                      # Frontend Jest configuration
│       └── src/
│           └── __tests__/                      # Frontend tests
│               ├── setup.ts                    # Test setup & mocks
│               ├── __mocks__/                  # Mock files
│               │   └── fileMock.js            # Static file mock
│               └── components/
│                   └── common/
│                       └── StatusBadge.test.tsx # Component tests
```

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

### Frontend Tests (React + TypeScript)

Frontend tests are located in `src/frontend/src/__tests__/` and use React Testing Library:

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

### Backend Jest Configuration

Located in `jest.config.js` at the project root:

- **Test Environment**: Node.js
- **Preset**: ts-jest
- **Test Pattern**: `**/__tests__/**/*.test.ts`
- **Coverage**: Collects from `src/backend/**/*.ts`

### Frontend Jest Configuration

Located in `src/frontend/jest.config.js`:

- **Test Environment**: jsdom (browser environment)
- **Preset**: ts-jest
- **Test Pattern**: `**/__tests__/**/*.test.{ts,tsx}`
- **Setup Files**: `src/__tests__/setup.ts` (mocks for window.matchMedia, IntersectionObserver)
- **Module Mapper**: 
  - CSS files → `identity-obj-proxy`
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
- Check that `testEnvironment: 'jsdom'` is set in frontend jest.config.js

#### Tests timing out

- Increase timeout: `jest.setTimeout(10000);` in test file
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

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Getting Help

If you have questions about testing:

1. Check this documentation first
2. Look at existing test files for examples
3. Review Jest and React Testing Library documentation
4. Ask in team discussions or code reviews
