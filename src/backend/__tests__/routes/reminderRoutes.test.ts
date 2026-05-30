import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import reminderRoutes from '../../routes/reminderRoutes';

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

vi.mock('../../controllers/proxies/reminderProxyController', () => ({
  createReminder: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getEventReminders: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getUserReminders: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateReminder: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteReminder: vi.fn((req: any, res: any) => res.json({ ok: true }))
}));

describe('Reminder Routes', () => {
  const app = createTestApp(reminderRoutes, '/api');

  it('GET /api/ → 200', async () => {
    const res = await request(app).get('/api/');
    expect(res.status).toBe(200);
  });

  it('PUT /api/:reminderId → 200', async () => {
    const res = await request(app).put('/api/reminder-1').send({ remindAt: new Date().toISOString() });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/:reminderId → 200', async () => {
    const res = await request(app).delete('/api/reminder-1');
    expect(res.status).toBe(200);
  });
});
