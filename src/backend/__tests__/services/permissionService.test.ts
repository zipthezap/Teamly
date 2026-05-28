import { describe, it, expect, beforeEach, vi } from 'vitest';
import prisma from '../../config/database';
import {
  hasGroupPermission,
  hasTournamentPermission,
  hasTeamUpPermission,
  hasTeamPermission,
  hasPermission,
  getUserGroupRole,
  getUserTournamentRole,
} from '../../services/permissionService';
import { Permission, GroupRole, TournamentRole } from '../../../shared/types/permissions.types';

vi.mock('../../config/database', () => ({
  default: {
    groupMember: {
      findUnique: vi.fn(),
    },
    tournament: {
      findUnique: vi.fn(),
    },
    tournamentAdminRole: {
      findFirst: vi.fn(),
    },
    tournamentTeam: {
      findFirst: vi.fn(),
    },
    tournamentPlayer: {
      findFirst: vi.fn(),
    },
    tournamentMatch: {
      findFirst: vi.fn(),
    },
    teamUpRequest: {
      findUnique: vi.fn(),
    },
    teamUpResponse: {
      findFirst: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../services/cacheService', () => ({
  CacheService: {
    wrap: vi.fn((_key: string, _ttl: number, fn: () => unknown) => fn()),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    deletePattern: vi.fn(),
  },
}));

const db = prisma as unknown as {
  groupMember: { findUnique: ReturnType<typeof vi.fn> };
  tournament: { findUnique: ReturnType<typeof vi.fn> };
  tournamentAdminRole: { findFirst: ReturnType<typeof vi.fn> };
  tournamentTeam: { findFirst: ReturnType<typeof vi.fn> };
  tournamentPlayer: { findFirst: ReturnType<typeof vi.fn> };
  tournamentMatch: { findFirst: ReturnType<typeof vi.fn> };
  teamUpRequest: { findUnique: ReturnType<typeof vi.fn> };
  teamUpResponse: { findFirst: ReturnType<typeof vi.fn> };
  session: { findUnique: ReturnType<typeof vi.fn> };
};

describe('PermissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── hasGroupPermission ────────────────────────────────────────────────────
  describe('hasGroupPermission', () => {
    it('returns true for admin with GROUP_UPDATE permission', async () => {
      db.groupMember.findUnique.mockResolvedValue({ role: GroupRole.ADMIN });
      const result = await hasGroupPermission('user-1', 'group-1', Permission.GROUP_UPDATE);
      expect(result).toBe(true);
    });

    it('returns true for moderator with EVENT_CREATE permission', async () => {
      db.groupMember.findUnique.mockResolvedValue({ role: GroupRole.MODERATOR });
      const result = await hasGroupPermission('user-1', 'group-1', Permission.EVENT_CREATE);
      expect(result).toBe(true);
    });

    it('returns true for member with GROUP_VIEW permission', async () => {
      db.groupMember.findUnique.mockResolvedValue({ role: GroupRole.MEMBER });
      const result = await hasGroupPermission('user-1', 'group-1', Permission.GROUP_VIEW);
      expect(result).toBe(true);
    });

    it('returns false for member with GROUP_DELETE permission', async () => {
      db.groupMember.findUnique.mockResolvedValue({ role: GroupRole.MEMBER });
      const result = await hasGroupPermission('user-1', 'group-1', Permission.GROUP_DELETE);
      expect(result).toBe(false);
    });

    it('returns false when user is not a member', async () => {
      db.groupMember.findUnique.mockResolvedValue(null);
      const result = await hasGroupPermission('non-member', 'group-1', Permission.GROUP_VIEW);
      expect(result).toBe(false);
    });
  });

  // ─── hasTournamentPermission ───────────────────────────────────────────────
  describe('hasTournamentPermission', () => {
    const baseTournament = { organizerId: 'organizer-1', groupId: null };

    it('returns true for organizer with TOURNAMENT_DELETE', async () => {
      db.tournament.findUnique.mockResolvedValue(baseTournament);
      const result = await hasTournamentPermission('organizer-1', 't-1', Permission.TOURNAMENT_DELETE);
      expect(result).toBe(true);
    });

    it('grants co-organizer permissions to group admin', async () => {
      db.tournament.findUnique.mockResolvedValue({ ...baseTournament, groupId: 'group-1' });
      // groupMember returns admin role for the internal checkGroupAdminDirect call
      db.groupMember.findUnique.mockResolvedValue({ role: GroupRole.ADMIN });
      const result = await hasTournamentPermission('admin-user', 't-1', Permission.TOURNAMENT_MANAGE_TEAMS);
      expect(result).toBe(true);
    });

    it('returns true for team captain with TOURNAMENT_SUBMIT_SCORES', async () => {
      db.tournament.findUnique.mockResolvedValue(baseTournament);
      db.tournamentTeam.findFirst.mockResolvedValue({ id: 'team-1' });
      const result = await hasTournamentPermission('captain-1', 't-1', Permission.TOURNAMENT_SUBMIT_SCORES);
      expect(result).toBe(true);
    });

    it('returns true for player with TOURNAMENT_VIEW', async () => {
      db.tournament.findUnique.mockResolvedValue(baseTournament);
      db.tournamentTeam.findFirst.mockResolvedValue(null); // not captain
      db.tournamentPlayer.findFirst.mockResolvedValue({ id: 'player-1' });
      const result = await hasTournamentPermission('player-1', 't-1', Permission.TOURNAMENT_VIEW);
      expect(result).toBe(true);
    });

    it('returns true for viewer with TOURNAMENT_VIEW', async () => {
      db.tournament.findUnique.mockResolvedValue(baseTournament);
      db.tournamentTeam.findFirst.mockResolvedValue(null);
      db.tournamentPlayer.findFirst.mockResolvedValue(null);
      db.tournamentMatch.findFirst.mockResolvedValue(null);
      const result = await hasTournamentPermission('viewer-1', 't-1', Permission.TOURNAMENT_VIEW);
      expect(result).toBe(true);
    });

    it('returns false when tournament not found', async () => {
      db.tournament.findUnique.mockResolvedValue(null);
      const result = await hasTournamentPermission('user-1', 'missing', Permission.TOURNAMENT_VIEW);
      expect(result).toBe(false);
    });
  });

  // ─── hasTeamUpPermission ───────────────────────────────────────────────────
  describe('hasTeamUpPermission', () => {
    it('returns true for creator with TEAMUP_DELETE', async () => {
      db.teamUpRequest.findUnique.mockResolvedValue({ creatorId: 'creator-1' });
      const result = await hasTeamUpPermission('creator-1', 'tu-1', Permission.TEAMUP_DELETE);
      expect(result).toBe(true);
    });

    it('returns true for participant with TEAMUP_COMMENT', async () => {
      db.teamUpRequest.findUnique.mockResolvedValue({ creatorId: 'creator-1' });
      db.teamUpResponse.findFirst.mockResolvedValue({ id: 'resp-1' });
      const result = await hasTeamUpPermission('participant-1', 'tu-1', Permission.TEAMUP_COMMENT);
      expect(result).toBe(true);
    });

    it('returns true for viewer with TEAMUP_VIEW', async () => {
      db.teamUpRequest.findUnique.mockResolvedValue({ creatorId: 'creator-1' });
      db.teamUpResponse.findFirst.mockResolvedValue(null);
      const result = await hasTeamUpPermission('viewer-1', 'tu-1', Permission.TEAMUP_VIEW);
      expect(result).toBe(true);
    });

    it('returns false for viewer with TEAMUP_DELETE', async () => {
      db.teamUpRequest.findUnique.mockResolvedValue({ creatorId: 'creator-1' });
      db.teamUpResponse.findFirst.mockResolvedValue(null);
      const result = await hasTeamUpPermission('viewer-1', 'tu-1', Permission.TEAMUP_DELETE);
      expect(result).toBe(false);
    });
  });

  // ─── hasTeamPermission ─────────────────────────────────────────────────────
  describe('hasTeamPermission', () => {
    const baseTeam = {
      captainUserId: 'captain-1',
      tournamentId: 't-1',
      tournament: { organizerId: 'organizer-1' },
    };

    it('returns true for organizer with TEAM_DELETE', async () => {
      db.tournamentTeam.findFirst.mockResolvedValue(null); // not captain
      // hasTeamPermission uses tournamentTeam.findUnique not findFirst
      const prismaDirect = prisma as any;
      prismaDirect.tournamentTeam.findUnique = vi.fn().mockResolvedValue(baseTeam);
      prismaDirect.tournamentPlayer = { findFirst: vi.fn().mockResolvedValue(null) };

      const result = await hasTeamPermission('organizer-1', 'team-1', Permission.TEAM_DELETE);
      expect(result).toBe(true);
    });

    it('returns true for team captain with TEAM_MANAGE_PLAYERS', async () => {
      const prismaDirect = prisma as any;
      prismaDirect.tournamentTeam.findUnique = vi.fn().mockResolvedValue(baseTeam);
      prismaDirect.tournamentPlayer = { findFirst: vi.fn().mockResolvedValue(null) };

      const result = await hasTeamPermission('captain-1', 'team-1', Permission.TEAM_MANAGE_PLAYERS);
      expect(result).toBe(true);
    });

    it('returns false when team not found', async () => {
      const prismaDirect = prisma as any;
      prismaDirect.tournamentTeam.findUnique = vi.fn().mockResolvedValue(null);

      const result = await hasTeamPermission('user-1', 'missing', Permission.TEAM_VIEW);
      expect(result).toBe(false);
    });
  });

  // ─── hasPermission router ──────────────────────────────────────────────────
  describe('hasPermission', () => {
    it('routes group context to hasGroupPermission', async () => {
      db.groupMember.findUnique.mockResolvedValue({ role: GroupRole.ADMIN });
      const result = await hasPermission({
        userId: 'user-1',
        resourceType: 'group',
        resourceId: 'group-1',
        action: Permission.GROUP_VIEW,
      });
      expect(result).toBe(true);
    });

    it('routes tournament context to hasTournamentPermission', async () => {
      db.tournament.findUnique.mockResolvedValue(null);
      const result = await hasPermission({
        userId: 'user-1',
        resourceType: 'tournament',
        resourceId: 'missing',
        action: Permission.TOURNAMENT_VIEW,
      });
      expect(result).toBe(false);
    });

    it('returns false for unknown resourceType', async () => {
      const result = await hasPermission({
        userId: 'user-1',
        resourceType: 'unknown' as any,
        resourceId: 'id',
        action: Permission.GROUP_VIEW,
      });
      expect(result).toBe(false);
    });
  });

  // ─── getUserGroupRole ──────────────────────────────────────────────────────
  describe('getUserGroupRole', () => {
    it('returns the user role when found', async () => {
      db.groupMember.findUnique.mockResolvedValue({ role: GroupRole.MODERATOR });
      const role = await getUserGroupRole('user-1', 'group-1');
      expect(role).toBe(GroupRole.MODERATOR);
    });

    it('returns null when not a member', async () => {
      db.groupMember.findUnique.mockResolvedValue(null);
      const role = await getUserGroupRole('non-member', 'group-1');
      expect(role).toBeNull();
    });
  });

  // ─── getUserTournamentRole ─────────────────────────────────────────────────
  describe('getUserTournamentRole', () => {
    it('returns ORGANIZER for the tournament organizer', async () => {
      db.tournament.findUnique.mockResolvedValue({ organizerId: 'org-1', groupId: null });
      const role = await getUserTournamentRole('org-1', 't-1');
      expect(role).toBe(TournamentRole.ORGANIZER);
    });

    it('returns TEAM_CAPTAIN for a team captain', async () => {
      db.tournament.findUnique.mockResolvedValue({ organizerId: 'org-1', groupId: null });
      db.tournamentTeam.findFirst.mockResolvedValue({ id: 'team-1' });
      const role = await getUserTournamentRole('captain-1', 't-1');
      expect(role).toBe(TournamentRole.TEAM_CAPTAIN);
    });

    it('returns PLAYER for a registered player', async () => {
      db.tournament.findUnique.mockResolvedValue({ organizerId: 'org-1', groupId: null });
      db.tournamentTeam.findFirst.mockResolvedValue(null);
      db.tournamentPlayer.findFirst.mockResolvedValue({ id: 'player-1' });
      const role = await getUserTournamentRole('player-1', 't-1');
      expect(role).toBe(TournamentRole.PLAYER);
    });

    it('returns VIEWER for an unknown user', async () => {
      db.tournament.findUnique.mockResolvedValue({ organizerId: 'org-1', groupId: null });
      db.tournamentTeam.findFirst.mockResolvedValue(null);
      db.tournamentPlayer.findFirst.mockResolvedValue(null);
      db.tournamentMatch.findFirst.mockResolvedValue(null);
      const role = await getUserTournamentRole('viewer-1', 't-1');
      expect(role).toBe(TournamentRole.VIEWER);
    });

    it('returns null when tournament not found', async () => {
      db.tournament.findUnique.mockResolvedValue(null);
      const role = await getUserTournamentRole('user-1', 'missing');
      expect(role).toBeNull();
    });
  });
});
