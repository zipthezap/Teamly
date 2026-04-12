import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import sessionRoutes from '../../routes/sessionRoutes';

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

vi.mock('../../controllers/sessionController', () => ({
  createEvent: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getEvents: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getEvent: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateEvent: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteEvent: vi.fn((req: any, res: any) => res.json({ ok: true })),
  joinEvent: vi.fn((req: any, res: any) => res.json({ ok: true })),
  leaveEvent: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getEventByInviteToken: vi.fn((req: any, res: any) => res.json({ ok: true })),
  joinEventAsGuest: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getNearbyEvents: vi.fn((req: any, res: any) => res.json({ ok: true })),
  exportEvents: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getUserStatistics: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getEventParticipantsByStatus: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getGuestParticipants: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getEventActivityFeed: vi.fn((req: any, res: any) => res.json({ ok: true })),
  generateInviteToken: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateParticipationStatus: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateSessionStatus: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateGuestParticipant: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateGuestParticipantStatus: vi.fn((req: any, res: any) => res.json({ ok: true })),
  removeGuestParticipant: vi.fn((req: any, res: any) => res.json({ ok: true })),
  archiveEvent: vi.fn((req: any, res: any) => res.json({ ok: true })),
  unarchiveEvent: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getRecurringEventInstances: vi.fn((req: any, res: any) => res.json({ ok: true })),
  addRecurringEventException: vi.fn((req: any, res: any) => res.json({ ok: true })),
  removeRecurringEventException: vi.fn((req: any, res: any) => res.json({ ok: true })),
  inviteToEvent: vi.fn((req: any, res: any) => res.json({ ok: true })),
  revokeEventInvitation: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getEventInviteAnalytics: vi.fn((req: any, res: any) => res.json({ ok: true })),
  generateEventInviteToken: vi.fn((req: any, res: any) => res.json({ ok: true }))
}));

vi.mock('../../controllers/reminderController', () => ({
  createReminder: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getEventReminders: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getUserReminders: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateReminder: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteReminder: vi.fn((req: any, res: any) => res.json({ ok: true }))
}));

vi.mock('../../controllers/attendanceController', () => ({
  markAttendance: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getEventAttendance: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getAttendanceStats: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteAttendance: vi.fn((req: any, res: any) => res.json({ ok: true }))
}));

describe('Session Routes', () => {
  const app = createTestApp(sessionRoutes, '/api');

  it('GET /api/ → 200 when authenticated', async () => {
    const res = await request(app).get('/api/');
    expect(res.status).toBe(200);
  });

  it('POST /api/ → 200 when authenticated', async () => {
    const res = await request(app).post('/api/').send({});
    expect(res.status).toBe(200);
  });

  it('GET /api/:id → 200', async () => {
    const res = await request(app).get('/api/session-1');
    expect(res.status).toBe(200);
  });

  it('PUT /api/:id → 200', async () => {
    const res = await request(app).put('/api/session-1').send({});
    expect(res.status).toBe(200);
  });

  it('DELETE /api/:id → 200', async () => {
    const res = await request(app).delete('/api/session-1');
    expect(res.status).toBe(200);
  });

  it('POST /api/:id/join → 200', async () => {
    const res = await request(app).post('/api/session-1/join').send({});
    expect(res.status).toBe(200);
  });

  it('GET /api/invite/:token → 200 (public, no auth needed)', async () => {
    const res = await request(app).get('/api/invite/some-token');
    expect(res.status).toBe(200);
  });
});
