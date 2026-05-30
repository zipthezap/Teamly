import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import twoFactorRoutes from '../../routes/twoFactorRoutes';

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

vi.mock('../../controllers/proxies/twoFactorProxyController', () => ({
  get2FAStatus: vi.fn((req: any, res: any) => res.json({ ok: true })),
  setup2FA: vi.fn((req: any, res: any) => res.json({ ok: true })),
  verify2FA: vi.fn((req: any, res: any) => res.json({ ok: true })),
  disable2FA: vi.fn((req: any, res: any) => res.json({ ok: true }))
}));

describe('Two Factor Routes', () => {
  const app = createTestApp(twoFactorRoutes, '/api');

  it('GET /api/status → 200', async () => {
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
  });

  it('POST /api/setup → 200', async () => {
    const res = await request(app).post('/api/setup').send({});
    expect(res.status).toBe(200);
  });

  it('POST /api/verify → 200', async () => {
    const res = await request(app).post('/api/verify').send({});
    expect(res.status).toBe(200);
  });

  it('POST /api/disable → 200', async () => {
    const res = await request(app).post('/api/disable').send({});
    expect(res.status).toBe(200);
  });
});
