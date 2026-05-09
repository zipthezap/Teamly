import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import teamUpRoutes from '../../routes/teamUpRoutes';

vi.mock('../../middleware/auth', () => ({
  default: (req: any, _res: any, next: any) => { req.user = { id: 'test-user-id', email: 'test@example.com', name: 'Test User' }; next(); },
  optionalAuthMiddleware: (req: any, _res: any, next: any) => { req.user = { id: 'test-user-id' }; next(); }
}));
vi.mock('../../middleware/rateLimiter', () => ({
  authenticatedLimiter: (_: any, __: any, next: any) => next(),
  apiLimiter: (_: any, __: any, next: any) => next(),
  authLimiter: (_: any, __: any, next: any) => next(),
  teamUpCommentLimiter: (_: any, __: any, next: any) => next(),
  teamUpCreateLimiter: (_: any, __: any, next: any) => next(),
  teamUpRespondLimiter: (_: any, __: any, next: any) => next(),
  teamUpReportLimiter: (_: any, __: any, next: any) => next(),
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

vi.mock('../../middleware/authorization', () => ({
  requireTournamentPermission: () => (_: any, __: any, next: any) => next(),
  requireTeamPermission: () => (_: any, __: any, next: any) => next(),
  requireTeamUpPermission: () => (_: any, __: any, next: any) => next()
}));

vi.mock('../../controllers/teamUpController', () => ({
  createTeamUpRequest: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getTeamUpRequests: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getNearbyTeamUpRequests: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getMyTeamUpRequests: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getMyTeamUpResponses: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getMyTeamUpAttendanceHistory: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getTeamUpRequest: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateTeamUpRequest: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteTeamUpRequest: vi.fn((req: any, res: any) => res.json({ ok: true })),
  respondToTeamUpRequest: vi.fn((req: any, res: any) => res.json({ ok: true })),
  withdrawTeamUpResponse: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateTeamUpRsvp: vi.fn((req: any, res: any) => res.json({ ok: true })),
  handleTeamUpResponse: vi.fn((req: any, res: any) => res.json({ ok: true })),
  bulkHandleTeamUpResponses: vi.fn((req: any, res: any) => res.json({ ok: true })),
  markTeamUpAttendance: vi.fn((req: any, res: any) => res.json({ ok: true })),
  sendTeamUpReminderNudges: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getTeamUpReplacementSuggestions: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getTeamUpComments: vi.fn((req: any, res: any) => res.json({ ok: true })),
  addTeamUpComment: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteTeamUpComment: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getMyTeamUpApplications: vi.fn((req: any, res: any) => res.json({ ok: true })),
  listTeamUpSavedSearches: vi.fn((req: any, res: any) => res.json({ ok: true })),
  createTeamUpSavedSearch: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteTeamUpSavedSearch: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getTeamUpAnalytics: vi.fn((req: any, res: any) => res.json({ ok: true })),
  listTeamUpModerationCases: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateTeamUpModerationCase: vi.fn((req: any, res: any) => res.json({ ok: true })),
  reportTeamUpRequest: vi.fn((req: any, res: any) => res.json({ ok: true })),
}));

describe('TeamUp Routes', () => {
  const app = createTestApp(teamUpRoutes, '/api');

  it('GET /api/ → 200', async () => {
    const res = await request(app).get('/api/');
    expect(res.status).toBe(200);
  });

  it('POST /api/ → 200', async () => {
    const res = await request(app).post('/api/').send({});
    expect(res.status).toBe(200);
  });

  it('GET /api/nearby → 200', async () => {
    const res = await request(app).get('/api/nearby');
    expect(res.status).toBe(200);
  });

  it('GET /api/my-requests → 200', async () => {
    const res = await request(app).get('/api/my-requests');
    expect(res.status).toBe(200);
  });

  it('GET /api/:id → 200', async () => {
    const res = await request(app).get('/api/teamup-1');
    expect(res.status).toBe(200);
  });

  it('PUT /api/:id → 200', async () => {
    const res = await request(app).put('/api/teamup-1').send({});
    expect(res.status).toBe(200);
  });

  it('DELETE /api/:id → 200', async () => {
    const res = await request(app).delete('/api/teamup-1');
    expect(res.status).toBe(200);
  });

  it('POST /api/:id/respond → 200', async () => {
    const res = await request(app).post('/api/teamup-1/respond').send({});
    expect(res.status).toBe(200);
  });

  it('DELETE /api/:id/respond → 200', async () => {
    const res = await request(app).delete('/api/teamup-1/respond');
    expect(res.status).toBe(200);
  });

  it('PUT /api/:id/respond/rsvp → 200', async () => {
    const res = await request(app).put('/api/teamup-1/respond/rsvp').send({});
    expect(res.status).toBe(200);
  });

  it('GET /api/my-applications → 200', async () => {
    const res = await request(app).get('/api/my-applications');
    expect(res.status).toBe(200);
  });

  it('GET /api/attendance-history → 200', async () => {
    const res = await request(app).get('/api/attendance-history');
    expect(res.status).toBe(200);
  });

  it('POST /api/saved-searches → 200', async () => {
    const res = await request(app).post('/api/saved-searches').send({});
    expect(res.status).toBe(200);
  });

  it('GET /api/analytics → 200', async () => {
    const res = await request(app).get('/api/analytics');
    expect(res.status).toBe(200);
  });

  it('POST /api/:id/responses/bulk-handle → 200', async () => {
    const res = await request(app).post('/api/teamup-1/responses/bulk-handle').send({});
    expect(res.status).toBe(200);
  });

  it('GET /api/:id/comments → 200', async () => {
    const res = await request(app).get('/api/teamup-1/comments');
    expect(res.status).toBe(200);
  });

  it('POST /api/:id/comments → 200', async () => {
    const res = await request(app).post('/api/teamup-1/comments').send({});
    expect(res.status).toBe(200);
  });

  it('POST /api/:id/report → 200', async () => {
    const res = await request(app).post('/api/teamup-1/report').send({});
    expect(res.status).toBe(200);
  });
});
