/**
 * Tournament Service Tests
 * Tests for tournament management business logic
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  calculateVolleyballWinner,
  sanitizeTournamentData,
  validateTournamentDates,
  validateTournamentEnums,
  validateTournamentBusinessRules,
  validateRegistrationEligibility,
  computeAutoStatus,
  isOrganizer,
  isOrganizerOrAdmin,
  isTeamCaptain,
  isRegisteredPlayer,
  canSubmitScore,
  revertStandings,
  updateStandings,
  canManageTeamInvitations,
  acceptTeamInvitation,
  expireOldInvitations,
  generateSingleEliminationBrackets,
  generateRandomizedSingleEliminationBracketsFromPools,
  generateRoundRobinBrackets,
  generateGroupsKnockoutBrackets,
  advanceWinners,
} from '../../services/tournamentService';
import prisma from '../../config/database';
import { VolleyballConfig, BracketStage, MatchStatus, TournamentFormat } from '../../../shared/types/tournament.types';

// Mock dependencies
vi.mock('../../config/database', () => ({
  default: {
    $transaction: vi.fn(),
    tournament: {
      findUnique: vi.fn(),
    },
    tournamentTeam: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    tournamentPool: {
      findMany: vi.fn(),
    },
    tournamentPlayer: {
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    tournamentMatch: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    tournamentStanding: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    tournamentAdminRole: {
      findFirst: vi.fn(),
    },
    tournamentTeamInvitation: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../utils/errors', () => ({
  BadRequestError: class BadRequestError extends Error {
    constructor(message: string, public code?: string) {
      super(message);
      this.name = 'BadRequestError';
    }
  },
  ForbiddenError: class ForbiddenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ForbiddenError';
    }
  },
}));

describe('Tournament Service', () => {
  beforeEach(() => {
    // Reset implementations as well as call history so one-off mock return
    // values from earlier test cases do not leak into later tournament service tests.
    vi.resetAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      typeof fn === 'function' ? fn(prisma) : Promise.all(fn)
    );
    vi.mocked(prisma.tournamentAdminRole.findFirst).mockResolvedValue(null);
  });

  describe('calculateVolleyballWinner', () => {
    const defaultConfig: VolleyballConfig = {
      type: 'volleyball',
      bestOfSets: 3,
      regularSetPoints: 25,
      decidingSetPoints: 15,
      minimumPointDifference: 2,
    };

    it('should calculate winner for best of 3 sets', () => {
      const detailedScore = {
        sets: [
          { home: 25, away: 20 },
          { home: 25, away: 22 },
        ],
      };

      const result = calculateVolleyballWinner(detailedScore, defaultConfig);

      expect(result.isValid).toBe(true);
      expect(result.homeWins).toBe(2);
      expect(result.awayWins).toBe(0);
    });

    it('should validate minimum point requirement', () => {
      const detailedScore = {
        sets: [
          { home: 24, away: 20 }, // Home team hasn't reached 25
        ],
      };

      const result = calculateVolleyballWinner(detailedScore, defaultConfig);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must reach at least 25 points');
    });

    it('should validate minimum point difference', () => {
      const detailedScore = {
        sets: [
          { home: 25, away: 24 }, // Only 1 point difference
        ],
      };

      const result = calculateVolleyballWinner(detailedScore, defaultConfig);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Must win by at least 2 points');
    });

    it('should reject negative scores', () => {
      const detailedScore = {
        sets: [
          { home: -1, away: 20 },
        ],
      };

      const result = calculateVolleyballWinner(detailedScore, defaultConfig);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot be negative');
    });

    it('should reject tied sets', () => {
      const detailedScore = {
        sets: [
          { home: 25, away: 25 },
        ],
      };

      const result = calculateVolleyballWinner(detailedScore, defaultConfig);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot be tied');
    });

    it('should return error if no sets provided', () => {
      const detailedScore = {
        sets: [],
      };

      const result = calculateVolleyballWinner(detailedScore, defaultConfig);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Sets are required');
    });

    it('should handle deciding set with different point requirement', () => {
      const detailedScore = {
        sets: [
          { home: 25, away: 20 },
          { home: 20, away: 25 },
          { home: 15, away: 10 }, // Deciding set
        ],
      };

      const result = calculateVolleyballWinner(detailedScore, defaultConfig);

      expect(result.isValid).toBe(true);
      expect(result.homeWins).toBe(2);
      expect(result.awayWins).toBe(1);
    });

    it('should stop counting once match is decided', () => {
      const detailedScore = {
        sets: [
          { home: 25, away: 20 },
          { home: 25, away: 22 },
          { home: 25, away: 20 }, // Match already won, but included
        ],
      };

      const result = calculateVolleyballWinner(detailedScore, defaultConfig);

      expect(result.isValid).toBe(true);
      expect(result.homeWins).toBe(2);
    });
  });

  describe('sanitizeTournamentData', () => {
    it('should trim all string fields', () => {
      const result = sanitizeTournamentData({
        name: '  Test Tournament  ',
        description: '  Test description  ',
        location: '  Test Location  ',
        locationName: '  Stadium  ',
        prizesDescription: '  $1000 prize  ',
        rulesDescription: '  Standard rules  ',
      });

      expect(result.name).toBe('Test Tournament');
      expect(result.description).toBe('Test description');
      expect(result.location).toBe('Test Location');
      expect(result.locationName).toBe('Stadium');
      expect(result.prizesDescription).toBe('$1000 prize');
      expect(result.rulesDescription).toBe('Standard rules');
    });

    it('should handle undefined fields', () => {
      const result = sanitizeTournamentData({});

      expect(result.name).toBe('');
      expect(result.description).toBe('');
      expect(result.location).toBe('');
    });

    it('should handle partial data', () => {
      const result = sanitizeTournamentData({
        name: '  Test Tournament  ',
        description: '  Test description  ',
      });

      expect(result.name).toBe('Test Tournament');
      expect(result.description).toBe('Test description');
      expect(result.location).toBe('');
    });
  });

  describe('validateTournamentDates', () => {
    it('should return valid true for future start date', () => {
      const futureDate = new Date(Date.now() + 86400000);
      const result = validateTournamentDates(futureDate);

      expect(result.valid).toBe(true);
    });

    it('should return valid false for past start date', () => {
      const pastDate = new Date(Date.now() - 86400000);
      const result = validateTournamentDates(pastDate);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be in the future');
    });

    it('should validate end date is after start date', () => {
      const startDate = new Date(Date.now() + 86400000);
      const endDate = new Date(Date.now() + 43200000); // Earlier than start
      
      const result = validateTournamentDates(startDate, endDate);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be after start date');
    });

    it('should return valid true for valid date range', () => {
      const startDate = new Date(Date.now() + 86400000);
      const endDate = new Date(Date.now() + 172800000); // 2 days later
      
      const result = validateTournamentDates(startDate, endDate);

      expect(result.valid).toBe(true);
    });

    it('should accept string dates', () => {
      const startDate = new Date(Date.now() + 86400000).toISOString();
      const endDate = new Date(Date.now() + 172800000).toISOString();
      
      const result = validateTournamentDates(startDate, endDate);

      expect(result.valid).toBe(true);
    });
  });

  describe('isOrganizerOrAdmin', () => {
    it('returns true when user is organizer', async () => {
      const result = await isOrganizerOrAdmin({ id: 'tournament-1', organizerId: 'user-1' } as any, 'user-1');
      expect(result).toBe(true);
    });

    it('returns true when user has admin role', async () => {
      vi.mocked(prisma.tournamentAdminRole.findFirst).mockResolvedValue({
        id: 'role-1',
        tournamentId: 'tournament-1',
        userId: 'user-2',
        grantedById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      const result = await isOrganizerOrAdmin({ id: 'tournament-1', organizerId: 'user-1' } as any, 'user-2');
      expect(result).toBe(true);
    });

    it('returns false when user has no role', async () => {
      vi.mocked(prisma.tournamentAdminRole.findFirst).mockResolvedValue(null);
      const result = await isOrganizerOrAdmin({ id: 'tournament-1', organizerId: 'user-1' } as any, 'user-3');
      expect(result).toBe(false);
    });
  });

  describe('isOrganizer', () => {
    it('should return true if user is organizer', () => {
      const tournament = { organizerId: 'user-1' };
      const result = isOrganizer(tournament, 'user-1');

      expect(result).toBe(true);
    });

    it('should return false if user is not organizer', () => {
      const tournament = { organizerId: 'user-1' };
      const result = isOrganizer(tournament, 'user-2');

      expect(result).toBe(false);
    });
  });

  describe('isTeamCaptain', () => {
    it('should return true if user is team captain', async () => {
      vi.mocked(prisma.tournamentTeam.findUnique).mockResolvedValueOnce({
        id: 'team-1',
        captainUserId: 'user-1',
      } as unknown);

      const result = await isTeamCaptain('team-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false if user is not team captain', async () => {
      vi.mocked(prisma.tournamentTeam.findUnique).mockResolvedValueOnce({
        id: 'team-1',
        captainUserId: 'user-2',
      } as unknown);

      const result = await isTeamCaptain('team-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false if team not found', async () => {
      vi.mocked(prisma.tournamentTeam.findUnique).mockResolvedValueOnce(null);

      const result = await isTeamCaptain('team-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('isRegisteredPlayer', () => {
    it('should return true if user is registered player', async () => {
      vi.mocked(prisma.tournamentPlayer.count).mockResolvedValueOnce(1);

      const result = await isRegisteredPlayer('team-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false if user is not registered player', async () => {
      vi.mocked(prisma.tournamentPlayer.count).mockResolvedValueOnce(0);

      const result = await isRegisteredPlayer('team-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('canSubmitScore', () => {
    const match = {
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      refereeTeamId: null,
    };
    const tournament = { organizerId: 'organizer-1' };

    it('should allow organizer to submit score', async () => {
      const result = await canSubmitScore(match, tournament, 'organizer-1');

      expect(result).toBe(true);
    });

    it('should allow home team captain to submit score', async () => {
      vi.mocked(prisma.tournamentTeam.findFirst)
        .mockResolvedValueOnce({ id: 'team-1', captainUserId: 'user-1' } as unknown);
      vi.mocked(prisma.tournamentPlayer.findFirst)
        .mockResolvedValueOnce(null);

      const result = await canSubmitScore(match, tournament, 'user-1');

      expect(result).toBe(true);
    });

    it('should allow away team captain to submit score', async () => {
      vi.mocked(prisma.tournamentTeam.findFirst)
        .mockResolvedValueOnce({ id: 'team-2', captainUserId: 'user-1' } as unknown);
      vi.mocked(prisma.tournamentPlayer.findFirst)
        .mockResolvedValueOnce(null);

      const result = await canSubmitScore(match, tournament, 'user-1');

      expect(result).toBe(true);
    });

    it('should allow registered player on home team to submit score', async () => {
      vi.mocked(prisma.tournamentTeam.findFirst)
        .mockResolvedValueOnce(null);
      vi.mocked(prisma.tournamentPlayer.findFirst)
        .mockResolvedValueOnce({ id: 'player-1' } as unknown);

      const result = await canSubmitScore(match, tournament, 'user-1');

      expect(result).toBe(true);
    });

    it('should deny submission for unrelated user', async () => {
      vi.mocked(prisma.tournamentTeam.findFirst)
        .mockResolvedValue(null);
      vi.mocked(prisma.tournamentPlayer.findFirst)
        .mockResolvedValue(null);

      const result = await canSubmitScore(match, tournament, 'user-1');

      expect(result).toBe(false);
    });

    it('should allow referee team member to submit score', async () => {
      const matchWithReferee = { ...match, refereeTeamId: 'ref-team' };

      vi.mocked(prisma.tournamentTeam.findFirst)
        .mockResolvedValue(null);
      vi.mocked(prisma.tournamentPlayer.findFirst)
        .mockResolvedValueOnce({ id: 'player-1' } as unknown);

      const result = await canSubmitScore(matchWithReferee, tournament, 'user-1');

      expect(result).toBe(true);
    });
  });

  describe('generateSingleEliminationBrackets', () => {
    it('should generate brackets for 8 teams', async () => {
      const teams = Array.from({ length: 8 }, (_, i) => ({
        id: `team-${i + 1}`,
        name: `Team ${i + 1}`,
        createdAt: new Date(),
      }));

      vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValueOnce(teams as unknown);
      vi.mocked(prisma.tournamentMatch.createMany).mockResolvedValueOnce({ count: 4 } as unknown);

      const result = await generateSingleEliminationBrackets('tournament-1');

      expect(prisma.tournamentMatch.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            tournamentId: 'tournament-1',
            homeTeamId: 'team-1',
            awayTeamId: 'team-2',
            stage: BracketStage.QUARTER_FINALS,
            status: MatchStatus.SCHEDULED,
          }),
        ]),
      });
      expect(result.count).toBe(4);
    });

    it('should throw error for insufficient teams', async () => {
      vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValueOnce([
        { id: 'team-1', name: 'Team 1' } as unknown,
      ]);

      await expect(generateSingleEliminationBrackets('tournament-1')).rejects.toThrow(
        'At least 2 teams are required'
      );
    });

    it('should handle 2 teams (finals)', async () => {
      const teams = [
        { id: 'team-1', name: 'Team 1', createdAt: new Date() },
        { id: 'team-2', name: 'Team 2', createdAt: new Date() },
      ];

      vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValueOnce(teams as unknown);
      vi.mocked(prisma.tournamentMatch.createMany).mockResolvedValueOnce({ count: 1 } as unknown);

      const result = await generateSingleEliminationBrackets('tournament-1');

      expect(prisma.tournamentMatch.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            stage: BracketStage.FINALS,
          }),
        ]),
      });
      expect(result.count).toBe(1);
    });

    it('should set correct stage for 4 teams', async () => {
      const teams = Array.from({ length: 4 }, (_, i) => ({
        id: `team-${i + 1}`,
        name: `Team ${i + 1}`,
        createdAt: new Date(),
      }));

      vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValueOnce(teams as unknown);
      vi.mocked(prisma.tournamentMatch.createMany).mockResolvedValueOnce({ count: 2 } as unknown);

      await generateSingleEliminationBrackets('tournament-1');

      expect(prisma.tournamentMatch.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            stage: BracketStage.SEMI_FINALS,
          }),
        ]),
      });
    });

    it('should generate preliminary round with deterministic bye handling for odd team count', async () => {
      const teams = Array.from({ length: 5 }, (_, i) => ({
        id: `team-${i + 1}`,
        name: `Team ${i + 1}`,
        createdAt: new Date(`2025-01-0${i + 1}`),
      }));

      vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValueOnce(teams as unknown);
      vi.mocked(prisma.tournamentMatch.createMany).mockResolvedValueOnce({ count: 1 } as unknown);

      const result = await generateSingleEliminationBrackets('tournament-1');

      expect(prisma.tournamentMatch.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            tournamentId: 'tournament-1',
            homeTeamId: 'team-4',
            awayTeamId: 'team-5',
            stage: BracketStage.QUARTER_FINALS,
            status: MatchStatus.SCHEDULED,
          }),
        ],
      });
      expect(result.count).toBe(1);
    });
  });

  describe('generateRandomizedSingleEliminationBracketsFromPools', () => {
    it('should generate brackets using randomized pool teams', async () => {
      vi.mocked(prisma.tournamentPool.findMany).mockResolvedValueOnce([
        {
          id: 'pool-a',
          name: 'Pool A',
          teams: [
            { id: 'team-1', createdAt: new Date('2025-01-01') },
            { id: 'team-2', createdAt: new Date('2025-01-02') },
          ],
        },
        {
          id: 'pool-b',
          name: 'Pool B',
          teams: [
            { id: 'team-3', createdAt: new Date('2025-01-03') },
            { id: 'team-4', createdAt: new Date('2025-01-04') },
          ],
        },
      ] as unknown);
      vi.mocked(prisma.tournamentMatch.createMany).mockResolvedValueOnce({ count: 2 } as unknown);

      const result = await generateRandomizedSingleEliminationBracketsFromPools('tournament-1');

      const createManyCall = vi.mocked(prisma.tournamentMatch.createMany).mock.calls[0]?.[0] as
        | { data: Array<{ homeTeamId: string; awayTeamId: string }> }
        | undefined;
      expect(createManyCall).toBeDefined();
      expect(createManyCall!.data).toHaveLength(2);
      const seededTeamIds = createManyCall!.data.flatMap(match => [match.homeTeamId, match.awayTeamId]).sort();
      expect(seededTeamIds).toEqual(['team-1', 'team-2', 'team-3', 'team-4']);
      expect(result.count).toBe(2);
    });

    it('should throw error when pooled teams are insufficient', async () => {
      vi.mocked(prisma.tournamentPool.findMany).mockResolvedValueOnce([
        {
          id: 'pool-a',
          name: 'Pool A',
          teams: [{ id: 'team-1', createdAt: new Date('2025-01-01') }],
        },
      ] as unknown);

      await expect(
        generateRandomizedSingleEliminationBracketsFromPools('tournament-1')
      ).rejects.toThrow('At least 2 teams are required');
    });
  });

  describe('generateRoundRobinBrackets', () => {
    it('should generate all possible match combinations', async () => {
      const teams = [
        { id: 'team-1', name: 'Team 1', createdAt: new Date() },
        { id: 'team-2', name: 'Team 2', createdAt: new Date() },
        { id: 'team-3', name: 'Team 3', createdAt: new Date() },
      ];

      vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValueOnce(teams as unknown);
      vi.mocked(prisma.tournamentMatch.createMany).mockResolvedValueOnce({ count: 3 } as unknown);

      const result = await generateRoundRobinBrackets('tournament-1');

      // With 3 teams, we should have 3 matches spread across 3 rounds
      expect(prisma.tournamentMatch.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            tournamentId: 'tournament-1',
            status: MatchStatus.SCHEDULED,
            roundNumber: expect.any(Number),
          }),
        ]),
      });
      expect(result.count).toBe(3);
    });

    it('should throw error for insufficient teams', async () => {
      vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValueOnce([
        { id: 'team-1', name: 'Team 1' } as unknown,
      ]);

      await expect(generateRoundRobinBrackets('tournament-1')).rejects.toThrow(
        'At least 2 teams are required'
      );
    });

    it('should generate correct number of matches for 4 teams', async () => {
      const teams = Array.from({ length: 4 }, (_, i) => ({
        id: `team-${i + 1}`,
        name: `Team ${i + 1}`,
        createdAt: new Date(),
      }));

      vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValueOnce(teams as unknown);
      vi.mocked(prisma.tournamentMatch.createMany).mockResolvedValueOnce({ count: 6 } as unknown);

      const result = await generateRoundRobinBrackets('tournament-1');

      // With 4 teams, we should have 6 matches (n * (n-1) / 2) across 3 rounds
      expect(result.count).toBe(6);
    });

    it('should assign round numbers distributed across rounds for 4 teams', async () => {
      const teams = Array.from({ length: 4 }, (_, i) => ({
        id: `team-${i + 1}`,
        name: `Team ${i + 1}`,
        createdAt: new Date(),
      }));

      vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValueOnce(teams as unknown);
      vi.mocked(prisma.tournamentMatch.createMany).mockResolvedValueOnce({ count: 6 } as unknown);

      await generateRoundRobinBrackets('tournament-1');

      const callArg = vi.mocked(prisma.tournamentMatch.createMany).mock.calls[0][0];
      const data = (callArg as { data: { roundNumber: number }[] }).data;

      // 4 teams → 3 rounds × 2 matches each
      const roundNumbers = data.map(m => m.roundNumber).sort((a, b) => a - b);
      expect(roundNumbers).toEqual([1, 1, 2, 2, 3, 3]);
    });

    it('should handle odd number of teams with round numbers (3 teams → 3 rounds × 1 match)', async () => {
      const teams = [
        { id: 'team-1', name: 'Team 1', createdAt: new Date() },
        { id: 'team-2', name: 'Team 2', createdAt: new Date() },
        { id: 'team-3', name: 'Team 3', createdAt: new Date() },
      ];

      vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValueOnce(teams as unknown);
      vi.mocked(prisma.tournamentMatch.createMany).mockResolvedValueOnce({ count: 3 } as unknown);

      await generateRoundRobinBrackets('tournament-1');

      const callArg = vi.mocked(prisma.tournamentMatch.createMany).mock.calls[0][0];
      const data = (callArg as { data: { roundNumber: number }[] }).data;

      // 3 teams (odd) → 3 rounds × 1 match each = 3 matches
      expect(data).toHaveLength(3);
      const roundNumbers = data.map(m => m.roundNumber).sort((a, b) => a - b);
      expect(roundNumbers).toEqual([1, 2, 3]);
    });
  });

  describe('generateGroupsKnockoutBrackets', () => {
    it('should distribute teams into groups and generate matches', async () => {
      const teams = Array.from({ length: 8 }, (_, i) => ({
        id: `team-${i + 1}`,
        name: `Team ${i + 1}`,
        createdAt: new Date(),
      }));

      vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValueOnce(teams as unknown);
      vi.mocked(prisma.tournamentMatch.createMany).mockResolvedValueOnce({ count: 12 } as unknown);

      const result = await generateGroupsKnockoutBrackets('tournament-1', 4);

      expect(prisma.tournamentMatch.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            tournamentId: 'tournament-1',
            stage: BracketStage.GROUP_STAGE,
            status: MatchStatus.SCHEDULED,
            groupName: expect.any(String),
          }),
        ]),
      });
      expect(result.count).toBe(12);
    });

    it('should throw error for insufficient teams', async () => {
      vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValueOnce([
        { id: 'team-1', name: 'Team 1' } as unknown,
        { id: 'team-2', name: 'Team 2' } as unknown,
      ]);

      // With 4 groups, we need at least 8 teams
      await expect(generateGroupsKnockoutBrackets('tournament-1', 4)).rejects.toThrow(
        'At least 8 teams are required for 4 groups'
      );
    });

    it('should use default number of groups if not specified', async () => {
      const teams = Array.from({ length: 8 }, (_, i) => ({
        id: `team-${i + 1}`,
        name: `Team ${i + 1}`,
        createdAt: new Date(),
      }));

      vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValueOnce(teams as unknown);
      vi.mocked(prisma.tournamentMatch.createMany).mockResolvedValueOnce({ count: 12 } as unknown);

      await generateGroupsKnockoutBrackets('tournament-1');

      expect(prisma.tournamentTeam.findMany).toHaveBeenCalled();
    });

    it('throws instead of falling back to flat round robin when pool seeding is required without populated pools', async () => {
      vi.mocked(prisma.tournamentPool.findMany).mockResolvedValueOnce([
        { id: 'pool-a', name: 'Group A', teams: [] },
      ] as unknown);

      const { generatePoolAwareBrackets } = await import('../../services/tournamentService');

      await expect(
        generatePoolAwareBrackets('tournament-1', { fallbackToRoundRobin: false })
      ).rejects.toThrow('No populated groups or pools are available to generate a groups + knockout stage');
    });
  });

  describe('advanceWinners', () => {
    it('seeds the initial knockout round for groups knockout after all group matches complete', async () => {
      vi.mocked(prisma.tournament.findUnique).mockResolvedValueOnce({
        format: TournamentFormat.GROUPS_KNOCKOUT,
        tiebreakerRules: ['goal_difference', 'goals_for'],
      } as unknown);
      vi.mocked(prisma.tournamentMatch.findMany).mockResolvedValueOnce([
        {
          id: 'group-match-1',
          tournamentId: 'tournament-1',
          stage: BracketStage.GROUP_STAGE,
          status: MatchStatus.COMPLETED,
          homeTeamId: 'a1',
          awayTeamId: 'a2',
          homeScore: 2,
          awayScore: 1,
        },
      ] as unknown);
      vi.mocked(prisma.tournamentMatch.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.tournamentStanding.findMany).mockResolvedValueOnce(
        Array.from({ length: 8 }, (_, groupIndex) => {
          const groupName = `Group ${String.fromCharCode(65 + groupIndex)}`;
          return [
            {
              teamId: `${groupName}-1`,
              groupName,
              points: 9,
              wins: 3,
              goalsFor: 6,
              goalsAgainst: 1,
            },
            {
              teamId: `${groupName}-2`,
              groupName,
              points: 6,
              wins: 2,
              goalsFor: 4,
              goalsAgainst: 2,
            },
          ];
        }).flatMap((group) => group) as unknown
      );
      vi.mocked(prisma.tournamentMatch.createMany).mockResolvedValueOnce({ count: 8 } as unknown);

      await advanceWinners('tournament-1', BracketStage.GROUP_STAGE);

      expect(prisma.tournamentMatch.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            stage: BracketStage.ROUND_OF_16,
            roundNumber: 1,
            homeTeamId: 'Group A-1',
            awayTeamId: 'Group H-2',
          }),
        ]),
      });
    });

    it('does nothing when not all matches in current stage are completed', async () => {
      vi.mocked(prisma.tournamentMatch.findMany).mockResolvedValueOnce([
        {
          id: 'm1',
          tournamentId: 'tournament-1',
          stage: BracketStage.QUARTER_FINALS,
          status: MatchStatus.COMPLETED,
          homeTeamId: 'team-1',
          awayTeamId: 'team-2',
          homeScore: 2,
          awayScore: 1,
          roundNumber: 1,
          matchOrder: 1,
          createdAt: new Date(),
        },
        {
          id: 'm2',
          tournamentId: 'tournament-1',
          stage: BracketStage.QUARTER_FINALS,
          status: MatchStatus.SCHEDULED,
          homeTeamId: 'team-3',
          awayTeamId: 'team-4',
          homeScore: null,
          awayScore: null,
          roundNumber: 1,
          matchOrder: 2,
          createdAt: new Date(),
        },
      ] as unknown);

      await advanceWinners('tournament-1', BracketStage.QUARTER_FINALS);

      expect(prisma.tournamentMatch.createMany).not.toHaveBeenCalled();
    });

    it('does nothing when next-stage matches already exist', async () => {
      vi.mocked(prisma.tournamentMatch.findMany).mockResolvedValueOnce([
        {
          id: 'm1',
          tournamentId: 'tournament-1',
          stage: BracketStage.QUARTER_FINALS,
          status: MatchStatus.COMPLETED,
          homeTeamId: 'team-1',
          awayTeamId: 'team-2',
          homeScore: 2,
          awayScore: 1,
          roundNumber: 1,
          matchOrder: 1,
          createdAt: new Date(),
        },
        {
          id: 'm2',
          tournamentId: 'tournament-1',
          stage: BracketStage.QUARTER_FINALS,
          status: MatchStatus.COMPLETED,
          homeTeamId: 'team-3',
          awayTeamId: 'team-4',
          homeScore: 0,
          awayScore: 1,
          roundNumber: 1,
          matchOrder: 2,
          createdAt: new Date(),
        },
      ] as unknown);
      vi.mocked(prisma.tournamentMatch.count).mockResolvedValueOnce(1);

      await advanceWinners('tournament-1', BracketStage.QUARTER_FINALS);

      expect(prisma.tournamentMatch.createMany).not.toHaveBeenCalled();
    });

    it('includes first-stage bye teams when advancing winners', async () => {
      vi.mocked(prisma.tournamentMatch.findMany).mockResolvedValueOnce([
        {
          id: 'm1',
          tournamentId: 'tournament-1',
          stage: BracketStage.QUARTER_FINALS,
          status: MatchStatus.COMPLETED,
          homeTeamId: 'team-4',
          awayTeamId: 'team-5',
          homeScore: 1,
          awayScore: 0,
          roundNumber: 1,
          matchOrder: 1,
          createdAt: new Date('2025-01-10'),
        },
      ] as unknown);
      vi.mocked(prisma.tournamentMatch.count)
        .mockResolvedValueOnce(0) // no next stage yet
        .mockResolvedValueOnce(0); // no previous stage matches
      vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValueOnce([
        { id: 'team-1', createdAt: new Date('2025-01-01') },
        { id: 'team-2', createdAt: new Date('2025-01-02') },
        { id: 'team-3', createdAt: new Date('2025-01-03') },
        { id: 'team-4', createdAt: new Date('2025-01-04') },
        { id: 'team-5', createdAt: new Date('2025-01-05') },
      ] as unknown);
      vi.mocked(prisma.tournamentMatch.createMany).mockResolvedValueOnce({ count: 2 } as unknown);

      await advanceWinners('tournament-1', BracketStage.QUARTER_FINALS);

      expect(prisma.tournamentMatch.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            stage: BracketStage.SEMI_FINALS,
            homeTeamId: 'team-1',
            awayTeamId: 'team-2',
          }),
          expect.objectContaining({
            stage: BracketStage.SEMI_FINALS,
            homeTeamId: 'team-3',
            awayTeamId: 'team-4',
          }),
        ],
      });
    });
  });

  // ─── computeAutoStatus ────────────────────────────────────────────────────

  describe('computeAutoStatus', () => {
    const future = new Date(Date.now() + 86_400_000); // +1 day
    const past = new Date(Date.now() - 86_400_000); // -1 day
    const farPast = new Date(Date.now() - 2 * 86_400_000); // -2 days

    it('returns null for cancelled tournaments', () => {
      expect(computeAutoStatus({ status: 'cancelled', startDate: future })).toBeNull();
    });

    it('returns null when no change needed (draft, start in future)', () => {
      expect(computeAutoStatus({ status: 'draft', startDate: future })).toBeNull();
    });

    it('returns "completed" when endDate has passed', () => {
      const result = computeAutoStatus({ status: 'in_progress', startDate: farPast, endDate: past });
      expect(result).toBe('completed');
    });

    it('returns null if already completed and endDate has passed', () => {
      expect(computeAutoStatus({ status: 'completed', startDate: farPast, endDate: past })).toBeNull();
    });

    it('returns "in_progress" when startDate has passed and tournament is not yet in_progress', () => {
      const result = computeAutoStatus({ status: 'registration', startDate: past });
      expect(result).toBe('in_progress');
    });

    it('returns null when startDate has passed and already in_progress', () => {
      expect(computeAutoStatus({ status: 'in_progress', startDate: past })).toBeNull();
    });

    it('returns "completed" when all matches are done (hasMatches=true, hasIncompleteMatches=false)', () => {
      const result = computeAutoStatus({
        status: 'in_progress',
        startDate: past,
        hasMatches: true,
        hasIncompleteMatches: false,
      });
      expect(result).toBe('completed');
    });

    it('returns "in_progress" when startDate passed but there are incomplete matches', () => {
      const result = computeAutoStatus({
        status: 'registration',
        startDate: past,
        hasMatches: true,
        hasIncompleteMatches: true,
      });
      expect(result).toBe('in_progress');
    });

    it('returns "registration" when registrationStartDate has arrived and status is draft', () => {
      const result = computeAutoStatus({
        status: 'draft',
        startDate: future,
        registrationStartDate: past,
        registrationDeadline: future,
      });
      expect(result).toBe('registration');
    });

    it('returns null when registrationDeadline has passed (no auto-registration change)', () => {
      const result = computeAutoStatus({
        status: 'draft',
        startDate: future,
        registrationStartDate: farPast,
        registrationDeadline: past,
      });
      expect(result).toBeNull();
    });

    it('returns null when status is already registration', () => {
      const result = computeAutoStatus({
        status: 'registration',
        startDate: future,
        registrationStartDate: past,
        registrationDeadline: future,
      });
      expect(result).toBeNull();
    });

    it('returns "in_progress" when brackets are generated before start date (draft)', () => {
      const result = computeAutoStatus({
        status: 'draft',
        startDate: future,
        hasMatches: true,
        hasIncompleteMatches: true,
      });
      expect(result).toBe('in_progress');
    });

    it('returns "in_progress" when brackets are generated before start date (registration)', () => {
      const result = computeAutoStatus({
        status: 'registration',
        startDate: future,
        registrationStartDate: past,
        registrationDeadline: future,
        hasMatches: true,
        hasIncompleteMatches: true,
      });
      expect(result).toBe('in_progress');
    });

    it('returns null when already in_progress and brackets exist before start date', () => {
      const result = computeAutoStatus({
        status: 'in_progress',
        startDate: future,
        hasMatches: true,
        hasIncompleteMatches: true,
      });
      expect(result).toBeNull();
    });
  });

  // ─── validateTournamentEnums ──────────────────────────────────────────────

  describe('validateTournamentEnums', () => {
    it('does not throw for valid sportType and format', () => {
      expect(() => validateTournamentEnums({ sportType: 'football', format: 'single_elimination' })).not.toThrow();
    });

    it('throws for invalid sportType', () => {
      expect(() => validateTournamentEnums({ sportType: 'baseball_extreme' })).toThrow('Invalid sportType');
    });

    it('throws for invalid format', () => {
      expect(() => validateTournamentEnums({ format: 'free_for_all' })).toThrow('Invalid format');
    });

    it('does not throw when sportType and format are both undefined', () => {
      expect(() => validateTournamentEnums({})).not.toThrow();
    });

    it('throws for invalid format regardless of valid sportType', () => {
      expect(() => validateTournamentEnums({ sportType: 'basketball', format: 'invalid' })).toThrow('Invalid format');
    });
  });

  // ─── validateTournamentBusinessRules ─────────────────────────────────────

  describe('validateTournamentBusinessRules', () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const regStart = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const regDeadline = new Date(Date.now() + 5 * 86_400_000).toISOString();

    it('does not throw for valid dates', () => {
      expect(() =>
        validateTournamentBusinessRules({ startDate: future, endDate: null, maxTeams: 8 })
      ).not.toThrow();
    });

    it('throws when endDate is not after startDate', () => {
      expect(() =>
        validateTournamentBusinessRules({ startDate: future, endDate: regStart })
      ).toThrow('End date must be after start date');
    });

    it('throws when registrationStartDate is not before startDate', () => {
      expect(() =>
        validateTournamentBusinessRules({ startDate: regStart, registrationStartDate: future })
      ).toThrow('Registration start date must be before tournament start date');
    });

    it('throws when registrationDeadline is not before startDate', () => {
      expect(() =>
        validateTournamentBusinessRules({ startDate: regStart, registrationDeadline: future })
      ).toThrow('Registration deadline must be before tournament start date');
    });

    it('throws when registrationDeadline is not after registrationStartDate', () => {
      expect(() =>
        validateTournamentBusinessRules({
          startDate: future,
          registrationStartDate: regDeadline,
          registrationDeadline: regStart,
        })
      ).toThrow('Registration deadline must be after registration start date');
    });

    it('throws when maxTeams is less than 2', () => {
      expect(() =>
        validateTournamentBusinessRules({ startDate: future, maxTeams: 1 })
      ).toThrow('Max teams must be at least 2');
    });

    it('does not throw when maxTeams is null', () => {
      expect(() =>
        validateTournamentBusinessRules({ startDate: future, maxTeams: null })
      ).not.toThrow();
    });
  });

  // ─── validateRegistrationEligibility ─────────────────────────────────────

  describe('validateRegistrationEligibility', () => {
    it('does not throw for open draft tournament with no dates', () => {
      const tournament = {
        status: 'draft',
        startDate: new Date(Date.now() + 86_400_000),
      };
      expect(() => validateRegistrationEligibility(tournament)).not.toThrow();
    });

    it('does not throw for open registration-status tournament', () => {
      const tournament = {
        status: 'registration',
        startDate: new Date(Date.now() + 86_400_000),
      };
      expect(() => validateRegistrationEligibility(tournament)).not.toThrow();
    });

    it('throws when tournament is in_progress', () => {
      const tournament = {
        status: 'in_progress',
        startDate: new Date(Date.now() - 86_400_000),
      };
      expect(() => validateRegistrationEligibility(tournament)).toThrow('Tournament registration is closed');
    });

    it('throws when registrationStartDate is in the future', () => {
      const tournament = {
        status: 'draft',
        startDate: new Date(Date.now() + 5 * 86_400_000),
        registrationStartDate: new Date(Date.now() + 86_400_000),
      };
      expect(() => validateRegistrationEligibility(tournament)).toThrow('Registration has not opened yet');
    });

    it('throws when registrationDeadline has passed (no late registration)', () => {
      const tournament = {
        status: 'registration',
        startDate: new Date(Date.now() + 86_400_000),
        registrationDeadline: new Date(Date.now() - 1000),
        allowLateRegistration: false,
      };
      expect(() => validateRegistrationEligibility(tournament)).toThrow('Registration deadline has passed');
    });

    it('does not throw when deadline has passed but allowLateRegistration is true', () => {
      const tournament = {
        status: 'registration',
        startDate: new Date(Date.now() + 86_400_000),
        registrationDeadline: new Date(Date.now() - 1000),
        allowLateRegistration: true,
      };
      expect(() => validateRegistrationEligibility(tournament)).not.toThrow();
    });

    it('throws when startDate has already passed (no late registration)', () => {
      const tournament = {
        status: 'registration',
        startDate: new Date(Date.now() - 1000),
        allowLateRegistration: false,
      };
      expect(() => validateRegistrationEligibility(tournament)).toThrow('Tournament registration is closed');
    });
  });

  // ─── revertStandings ─────────────────────────────────────────────────────

  describe('revertStandings', () => {
    it('does nothing when match has no scores', async () => {
      vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValueOnce({
        id: 'match-1',
        homeScore: null,
        awayScore: null,
      } as unknown);

      await revertStandings('match-1');

      expect(prisma.tournamentStanding.updateMany).not.toHaveBeenCalled();
    });

    it('does nothing when match is not found', async () => {
      vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValueOnce(null);

      await revertStandings('match-1');

      expect(prisma.tournamentStanding.updateMany).not.toHaveBeenCalled();
    });

    it('decrements standings when home team won', async () => {
      vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValueOnce({
        id: 'match-1',
        tournamentId: 'tournament-1',
        homeTeamId: 'team-1',
        awayTeamId: 'team-2',
        homeScore: 3,
        awayScore: 1,
        groupName: null,
        tournament: null,
      } as unknown);
      vi.mocked(prisma.tournamentStanding.updateMany).mockResolvedValue({ count: 1 } as unknown);

      await revertStandings('match-1');

      expect(prisma.tournamentStanding.updateMany).toHaveBeenCalledTimes(2);
      // Home team (winner) should have points and wins decremented
      expect(prisma.tournamentStanding.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tournamentId: 'tournament-1', teamId: 'team-1', groupName: null },
          data: expect.objectContaining({
            points: { decrement: 3 },
            wins: { decrement: 1 },
            goalsFor: { decrement: 3 },
            goalsAgainst: { decrement: 1 },
          }),
        })
      );
    });

    it('decrements standings correctly when away team won', async () => {
      vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValueOnce({
        id: 'match-1',
        tournamentId: 'tournament-1',
        homeTeamId: 'team-1',
        awayTeamId: 'team-2',
        homeScore: 0,
        awayScore: 2,
        groupName: null,
        tournament: null,
      } as unknown);
      vi.mocked(prisma.tournamentStanding.updateMany).mockResolvedValue({ count: 1 } as unknown);

      await revertStandings('match-1');

      expect(prisma.tournamentStanding.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tournamentId: 'tournament-1', teamId: 'team-2', groupName: null },
          data: expect.objectContaining({
            points: { decrement: 3 },
            wins: { decrement: 1 },
          }),
        })
      );
    });

    it('decrements standings with groupName when set', async () => {
      vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValueOnce({
        id: 'match-1',
        tournamentId: 'tournament-1',
        homeTeamId: 'team-1',
        awayTeamId: 'team-2',
        homeScore: 1,
        awayScore: 1,
        groupName: 'A',
        tournament: null,
      } as unknown);
      vi.mocked(prisma.tournamentStanding.updateMany).mockResolvedValue({ count: 1 } as unknown);

      await revertStandings('match-1');

      expect(prisma.tournamentStanding.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tournamentId: 'tournament-1', teamId: 'team-1', groupName: 'A' },
        })
      );
    });
  });

  // ─── updateStandings ─────────────────────────────────────────────────────

  describe('updateStandings', () => {
    const mockTournamentData = { id: 'tournament-1', organizerId: 'org-1', sportConfig: null };

    it('creates/updates standings after a home win', async () => {
      vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValueOnce({
        id: 'match-1',
        tournamentId: 'tournament-1',
        homeTeamId: 'team-1',
        awayTeamId: 'team-2',
        homeScore: 2,
        awayScore: 0,
        groupName: null,
      } as unknown);
      vi.mocked(prisma.tournamentStanding.upsert).mockResolvedValue({} as unknown);

      await updateStandings('match-1', mockTournamentData as any);

      expect(prisma.tournamentStanding.upsert).toHaveBeenCalledTimes(2);
      // Home team wins: should get 3 points, 1 win
      expect(prisma.tournamentStanding.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ points: 3, wins: 1, losses: 0 }),
        })
      );
    });

    it('creates/updates standings after a draw', async () => {
      vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValueOnce({
        id: 'match-1',
        tournamentId: 'tournament-1',
        homeTeamId: 'team-1',
        awayTeamId: 'team-2',
        homeScore: 1,
        awayScore: 1,
        groupName: null,
      } as unknown);
      vi.mocked(prisma.tournamentStanding.upsert).mockResolvedValue({} as unknown);

      await updateStandings('match-1', mockTournamentData as any);

      // Both teams draw: each gets 1 draw point
      expect(prisma.tournamentStanding.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ points: 1, draws: 1, wins: 0, losses: 0 }),
        })
      );
    });

    it('returns early when match is not found', async () => {
      vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValueOnce(null);

      await updateStandings('match-1', mockTournamentData as any);

      expect(prisma.tournamentStanding.upsert).not.toHaveBeenCalled();
    });
  });

  // ─── canManageTeamInvitations ─────────────────────────────────────────────

  describe('canManageTeamInvitations', () => {
    it('returns true for tournament organizer', async () => {
      vi.mocked(prisma.tournament.findUnique).mockResolvedValueOnce({
        id: 'tournament-1',
        organizerId: 'user-1',
      } as unknown);

      const result = await canManageTeamInvitations('team-1', 'tournament-1', 'user-1');

      expect(result).toBe(true);
    });

    it('returns true for team captain (non-organizer)', async () => {
      vi.mocked(prisma.tournament.findUnique).mockResolvedValueOnce({
        id: 'tournament-1',
        organizerId: 'org-1',
      } as unknown);
      vi.mocked(prisma.tournamentTeam.findUnique).mockResolvedValueOnce({
        id: 'team-1',
        captainUserId: 'user-1',
      } as unknown);

      const result = await canManageTeamInvitations('team-1', 'tournament-1', 'user-1');

      expect(result).toBe(true);
    });

    it('returns false for unrelated user', async () => {
      vi.mocked(prisma.tournament.findUnique).mockResolvedValueOnce({
        id: 'tournament-1',
        organizerId: 'org-1',
      } as unknown);
      vi.mocked(prisma.tournamentTeam.findUnique).mockResolvedValueOnce({
        id: 'team-1',
        captainUserId: 'captain-1',
      } as unknown);

      const result = await canManageTeamInvitations('team-1', 'tournament-1', 'user-1');

      expect(result).toBe(false);
    });

    it('returns false when tournament not found', async () => {
      vi.mocked(prisma.tournament.findUnique).mockResolvedValueOnce(null);

      const result = await canManageTeamInvitations('team-1', 'tournament-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  // ─── acceptTeamInvitation ─────────────────────────────────────────────────

  describe('acceptTeamInvitation', () => {
    const mockInvitation = {
      id: 'inv-1',
      teamId: 'team-1',
      inviteToken: 'abc123',
      inviteeEmail: 'player@example.com',
      status: 'pending',
      expiresAt: new Date(Date.now() + 86_400_000),
      team: { id: 'team-1', tournament: { id: 'tournament-1' } },
    };

    it('throws when invitation is not found', async () => {
      vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValueOnce(null);

      await expect(acceptTeamInvitation('bad-token', 'user-1')).rejects.toThrow('Invalid invitation token');
    });

    it('throws when invitation is already processed', async () => {
      vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValueOnce({
        ...mockInvitation,
        status: 'accepted',
      } as unknown);

      await expect(acceptTeamInvitation('abc123', 'user-1')).rejects.toThrow('already been processed');
    });

    it('marks invitation as expired and throws when past expiresAt', async () => {
      vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValueOnce({
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 1000),
      } as unknown);
      vi.mocked(prisma.tournamentTeamInvitation.update).mockResolvedValueOnce({} as unknown);

      await expect(acceptTeamInvitation('abc123', 'user-1')).rejects.toThrow('expired');

      expect(prisma.tournamentTeamInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'expired' } })
      );
    });

    it('throws when user email does not match invitation email', async () => {
      vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValueOnce(mockInvitation as unknown);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-1',
        email: 'different@example.com',
        name: 'User One',
      } as unknown);

      await expect(acceptTeamInvitation('abc123', 'user-1')).rejects.toThrow('different email address');
    });

    it('marks as accepted and throws when user is already on the team', async () => {
      vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValueOnce(mockInvitation as unknown);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-1',
        email: 'player@example.com',
        name: 'Player',
      } as unknown);
      vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValueOnce({ id: 'p-1' } as unknown);
      vi.mocked(prisma.tournamentTeamInvitation.update).mockResolvedValueOnce({} as unknown);

      await expect(acceptTeamInvitation('abc123', 'user-1')).rejects.toThrow('already a participant');

      expect(prisma.tournamentTeamInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'accepted', inviteeUserId: 'user-1' } })
      );
    });

    it('creates player and marks invitation accepted on success', async () => {
      vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValueOnce(mockInvitation as unknown);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-1',
        email: 'player@example.com',
        name: 'Player',
      } as unknown);
      vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.tournamentPlayer.create).mockResolvedValueOnce({ id: 'p-new' } as unknown);
      vi.mocked(prisma.tournamentTeamInvitation.update).mockResolvedValueOnce(mockInvitation as unknown);

      const result = await acceptTeamInvitation('abc123', 'user-1');

      expect(prisma.tournamentPlayer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ teamId: 'team-1', userId: 'user-1' }),
        })
      );
      expect(prisma.tournamentTeamInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'accepted', inviteeUserId: 'user-1' } })
      );
      expect(result).toBe(mockInvitation);
    });
  });

  // ─── expireOldInvitations ─────────────────────────────────────────────────

  describe('expireOldInvitations', () => {
    it('marks all expired pending invitations as expired', async () => {
      vi.mocked(prisma.tournamentTeamInvitation.updateMany).mockResolvedValueOnce({ count: 3 } as unknown);

      const result = await expireOldInvitations();

      expect(prisma.tournamentTeamInvitation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
          data: { status: 'expired' },
        })
      );
      expect(result).toEqual({ count: 3 });
    });

    it('returns count 0 when no invitations to expire', async () => {
      vi.mocked(prisma.tournamentTeamInvitation.updateMany).mockResolvedValueOnce({ count: 0 } as unknown);

      const result = await expireOldInvitations();

      expect(result).toEqual({ count: 0 });
    });
  });
});
