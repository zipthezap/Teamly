import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createAuthenticatedTestApp } from '../helpers/testApp';

// ─── Mock middleware ──────────────────────────────────────────────────────────

vi.mock('../../middleware/auth', () => ({
  default: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/rateLimiter', () => ({
  authenticatedLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/cacheControl', () => ({
  noCache: (_req: any, _res: any, next: any) => next(),
  cacheControl: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/etag', () => ({
  etagMiddleware: () => (_req: any, _res: any, next: any) => next(),
  generateWeakETag: vi.fn(),
  generateETag: vi.fn(),
}));

// ─── Mock database ────────────────────────────────────────────────────────────

vi.mock('../../config/database', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// ─── Mock speakeasy ───────────────────────────────────────────────────────────

vi.mock('speakeasy', () => ({
  default: {
    generateSecret: vi.fn().mockReturnValue({
      base32: 'MOCK_SECRET_BASE32',
      otpauth_url: 'otpauth://totp/Teamly%20(test%40example.com)?secret=MOCK_SECRET_BASE32&issuer=Teamly',
    }),
    totp: {
      verify: vi.fn(),
    },
  },
}));

// ─── Mock qrcode ─────────────────────────────────────────────────────────────

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,MOCK_QR_CODE'),
  },
}));

import prisma from '../../config/database';
import speakeasy from 'speakeasy';
import twoFactorRoutes from '../../routes/twoFactorRoutes';

const app = createAuthenticatedTestApp(twoFactorRoutes, 'test-user-id', '/api/2fa');

describe('TwoFactor Controller', () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── GET /api/2fa/status ──────────────────────────────────────────────

  describe('GET /api/2fa/status', () => {
    it('returns 200 with enabled status and backup code count', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'test-user-id',
        twoFactorEnabled: false,
        twoFactorBackupCodes: ['CODE1', 'CODE2', 'CODE3'],
      } as any);

      const res = await request(app).get('/api/2fa/status');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        enabled: false,
        backupCodesRemaining: 3,
      });
    });

    it('returns enabled=true when 2FA is enabled', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'test-user-id',
        twoFactorEnabled: true,
        twoFactorBackupCodes: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10'],
      } as any);

      const res = await request(app).get('/api/2fa/status');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        enabled: true,
        backupCodesRemaining: 10,
      });
    });
  });

  // ─── POST /api/2fa/setup ──────────────────────────────────────────────

  describe('POST /api/2fa/setup', () => {
    it('returns 400 when 2FA is already enabled', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'test-user-id',
        twoFactorEnabled: true,
        email: 'test@example.com',
        name: 'Test User',
      } as any);

      const res = await request(app).post('/api/2fa/setup');

      expect(res.status).toBe(400);
    });

    it('returns 200 with secret, qrCode, and backupCodes', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'test-user-id',
        twoFactorEnabled: false,
        email: 'test@example.com',
        name: 'Test User',
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      const res = await request(app).post('/api/2fa/setup');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('secret');
      expect(res.body).toHaveProperty('qrCode');
      expect(res.body).toHaveProperty('backupCodes');
      expect(Array.isArray(res.body.backupCodes)).toBe(true);
      expect(res.body.backupCodes).toHaveLength(10);
    });
  });

  // ─── POST /api/2fa/verify ─────────────────────────────────────────────

  describe('POST /api/2fa/verify', () => {
    it('returns 400 when no token is provided', async () => {
      const res = await request(app).post('/api/2fa/verify').send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when 2FA is already enabled', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'test-user-id',
        twoFactorEnabled: true,
        twoFactorSecret: 'MOCK_SECRET_BASE32',
      } as any);

      const res = await request(app)
        .post('/api/2fa/verify')
        .send({ token: '123456' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when token is invalid', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'test-user-id',
        twoFactorEnabled: false,
        twoFactorSecret: 'MOCK_SECRET_BASE32',
      } as any);
      vi.mocked(speakeasy.totp.verify).mockReturnValue(false as any);

      const res = await request(app)
        .post('/api/2fa/verify')
        .send({ token: '000000' });

      expect(res.status).toBe(400);
    });

    it('returns 200 on successful verification', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'test-user-id',
        twoFactorEnabled: false,
        twoFactorSecret: 'MOCK_SECRET_BASE32',
      } as any);
      vi.mocked(speakeasy.totp.verify).mockReturnValue(true as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/2fa/verify')
        .send({ token: '123456' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: '2FA enabled successfully' });
    });
  });

  // ─── POST /api/2fa/disable ────────────────────────────────────────────

  describe('POST /api/2fa/disable', () => {
    it('returns 400 when no password is provided', async () => {
      const res = await request(app).post('/api/2fa/disable').send({});

      expect(res.status).toBe(400);
    });

    it('returns 401 when password is wrong', async () => {
      // bcrypt.compare returns false for wrong password
      // The controller uses bcrypt.compare internally; we mock the user record
      // with a password hash that won't match the provided password
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'test-user-id',
        // bcrypt hash of 'correctpassword'
        password: '$2a$10$invalidhashfortest...............................X',
        twoFactorEnabled: true,
      } as any);

      const res = await request(app)
        .post('/api/2fa/disable')
        .send({ password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when 2FA is not enabled', async () => {
      // We need bcrypt.compare to return true — use a real bcrypt hash
      // Instead mock bcrypt directly in this test
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('mypassword', 1);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'test-user-id',
        password: hash,
        twoFactorEnabled: false, // 2FA not enabled
      } as any);

      const res = await request(app)
        .post('/api/2fa/disable')
        .send({ password: 'mypassword' });

      expect(res.status).toBe(400);
    });

    it('returns 200 when 2FA is disabled successfully', async () => {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('mypassword', 1);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'test-user-id',
        password: hash,
        twoFactorEnabled: true,
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/2fa/disable')
        .send({ password: 'mypassword' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: '2FA disabled successfully' });
    });
  });
});
