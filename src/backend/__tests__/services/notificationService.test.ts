/**
 * Notification Service Tests
 * Tests for the unified notification service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies at the top level
vi.mock('../../config/database', () => ({
  default: {
    eventNotification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    },
    groupNotification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    },
    teamUpNotification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    },
    tournamentNotification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}));

import prisma from '../../config/database';
import {
  getUserNotifications,
  markNotificationsAsRead,
  getNotificationStats,
  deleteNotifications,
  deleteAllReadNotifications
} from '../../services/notificationService';
import {
  mockEventNotification,
  mockEventNotifications,
  mockGroupNotifications,
  mockTeamUpNotifications as _mockTeamUpNotifications,
  mockTournamentNotifications as _mockTournamentNotifications,
} from '../__mocks__/mockData';

const mockPrisma = vi.mocked(prisma);

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserNotifications', () => {
    it('should get all unread notifications by default', async () => {
      // Use centralized mock data
      mockPrisma.eventNotification.findMany.mockResolvedValue([mockEventNotification] as unknown);
      mockPrisma.eventNotification.count.mockResolvedValue(1);
      mockPrisma.groupNotification.findMany.mockResolvedValue([]);
      mockPrisma.groupNotification.count.mockResolvedValue(0);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.teamUpNotification.count.mockResolvedValue(0);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.count.mockResolvedValue(0);

      const result = await getUserNotifications('user-1');

      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.notifications[0].notificationType).toBe('event');
    });

    it('should include read notifications when specified', async () => {
      mockPrisma.eventNotification.findMany.mockResolvedValue([]);
      mockPrisma.eventNotification.count.mockResolvedValue(0);
      mockPrisma.groupNotification.findMany.mockResolvedValue([]);
      mockPrisma.groupNotification.count.mockResolvedValue(0);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.teamUpNotification.count.mockResolvedValue(0);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.count.mockResolvedValue(0);

      await getUserNotifications('user-1', { includeRead: true });

      expect(mockPrisma.eventNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1'
          })
        })
      );
    });

    it('should filter by notification type', async () => {
      mockPrisma.eventNotification.findMany.mockResolvedValue([]);
      mockPrisma.eventNotification.count.mockResolvedValue(0);
      mockPrisma.groupNotification.findMany.mockResolvedValue([]);
      mockPrisma.groupNotification.count.mockResolvedValue(0);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.teamUpNotification.count.mockResolvedValue(0);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.count.mockResolvedValue(0);

      await getUserNotifications('user-1', { notificationType: 'event' });

      expect(mockPrisma.eventNotification.findMany).toHaveBeenCalled();
      expect(mockPrisma.groupNotification.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.teamUpNotification.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.tournamentNotification.findMany).not.toHaveBeenCalled();
    });

    it('should apply pagination', async () => {
      mockPrisma.eventNotification.findMany.mockResolvedValue([]);
      mockPrisma.eventNotification.count.mockResolvedValue(0);
      mockPrisma.groupNotification.findMany.mockResolvedValue([]);
      mockPrisma.groupNotification.count.mockResolvedValue(0);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.teamUpNotification.count.mockResolvedValue(0);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.count.mockResolvedValue(0);

      await getUserNotifications('user-1', { limit: 10, offset: 20 });

      expect(mockPrisma.eventNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 31,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
        })
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockPrisma.eventNotification.findMany.mockResolvedValue([]);
      mockPrisma.eventNotification.count.mockResolvedValue(0);
      mockPrisma.groupNotification.findMany.mockResolvedValue([]);
      mockPrisma.groupNotification.count.mockResolvedValue(0);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.teamUpNotification.count.mockResolvedValue(0);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.count.mockResolvedValue(0);

      await getUserNotifications('user-1', { startDate, endDate });

      expect(mockPrisma.eventNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          })
        })
      );
    });

    it('should return combined notifications from all types', async () => {
      // Use centralized mock data
      mockPrisma.eventNotification.findMany.mockResolvedValue([mockEventNotifications[0]] as unknown);
      mockPrisma.eventNotification.count.mockResolvedValue(1);
      mockPrisma.groupNotification.findMany.mockResolvedValue([mockGroupNotifications[0]] as unknown);
      mockPrisma.groupNotification.count.mockResolvedValue(1);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.teamUpNotification.count.mockResolvedValue(0);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.count.mockResolvedValue(0);

      const result = await getUserNotifications('user-1');

      expect(result.notifications).toHaveLength(2);
      expect(result.total).toBe(2);
      // Should be sorted by date descending
      expect(result.notifications[0].id).toBe('notif-4'); // group notification
      expect(result.notifications[1].id).toBe('notif-1'); // event notification
    });

    it('should return cursor metadata for next page when more results exist', async () => {
      const now = new Date('2026-01-01T00:00:00.000Z');
      const older = new Date('2025-12-31T00:00:00.000Z');
      const oldest = new Date('2025-12-30T00:00:00.000Z');

      mockPrisma.eventNotification.findMany.mockResolvedValue([
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'created',
          params: {},
          read: false,
          createdAt: now,
          event: { id: 'event-1', title: 'Event 1', startTime: now },
          user: { id: 'user-2', name: 'Alice' },
        },
        {
          id: 'notif-2',
          userId: 'user-1',
          type: 'created',
          params: {},
          read: false,
          createdAt: older,
          event: { id: 'event-2', title: 'Event 2', startTime: older },
          user: { id: 'user-3', name: 'Bob' },
        },
        {
          id: 'notif-3',
          userId: 'user-1',
          type: 'created',
          params: {},
          read: false,
          createdAt: oldest,
          event: { id: 'event-3', title: 'Event 3', startTime: oldest },
          user: { id: 'user-4', name: 'Carol' },
        },
      ] as unknown);
      mockPrisma.eventNotification.count.mockResolvedValue(3);
      mockPrisma.groupNotification.findMany.mockResolvedValue([]);
      mockPrisma.groupNotification.count.mockResolvedValue(0);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.teamUpNotification.count.mockResolvedValue(0);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.count.mockResolvedValue(0);

      const result = await getUserNotifications('user-1', { limit: 2 });

      expect(result.notifications).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeTruthy();
    });
  });

  describe('markNotificationsAsRead', () => {
    it('should mark specific notifications as read', async () => {
      mockPrisma.eventNotification.findMany.mockResolvedValue([{ id: 'notif-1' }] as unknown);
      mockPrisma.groupNotification.findMany.mockResolvedValue([{ id: 'notif-2' }] as unknown);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.eventNotification.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.groupNotification.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.teamUpNotification.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.tournamentNotification.updateMany.mockResolvedValue({ count: 0 });

      await markNotificationsAsRead('user-1', ['notif-1', 'notif-2']);

      expect(mockPrisma.eventNotification.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['notif-1', 'notif-2'] }, userId: 'user-1' },
        data: { read: true }
      });
      expect(mockPrisma.groupNotification.updateMany).toHaveBeenCalled();
      expect(mockPrisma.teamUpNotification.updateMany).toHaveBeenCalled();
      expect(mockPrisma.tournamentNotification.updateMany).toHaveBeenCalled();
    });

    it('should mark all notifications as read when no IDs provided', async () => {
      mockPrisma.eventNotification.updateMany.mockResolvedValue({ count: 5 });
      mockPrisma.groupNotification.updateMany.mockResolvedValue({ count: 3 });
      mockPrisma.teamUpNotification.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.tournamentNotification.updateMany.mockResolvedValue({ count: 1 });

      await markNotificationsAsRead('user-1');

      expect(mockPrisma.eventNotification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        data: { read: true }
      });
      expect(mockPrisma.groupNotification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        data: { read: true }
      });
    });

    it('should handle empty notification IDs array', async () => {
      mockPrisma.eventNotification.updateMany.mockResolvedValue({ count: 5 });
      mockPrisma.groupNotification.updateMany.mockResolvedValue({ count: 3 });
      mockPrisma.teamUpNotification.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.tournamentNotification.updateMany.mockResolvedValue({ count: 1 });

      await markNotificationsAsRead('user-1', []);

      // Should mark all as read when empty array is provided
      expect(mockPrisma.eventNotification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        data: { read: true }
      });
    });
  });

  describe('getNotificationStats', () => {
    it('should return comprehensive notification statistics', async () => {
      mockPrisma.eventNotification.count
        .mockResolvedValueOnce(5) // unread
        .mockResolvedValueOnce(10); // total
      mockPrisma.groupNotification.count
        .mockResolvedValueOnce(3) // unread
        .mockResolvedValueOnce(8); // total
      mockPrisma.teamUpNotification.count
        .mockResolvedValueOnce(2) // unread
        .mockResolvedValueOnce(4); // total
      mockPrisma.tournamentNotification.count
        .mockResolvedValueOnce(1) // unread
        .mockResolvedValueOnce(2); // total
      mockPrisma.eventNotification.findMany.mockResolvedValue([
        { type: 'event_created' },
        { type: 'event_created' },
        { type: 'event_updated' }
      ]);

      const stats = await getNotificationStats('user-1');

      expect(stats.unread).toBe(11); // 5 + 3 + 2 + 1
      expect(stats.unreadEvent).toBe(5);
      expect(stats.unreadGroup).toBe(3);
      expect(stats.unreadTeamUp).toBe(2);
      expect(stats.unreadTournament).toBe(1);
      expect(stats.total).toBe(24); // 10 + 8 + 4 + 2
      expect(stats.last7Days).toBe(3);
      expect(stats.typeCounts).toEqual({
        event_created: 2,
        event_updated: 1
      });
    });

    it('should handle user with no notifications', async () => {
      mockPrisma.eventNotification.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.groupNotification.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.teamUpNotification.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.tournamentNotification.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.eventNotification.findMany.mockResolvedValue([]);

      const stats = await getNotificationStats('user-1');

      expect(stats.unread).toBe(0);
      expect(stats.total).toBe(0);
      expect(stats.last7Days).toBe(0);
      expect(stats.typeCounts).toEqual({});
    });
  });

  describe('deleteNotifications', () => {
    it('should delete specific notifications', async () => {
      mockPrisma.eventNotification.findMany.mockResolvedValue([{ id: 'notif-1' }, { id: 'notif-2' }] as unknown);
      mockPrisma.groupNotification.findMany.mockResolvedValue([{ id: 'notif-3' }] as unknown);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.eventNotification.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.groupNotification.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.teamUpNotification.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.tournamentNotification.deleteMany.mockResolvedValue({ count: 1 });

      const result = await deleteNotifications('user-1', ['notif-1', 'notif-2', 'notif-3']);

      expect(result.deletedCount).toBe(4); // 2 + 1 + 0 + 1
      expect(mockPrisma.eventNotification.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['notif-1', 'notif-2', 'notif-3'] }, userId: 'user-1' }
      });
    });

    it('should return zero count for empty array', async () => {
      const result = await deleteNotifications('user-1', []);

      expect(result.deletedCount).toBe(0);
      expect(mockPrisma.eventNotification.deleteMany).not.toHaveBeenCalled();
    });

    it('should handle user security by checking userId', async () => {
      mockPrisma.eventNotification.findMany.mockResolvedValue([{ id: 'notif-1' }] as unknown);
      mockPrisma.groupNotification.findMany.mockResolvedValue([]);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.eventNotification.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.groupNotification.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.teamUpNotification.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.tournamentNotification.deleteMany.mockResolvedValue({ count: 0 });

      await deleteNotifications('user-1', ['notif-1']);

      // Verify userId is included in the query
      expect(mockPrisma.eventNotification.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ userId: 'user-1' })
      });
    });
  });

  describe('deleteAllReadNotifications', () => {
    it('should delete all read notifications for a user', async () => {
      mockPrisma.eventNotification.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.groupNotification.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.teamUpNotification.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.tournamentNotification.deleteMany.mockResolvedValue({ count: 2 });

      const result = await deleteAllReadNotifications('user-1');

      expect(result.deletedCount).toBe(20); // 10 + 5 + 3 + 2
      expect(mockPrisma.eventNotification.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: true }
      });
      expect(mockPrisma.groupNotification.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: true }
      });
    });

    it('should return zero count when no read notifications exist', async () => {
      mockPrisma.eventNotification.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.groupNotification.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.teamUpNotification.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.tournamentNotification.deleteMany.mockResolvedValue({ count: 0 });

      const result = await deleteAllReadNotifications('user-1');

      expect(result.deletedCount).toBe(0);
    });

    it('should only delete read notifications', async () => {
      mockPrisma.eventNotification.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.groupNotification.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.teamUpNotification.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.tournamentNotification.deleteMany.mockResolvedValue({ count: 1 });

      await deleteAllReadNotifications('user-1');

      // Verify only read:true notifications are deleted
      expect(mockPrisma.eventNotification.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: true }
      });
    });
  });

  describe('getUserNotifications - metadata enrichment', () => {
    it('should enrich event notifications with high priority for cancelled type', async () => {
      const mockEventNotifications = [
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'cancelled',
          params: { eventTitle: 'Soccer Match' },
          read: false,
          createdAt: new Date(),
          event: { id: 'event-1', title: 'Soccer Match', startTime: new Date() },
          user: { id: 'user-2', name: 'John' }
        }
      ];

      mockPrisma.eventNotification.findMany.mockResolvedValue(mockEventNotifications);
      mockPrisma.eventNotification.count.mockResolvedValue(1);
      mockPrisma.groupNotification.findMany.mockResolvedValue([]);
      mockPrisma.groupNotification.count.mockResolvedValue(0);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.teamUpNotification.count.mockResolvedValue(0);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.count.mockResolvedValue(0);

      const result = await getUserNotifications('user-1');

      expect(result.notifications[0].metadata?.priority).toBe('high');
      expect(result.notifications[0].metadata?.actionUrl).toBe('/events/event-1');
      expect(result.notifications[0].metadata?.actionText).toBe('View Event');
    });

    it('should enrich group notifications with action URL and text for join_request', async () => {
      const mockGroupNotifications = [
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'join_request',
          params: { groupName: 'Soccer Team' },
          read: false,
          createdAt: new Date(),
          group: { id: 'group-1', name: 'Soccer Team' }
        }
      ];

      mockPrisma.eventNotification.findMany.mockResolvedValue([]);
      mockPrisma.eventNotification.count.mockResolvedValue(0);
      mockPrisma.groupNotification.findMany.mockResolvedValue(mockGroupNotifications);
      mockPrisma.groupNotification.count.mockResolvedValue(1);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.teamUpNotification.count.mockResolvedValue(0);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.count.mockResolvedValue(0);

      const result = await getUserNotifications('user-1');

      expect(result.notifications[0].metadata?.actionUrl).toBe('/groups/group-1');
      expect(result.notifications[0].metadata?.actionText).toBe('Review Request');
    });

    it('should enrich teamup notifications with medium priority for accepted type', async () => {
      const mockTeamUpNotifications = [
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'teamup_accepted',
          params: { title: 'Basketball Game' },
          read: false,
          createdAt: new Date(),
          teamUpRequest: { id: 'teamup-1', title: 'Basketball Game', sportType: 'basketball' }
        }
      ];

      mockPrisma.eventNotification.findMany.mockResolvedValue([]);
      mockPrisma.eventNotification.count.mockResolvedValue(0);
      mockPrisma.groupNotification.findMany.mockResolvedValue([]);
      mockPrisma.groupNotification.count.mockResolvedValue(0);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue(mockTeamUpNotifications);
      mockPrisma.teamUpNotification.count.mockResolvedValue(1);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.count.mockResolvedValue(0);

      const result = await getUserNotifications('user-1');

      expect(result.notifications[0].metadata?.priority).toBe('medium');
      expect(result.notifications[0].metadata?.actionUrl).toBe('/teamup/teamup-1');
      expect(result.notifications[0].metadata?.actionText).toBe('View Request');
    });

    it('should enrich teamup notifications with specific action text for response type', async () => {
      const mockTeamUpNotifications = [
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'teamup_response',
          params: { title: 'Basketball Game' },
          read: false,
          createdAt: new Date(),
          teamUpRequest: { id: 'teamup-1', title: 'Basketball Game', sportType: 'basketball' }
        }
      ];

      mockPrisma.eventNotification.findMany.mockResolvedValue([]);
      mockPrisma.eventNotification.count.mockResolvedValue(0);
      mockPrisma.groupNotification.findMany.mockResolvedValue([]);
      mockPrisma.groupNotification.count.mockResolvedValue(0);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue(mockTeamUpNotifications);
      mockPrisma.teamUpNotification.count.mockResolvedValue(1);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.count.mockResolvedValue(0);

      const result = await getUserNotifications('user-1');

      expect(result.notifications[0].metadata?.actionText).toBe('Review Response');
    });

    it('should enrich teamup notifications with specific action text for comment type', async () => {
      const mockTeamUpNotifications = [
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'teamup_comment',
          params: { title: 'Basketball Game' },
          read: false,
          createdAt: new Date(),
          teamUpRequest: { id: 'teamup-1', title: 'Basketball Game', sportType: 'basketball' }
        }
      ];

      mockPrisma.eventNotification.findMany.mockResolvedValue([]);
      mockPrisma.eventNotification.count.mockResolvedValue(0);
      mockPrisma.groupNotification.findMany.mockResolvedValue([]);
      mockPrisma.groupNotification.count.mockResolvedValue(0);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue(mockTeamUpNotifications);
      mockPrisma.teamUpNotification.count.mockResolvedValue(1);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.count.mockResolvedValue(0);

      const result = await getUserNotifications('user-1');

      expect(result.notifications[0].metadata?.actionText).toBe('View Comment');
    });

    it('should enrich tournament notifications with action URL and text for team_registered', async () => {
      const mockTournamentNotifications = [
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'team_registered',
          params: { tournamentName: 'Summer Cup' },
          read: false,
          createdAt: new Date(),
          tournament: { id: 'tournament-1', name: 'Summer Cup', sportType: 'soccer' }
        }
      ];

      mockPrisma.eventNotification.findMany.mockResolvedValue([]);
      mockPrisma.eventNotification.count.mockResolvedValue(0);
      mockPrisma.groupNotification.findMany.mockResolvedValue([]);
      mockPrisma.groupNotification.count.mockResolvedValue(0);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.teamUpNotification.count.mockResolvedValue(0);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue(mockTournamentNotifications);
      mockPrisma.tournamentNotification.count.mockResolvedValue(1);

      const result = await getUserNotifications('user-1');

      expect(result.notifications[0].metadata?.actionUrl).toBe('/tournaments/tournament-1');
      expect(result.notifications[0].metadata?.actionText).toBe('View Team');
      expect(result.notifications[0].metadata?.priority).toBe('medium');
    });

    it('should enrich tournament notifications with action text for score_submitted', async () => {
      const mockTournamentNotifications = [
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'score_submitted',
          params: { tournamentName: 'Summer Cup' },
          read: false,
          createdAt: new Date(),
          tournament: { id: 'tournament-1', name: 'Summer Cup', sportType: 'soccer' }
        }
      ];

      mockPrisma.eventNotification.findMany.mockResolvedValue([]);
      mockPrisma.eventNotification.count.mockResolvedValue(0);
      mockPrisma.groupNotification.findMany.mockResolvedValue([]);
      mockPrisma.groupNotification.count.mockResolvedValue(0);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.teamUpNotification.count.mockResolvedValue(0);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue(mockTournamentNotifications);
      mockPrisma.tournamentNotification.count.mockResolvedValue(1);

      const result = await getUserNotifications('user-1');

      expect(result.notifications[0].metadata?.actionText).toBe('Review Score');
    });

    it('should enrich notifications with low priority for other types', async () => {
      const mockEventNotifications = [
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'other_type',
          params: { eventTitle: 'Soccer Match' },
          read: false,
          createdAt: new Date(),
          event: { id: 'event-1', title: 'Soccer Match', startTime: new Date() },
          user: { id: 'user-2', name: 'John' }
        }
      ];

      mockPrisma.eventNotification.findMany.mockResolvedValue(mockEventNotifications);
      mockPrisma.eventNotification.count.mockResolvedValue(1);
      mockPrisma.groupNotification.findMany.mockResolvedValue([]);
      mockPrisma.groupNotification.count.mockResolvedValue(0);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.teamUpNotification.count.mockResolvedValue(0);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.count.mockResolvedValue(0);

      const result = await getUserNotifications('user-1');

      expect(result.notifications[0].metadata?.priority).toBe('low');
    });

    it('should apply search query filter on notifications', async () => {
      const mockEventNotifications = [
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'event_created',
          params: { eventTitle: 'Soccer Match' },
          read: false,
          createdAt: new Date('2024-01-01'),
          event: { id: 'event-1', title: 'Soccer Match', startTime: new Date() },
          user: { id: 'user-2', name: 'John' }
        },
        {
          id: 'notif-2',
          userId: 'user-1',
          type: 'event_updated',
          params: { eventTitle: 'Basketball Game' },
          read: false,
          createdAt: new Date('2024-01-02'),
          event: { id: 'event-2', title: 'Basketball Game', startTime: new Date() },
          user: { id: 'user-3', name: 'Jane' }
        }
      ];

      mockPrisma.eventNotification.findMany.mockResolvedValue(mockEventNotifications);
      mockPrisma.eventNotification.count.mockResolvedValue(2);
      mockPrisma.groupNotification.findMany.mockResolvedValue([]);
      mockPrisma.groupNotification.count.mockResolvedValue(0);
      mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
      mockPrisma.teamUpNotification.count.mockResolvedValue(0);
      mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
      mockPrisma.tournamentNotification.count.mockResolvedValue(0);

      const result = await getUserNotifications('user-1', { searchQuery: 'soccer' });

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].params?.eventTitle).toBe('Soccer Match');
      expect(result.total).toBe(1);
    });
  });
});
