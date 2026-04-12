/**
 * Vitest Setup File
 * Configure environment and global mocks for tests
 */

import { vi } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.FRONTEND_URL = 'http://localhost:3001';

// Global mock: Redis client — replaced with a no-op in-memory stub
vi.mock('../config/redis', () => ({
  getRedisClient: vi.fn(() => null),
  isRedisEnabled: vi.fn(() => false),
}));

// Global mock: logger — silence all output during tests
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

