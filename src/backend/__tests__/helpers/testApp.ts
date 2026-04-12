/**
 * Test App Helper
 * Creates Express app instance for API route integration tests
 */

import express, { Express, Router } from 'express';
import { errorHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/sanitizeInput';

/**
 * Creates a test Express app with minimal middleware
 * @param router - Optional router to mount
 * @param basePath - Base path for the router (default: '/api')
 */
export function createTestApp(router?: Router, basePath: string = '/api'): Express {
  const app = express();

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Input sanitization
  app.use(sanitizeInput);

  // Mount router if provided
  if (router) {
    app.use(basePath, router);
  }

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Creates an Express test app that injects a mock authenticated user into
 * every request via middleware, before the provided router is mounted.
 *
 * @param router   - The router under test
 * @param userId   - The user id to inject (default: 'test-user-id')
 * @param basePath - Base path for the router (default: '/api')
 */
export function createAuthenticatedTestApp(
  router: Router,
  userId: string = 'test-user-id',
  basePath: string = '/api'
): Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(sanitizeInput);

  // Inject mock user — simulates a successfully verified JWT
  app.use((req, _res, next) => {
    (req as any).user = {
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
    };
    next();
  });

  app.use(basePath, router);
  app.use(errorHandler);

  return app;
}

/**
 * Creates an Express test app WITHOUT any auth middleware.
 * Useful for asserting that protected routes return 401.
 *
 * @param router   - The router under test
 * @param basePath - Base path for the router (default: '/api')
 */
export function createUnauthenticatedTestApp(router: Router, basePath: string = '/api'): Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(sanitizeInput);

  app.use(basePath, router);
  app.use(errorHandler);

  return app;
}

/**
 * Mock authentication helper
 * Returns a valid JWT token for testing authenticated routes
 */
export function getMockAuthToken(userId: string = 'test-user-id'): string {
  // In tests, we'll mock the JWT verification
  return `Bearer mock-token-${userId}`;
}

/**
 * Mock user data for testing
 */
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  password: '$2a$10$test.hash.for.password',
  emailVerified: true,
  isAdmin: false,
  createdAt: new Date(),
  updatedAt: new Date()
};

/**
 * Mock session data for testing
 */
export const mockEvent = {
  id: 'test-session-id',
  title: 'Test Event',
  description: 'Test session description',
  sessionType: 'soccer',
  location: 'Test Location',
  latitude: 40.7128,
  longitude: -74.0060,
  startTime: new Date(Date.now() + 86400000), // Tomorrow
  endTime: new Date(Date.now() + 90000000), // Tomorrow + 1 hour
  maxParticipants: 20,
  isPrivate: false,
  isRecurring: false,
  creatorId: 'test-user-id',
  createdAt: new Date(),
  updatedAt: new Date()
};

/**
 * Mock group data for testing
 */
export const mockGroup = {
  id: 'test-group-id',
  name: 'Test Group',
  description: 'Test group description',
  isPrivate: false,
  sportType: 'soccer',
  location: 'Test Location',
  createdAt: new Date(),
  updatedAt: new Date()
};
