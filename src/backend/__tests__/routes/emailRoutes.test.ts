import { describe, it, expect, vi } from 'vitest';
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

vi.mock('../../controllers/emailController', () => ({
  getEmailPreferences: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateEmailPreferences: vi.fn((req: any, res: any) => res.json({ ok: true })),
  toggleEmailNotifications: vi.fn((req: any, res: any) => res.json({ ok: true })),
  sendVerificationEmail: vi.fn((req: any, res: any) => res.json({ ok: true })),
  verifyEmail: vi.fn((req: any, res: any) => res.json({ ok: true }))
}));

describe('Email Routes', () => {
  const app = createTestApp(emailRoutes, '/api/email');

  it('GET /api/email/preferences → 200', async () => {
    const res = await request(app).get('/api/email/preferences');
    expect(res.status).toBe(200);
  });

  it('PUT /api/email/preferences → 200', async () => {
    const res = await request(app).put('/api/email/preferences').send({});
    expect(res.status).toBe(200);
  });

  it('PUT /api/email/notifications/toggle → 200', async () => {
    const res = await request(app).put('/api/email/notifications/toggle').send({ enabled: true });
    expect(res.status).toBe(200);
  });

  it('POST /api/email/verify/send → 200', async () => {
    const res = await request(app).post('/api/email/verify/send');
    expect(res.status).toBe(200);
  });

  it('GET /api/email/verify/:token → 200', async () => {
    const res = await request(app).get('/api/email/verify/some-token');
    expect(res.status).toBe(200);
  });
});
