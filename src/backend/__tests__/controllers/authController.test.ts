import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createAuthenticatedTestApp } from '../helpers/testApp';

// ─── Mock middleware ──────────────────────────────────────────────────────────

vi.mock('../../middleware/auth', () => ({
  default: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/cacheControl', () => ({
  noCache: (_req: any, _res: any, next: any) => next(),
  cacheControl: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/etag', () => ({
  etagMiddleware: () => (_req: any, _res: any, next: any) => next(),
  generateWeakETag: vi.fn(),
  generateStrongETag: vi.fn(),
  generateETag: vi.fn(),
}));

vi.mock('../../middleware/rateLimiter', () => ({
  rateLimiter: () => (_req: any, _res: any, next: any) => next(),
  authLimiter: (_req: any, _res: any, next: any) => next(),
  authenticatedLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/distributedRateLimiter', () => ({
  distributedRateLimiter: () => (_req: any, _res: any, next: any) => next(),
  distributedAuthLimiter: (_req: any, _res: any, next: any) => next(),
  distributedUploadLimiter: (_req: any, _res: any, next: any) => next(),
  distributedPasswordResetLimiter: (_req: any, _res: any, next: any) => next(),
  distributedEmailVerificationLimiter: (_req: any, _res: any, next: any) => next(),
  distributedAuthenticatedLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/upload', () => ({
  upload: { single: vi.fn(() => (_req: any, _res: any, next: any) => next()) },
  uploadProfilePicture: (_req: any, _res: any, next: any) => next(),
}));

// ─── Mock passport (used by OAuth routes in authRoutes.ts) ───────────────────

vi.mock('../../config/passport', () => ({
  default: {
    authenticate: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  },
}));

// ─── Mock database ────────────────────────────────────────────────────────────

