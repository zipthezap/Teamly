/**
 * Tournament Service Tests
 * Tests for tournament management business logic
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  calculateVolleyballWinner,
  sanitizeTournamentData,
  validateTournamentDates,
  isOrganizer,
  isOrganizerOrAdmin,
  isTeamCaptain,
  isRegisteredPlayer,
  canSubmitScore,
  generateSingleEliminationBrackets,
  generateRoundRobinBrackets,
  generateGroupsKnockoutBrackets,
} from '../../services/tournamentService';
import prisma from '../../config/database';
import { VolleyballConfig, BracketStage, MatchStatus } from '../../../shared/types/tournament.types';

// Mock dependencies
vi.mock('../../config/database', () => ({
  default: {
    tournamentTeam: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    tournamentPlayer: {
      count: vi.fn(),
    },
    tournamentMatch: {
      createMany: vi.fn(),
    },
    tournamentAdminRole: {
      findFirst: vi.fn(),
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
}));

describe('Tournament Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      vi.mocked(prisma.tournamentTeam.findUnique)
        .mockResolvedValueOnce({ id: 'team-1', captainUserId: 'user-1' } as unknown);

      const result = await canSubmitScore(match, tournament, 'user-1');

      expect(result).toBe(true);
    });

    it('should allow away team captain to submit score', async () => {
      vi.mocked(prisma.tournamentTeam.findUnique)
        .mockResolvedValueOnce({ id: 'team-1', captainUserId: 'other-user' } as unknown)
        .mockResolvedValueOnce({ id: 'team-2', captainUserId: 'user-1' } as unknown);

      const result = await canSubmitScore(match, tournament, 'user-1');

      expect(result).toBe(true);
    });

    it('should allow registered player on home team to submit score', async () => {
      vi.mocked(prisma.tournamentTeam.findUnique)
        .mockResolvedValueOnce({ id: 'team-1', captainUserId: 'other-user' } as unknown)
        .mockResolvedValueOnce({ id: 'team-2', captainUserId: 'other-user' } as unknown);
      vi.mocked(prisma.tournamentPlayer.count)
        .mockResolvedValueOnce(1); // Home team player

      const result = await canSubmitScore(match, tournament, 'user-1');

      expect(result).toBe(true);
    });

    it('should deny submission for unrelated user', async () => {
      vi.mocked(prisma.tournamentTeam.findUnique)
        .mockResolvedValue({ id: 'team-1', captainUserId: 'other-user' } as unknown);
      vi.mocked(prisma.tournamentPlayer.count)
        .mockResolvedValue(0);

      const result = await canSubmitScore(match, tournament, 'user-1');

      expect(result).toBe(false);
    });

    it('should allow referee team member to submit score', async () => {
      const matchWithReferee = { ...match, refereeTeamId: 'ref-team' };
      
      vi.mocked(prisma.tournamentTeam.findUnique)
        .mockResolvedValue({ id: 'team-1', captainUserId: 'other-user' } as unknown);
      vi.mocked(prisma.tournamentPlayer.count)
        .mockResolvedValueOnce(0) // Not on home team
        .mockResolvedValueOnce(0) // Not on away team
        .mockResolvedValueOnce(1); // On referee team

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

      // With 3 teams, we should have 3 matches: 1v2, 1v3, 2v3
      expect(prisma.tournamentMatch.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            tournamentId: 'tournament-1',
            status: MatchStatus.SCHEDULED,
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

      // With 4 teams, we should have 6 matches (n * (n-1) / 2)
      expect(result.count).toBe(6);
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
  });
});
