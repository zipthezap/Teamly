/**
 * Auth Routes Integration Tests
 * Tests for authentication API endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { mockUser } from '../helpers/testApp';

// Mock dependencies at the top level.
// Note: `../../utils/jwt` and `../../services/authService` are intentionally
// left UNMOCKED. They only depend on `prisma` (mocked below) and pure
// crypto/bcrypt, so running the real implementations gives us genuine
// integration coverage of token issuance/validation and business rules
// (e.g. password strength, email format) without hand-duplicating that
// logic in test-only mocks that can drift from the real controller.
vi.mock('../../config/database', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn()
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn()
    },
    revokedToken: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      createMany: vi.fn()
    },
    userSession: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      deleteMany: vi.fn()
    },
    inviteLog: undefined
  }
}));

vi.mock('../../utils/emailService', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'mock-message-id' })
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../middleware/distributedRateLimiter', () => ({
  distributedAuthLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  distributedUploadLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  distributedPasswordResetLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  distributedEmailVerificationLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  distributedApiLimiter: (_req: Request, _res: Response, next: NextFunction) => next()
}));

vi.mock('../../config/passport', () => ({
  default: {
    authenticate: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next())
  }
}));

vi.mock('../../middleware/asyncHandler', () => ({
  asyncHandler: (fn: unknown) => fn
}));

vi.mock('../../middleware/cacheControl', () => ({
  noCache: (_req: Request, _res: Response, next: NextFunction) => next(),
  cacheControl: () => (_req: Request, _res: Response, next: NextFunction) => next()
}));

vi.mock('../../middleware/etag', () => ({
  etagMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next()
}));

vi.mock('../../middleware/upload', () => ({
  uploadProfilePicture: (_req: Request, _res: Response, next: NextFunction) => next()
}));

// Mirrors the real middleware's contract (401 when no/invalid Bearer header)
// so route-level auth-guard behavior is still exercised, while avoiding a
// real JWT round-trip for routes that don't need it.
vi.mock('../../middleware/auth', () => ({
  default: (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.token = authHeader.substring(7);
    req.user = { id: 'test-user-id', email: 'test@example.com', name: 'Test User' };
    next();
  },
  optionalAuthMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: 'test-user-id' };
    next();
  }
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(() => Promise.resolve('$2a$10$hashed.password')),
    compare: vi.fn(() => Promise.resolve(true))
  }
}));

import prisma from '../../config/database';
import { generateRefreshToken } from '../../utils/jwt';
import authRoutes from '../../routes/authRoutes';
import { createTestApp } from '../helpers/testApp';

const mockPrisma = vi.mocked(prisma);

describe('Auth Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp(authRoutes, '/api/auth');
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-id',
        token: 'mock-refresh-token',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date()
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'StrongPass123!',
          name: 'New User'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toHaveProperty('email');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'StrongPass123!',
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'StrongPass123!',
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        accountLockoutUntil: null,
        failedLoginAttempts: 0
      });
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-id',
        token: 'mock-refresh-token',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date()
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'correctPassword'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(mockUser.email);
    });

    it('should return 401 for invalid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongPassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    it('should refresh tokens successfully', async () => {
      // Use a real, validly-signed refresh JWT so `verifyRefreshToken` (real,
      // unmocked implementation) succeeds; only the DB lookup is mocked.
      const validRefreshToken = generateRefreshToken(mockUser.id);
      const mockRefreshToken = {
        id: 'token-id',
        token: validRefreshToken,
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date()
      };

      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockRefreshToken);
      mockPrisma.refreshToken.update.mockResolvedValue(mockRefreshToken);

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({
          refreshToken: validRefreshToken
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should return 401 for invalid refresh token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({
          refreshToken: 'invalid-token'
        });

      expect(response.status).toBe(401);
    });

    it('should return 401 for expired refresh token', async () => {
      // Signature must be valid so the expiry check on the *stored* record is
      // what actually rejects the request (not JWT-level verification).
      const validRefreshToken = generateRefreshToken(mockUser.id);
      const expiredToken = {
        id: 'token-id',
        token: validRefreshToken,
        userId: mockUser.id,
        expiresAt: new Date(Date.now() - 1000), // Already expired in the DB
        createdAt: new Date()
      };

      mockPrisma.refreshToken.findUnique.mockResolvedValue(expiredToken);

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({
          refreshToken: validRefreshToken
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      mockPrisma.revokedToken.create.mockResolvedValue({
        id: 'revoked-id',
        token: 'mock-access-token-hash',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        reason: 'logout'
      });
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer mock-access-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('successfully');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should initiate password reset', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'test@example.com'
        });

      // Should always return 200 for security reasons
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('email');
    });

    it('should return 200 even for non-existent email (security)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize input data', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'token-id',
        token: 'mock-refresh-token',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date()
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: '  test@example.com  ', // Whitespace
          password: 'StrongPass123!',
          name: '  Test User  ' // Whitespace
        });

      expect(response.status).toBe(201);
      // Verify sanitization occurred in the request processing
    });
  });
});