vi.mock('../../config/database', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    token: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    userProfilePicture: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    userSession: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// ─── Mock authService ─────────────────────────────────────────────────────────

vi.mock('../../services/authService', () => ({
  validateRegistrationInputs: vi.fn(),
  sanitizeUserInputs: vi.fn(),
  findUserByEmail: vi.fn(),
  hashPassword: vi.fn(),
  hashToken: vi.fn(),
  generateEmailVerificationToken: vi.fn(),
  generatePasswordResetToken: vi.fn(),
  isAccountLocked: vi.fn(),
  recordFailedLoginAttempt: vi.fn(),
  resetFailedLoginAttempts: vi.fn(),
  verifyPassword: vi.fn(),
  validatePasswordResetToken: vi.fn(),
  validateEmailVerificationToken: vi.fn(),
  createPasswordResetToken: vi.fn(),
  getUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
  validateCurrentPassword: vi.fn(),
}));

// ─── Mock JWT utils ───────────────────────────────────────────────────────────

vi.mock('../../utils/jwt', () => ({
  generateTokenPair: vi.fn(),
  revokeToken: vi.fn(),
  revokeAllUserTokens: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

// ─── Mock email service ───────────────────────────────────────────────────────

vi.mock('../../utils/emailService', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// ─── Mock image processor ─────────────────────────────────────────────────────

vi.mock('../../utils/imageProcessor', () => ({
  validateImage: vi.fn(),
  processImage: vi.fn(),
  deleteFile: vi.fn(),
  deleteOldPicture: vi.fn(),
  generateUniqueFilename: vi.fn().mockReturnValue('profile_123.jpg'),
}));

// ─── Mock mobile OAuth ────────────────────────────────────────────────────────

vi.mock('../../utils/mobileOAuth', () => ({
  verifyGoogleToken: vi.fn(),
  verifyFacebookToken: vi.fn(),
  verifyAppleToken: vi.fn(),
}));

// ─── Mock twoFactorController ─────────────────────────────────────────────────

vi.mock('../../controllers/twoFactorController', () => ({
  validate2FAToken: vi.fn().mockResolvedValue({ valid: true }),
}));

// ─── Mock validation utils (used directly in login, updatePassword, etc.) ─────

vi.mock('../../utils/validation', () => ({
  validateEmail: vi.fn(),
  validateStrongPassword: vi.fn(),
  isRequired: vi.fn(),
  sanitizeString: vi.fn((v: string) => v),
  sanitizeUserInput: vi.fn((v: string) => v),
  ValidationError: class ValidationError extends Error {},
}));

// ─── Mock bcryptjs (used directly in login and updatePassword) ────────────────

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
    genSalt: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
  genSalt: vi.fn(),
}));

import prisma from '../../config/database';
import * as authService from '../../services/authService';
import { generateTokenPair, revokeToken, revokeAllUserTokens, refreshAccessToken } from '../../utils/jwt';
import { sendEmail } from '../../utils/emailService';
import bcrypt from 'bcryptjs';
import authRoutes from '../../routes/authRoutes';

const USER_ID = 'test-user-id';
const app = createAuthenticatedTestApp(authRoutes, USER_ID, '/api/auth');

const mockUser = {
  id: USER_ID,
  email: 'test@example.com',
  name: 'Test User',
  password: '$2a$10$hashedpassword',
  emailVerified: true,
  twoFactorEnabled: false,
  failedLoginAttempts: 0,
  accountLockedUntil: null,
  authProvider: 'local',
};

const mockTokens = {
  accessToken: 'access-token-abc',
  refreshToken: 'refresh-token-xyz',
};

describe('Auth Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /api/auth/register ───────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('returns 201 on successful registration', async () => {
      const createdUser = {
        id: 'new-user-id',
        email: 'new@example.com',
        name: 'New User',
        createdAt: new Date(),
        emailVerified: false,
      };

      vi.mocked(authService.validateRegistrationInputs).mockReturnValue({ valid: true });
      vi.mocked(authService.sanitizeUserInputs).mockReturnValue({
        email: 'new@example.com',
        name: 'New User',
      });
      vi.mocked(authService.findUserByEmail).mockResolvedValue(null);
      vi.mocked(authService.hashPassword).mockResolvedValue('hashed-pw');
      vi.mocked(authService.generateEmailVerificationToken).mockReturnValue({
        token: 'plain-token',
        hashedToken: 'hashed-token',
      } as any);
      vi.mocked(prisma.user.create).mockResolvedValue(createdUser as any);
      vi.mocked(generateTokenPair).mockResolvedValue(mockTokens as any);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@example.com', password: 'StrongPass1!', name: 'New User' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ user: { email: 'new@example.com' } });
      expect(res.body.accessToken).toBe('access-token-abc');
    });

    it('returns 400 when email is already registered', async () => {
      vi.mocked(authService.validateRegistrationInputs).mockReturnValue({ valid: true });
      vi.mocked(authService.sanitizeUserInputs).mockReturnValue({
        email: 'existing@example.com',
        name: 'Existing User',
      });
      vi.mocked(authService.findUserByEmail).mockResolvedValue(mockUser as any);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'existing@example.com', password: 'StrongPass1!', name: 'Existing User' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('returns 400 when registration inputs are invalid', async () => {
      vi.mocked(authService.validateRegistrationInputs).mockReturnValue({
        valid: false,
        error: 'Password is too weak',
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'bad', password: 'weak', name: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password is too weak');
    });
  });

  // ─── POST /api/auth/login ──────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('returns 200 with tokens on valid credentials', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(generateTokenPair).mockResolvedValue(mockTokens as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ user: { id: USER_ID }, accessToken: 'access-token-abc' });
    });

    it('returns 401 when user is not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' });

      expect(res.status).toBe(401);
    });

    it('returns 401 when account is locked', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        accountLockedUntil: new Date(Date.now() + 10 * 60 * 1000),
      } as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/locked/i);
    });

    it('returns 401 when password is wrong', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      vi.mocked(prisma.user.update).mockResolvedValue({ failedLoginAttempts: 1 } as any);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/auth/profile ─────────────────────────────────────────────

  describe('GET /api/auth/profile', () => {
    it('returns 200 with the user profile', async () => {
      const profile = { id: USER_ID, email: 'test@example.com', name: 'Test User' };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(profile as any);

      const res = await request(app).get('/api/auth/profile');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ user: { id: USER_ID } });
    });

    it('returns 200 with null user when not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const res = await request(app).get('/api/auth/profile');

      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    });
  });

  // ─── PUT /api/auth/profile ─────────────────────────────────────────────

  describe('PUT /api/auth/profile', () => {
    it('returns 400 when name or email is missing', async () => {
      const res = await request(app).put('/api/auth/profile').send({ name: 'Only Name' });
      expect(res.status).toBe(400);
    });

    it('returns 200 with updated user on valid update', async () => {
      const updatedUser = { id: USER_ID, email: 'test@example.com', name: 'Updated Name' };
      // Same email as injected user, skip uniqueness check
      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser as any);

      const res = await request(app)
        .put('/api/auth/profile')
        .send({ name: 'Updated Name', email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ user: { name: 'Updated Name' } });
    });

    it('returns 400 when email is already in use by another account', async () => {
      // Provide a different email so the uniqueness check runs
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'other-user' } as any);

      const res = await request(app)
        .put('/api/auth/profile')
        .send({ name: 'Test User', email: 'taken@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already in use/i);
    });
  });

  // ─── PUT /api/auth/password ────────────────────────────────────────────

  describe('PUT /api/auth/password', () => {
    it('returns 400 when new password is missing', async () => {
      const res = await request(app).put('/api/auth/password').send({ currentPassword: 'old' });
      expect(res.status).toBe(400);
    });

    it('returns 401 when current password is incorrect', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const res = await request(app)
        .put('/api/auth/password')
        .send({ currentPassword: 'wrongOld', newPassword: 'NewStrong1!' });

      expect(res.status).toBe(401);
    });

    it('returns 200 on successful password update', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(bcrypt.hash).mockResolvedValue('new-hashed-pw' as never);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);
      vi.mocked(revokeAllUserTokens).mockResolvedValue(undefined);

      const res = await request(app)
        .put('/api/auth/password')
        .send({ currentPassword: 'correctOld', newPassword: 'NewStrong1!' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated successfully/i);
    });
  });

  // ─── POST /api/auth/forgot-password ───────────────────────────────────

  describe('POST /api/auth/forgot-password', () => {
    it('returns 200 with generic message when user exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/if an account/i);
      expect(sendEmail).toHaveBeenCalled();
    });

    it('returns 200 with generic message when user does not exist (no enumeration)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/if an account/i);
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  // ─── POST /api/auth/reset-password ────────────────────────────────────

  describe('POST /api/auth/reset-password', () => {
    it('returns 200 on valid reset token', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.hash).mockResolvedValue('new-hashed-pw' as never);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);
      vi.mocked(revokeAllUserTokens).mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'valid-reset-token', newPassword: 'NewStrong1!' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/reset successfully/i);
    });

    it('returns 400 when reset token is invalid or expired', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'bad-token', newPassword: 'NewStrong1!' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid or expired/i);
    });
  });

  // ─── POST /api/auth/verify-email ──────────────────────────────────────

  describe('POST /api/auth/verify-email', () => {
    it('returns 400 when token is missing', async () => {
      const res = await request(app).post('/api/auth/verify-email').send({});
      expect(res.status).toBe(400);
    });

    it('returns 200 on valid verification token', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, emailVerified: true } as any);

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'valid-verify-token' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/verified successfully/i);
    });

    it('returns 400 when token is invalid or already verified', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'bad-token' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid or expired/i);
    });
  });

  // ─── POST /api/auth/refresh-token ─────────────────────────────────────

  describe('POST /api/auth/refresh-token', () => {
    it('returns 400 when refresh token is missing', async () => {
      const res = await request(app).post('/api/auth/refresh-token').send({});
      expect(res.status).toBe(400);
    });

    it('returns 200 with new tokens on valid refresh token', async () => {
      vi.mocked(refreshAccessToken).mockResolvedValue(mockTokens as any);

      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ accessToken: 'access-token-abc' });
    });

    it('returns 401 when refresh token is invalid', async () => {
      vi.mocked(refreshAccessToken).mockResolvedValue(null as any);

      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'expired-token' });

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/auth/logout ─────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('returns 200 and revokes token when user is authenticated', async () => {
      vi.mocked(revokeToken).mockResolvedValue(undefined);

      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/logged out/i);
    });
  });

  // ─── GET /api/auth/sessions ────────────────────────────────────────────

  describe('GET /api/auth/sessions', () => {
    it('returns 200 with sessions array', async () => {
      const sessions = [
        { id: 'sess-1', deviceInfo: 'Chrome', ipAddress: '127.0.0.1', lastActive: new Date() },
        { id: 'sess-2', deviceInfo: 'Firefox', ipAddress: '127.0.0.2', lastActive: new Date() },
      ];
      vi.mocked(prisma.userSession.findMany).mockResolvedValue(sessions as any);

      const res = await request(app).get('/api/auth/sessions');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ sessions: expect.arrayContaining([expect.objectContaining({ id: 'sess-1' })]) });
    });

    it('returns 200 with empty sessions array when no active sessions', async () => {
      vi.mocked(prisma.userSession.findMany).mockResolvedValue([]);

      const res = await request(app).get('/api/auth/sessions');

      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(0);
    });
  });
});
