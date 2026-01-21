/**
 * Test Helper Utilities
 * Provides common utilities for testing
 */

/**
 * Mock Prisma client for testing
 */
export const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  event: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  group: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  userSession: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  revokedToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  notification: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
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
 * Mock event data for testing
 */
export const mockEvent = {
  id: 'test-event-id-123',
  name: 'Test Event',
  description: 'Test event description',
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
      if (jest.isMockFunction(method)) {
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
      if (jest.isMockFunction(method)) {
        method.mockReset();
      }
    });
  });
};
