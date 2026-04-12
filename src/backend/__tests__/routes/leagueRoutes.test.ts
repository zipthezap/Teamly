import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import leagueRoutes from '../../routes/leagueRoutes';

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

vi.mock('../../controllers/leagueController', () => ({
  createLeague: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getLeagues: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getLeagueById: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateLeague: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteLeague: vi.fn((req: any, res: any) => res.json({ ok: true })),
  addTeam: vi.fn((req: any, res: any) => res.json({ ok: true })),
  removeTeam: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getStandings: vi.fn((req: any, res: any) => res.json({ ok: true })),
  linkSession: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateMatch: vi.fn((req: any, res: any) => res.json({ ok: true }))
}));

describe('League Routes', () => {
  const app = createTestApp(leagueRoutes, '/api');

  it('GET /api/ → 200', async () => {
    const res = await request(app).get('/api/');
    expect(res.status).toBe(200);
  });

  it('POST /api/ → 200', async () => {
    const res = await request(app).post('/api/').send({});
    expect(res.status).toBe(200);
  });

  it('GET /api/:id → 200', async () => {
    const res = await request(app).get('/api/league-1');
    expect(res.status).toBe(200);
  });

  it('PUT /api/:id → 200', async () => {
    const res = await request(app).put('/api/league-1').send({});
    expect(res.status).toBe(200);
  });

  it('DELETE /api/:id → 200', async () => {
    const res = await request(app).delete('/api/league-1');
    expect(res.status).toBe(200);
  });

  it('POST /api/:id/teams → 200', async () => {
    const res = await request(app).post('/api/league-1/teams').send({});
    expect(res.status).toBe(200);
  });

  it('DELETE /api/:id/teams/:teamId → 200', async () => {
    const res = await request(app).delete('/api/league-1/teams/team-1');
    expect(res.status).toBe(200);
  });

  it('GET /api/:id/standings → 200', async () => {
    const res = await request(app).get('/api/league-1/standings');
    expect(res.status).toBe(200);
  });

  it('POST /api/:id/sessions → 200', async () => {
    const res = await request(app).post('/api/league-1/sessions').send({});
    expect(res.status).toBe(200);
  });

  it('PUT /api/:id/matches/:matchId → 200', async () => {
    const res = await request(app).put('/api/league-1/matches/match-1').send({});
    expect(res.status).toBe(200);
  });
});
