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

vi.mock('../../middleware/distributedRateLimiter', () => ({
  distributedAuthenticatedLimiter: (_req: any, _res: any, next: any) => next(),
  distributedApiLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/cacheControl', () => ({
  noCache: (_req: any, _res: any, next: any) => next(),
  cacheControl: () => (_req: any, _res: any, next: any) => next(),
}));

// ─── Mock database ────────────────────────────────────────────────────────────

vi.mock('../../config/database', () => ({
  default: {
    pushDeviceToken: {
      findMany: vi.fn(),
    },
  },
}));

// ─── Mock pushTokenService ────────────────────────────────────────────────────

vi.mock('../../services/pushTokenService', () => ({
  validatePushToken: vi.fn(),
  registerOrUpdatePushDevice: vi.fn(),
  disablePushDevice: vi.fn(),
  disableAllPushDevices: vi.fn(),
}));

import prisma from '../../config/database';
import {
  validatePushToken,
  registerOrUpdatePushDevice,
  disablePushDevice,
  disableAllPushDevices,
} from '../../services/pushTokenService';
import pushTokenRoutes from '../../routes/pushTokenRoutes';

const app = createAuthenticatedTestApp(pushTokenRoutes, 'test-user-id', '/api/push-tokens');

const mockDevice = {
  id: 'device-1',
  platform: 'ios' as const,
  enabled: true,
  locale: 'en',
  timezone: 'UTC',
  appVersion: '1.0.0',
  deviceModel: 'iPhone 14',
  lastSeen: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('PushToken Controller', () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── GET /api/push-tokens ─────────────────────────────────────────────

  describe('GET /api/push-tokens', () => {
    it('returns 200 with devices list', async () => {
      vi.mocked(prisma.pushDeviceToken.findMany).mockResolvedValue([mockDevice] as any);

      const res = await request(app).get('/api/push-tokens');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('devices');
      expect(Array.isArray(res.body.devices)).toBe(true);
    });
  });

  // ─── POST /api/push-tokens ────────────────────────────────────────────

  describe('POST /api/push-tokens', () => {
    it('returns 400 when token is invalid', async () => {
      vi.mocked(validatePushToken).mockReturnValue(false);

      const res = await request(app)
        .post('/api/push-tokens')
        .send({ token: 'bad token!', platform: 'ios' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when platform is invalid', async () => {
      vi.mocked(validatePushToken).mockReturnValue(true);

      const res = await request(app)
        .post('/api/push-tokens')
        .send({ token: 'valid-token-123', platform: 'fax' });

      expect(res.status).toBe(400);
    });

    it('returns 201 when device is registered', async () => {
      vi.mocked(validatePushToken).mockReturnValue(true);
      vi.mocked(registerOrUpdatePushDevice).mockResolvedValue(mockDevice as any);

      const res = await request(app)
        .post('/api/push-tokens')
        .send({ token: 'valid-token-123', platform: 'ios' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('device');
      expect(res.body.device).toMatchObject({ id: 'device-1', platform: 'ios' });
    });
  });

  // ─── PUT /api/push-tokens/refresh ────────────────────────────────────

  describe('PUT /api/push-tokens/refresh', () => {
    it('returns 200 when device token is refreshed', async () => {
      vi.mocked(validatePushToken).mockReturnValue(true);
      vi.mocked(disablePushDevice).mockResolvedValue(undefined as any);
      vi.mocked(registerOrUpdatePushDevice).mockResolvedValue(mockDevice as any);

      const res = await request(app)
        .put('/api/push-tokens/refresh')
        .send({
          oldToken: 'old-token-123',
          newToken: 'new-token-456',
          platform: 'ios',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('device');
    });
  });

  // ─── DELETE /api/push-tokens ──────────────────────────────────────────

  describe('DELETE /api/push-tokens', () => {
    it('returns 200 when device is disabled', async () => {
      vi.mocked(validatePushToken).mockReturnValue(true);
      vi.mocked(disablePushDevice).mockResolvedValue(undefined as any);

      const res = await request(app)
        .delete('/api/push-tokens')
        .send({ token: 'valid-token-123' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'Push device disabled' });
    });
  });

  // ─── DELETE /api/push-tokens/all ─────────────────────────────────────

  describe('DELETE /api/push-tokens/all', () => {
    it('returns 200 when all devices are disabled', async () => {
      vi.mocked(disableAllPushDevices).mockResolvedValue(undefined as any);

      const res = await request(app).delete('/api/push-tokens/all');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'All push devices disabled' });
    });
  });
});
