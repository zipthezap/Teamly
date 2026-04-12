import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import emailRoutes from '../../routes/emailRoutes';

vi.mock('../../middleware/auth', () => ({
  default: (req: any, _res: any, next: any) => { req.user = { id: 'test-user-id', email: 'test@example.com', name: 'Test User' }; next(); },
  optionalAuthMiddleware: (req: any, _res: any, next: any) => { req.user = { id: 'test-user-id' }; next(); }
}));
vi.mock('../../middleware/rateLimiter', () => ({
  authenticatedLimiter: (_: any, __: any, next: any) => next(),
  apiLimiter: (_: any, __: any, next: any) => next(),
  authLimiter: (_: any, __: any, next: any) => next()
}));
vi.mock('../../middleware/distributedRateLimiter', () => ({
  distributedAuthLimiter: (_: any, __: any, next: any) => next(),
  distributedAuthenticatedLimiter: (_: any, __: any, next: any) => next(),
  distributedUploadLimiter: (_: any, __: any, next: any) => next(),
  distributedApiLimiter: (_: any, __: any, next: any) => next(),
  distributedPasswordResetLimiter: (_: any, __: any, next: any) => next(),
  distributedEmailVerificationLimiter: (_: any, __: any, next: any) => next()
}));
vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../middleware/etag', () => ({
  etagMiddleware: () => (_: any, __: any, next: any) => next()
}));
vi.mock('../../middleware/cacheControl', () => ({
  noCache: (_: any, __: any, next: any) => next(),
  cacheControl: () => (_: any, __: any, next: any) => next()
}));

vi.mock('../../config/database', () => ({
  default: {
    emailPreference: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn()
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock('../../utils/emailService', () => ({
  sendEmail: vi.fn()
}));

vi.mock('../../services/authService', () => ({
  generateEmailVerificationToken: vi.fn(),
  hashToken: vi.fn()
}));

import prisma from '../../config/database';
import { sendEmail } from '../../utils/emailService';
import * as authService from '../../services/authService';

describe('Email Controller', () => {
  const app = createTestApp(emailRoutes, '/api/email');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/email/preferences', () => {
    it('returns 200 and creates default preferences when they do not exist', async () => {
      vi.mocked(prisma.emailPreference.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.emailPreference.create).mockResolvedValue({
        id: 'pref-1',
        userId: 'test-user-id',
        sessionInvites: true,
        sessionReminders: true
      } as any);

      const res = await request(app).get('/api/email/preferences');
      expect(res.status).toBe(200);
      expect(prisma.emailPreference.create).toHaveBeenCalled();
    });

    it('returns 200 with existing preferences', async () => {
      vi.mocked(prisma.emailPreference.findUnique).mockResolvedValue({
        id: 'pref-1',
        userId: 'test-user-id',
        sessionInvites: true,
        sessionReminders: false
      } as any);

      const res = await request(app).get('/api/email/preferences');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 'pref-1');
    });
  });

  describe('PUT /api/email/preferences', () => {
    it('returns 200 with updated preferences', async () => {
      vi.mocked(prisma.emailPreference.upsert).mockResolvedValue({
        id: 'pref-1',
        userId: 'test-user-id',
        sessionInvites: false,
        sessionReminders: true
      } as any);

      const res = await request(app)
        .put('/api/email/preferences')
        .send({ sessionInvites: false });
      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/email/notifications/toggle', () => {
    it('returns 200 with updated emailNotifications flag', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({
        id: 'test-user-id',
        emailNotifications: false
      } as any);

      const res = await request(app)
        .put('/api/email/notifications/toggle')
        .send({ enabled: false });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('emailNotifications', false);
    });
  });

  describe('POST /api/email/verify/send', () => {
    it('returns 404 when user is not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const res = await request(app).post('/api/email/verify/send');
      expect(res.status).toBe(404);
    });

    it('returns 400 when email is already verified', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true
      } as any);

      const res = await request(app).post('/api/email/verify/send');
      expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: false
      } as any);
      vi.mocked(authService.generateEmailVerificationToken).mockReturnValue({
        token: 'plain-token',
        hashedToken: 'hashed-token'
      });
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(sendEmail).mockResolvedValue(undefined as any);

      const res = await request(app).post('/api/email/verify/send');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('GET /api/email/verify/:token', () => {
    it('returns 400 when token is invalid', async () => {
      vi.mocked(authService.hashToken).mockReturnValue('hashed-bad-token');
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      const res = await request(app).get('/api/email/verify/bad-token');
      expect(res.status).toBe(400);
    });

    it('returns 200 on successful verification', async () => {
      vi.mocked(authService.hashToken).mockReturnValue('hashed-token');
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com'
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      const res = await request(app).get('/api/email/verify/valid-token');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
  });
});
