/**
 * Bulk Notification Service Tests
 * Tests for bulk notification operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies at the top level
vi.mock('../../config/database', () => ({
  default: {
    eventNotification: {
      createMany: vi.fn()
    },
    groupNotification: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    },
    teamUpNotification: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

import prisma from '../../config/database';
import {
  createBulkEventNotifications,
  createBulkGroupNotifications,
  createBulkTeamUpNotifications,
  markNotificationsAsReadBulk,
  deleteNotificationsBulk
} from '../../services/bulkNotificationService';

const mockPrisma = vi.mocked(prisma);

// Test constants
const TEST_LARGE_BATCH_SIZE = 1000;

describe('BulkNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBulkEventNotifications', () => {
    it('should create session notifications for multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      mockPrisma.eventNotification.createMany = vi.fn().mockResolvedValue({ count: 3 });

      await createBulkEventNotifications(
        'session-123',
        userIds,
        'session_created',
        { eventTitle: 'Soccer Match' }
      );

      expect(mockPrisma.eventNotification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            sessionId: 'session-123',
            userId: 'user-1',
            type: 'session_created',
            params: { eventTitle: 'Soccer Match' }
          })
        ]),
        skipDuplicates: true
      });
    });

    it('should remove duplicate user IDs', async () => {
      const userIds = ['user-1', 'user-1', 'user-2', 'user-2', 'user-3'];
      mockPrisma.eventNotification.createMany = vi.fn().mockResolvedValue({ count: 3 });

      await createBulkEventNotifications(
        'session-123',
        userIds,
        'session_created'
      );

      const call = mockPrisma.eventNotification.createMany.mock.calls[0][0];
      expect(call.data).toHaveLength(3);
    });

    it('should handle empty user list', async () => {
      mockPrisma.eventNotification.createMany = vi.fn();

      await createBulkEventNotifications(
        'session-123',
        [],
        'session_created'
      );

      expect(mockPrisma.eventNotification.createMany).not.toHaveBeenCalled();
    });

    it('should process large batches in chunks', async () => {
      // Create large batch of user IDs
      const userIds = Array.from({ length: TEST_LARGE_BATCH_SIZE }, (_, i) => `user-${i}`);
      mockPrisma.eventNotification.createMany = vi.fn().mockResolvedValue({ count: 500 });

      await createBulkEventNotifications(
        'session-123',
        userIds,
        'session_created'
      );

      // Should be called twice (default batch size is 500)
      expect(mockPrisma.eventNotification.createMany).toHaveBeenCalledTimes(2);
    });

    it('should include metadata when provided', async () => {
      const userIds = ['user-1'];
      const metadata = { groupName: 'Sports Group' };
      mockPrisma.eventNotification.createMany = vi.fn().mockResolvedValue({ count: 1 });

      await createBulkEventNotifications(
        'session-123',
        userIds,
        'session_created',
        {},
        metadata
      );

      expect(mockPrisma.eventNotification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            metadata
          })
        ]),
        skipDuplicates: true
      });
    });

    it('should set default params and metadata', async () => {
      const userIds = ['user-1'];
      mockPrisma.eventNotification.createMany = vi.fn().mockResolvedValue({ count: 1 });

      await createBulkEventNotifications(
        'session-123',
        userIds,
        'session_created'
      );

      expect(mockPrisma.eventNotification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            params: {},
            metadata: {}
          })
        ]),
        skipDuplicates: true
      });
    });
  });

  describe('createBulkGroupNotifications', () => {
    it('should create group notifications for multiple users', async () => {
      const userIds = ['user-1', 'user-2'];
      mockPrisma.groupNotification.createMany = vi.fn().mockResolvedValue({ count: 2 });

      await createBulkGroupNotifications(
        'group-123',
        userIds,
        'session_created',
        { groupName: 'Sports Group' }
      );

      expect(mockPrisma.groupNotification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            groupId: 'group-123',
            userId: 'user-1',
            type: 'session_created'
          })
        ]),
        skipDuplicates: true
      });
    });

    it('should handle empty user list', async () => {
      mockPrisma.groupNotification.createMany = vi.fn();

      await createBulkGroupNotifications(
        'group-123',
        [],
        'session_created'
      );

      expect(mockPrisma.groupNotification.createMany).not.toHaveBeenCalled();
    });

    it('should remove duplicate user IDs', async () => {
      const userIds = ['user-1', 'user-1', 'user-2'];
      mockPrisma.groupNotification.createMany = vi.fn().mockResolvedValue({ count: 2 });

      await createBulkGroupNotifications(
        'group-123',
        userIds,
        'session_created'
      );

      const call = mockPrisma.groupNotification.createMany.mock.calls[0][0];
      expect(call.data).toHaveLength(2);
    });
  });

  describe('createBulkTeamUpNotifications', () => {
    it('should create TeamUp notifications for multiple users', async () => {
      const userIds = ['user-1', 'user-2'];
      mockPrisma.teamUpNotification.createMany = vi.fn().mockResolvedValue({ count: 2 });

      await createBulkTeamUpNotifications(
        'teamup-123',
        userIds,
        'teamup_nearby',
        { title: 'Soccer Game' }
      );

      expect(mockPrisma.teamUpNotification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            teamUpRequestId: 'teamup-123',
            userId: 'user-1',
            type: 'teamup_nearby'
          })
        ]),
        skipDuplicates: true
      });
    });

    it('should include metadata when provided', async () => {
      const userIds = ['user-1'];
      const metadata = { location: 'New York' };
      mockPrisma.teamUpNotification.createMany = vi.fn().mockResolvedValue({ count: 1 });

      await createBulkTeamUpNotifications(
        'teamup-123',
        userIds,
        'teamup_nearby',
        {},
        metadata
      );

      expect(mockPrisma.teamUpNotification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            metadata
          })
        ]),
        skipDuplicates: true
      });
    });

    it('should handle empty user list', async () => {
      mockPrisma.teamUpNotification.createMany = vi.fn();

      await createBulkTeamUpNotifications(
        'teamup-123',
        [],
        'teamup_nearby'
      );

      expect(mockPrisma.teamUpNotification.createMany).not.toHaveBeenCalled();
    });
  });

  describe('markNotificationsAsReadBulk', () => {
    it('should mark session notifications as read', async () => {
      const notificationIds = ['notif-1', 'notif-2', 'notif-3'];
      mockPrisma.eventNotification.updateMany = vi.fn().mockResolvedValue({ count: 3 });

      const count = await markNotificationsAsReadBulk(notificationIds, 'session');

      expect(count).toBe(3);
      expect(mockPrisma.eventNotification.updateMany).toHaveBeenCalledWith({
        where: { id: { in: notificationIds } },
        data: { read: true }
      });
    });

    it('should mark group notifications as read', async () => {
      const notificationIds = ['notif-1', 'notif-2'];
      mockPrisma.groupNotification.updateMany = vi.fn().mockResolvedValue({ count: 2 });

      const count = await markNotificationsAsReadBulk(notificationIds, 'group');

      expect(count).toBe(2);
      expect(mockPrisma.groupNotification.updateMany).toHaveBeenCalledWith({
        where: { id: { in: notificationIds } },
        data: { read: true }
      });
    });

    it('should mark TeamUp notifications as read', async () => {
      const notificationIds = ['notif-1'];
      mockPrisma.teamUpNotification.updateMany = vi.fn().mockResolvedValue({ count: 1 });

      const count = await markNotificationsAsReadBulk(notificationIds, 'teamup');

      expect(count).toBe(1);
      expect(mockPrisma.teamUpNotification.updateMany).toHaveBeenCalledWith({
        where: { id: { in: notificationIds } },
        data: { read: true }
      });
    });

    it('should return 0 for empty notification list', async () => {
      const count = await markNotificationsAsReadBulk([], 'session');

      expect(count).toBe(0);
      expect(mockPrisma.eventNotification.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteNotificationsBulk', () => {
    it('should delete session notifications', async () => {
      const notificationIds = ['notif-1', 'notif-2'];
      mockPrisma.eventNotification.deleteMany = vi.fn().mockResolvedValue({ count: 2 });

      const count = await deleteNotificationsBulk(notificationIds, 'session');

      expect(count).toBe(2);
      expect(mockPrisma.eventNotification.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: notificationIds } }
      });
    });

    it('should delete group notifications', async () => {
      const notificationIds = ['notif-1'];
      mockPrisma.groupNotification.deleteMany = vi.fn().mockResolvedValue({ count: 1 });

      const count = await deleteNotificationsBulk(notificationIds, 'group');

      expect(count).toBe(1);
      expect(mockPrisma.groupNotification.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: notificationIds } }
      });
    });

    it('should delete TeamUp notifications', async () => {
      const notificationIds = ['notif-1', 'notif-2', 'notif-3'];
      mockPrisma.teamUpNotification.deleteMany = vi.fn().mockResolvedValue({ count: 3 });

      const count = await deleteNotificationsBulk(notificationIds, 'teamup');

      expect(count).toBe(3);
      expect(mockPrisma.teamUpNotification.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: notificationIds } }
      });
    });

    it('should return 0 for empty notification list', async () => {
      const count = await deleteNotificationsBulk([], 'session');

      expect(count).toBe(0);
      expect(mockPrisma.eventNotification.deleteMany).not.toHaveBeenCalled();
    });
  });
});
