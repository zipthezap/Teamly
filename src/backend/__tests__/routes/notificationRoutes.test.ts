import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import notificationRoutes from '../../routes/notificationRoutes';

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

vi.mock('../../controllers/notificationController', () => ({
  getNotifications: vi.fn((req: any, res: any) => res.json({ ok: true })),
  markAsRead: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getStats: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getUnreadCount: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteNotificationsEndpoint: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteAllReadNotificationsEndpoint: vi.fn((req: any, res: any) => res.json({ ok: true })),
  streamNotifications: vi.fn((req: any, res: any) => res.json({ ok: true }))
}));

describe('Notification Routes', () => {
  const app = createTestApp(notificationRoutes, '/api/notifications');

  it('GET /api/notifications/stream → 200', async () => {
    const res = await request(app).get('/api/notifications/stream');
    expect(res.status).toBe(200);
  });

  it('GET /api/notifications/ → 200', async () => {
    const res = await request(app).get('/api/notifications/');
    expect(res.status).toBe(200);
  });

  it('PUT /api/notifications/read → 200', async () => {
    const res = await request(app).put('/api/notifications/read').send({});
    expect(res.status).toBe(200);
  });

  it('GET /api/notifications/stats → 200', async () => {
    const res = await request(app).get('/api/notifications/stats');
    expect(res.status).toBe(200);
  });

  it('GET /api/notifications/unread-count → 200', async () => {
    const res = await request(app).get('/api/notifications/unread-count');
    expect(res.status).toBe(200);
  });

  it('DELETE /api/notifications/ → 200', async () => {
    const res = await request(app).delete('/api/notifications/').send({});
    expect(res.status).toBe(200);
  });

  it('DELETE /api/notifications/read → 200', async () => {
    const res = await request(app).delete('/api/notifications/read');
    expect(res.status).toBe(200);
  });
});
