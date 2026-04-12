import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import sessionRequestRoutes from '../../routes/sessionRequestRoutes';

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

vi.mock('../../controllers/sessionRequestController', () => ({
  createEventRequest: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getEventRequests: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getEventRequest: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getEventRequestStatistics: vi.fn((req: any, res: any) => res.json({ ok: true })),
  voteOnEventRequest: vi.fn((req: any, res: any) => res.json({ ok: true })),
  finalizeEventRequest: vi.fn((req: any, res: any) => res.json({ ok: true })),
  cancelEventRequest: vi.fn((req: any, res: any) => res.json({ ok: true }))
}));

describe('Session Request Routes', () => {
  const app = createTestApp(sessionRequestRoutes, '/api/session-requests');

  it('POST /api/session-requests/ → 200', async () => {
    const res = await request(app).post('/api/session-requests/').send({});
    expect(res.status).toBe(200);
  });

  it('GET /api/session-requests/group/:groupId → 200', async () => {
    const res = await request(app).get('/api/session-requests/group/group-1');
    expect(res.status).toBe(200);
  });

  it('GET /api/session-requests/:id → 200', async () => {
    const res = await request(app).get('/api/session-requests/request-1');
    expect(res.status).toBe(200);
  });

  it('GET /api/session-requests/:id/statistics → 200', async () => {
    const res = await request(app).get('/api/session-requests/request-1/statistics');
    expect(res.status).toBe(200);
  });

  it('POST /api/session-requests/:id/vote → 200', async () => {
    const res = await request(app).post('/api/session-requests/request-1/vote').send({ vote: 'yes' });
    expect(res.status).toBe(200);
  });

  it('POST /api/session-requests/:id/finalize → 200', async () => {
    const res = await request(app).post('/api/session-requests/request-1/finalize').send({});
    expect(res.status).toBe(200);
  });

  it('POST /api/session-requests/:id/cancel → 200', async () => {
    const res = await request(app).post('/api/session-requests/request-1/cancel').send({});
    expect(res.status).toBe(200);
  });
});
