import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import groupChatRoutes from '../../routes/groupChatRoutes';

vi.mock('../../middleware/auth', () => ({
  default: (req: any, _res: any, next: any) => { req.user = { id: 'test-user-id', email: 'test@example.com', name: 'Test User' }; next(); },
  optionalAuthMiddleware: (req: any, _res: any, next: any) => { req.user = { id: 'test-user-id' }; next(); }
}));
vi.mock('../../middleware/rateLimiter', () => ({
  authenticatedLimiter: (_: any, __: any, next: any) => next(),
  apiLimiter: (_: any, __: any, next: any) => next(),
  authLimiter: (_: any, __: any, next: any) => next(),
  groupMessageLimiter: (_: any, __: any, next: any) => next(),
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

vi.mock('../../controllers/groupChatController', () => ({
  unmarkLate: vi.fn((req: any, res: any) => res.json({ ok: true })),
  createMessage: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateMessage: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteMessage: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getMessages: vi.fn((req: any, res: any) => res.json({ ok: true })),
  markLate: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getNotifications: vi.fn((req: any, res: any) => res.json({ ok: true })),
  markNotificationsRead: vi.fn((req: any, res: any) => res.json({ ok: true }))
}));

describe('Group Chat Routes', () => {
  const app = createTestApp(groupChatRoutes, '/api');

  it('POST /api/session/unmark-late → 200', async () => {
    const res = await request(app).post('/api/session/unmark-late').send({});
    expect(res.status).toBe(200);
  });

  it('POST /api/message → 200', async () => {
    const res = await request(app).post('/api/message').send({});
    expect(res.status).toBe(200);
  });

  it('GET /api/:groupId/messages → 200', async () => {
    const res = await request(app).get('/api/group-1/messages');
    expect(res.status).toBe(200);
  });

  it('POST /api/session/late → 200', async () => {
    const res = await request(app).post('/api/session/late').send({});
    expect(res.status).toBe(200);
  });

  it('GET /api/notifications → 200', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(200);
  });
});
