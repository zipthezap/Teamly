/**
 * Tests for NotificationFactory Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationFactory } from '../../services/notificationFactory';
import prisma from '../../config/database';

// Mock the dependencies
vi.mock('../../config/database', () => ({
  default: {
    eventNotification: {
      createMany: vi.fn(),
      findMany: vi.fn()
    },
    groupNotification: {
      createMany: vi.fn(),
      findMany: vi.fn()
    },
    teamUpNotification: {
      createMany: vi.fn(),
      findMany: vi.fn()
    },
    tournamentNotification: {
      createMany: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

vi.mock('../../utils/notificationHelper', () => ({
  filterUnmutedUsers: vi.fn((userIds) => Promise.resolve(userIds))
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn()
  }
}));

describe('NotificationFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createEventNotifications', () => {
    it('should create event notifications for multiple users', async () => {
      const mockCreateMany = vi.mocked(prisma.eventNotification.createMany);
      mockCreateMany.mockResolvedValue({ count: 3 });

      const result = await NotificationFactory.createEventNotifications({
        eventId: 'event-1',
        type: 'join',
        userIds: ['user-1', 'user-2', 'user-3'],
        params: {
          eventTitle: 'Test Event',
          name: 'John Doe'
        },
        checkMutePreference: false
      });

      expect(result.created).toBe(3);
      expect(result.skipped).toBe(0);
      expect(mockCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            eventId: 'event-1',
            userId: 'user-1',
            type: 'join'
          }),
          expect.objectContaining({
            eventId: 'event-1',
            userId: 'user-2',
            type: 'join'
          }),
          expect.objectContaining({
            eventId: 'event-1',
            userId: 'user-3',
            type: 'join'
          })
        ]),
        skipDuplicates: true
      });
    });

    it('should handle empty user list', async () => {
      const result = await NotificationFactory.createEventNotifications({
        eventId: 'event-1',
        type: 'join',
        userIds: [],
        params: {}
      });

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(prisma.eventNotification.createMany).not.toHaveBeenCalled();
    });

    it('should deduplicate notifications within time window', async () => {
      const mockFindMany = vi.mocked(prisma.eventNotification.findMany);
      const mockCreateMany = vi.mocked(prisma.eventNotification.createMany);

      // Simulate existing notifications for user-1
      mockFindMany.mockResolvedValue([
        { userId: 'user-1' }
      ] as any);
      mockCreateMany.mockResolvedValue({ count: 2 });

      const result = await NotificationFactory.createEventNotifications({
        eventId: 'event-1',
        type: 'join',
        userIds: ['user-1', 'user-2', 'user-3'],
        params: {},
        deduplicateWindow: 60000 // 1 minute
      });

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(1);
      expect(mockFindMany).toHaveBeenCalled();
    });

    it('should include metadata when provided', async () => {
      const mockCreateMany = vi.mocked(prisma.eventNotification.createMany);
      mockCreateMany.mockResolvedValue({ count: 1 });

      const metadata = {
        actionUrl: '/events/123',
        priority: 'high' as const
      };

      await NotificationFactory.createEventNotifications({
        eventId: 'event-1',
        type: 'late',
        userIds: ['user-1'],
        params: {},
        metadata
      });

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            metadata
          })
        ]),
        skipDuplicates: true
      });
    });
  });

  describe('createGroupNotifications', () => {
    it('should create group notifications for multiple users', async () => {
      const mockCreateMany = vi.mocked(prisma.groupNotification.createMany);
      mockCreateMany.mockResolvedValue({ count: 2 });

      const result = await NotificationFactory.createGroupNotifications({
        groupId: 'group-1',
        type: 'invited',
        userIds: ['user-1', 'user-2'],
        params: {
          groupName: 'Test Group',
          name: 'Admin User'
        }
      });

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(mockCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            groupId: 'group-1',
            userId: 'user-1',
            type: 'invited'
          }),
          expect.objectContaining({
            groupId: 'group-1',
            userId: 'user-2',
            type: 'invited'
          })
        ]),
        skipDuplicates: true
      });
    });

    it('should filter muted users when checkMutePreference is true', async () => {
      const { filterUnmutedUsers } = await import('../../utils/notificationHelper');
      const mockFilterUnmuted = vi.mocked(filterUnmutedUsers);
      const mockCreateMany = vi.mocked(prisma.groupNotification.createMany);
      
      // Mock filter to return only user-2
      mockFilterUnmuted.mockResolvedValue(['user-2']);
      mockCreateMany.mockResolvedValue({ count: 1 });

      const result = await NotificationFactory.createGroupNotifications({
        groupId: 'group-1',
        type: 'invited',
        userIds: ['user-1', 'user-2'],
        params: {},
        checkMutePreference: true
      });

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      expect(mockFilterUnmuted).toHaveBeenCalledWith(['user-1', 'user-2'], 'muteGroupInvites');
    });
  });

  describe('createTeamUpNotifications', () => {
    it('should create team-up notifications for multiple users', async () => {
      const mockCreateMany = vi.mocked(prisma.teamUpNotification.createMany);
      mockCreateMany.mockResolvedValue({ count: 2 });

      const result = await NotificationFactory.createTeamUpNotifications({
        teamUpRequestId: 'teamup-1',
        type: 'teamup_response',
        userIds: ['user-1', 'user-2'],
        params: {
          title: 'Test TeamUp',
          sportType: 'football'
        },
        checkMutePreference: false // Disable mute checking for test
      });

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(mockCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            teamUpRequestId: 'teamup-1',
            userId: 'user-1',
            type: 'teamup_response'
          })
        ]),
        skipDuplicates: true
      });
    });
  });

  describe('createTournamentNotifications', () => {
    it('should create tournament notifications for multiple users', async () => {
      const mockCreateMany = vi.mocked(prisma.tournamentNotification.createMany);
      mockCreateMany.mockResolvedValue({ count: 3 });

      const result = await NotificationFactory.createTournamentNotifications({
        tournamentId: 'tournament-1',
        type: 'team_registered',
        userIds: ['user-1', 'user-2', 'user-3'],
        params: {
          tournamentName: 'Test Tournament',
          teamName: 'Team A'
        }
      });

      expect(result.created).toBe(3);
      expect(result.skipped).toBe(0);
      expect(mockCreateMany).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle creation errors gracefully', async () => {
      const mockCreateMany = vi.mocked(prisma.eventNotification.createMany);
      const error = new Error('Database error');
      mockCreateMany.mockRejectedValue(error);

      await expect(
        NotificationFactory.createEventNotifications({
          eventId: 'event-1',
          type: 'join',
          userIds: ['user-1'],
          params: {}
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('transaction support', () => {
    it('should use provided transaction client', async () => {
      const mockTx = {
        eventNotification: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
          findMany: vi.fn().mockResolvedValue([])
        }
      } as any;

      const result = await NotificationFactory.createEventNotifications(
        {
          eventId: 'event-1',
          type: 'join',
          userIds: ['user-1'],
          params: {}
        },
        mockTx
      );

      expect(result.created).toBe(1);
      expect(mockTx.eventNotification.createMany).toHaveBeenCalled();
      expect(prisma.eventNotification.createMany).not.toHaveBeenCalled();
    });
  });
});
