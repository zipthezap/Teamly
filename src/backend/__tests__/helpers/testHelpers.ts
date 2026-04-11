/**
 * Test Helper Utilities
 * Provides common utilities for testing
 */

import { vi } from 'vitest';

/**
 * Mock Prisma client for testing
 */
export const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  session: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  group: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  userSession: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  refreshToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  revokedToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  notification: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

/**
 * Mock user data for testing
 */
export const mockUser = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  name: 'Test User',
  city: 'Test City',
  country: 'Test Country',
  password: 'hashedPassword123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

/**
 * Mock session data for testing
 */
export const mockEvent = {
  id: 'test-session-id-123',
  name: 'Test Event',
  description: 'Test session description',
  location: 'Test Location',
  date: new Date('2024-12-31'),
  creatorId: 'test-user-id-123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

/**
 * Mock group data for testing
 */
export const mockGroup = {
  id: 'test-group-id-123',
  name: 'Test Group',
  description: 'Test group description',
  creatorId: 'test-user-id-123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

/**
 * Clear all mock calls
 */
export const clearAllMocks = () => {
  Object.values(mockPrisma).forEach((model) => {
    Object.values(model).forEach((method) => {
      if (vi.isMockFunction(method)) {
        method.mockClear();
      }
    });
  });
};

/**
 * Reset all mocks to default state
 */
export const resetAllMocks = () => {
  Object.values(mockPrisma).forEach((model) => {
    Object.values(model).forEach((method) => {
      if (vi.isMockFunction(method)) {
        method.mockReset();
      }
    });
  });
};
