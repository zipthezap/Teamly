import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createAuthenticatedTestApp } from '../helpers/testApp';

// Mock auth and rate limiting middleware used by the router
vi.mock('../../middleware/auth', () => ({
  default: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/rateLimiter', () => ({
  authenticatedLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../services/leagueService', () => ({
  leagueService: {
    createLeague: vi.fn(),
    getLeagues: vi.fn(),
    getLeagueById: vi.fn(),
    updateLeague: vi.fn(),
    deleteLeague: vi.fn(),
    addTeam: vi.fn(),
    removeTeam: vi.fn(),
    getStandings: vi.fn(),
    linkSession: vi.fn(),
    updateMatch: vi.fn(),
  },
}));

import { leagueService } from '../../services/leagueService';
import leagueRoutes from '../../routes/leagueRoutes';
import { NotFoundError, ForbiddenError } from '../../utils/errors';

const app = createAuthenticatedTestApp(leagueRoutes, 'test-user-id', '/api/leagues');

const mockLeague = {
  id: 'league-1',
  title: 'Test League',
  description: 'Desc',
  sport: 'soccer',
  groupId: 'group-1',
  creatorId: 'test-user-id',
  status: 'upcoming',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-06-30'),
  isPublic: true,
  maxTeams: 8,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('League Controller', () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── POST /api/leagues ───────────────────────────────────────────────────

  describe('POST /api/leagues', () => {
    it('returns 201 with the created league', async () => {
      vi.mocked(leagueService.createLeague).mockResolvedValue(mockLeague as any);

      const res = await request(app)
        .post('/api/leagues')
        .send({ title: 'Test League', sport: 'soccer', groupId: 'group-1', startDate: '2025-01-01' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 'league-1', title: 'Test League' });
    });
  });

  // ─── GET /api/leagues ────────────────────────────────────────────────────

  describe('GET /api/leagues', () => {
    it('returns 200 with paginated results', async () => {
      const paginatedResult = { leagues: [mockLeague], total: 1, page: 1, limit: 20 };
      vi.mocked(leagueService.getLeagues).mockResolvedValue(paginatedResult as any);

      const res = await request(app).get('/api/leagues');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 1 });
    });
  });

  // ─── GET /api/leagues/:id ────────────────────────────────────────────────

  describe('GET /api/leagues/:id', () => {
    it('returns 200 with the league', async () => {
      vi.mocked(leagueService.getLeagueById).mockResolvedValue(mockLeague as any);

      const res = await request(app).get('/api/leagues/league-1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 'league-1' });
    });

    it('returns 404 when league is not found', async () => {
      vi.mocked(leagueService.getLeagueById).mockRejectedValue(new NotFoundError('League not found'));

      const res = await request(app).get('/api/leagues/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  // ─── PUT /api/leagues/:id ────────────────────────────────────────────────

  describe('PUT /api/leagues/:id', () => {
    it('returns 200 with updated league', async () => {
      const updated = { ...mockLeague, title: 'Updated' };
      vi.mocked(leagueService.updateLeague).mockResolvedValue(updated as any);

      const res = await request(app)
        .put('/api/leagues/league-1')
        .send({ title: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ title: 'Updated' });
    });

    it('returns 403 when user is forbidden', async () => {
      vi.mocked(leagueService.updateLeague).mockRejectedValue(new ForbiddenError('Forbidden'));

      const res = await request(app)
        .put('/api/leagues/league-1')
        .send({ title: 'Updated' });

      expect(res.status).toBe(403);
    });
  });

  // ─── DELETE /api/leagues/:id ─────────────────────────────────────────────

  describe('DELETE /api/leagues/:id', () => {
    it('returns 200 with success message', async () => {
      vi.mocked(leagueService.deleteLeague).mockResolvedValue(undefined as any);

      const res = await request(app).delete('/api/leagues/league-1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'League deleted successfully' });
    });
  });

  // ─── POST /api/leagues/:id/teams ─────────────────────────────────────────

  describe('POST /api/leagues/:id/teams', () => {
    it('returns 201 with the added team', async () => {
      const team = { id: 'team-1', name: 'Team Alpha', leagueId: 'league-1' };
      vi.mocked(leagueService.addTeam).mockResolvedValue(team as any);

      const res = await request(app)
        .post('/api/leagues/league-1/teams')
        .send({ name: 'Team Alpha' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 'team-1' });
    });
  });

  // ─── DELETE /api/leagues/:id/teams/:teamId ───────────────────────────────

  describe('DELETE /api/leagues/:id/teams/:teamId', () => {
    it('returns 200 with success message', async () => {
      vi.mocked(leagueService.removeTeam).mockResolvedValue(undefined as any);

      const res = await request(app).delete('/api/leagues/league-1/teams/team-1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'Team removed successfully' });
    });
  });

  // ─── GET /api/leagues/:id/standings ─────────────────────────────────────

  describe('GET /api/leagues/:id/standings', () => {
    it('returns 200 with standings', async () => {
      const standings = [{ teamId: 'team-1', points: 9 }];
      vi.mocked(leagueService.getStandings).mockResolvedValue(standings as any);

      const res = await request(app).get('/api/leagues/league-1/standings');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── POST /api/leagues/:id/sessions ─────────────────────────────────────

  describe('POST /api/leagues/:id/sessions', () => {
    it('returns 201 with the linked session entry', async () => {
      const entry = { id: 'entry-1', leagueId: 'league-1', sessionId: 'session-1' };
      vi.mocked(leagueService.linkSession).mockResolvedValue(entry as any);

      const res = await request(app)
        .post('/api/leagues/league-1/sessions')
        .send({ sessionId: 'session-1', roundNumber: 1 });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 'entry-1' });
    });
  });

  // ─── PUT /api/leagues/:id/matches/:matchId ───────────────────────────────

  describe('PUT /api/leagues/:id/matches/:matchId', () => {
    it('returns 200 with updated match', async () => {
      const match = { id: 'match-1', homeScore: 2, awayScore: 1 };
      vi.mocked(leagueService.updateMatch).mockResolvedValue(match as any);

      const res = await request(app)
        .put('/api/leagues/league-1/matches/match-1')
        .send({ homeScore: 2, awayScore: 1 });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 'match-1' });
    });
  });
});
