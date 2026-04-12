import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LeagueService } from '../../services/leagueService';
import prisma from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../utils/errors';

vi.mock('../../config/database', () => ({
  default: {
    league: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    leagueTeam: {
      create: vi.fn(),
      delete: vi.fn(),
    },
    leagueStanding: {
      create: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    leagueSessionEntry: {
      create: vi.fn(),
    },
    leagueMatch: {
      update: vi.fn(),
    },
  },
}));

const prismaMock = prisma as unknown as {
  league: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  leagueTeam: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  leagueStanding: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  leagueSessionEntry: { create: ReturnType<typeof vi.fn> };
  leagueMatch: { update: ReturnType<typeof vi.fn> };
};

const service = new LeagueService();

const baseLeague = {
  id: 'league-1',
  title: 'Test League',
  description: null,
  sport: 'soccer',
  groupId: 'group-1',
  creatorId: 'user-1',
  status: 'upcoming',
  startDate: new Date('2025-01-01'),
  endDate: null,
  isPublic: true,
  maxTeams: 8,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('LeagueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── createLeague ──────────────────────────────────────────────────────────
  describe('createLeague', () => {
    it('creates a league and returns it with relations', async () => {
      const expected = { ...baseLeague, creator: { id: 'user-1', name: 'Alice' }, group: { id: 'group-1', name: 'FC Test' } };
      prismaMock.league.create.mockResolvedValue(expected);

      const result = await service.createLeague(
        { title: 'Test League', sport: 'soccer', groupId: 'group-1', startDate: new Date('2025-01-01') },
        'user-1'
      );

      expect(prismaMock.league.create).toHaveBeenCalledOnce();
      expect(result).toEqual(expected);
    });
  });

  // ─── getLeagues ────────────────────────────────────────────────────────────
  describe('getLeagues', () => {
    it('returns paginated leagues with defaults', async () => {
      prismaMock.league.findMany.mockResolvedValue([baseLeague]);
      prismaMock.league.count.mockResolvedValue(1);

      const result = await service.getLeagues({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.total).toBe(1);
      expect(result.leagues).toHaveLength(1);
    });

    it('applies groupId and status filters', async () => {
      prismaMock.league.findMany.mockResolvedValue([]);
      prismaMock.league.count.mockResolvedValue(0);

      await service.getLeagues({ groupId: 'group-1', status: 'active', page: 2, limit: 5 });

      const findManyCall = prismaMock.league.findMany.mock.calls[0][0];
      expect(findManyCall.where).toMatchObject({ groupId: 'group-1', status: 'active' });
      expect(findManyCall.skip).toBe(5);
      expect(findManyCall.take).toBe(5);
    });

    it('caps limit at MAX_LEAGUE_LIMIT (100)', async () => {
      prismaMock.league.findMany.mockResolvedValue([]);
      prismaMock.league.count.mockResolvedValue(0);

      const result = await service.getLeagues({ limit: 999 });
      expect(result.limit).toBe(100);
    });
  });

  // ─── getLeagueById ─────────────────────────────────────────────────────────
  describe('getLeagueById', () => {
    it('returns the league when found', async () => {
      prismaMock.league.findUnique.mockResolvedValue(baseLeague);
      const result = await service.getLeagueById('league-1');
      expect(result).toEqual(baseLeague);
    });

    it('throws NotFoundError when not found', async () => {
      prismaMock.league.findUnique.mockResolvedValue(null);
      await expect(service.getLeagueById('missing')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── updateLeague ──────────────────────────────────────────────────────────
  describe('updateLeague', () => {
    it('updates a league successfully', async () => {
      const updated = { ...baseLeague, title: 'Updated League' };
      prismaMock.league.findUnique.mockResolvedValue(baseLeague);
      prismaMock.league.update.mockResolvedValue(updated);

      const result = await service.updateLeague('league-1', { title: 'Updated League' }, 'user-1');
      expect(result).toEqual(updated);
    });

    it('throws NotFoundError when league missing', async () => {
      prismaMock.league.findUnique.mockResolvedValue(null);
      await expect(service.updateLeague('missing', {}, 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when not the creator', async () => {
      prismaMock.league.findUnique.mockResolvedValue(baseLeague);
      await expect(service.updateLeague('league-1', {}, 'other-user')).rejects.toThrow(ForbiddenError);
    });
  });

  // ─── deleteLeague ──────────────────────────────────────────────────────────
  describe('deleteLeague', () => {
    it('deletes a league successfully', async () => {
      prismaMock.league.findUnique.mockResolvedValue(baseLeague);
      prismaMock.league.delete.mockResolvedValue(baseLeague);

      await service.deleteLeague('league-1', 'user-1');
      expect(prismaMock.league.delete).toHaveBeenCalledWith({ where: { id: 'league-1' } });
    });

    it('throws NotFoundError when league missing', async () => {
      prismaMock.league.findUnique.mockResolvedValue(null);
      await expect(service.deleteLeague('missing', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when not the creator', async () => {
      prismaMock.league.findUnique.mockResolvedValue(baseLeague);
      await expect(service.deleteLeague('league-1', 'other-user')).rejects.toThrow(ForbiddenError);
    });
  });

  // ─── addTeam ───────────────────────────────────────────────────────────────
  describe('addTeam', () => {
    it('creates a team and a standing entry', async () => {
      const team = { id: 'team-1', name: 'FC Alpha', leagueId: 'league-1', captainUserId: null };
      prismaMock.league.findUnique.mockResolvedValue(baseLeague);
      prismaMock.leagueTeam.create.mockResolvedValue(team);
      prismaMock.leagueStanding.create.mockResolvedValue({});

      const result = await service.addTeam('league-1', { name: 'FC Alpha' }, 'user-1');
      expect(result).toEqual(team);
      expect(prismaMock.leagueStanding.create).toHaveBeenCalledOnce();
    });

    it('throws NotFoundError when league missing', async () => {
      prismaMock.league.findUnique.mockResolvedValue(null);
      await expect(service.addTeam('missing', { name: 'Team' }, 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when not the creator', async () => {
      prismaMock.league.findUnique.mockResolvedValue(baseLeague);
      await expect(service.addTeam('league-1', { name: 'Team' }, 'other-user')).rejects.toThrow(ForbiddenError);
    });
  });

  // ─── removeTeam ────────────────────────────────────────────────────────────
  describe('removeTeam', () => {
    it('deletes the team', async () => {
      prismaMock.league.findUnique.mockResolvedValue(baseLeague);
      prismaMock.leagueTeam.delete.mockResolvedValue({});

      await service.removeTeam('league-1', 'team-1', 'user-1');
      expect(prismaMock.leagueTeam.delete).toHaveBeenCalledWith({ where: { id: 'team-1' } });
    });

    it('throws NotFoundError when league missing', async () => {
      prismaMock.league.findUnique.mockResolvedValue(null);
      await expect(service.removeTeam('missing', 'team-1', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when not the creator', async () => {
      prismaMock.league.findUnique.mockResolvedValue(baseLeague);
      await expect(service.removeTeam('league-1', 'team-1', 'other-user')).rejects.toThrow(ForbiddenError);
    });
  });

  // ─── getStandings ──────────────────────────────────────────────────────────
  describe('getStandings', () => {
    it('returns standings ordered by points', async () => {
      const standings = [
        { id: 's1', leagueId: 'league-1', teamId: 'team-1', points: 9 },
        { id: 's2', leagueId: 'league-1', teamId: 'team-2', points: 3 },
      ];
      prismaMock.leagueStanding.findMany.mockResolvedValue(standings);

      const result = await service.getStandings('league-1');
      expect(result).toEqual(standings);
      const call = prismaMock.leagueStanding.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual([{ points: 'desc' }, { goalsFor: 'desc' }]);
    });
  });

  // ─── linkSession ───────────────────────────────────────────────────────────
  describe('linkSession', () => {
    it('creates a session entry successfully', async () => {
      const entry = { id: 'entry-1', leagueId: 'league-1', sessionId: 'session-1', roundNumber: 1 };
      prismaMock.league.findUnique.mockResolvedValue(baseLeague);
      prismaMock.leagueSessionEntry.create.mockResolvedValue(entry);

      const result = await service.linkSession('league-1', 'session-1', 1, 'user-1');
      expect(result).toEqual(entry);
    });

    it('throws NotFoundError when league missing', async () => {
      prismaMock.league.findUnique.mockResolvedValue(null);
      await expect(service.linkSession('missing', 'session-1', 1, 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when not the creator', async () => {
      prismaMock.league.findUnique.mockResolvedValue(baseLeague);
      await expect(service.linkSession('league-1', 'session-1', 1, 'other-user')).rejects.toThrow(ForbiddenError);
    });
  });

  // ─── updateMatch ───────────────────────────────────────────────────────────
  describe('updateMatch', () => {
    const matchBase = {
      id: 'match-1',
      leagueId: 'league-1',
      homeTeamId: 'team-home',
      awayTeamId: 'team-away',
      homeScore: 0,
      awayScore: 0,
      status: 'completed',
    };

    it('updates standings correctly for a home win', async () => {
      const match = { ...matchBase, homeScore: 3, awayScore: 1 };
      prismaMock.league.findUnique.mockResolvedValue(baseLeague);
      prismaMock.leagueMatch.update.mockResolvedValue(match);
      prismaMock.leagueStanding.upsert.mockResolvedValue({});

      await service.updateMatch('league-1', 'match-1', { homeScore: 3, awayScore: 1 }, 'user-1');

      expect(prismaMock.leagueStanding.upsert).toHaveBeenCalledTimes(2);
      const homeUpsert = prismaMock.leagueStanding.upsert.mock.calls[0][0];
      expect(homeUpsert.create.points).toBe(3); // home won → 3 pts
      const awayUpsert = prismaMock.leagueStanding.upsert.mock.calls[1][0];
      expect(awayUpsert.create.points).toBe(0); // away lost → 0 pts
    });

    it('updates standings correctly for a draw', async () => {
      const match = { ...matchBase, homeScore: 1, awayScore: 1 };
      prismaMock.league.findUnique.mockResolvedValue(baseLeague);
      prismaMock.leagueMatch.update.mockResolvedValue(match);
      prismaMock.leagueStanding.upsert.mockResolvedValue({});

      await service.updateMatch('league-1', 'match-1', { homeScore: 1, awayScore: 1 }, 'user-1');

      const homeUpsert = prismaMock.leagueStanding.upsert.mock.calls[0][0];
      expect(homeUpsert.create.points).toBe(1); // draw → 1 pt
      const awayUpsert = prismaMock.leagueStanding.upsert.mock.calls[1][0];
      expect(awayUpsert.create.points).toBe(1);
    });

    it('updates standings correctly for an away win', async () => {
      const match = { ...matchBase, homeScore: 0, awayScore: 2 };
      prismaMock.league.findUnique.mockResolvedValue(baseLeague);
      prismaMock.leagueMatch.update.mockResolvedValue(match);
      prismaMock.leagueStanding.upsert.mockResolvedValue({});

      await service.updateMatch('league-1', 'match-1', { homeScore: 0, awayScore: 2 }, 'user-1');

      const homeUpsert = prismaMock.leagueStanding.upsert.mock.calls[0][0];
      expect(homeUpsert.create.points).toBe(0);
      const awayUpsert = prismaMock.leagueStanding.upsert.mock.calls[1][0];
      expect(awayUpsert.create.points).toBe(3);
    });

    it('throws NotFoundError when league missing', async () => {
      prismaMock.league.findUnique.mockResolvedValue(null);
      await expect(
        service.updateMatch('missing', 'match-1', { homeScore: 1, awayScore: 0 }, 'user-1')
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when not the creator', async () => {
      prismaMock.league.findUnique.mockResolvedValue(baseLeague);
      await expect(
        service.updateMatch('league-1', 'match-1', { homeScore: 1, awayScore: 0 }, 'other-user')
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
