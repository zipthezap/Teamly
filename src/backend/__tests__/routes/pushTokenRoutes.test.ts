import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import pushTokenRoutes from '../../routes/pushTokenRoutes';

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

vi.mock('../../middleware/cacheControl', () => ({
  noCache: (_: any, __: any, next: any) => next(),
  cacheControl: () => (_: any, __: any, next: any) => next()
}));

vi.mock('../../controllers/pushTokenController', () => ({
  listPushDevices: vi.fn((req: any, res: any) => res.json({ ok: true })),
  registerPushDevice: vi.fn((req: any, res: any) => res.json({ ok: true })),
  refreshPushDevice: vi.fn((req: any, res: any) => res.json({ ok: true })),
  disablePushDeviceEndpoint: vi.fn((req: any, res: any) => res.json({ ok: true })),
  disableAllPushDevicesEndpoint: vi.fn((req: any, res: any) => res.json({ ok: true }))
}));

describe('Push Token Routes', () => {
  const app = createTestApp(pushTokenRoutes, '/api');

  it('GET /api/ → 200', async () => {
    const res = await request(app).get('/api/');
    expect(res.status).toBe(200);
  });

  it('POST /api/ → 200', async () => {
    const res = await request(app).post('/api/').send({});
    expect(res.status).toBe(200);
  });

  it('PUT /api/refresh → 200', async () => {
    const res = await request(app).put('/api/refresh').send({});
    expect(res.status).toBe(200);
  });

  it('DELETE /api/ → 200', async () => {
    const res = await request(app).delete('/api/').send({});
    expect(res.status).toBe(200);
  });

  it('DELETE /api/all → 200', async () => {
    const res = await request(app).delete('/api/all');
    expect(res.status).toBe(200);
  });
});
