import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import { Permission } from '../../../shared/types/permissions.types';
import tournamentRoutes from '../../routes/tournamentRoutes';
import * as tournamentController from '../../controllers/tournamentController';

const routeSecurityMocks = vi.hoisted(() => ({
  authenticatedLimiter: vi.fn((_: any, __: any, next: any) => next()),
  requireTournamentPermission: vi.fn(() => (_: any, __: any, next: any) => next()),
  requireTeamPermission: vi.fn(() => (_: any, __: any, next: any) => next()),
}));

vi.mock('../../middleware/auth', () => ({
  default: (req: any, _res: any, next: any) => { req.user = { id: 'test-user-id', email: 'test@example.com', name: 'Test User' }; next(); },
  optionalAuthMiddleware: (req: any, _res: any, next: any) => { req.user = { id: 'test-user-id' }; next(); }
}));
vi.mock('../../middleware/rateLimiter', () => ({
  authenticatedLimiter: routeSecurityMocks.authenticatedLimiter,
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

vi.mock('../../middleware/authorization', () => ({
  requireTournamentPermission: routeSecurityMocks.requireTournamentPermission,
  requireTeamPermission: routeSecurityMocks.requireTeamPermission,
  requireTeamUpPermission: () => (_: any, __: any, next: any) => next()
}));

vi.mock('../../controllers/tournamentController', () => ({
  createTournament: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getTournaments: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getTournament: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getTournamentMatches: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateTournament: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteTournament: vi.fn((req: any, res: any) => res.json({ ok: true })),
  cancelTournament: vi.fn((req: any, res: any) => res.json({ ok: true })),
  addTeam: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateTeam: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteTeam: vi.fn((req: any, res: any) => res.json({ ok: true })),
  assignTeamToPool: vi.fn((req: any, res: any) => res.json({ ok: true })),
  moveTeamToPool: vi.fn((req: any, res: any) => res.json({ ok: true })),
  addPlayer: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getPlayers: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updatePlayer: vi.fn((req: any, res: any) => res.json({ ok: true })),
  removePlayer: vi.fn((req: any, res: any) => res.json({ ok: true })),
  sendTeamInvitation: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getTeamInvitations: vi.fn((req: any, res: any) => res.json({ ok: true })),
  cancelTeamInvitation: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getUserInvitations: vi.fn((req: any, res: any) => res.json({ ok: true })),
  acceptTeamInvitation: vi.fn((req: any, res: any) => res.json({ ok: true })),
  declineTeamInvitation: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getInvitationByToken: vi.fn((req: any, res: any) => res.json({ ok: true })),
  generateGroupMatches: vi.fn((req: any, res: any) => res.json({ ok: true })),
  generateBrackets: vi.fn((req: any, res: any) => res.json({ ok: true })),
  submitScore: vi.fn((req: any, res: any) => res.json({ ok: true })),
  adminUpdateScore: vi.fn((req: any, res: any) => res.json({ ok: true })),
  createMatch: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateMatch: vi.fn((req: any, res: any) => res.json({ ok: true })),
  cancelMatch: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteMatch: vi.fn((req: any, res: any) => res.json({ ok: true })),
  assignReferee: vi.fn((req: any, res: any) => res.json({ ok: true })),
  autoAssignReferees: vi.fn((req: any, res: any) => res.json({ assigned: 0, matches: [] })),
  getRefereeDuties: vi.fn((req: any, res: any) => res.json([])),
  getStandings: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getPools: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getPoolDetails: vi.fn((req: any, res: any) => res.json({ ok: true })),
  createPool: vi.fn((req: any, res: any) => res.json({ ok: true })),
  registerTeamToPool: vi.fn((req: any, res: any) => res.json({ ok: true })),
  adminMoveTeamToPool: vi.fn((req: any, res: any) => res.json({ ok: true })),
  removeTeamFromPool: vi.fn((req: any, res: any) => res.json({ ok: true })),
  removeTeamFromWaitlist: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updatePool: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deletePool: vi.fn((req: any, res: any) => res.json({ ok: true })),
  selfRegisterTeam: vi.fn((req: any, res: any) => res.json({ ok: true })),
  selfUnregisterTeam: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getCategories: vi.fn((req: any, res: any) => res.json({ ok: true })),
  createCategory: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateCategory: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteCategory: vi.fn((req: any, res: any) => res.json({ ok: true })),
  assignPoolToCategory: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getAdmins: vi.fn((req: any, res: any) => res.json({ ok: true })),
  addAdmin: vi.fn((req: any, res: any) => res.json({ ok: true })),
  removeAdmin: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateTeamPayment: vi.fn((req: any, res: any) => res.json({ ok: true })),
  batchUpdateTeamPayments: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getTeamPaymentTransactions: vi.fn((req: any, res: any) => res.json({ ok: true })),
  createTeamPaymentIntent: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updatePaymentTransactionStatus: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getPublicTournaments: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getInvitationDetails: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getTournamentNotifications: vi.fn((req: any, res: any) => res.json({ ok: true })),
  checkInTeam: vi.fn((req: any, res: any) => res.json({ ok: true })),
  acceptTeamWaiver: vi.fn((req: any, res: any) => res.json({ ok: true })),
  generateCheckInQrToken: vi.fn((req: any, res: any) => res.json({ ok: true })),
  checkInViaQrToken: vi.fn((req: any, res: any) => res.json({ ok: true })),
  assignMatchScorekeeper: vi.fn((req: any, res: any) => res.json({ ok: true })),
  startMatch: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getMatchIncidents: vi.fn((req: any, res: any) => res.json({ ok: true })),
  createMatchIncident: vi.fn((req: any, res: any) => res.json({ ok: true })),
  resolveMatchIncident: vi.fn((req: any, res: any) => res.json({ ok: true })),
  generateShareToken: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getPublicTournamentPortal: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getTournamentAnalytics: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getCourts: vi.fn((req: any, res: any) => res.json({ ok: true })),
  createCourt: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateCourt: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteCourt: vi.fn((req: any, res: any) => res.json({ ok: true })),
  createCourtAvailability: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteCourtAvailability: vi.fn((req: any, res: any) => res.json({ ok: true })),
  scheduleMatchOnCourt: vi.fn((req: any, res: any) => res.json({ ok: true })),
  bulkShiftScheduledMatches: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getRegistrationWaitlist: vi.fn((req: any, res: any) => res.json({ ok: true })),
  joinRegistrationWaitlist: vi.fn((req: any, res: any) => res.json({ ok: true })),
  leaveRegistrationWaitlist: vi.fn((req: any, res: any) => res.json({ ok: true })),
  promoteFromRegistrationWaitlist: vi.fn((req: any, res: any) => res.json({ ok: true })),
  createScoreDispute: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getMatchDisputes: vi.fn((req: any, res: any) => res.json({ ok: true })),
  resolveScoreDispute: vi.fn((req: any, res: any) => res.json({ ok: true })),
  createAnnouncement: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getAnnouncements: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getRegistrationFields: vi.fn((req: any, res: any) => res.json({ ok: true })),
  createRegistrationField: vi.fn((req: any, res: any) => res.json({ ok: true })),
  updateRegistrationField: vi.fn((req: any, res: any) => res.json({ ok: true })),
  deleteRegistrationField: vi.fn((req: any, res: any) => res.json({ ok: true })),
  submitTeamAnswers: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getTeamAnswers: vi.fn((req: any, res: any) => res.json({ ok: true })),
  getPlayerStats: vi.fn((req: any, res: any) => res.json({ ok: true })),
  upsertPlayerStat: vi.fn((req: any, res: any) => res.json({ ok: true })),
  cloneTournament: vi.fn((req: any, res: any) => res.json({ ok: true })),
}));

describe('Tournament Routes', () => {
  const app = createTestApp(tournamentRoutes, '/api');

  it('GET /api/ → 200', async () => {
    const res = await request(app).get('/api/');
    expect(res.status).toBe(200);
  });

  it('POST /api/ → 200', async () => {
    const res = await request(app).post('/api/').send({});
    expect(res.status).toBe(200);
  });

  it('GET /api/:id → 200', async () => {
    const res = await request(app).get('/api/tournament-1');
    expect(res.status).toBe(200);
  });

  it('GET /api/:id/matches → 200', async () => {
    const res = await request(app).get('/api/tournament-1/matches');
    expect(res.status).toBe(200);
  });

  it('PUT /api/:id → 200 (permission middleware mocked to pass)', async () => {
    const res = await request(app).put('/api/tournament-1').send({});
    expect(res.status).toBe(200);
  });

  it('DELETE /api/:id → 200', async () => {
    const res = await request(app).delete('/api/tournament-1');
    expect(res.status).toBe(200);
  });

  it('POST /api/:id/teams → 200', async () => {
    const res = await request(app).post('/api/tournament-1/teams').send({});
    expect(res.status).toBe(200);
  });

  it('DELETE /api/:id/teams/self-register → 200', async () => {
    const res = await request(app).delete('/api/tournament-1/teams/self-register');
    expect(res.status).toBe(200);
  });

  it('PUT /api/:id/teams/payment/batch → 200', async () => {
    const res = await request(app)
      .put('/api/tournament-1/teams/payment/batch')
      .send({ teamIds: ['team-1'], paymentStatus: 'paid' });
    expect(res.status).toBe(200);
  });

  it('POST /api/:id/matches/:matchId/cancel → 200', async () => {
    const res = await request(app).post('/api/tournament-1/matches/match-1/cancel').send({});
    expect(res.status).toBe(200);
  });

  it('PUT /api/:id/courts/:courtId → 200', async () => {
    const res = await request(app).put('/api/tournament-1/courts/court-1').send({ name: 'Court 1' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/:id/courts/:courtId → 200', async () => {
    const res = await request(app).delete('/api/tournament-1/courts/court-1');
    expect(res.status).toBe(200);
  });

  it('DELETE /api/:id/courts/:courtId/availability/:availabilityId → 200', async () => {
    const res = await request(app).delete('/api/tournament-1/courts/court-1/availability/availability-1');
    expect(res.status).toBe(200);
  });

  it('PUT /api/:id/status → 404 (removed endpoint)', async () => {
    const res = await request(app).put('/api/tournament-1/status').send({ status: 'registration' });
    expect(res.status).toBe(404);
  });

  it('POST /api/:id/generate-brackets → 200', async () => {
    const res = await request(app).post('/api/tournament-1/generate-brackets').send({});
    expect(res.status).toBe(200);
  });

  it('GET /api/:id/standings → 200', async () => {
    const res = await request(app).get('/api/tournament-1/standings');
    expect(res.status).toBe(200);
  });

  it('wires high-risk endpoints to tournament permission middleware', async () => {
    expect(routeSecurityMocks.requireTournamentPermission).toHaveBeenCalledWith(Permission.TOURNAMENT_MANAGE_TEAMS);
    expect(routeSecurityMocks.requireTournamentPermission).toHaveBeenCalledWith(Permission.TOURNAMENT_MANAGE_BRACKETS);
    expect(routeSecurityMocks.requireTournamentPermission).toHaveBeenCalledWith(Permission.TOURNAMENT_MANAGE_MATCHES);
    expect(routeSecurityMocks.requireTournamentPermission).toHaveBeenCalledWith(Permission.TOURNAMENT_SUBMIT_SCORES);
    // Newly wired endpoints
    expect(routeSecurityMocks.requireTournamentPermission).toHaveBeenCalledWith(Permission.TOURNAMENT_UPDATE);
    expect(routeSecurityMocks.requireTournamentPermission).toHaveBeenCalledWith(Permission.TOURNAMENT_VIEW_ADMIN_PANEL);
  });

  it('wires team-scoped endpoints to team permission middleware', async () => {
    expect(routeSecurityMocks.requireTeamPermission).toHaveBeenCalledWith(Permission.TEAM_UPDATE);
    expect(routeSecurityMocks.requireTeamPermission).toHaveBeenCalledWith(Permission.TEAM_MANAGE_PLAYERS);
  });

  it('applies authenticated limiter to protected routes', async () => {
    routeSecurityMocks.authenticatedLimiter.mockClear();
    await request(app).post('/api/tournament-1/generate-brackets').send({});
    expect(routeSecurityMocks.authenticatedLimiter).toHaveBeenCalled();
  });

  it('POST /api/:id/pools/:poolId/admin/teams/:teamId/move/:targetPoolId → 404 (removed deprecated endpoint)', async () => {
    const res = await request(app)
      .post('/api/tournament-1/pools/pool-a/admin/teams/team-1/move/pool-b')
      .send({ keep: 'value' });

    expect(res.status).toBe(404);
  });

  it('POST /api/:id/registration-waitlist/:teamId/promote → 200', async () => {
    const res = await request(app)
      .post('/api/tournament-1/registration-waitlist/team-1/promote')
      .send({});
    expect(res.status).toBe(200);
  });

  it('DELETE /api/:id/registration-waitlist/me → 200', async () => {
    const res = await request(app).delete('/api/tournament-1/registration-waitlist/me');
    expect(res.status).toBe(200);
  });
});
