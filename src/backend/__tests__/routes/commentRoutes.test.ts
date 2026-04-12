import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import commentRoutes from '../../routes/commentRoutes';

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

vi.mock('../../controllers/commentController', () => ({
  createComment: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getEventComments: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateComment: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteComment: vi.fn((req: any, res: any) => res.json({ ok: true }))
}));

describe('Comment Routes', () => {
  const app = createTestApp(commentRoutes, '/api');

  it('POST /api/ → 200 (auth required)', async () => {
    const res = await request(app).post('/api/').send({ content: 'hello' });
    expect(res.status).toBe(200);
  });

  it('GET /api/session/:sessionId → 200', async () => {
    const res = await request(app).get('/api/session/session-1');
    expect(res.status).toBe(200);
  });

  it('PUT /api/:commentId → 200', async () => {
    const res = await request(app).put('/api/comment-1').send({ content: 'updated' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/:commentId → 200', async () => {
    const res = await request(app).delete('/api/comment-1');
    expect(res.status).toBe(200);
  });
});
