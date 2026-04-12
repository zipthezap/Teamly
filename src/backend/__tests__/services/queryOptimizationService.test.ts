import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../config/database';

// Use vi.hoisted to create mocks that can be referenced in vi.mock factories
const {
  mockPrismaUser, mockPrismaSession, mockPrismaSessionParticipant,
  mockPrismaGroupMember, mockPrismaTournamentTeam, mockPrismaTournamentMatch,
} = vi.hoisted(() => ({
  mockPrismaUser: { findMany: vi.fn(), count: vi.fn() },
  mockPrismaSession: { findMany: vi.fn(), count: vi.fn() },
  mockPrismaSessionParticipant: { findMany: vi.fn(), count: vi.fn() },
  mockPrismaGroupMember: { count: vi.fn() },
  mockPrismaTournamentTeam: { count: vi.fn() },
  mockPrismaTournamentMatch: { count: vi.fn() },
}));

vi.mock('../../config/database', () => ({
  default: {
    user: mockPrismaUser,
    session: mockPrismaSession,
    sessionParticipant: mockPrismaSessionParticipant,
    groupMember: mockPrismaGroupMember,
    tournamentTeam: mockPrismaTournamentTeam,
    tournamentMatch: mockPrismaTournamentMatch,
    $queryRaw: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/cacheService', () => ({
  CacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    deletePattern: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/queryCache', () => ({
  CACHE_TTL: {
    USER_PROFILE: 120,
    GROUP_DETAILS: 180,
    TOURNAMENT_DETAILS: 120,
  },
}));

import {
  UserBatchLoader,
  EventParticipantBatchLoader,
  CachedAggregations,
  userBatchLoader,
  eventParticipantBatchLoader,
} from '../../services/queryOptimizationService';
import { CacheService } from '../../services/cacheService';
import prisma from '../../config/database';

describe('QueryOptimizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(CacheService.get).mockResolvedValue(null);
  });

  describe('UserBatchLoader', () => {
    it('is exported as a class', () => {
      expect(UserBatchLoader).toBeDefined();
    });

    it('userBatchLoader singleton is exported', () => {
      expect(userBatchLoader).toBeDefined();
      expect(userBatchLoader).toBeInstanceOf(UserBatchLoader);
    });

    it('load() returns user data for a valid user', async () => {
      const mockUser = { id: 'user-1', name: 'Alice', email: 'alice@example.com', profilePicture: null };
      vi.mocked(mockPrismaUser.findMany).mockResolvedValueOnce([mockUser]);

      const loader = new UserBatchLoader();
      const result = await loader.load('user-1');

      expect(result).toEqual(mockUser);
    });

    it('load() returns null for non-existent user', async () => {
      vi.mocked(mockPrismaUser.findMany).mockResolvedValueOnce([]);

      const loader = new UserBatchLoader();
      const result = await loader.load('nonexistent-id');

      expect(result).toBeNull();
    });

    it('batches multiple load() calls in the same tick', async () => {
      const mockUsers = [
        { id: 'user-1', name: 'Alice', email: 'alice@example.com', profilePicture: null },
        { id: 'user-2', name: 'Bob', email: 'bob@example.com', profilePicture: null },
      ];
      vi.mocked(mockPrismaUser.findMany).mockResolvedValueOnce(mockUsers);

      const loader = new UserBatchLoader();
      const [result1, result2] = await Promise.all([
        loader.load('user-1'),
        loader.load('user-2'),
      ]);

      expect(result1).toEqual(mockUsers[0]);
      expect(result2).toEqual(mockUsers[1]);
      // Should have been called once (batched)
      expect(mockPrismaUser.findMany).toHaveBeenCalledTimes(1);
    });

    it('returns null when database query fails', async () => {
      vi.mocked(mockPrismaUser.findMany).mockRejectedValueOnce(new Error('DB error'));

      const loader = new UserBatchLoader();
      const result = await loader.load('user-error');

      expect(result).toBeNull();
    });
  });

  describe('EventParticipantBatchLoader', () => {
    it('is exported as a class', () => {
      expect(EventParticipantBatchLoader).toBeDefined();
    });

    it('eventParticipantBatchLoader singleton is exported', () => {
      expect(eventParticipantBatchLoader).toBeDefined();
      expect(eventParticipantBatchLoader).toBeInstanceOf(EventParticipantBatchLoader);
    });

    it('load() returns participants for a session', async () => {
      const mockParticipants = [
        {
          id: 'p-1',
          status: 'confirmed',
          joinedAt: new Date(),
          sessionId: 'session-1',
          userId: 'user-1',
          user: { id: 'user-1', name: 'Alice', email: 'alice@example.com', profilePicture: null },
        },
      ];
      vi.mocked(mockPrismaSessionParticipant.findMany).mockResolvedValueOnce(mockParticipants);

      const loader = new EventParticipantBatchLoader();
      const result = await loader.load('session-1');

      expect(result).toEqual(mockParticipants);
    });

    it('load() returns empty array for session with no participants', async () => {
      vi.mocked(mockPrismaSessionParticipant.findMany).mockResolvedValueOnce([]);

      const loader = new EventParticipantBatchLoader();
      const result = await loader.load('session-empty');

      expect(result).toEqual([]);
    });
  });

  describe('CachedAggregations', () => {
    describe('getUserEventStats', () => {
      it('returns user stats from database when not cached', async () => {
        vi.mocked(mockPrismaSessionParticipant.count)
          .mockResolvedValueOnce(10) // totalEvents
          .mockResolvedValueOnce(3)  // upcomingEvents
          .mockResolvedValueOnce(7); // completedEvents
        vi.mocked(mockPrismaSession.count).mockResolvedValueOnce(2); // createdEvents

        const stats = await CachedAggregations.getUserEventStats('user-1');

        expect(stats).toEqual({
          totalEvents: 10,
          upcomingEvents: 3,
          completedEvents: 7,
          createdEvents: 2,
        });
      });

      it('returns cached stats when available', async () => {
        const cachedStats = { totalEvents: 5, upcomingEvents: 1, completedEvents: 4, createdEvents: 1 };
        vi.mocked(CacheService.get).mockResolvedValueOnce(cachedStats);

        const stats = await CachedAggregations.getUserEventStats('user-cached');

        expect(stats).toEqual(cachedStats);
        expect(mockPrismaSessionParticipant.count).not.toHaveBeenCalled();
      });
    });

    describe('getGroupStats', () => {
      it('returns group stats from database when not cached', async () => {
        vi.mocked(mockPrismaGroupMember.count).mockResolvedValueOnce(15);
        vi.mocked(mockPrismaSession.count)
          .mockResolvedValueOnce(8)  // eventCount
          .mockResolvedValueOnce(3); // upcomingEventCount

        const stats = await CachedAggregations.getGroupStats('group-1');

        expect(stats).toEqual({ memberCount: 15, eventCount: 8, upcomingEventCount: 3 });
      });

      it('returns cached stats when available', async () => {
        const cachedStats = { memberCount: 5, eventCount: 2, upcomingEventCount: 1 };
        vi.mocked(CacheService.get).mockResolvedValueOnce(cachedStats);

        const stats = await CachedAggregations.getGroupStats('group-cached');

        expect(stats).toEqual(cachedStats);
      });
    });

    describe('getTournamentStats', () => {
      it('returns tournament stats from database when not cached', async () => {
        vi.mocked(mockPrismaTournamentTeam.count).mockResolvedValueOnce(8);
        vi.mocked(mockPrismaTournamentMatch.count)
          .mockResolvedValueOnce(12) // matchCount
          .mockResolvedValueOnce(5); // completedMatchCount

        const stats = await CachedAggregations.getTournamentStats('tournament-1');

        expect(stats).toEqual({
          teamCount: 8,
          matchCount: 12,
          completedMatchCount: 5,
          inProgressMatchCount: 7,
        });
      });
    });

    describe('cache invalidation', () => {
      it('invalidateUserStats deletes cache key', async () => {
        await CachedAggregations.invalidateUserStats('user-1');
        expect(CacheService.del).toHaveBeenCalledWith('stats:user:user-1:events');
      });

      it('invalidateGroupStats deletes cache key', async () => {
        await CachedAggregations.invalidateGroupStats('group-1');
        expect(CacheService.del).toHaveBeenCalledWith('stats:group:group-1');
      });

      it('invalidateTournamentStats deletes cache key', async () => {
        await CachedAggregations.invalidateTournamentStats('tournament-1');
        expect(CacheService.del).toHaveBeenCalledWith('stats:tournament:tournament-1');
      });
    });
  });
});
