/**
 * Bulk Notification Service Tests
 * Tests for bulk notification operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies at the top level
vi.mock('../../config/database', () => ({
  default: {
    sessionNotification: {
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

vi.mock('../../services/notificationFactory', () => ({
  NotificationFactory: {
    createSessionNotifications: vi.fn().mockResolvedValue({ created: 0, skipped: 0 }),
    createGroupNotifications: vi.fn().mockResolvedValue({ created: 0, skipped: 0 }),
    createTeamUpNotifications: vi.fn().mockResolvedValue({ created: 0, skipped: 0 }),
  },
}));

import prisma from '../../config/database';
import { NotificationFactory } from '../../services/notificationFactory';
import {
  createBulkEventNotifications,
  createBulkGroupNotifications,
  createBulkTeamUpNotifications,
  markNotificationsAsReadBulk,
  deleteNotificationsBulk
} from '../../services/bulkNotificationService';

const mockPrisma = vi.mocked(prisma);
const mockNotificationFactory = vi.mocked(NotificationFactory);

// Test constants
const TEST_LARGE_BATCH_SIZE = 1000;

describe('BulkNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBulkEventNotifications', () => {
    it('should create session notifications for multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];

      await createBulkEventNotifications(
        'session-123',
        userIds,
        'session_created',
        { eventTitle: 'Soccer Match' }
      );

      expect(mockNotificationFactory.createSessionNotifications).toHaveBeenCalledWith({
        sessionId: 'session-123',
        userIds,
        type: 'session_created',
        params: { eventTitle: 'Soccer Match' },
        metadata: {},
        checkMutePreference: false,
      });
    });

    it('should remove duplicate user IDs', async () => {
      const userIds = ['user-1', 'user-1', 'user-2', 'user-2', 'user-3'];

      await createBulkEventNotifications(
        'session-123',
        userIds,
        'session_created'
      );

      expect(mockNotificationFactory.createSessionNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
          userIds: ['user-1', 'user-2', 'user-3'],
        })
      );
    });

    it('should handle empty user list', async () => {
      await createBulkEventNotifications(
        'session-123',
        [],
        'session_created'
      );

      expect(mockNotificationFactory.createSessionNotifications).not.toHaveBeenCalled();
    });

    it('should process large batches in chunks', async () => {
      // Create large batch of user IDs
      const userIds = Array.from({ length: TEST_LARGE_BATCH_SIZE }, (_, i) => `user-${i}`);

      await createBulkEventNotifications(
        'session-123',
        userIds,
        'session_created'
      );

      // Should be called twice (default batch size is 500)
      expect(mockNotificationFactory.createSessionNotifications).toHaveBeenCalledTimes(2);
    });

    it('should include metadata when provided', async () => {
      const userIds = ['user-1'];
      const metadata = { groupName: 'Sports Group' };

      await createBulkEventNotifications(
        'session-123',
        userIds,
        'session_created',
        {},
        metadata
      );

      expect(mockNotificationFactory.createSessionNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ metadata })
      );
    });

    it('should set default params and metadata', async () => {
      const userIds = ['user-1'];

      await createBulkEventNotifications(
        'session-123',
        userIds,
        'session_created'
      );

      expect(mockNotificationFactory.createSessionNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ params: {}, metadata: {} })
      );
    });
  });

  describe('createBulkGroupNotifications', () => {
    it('should create group notifications for multiple users', async () => {
      const userIds = ['user-1', 'user-2'];

      await createBulkGroupNotifications(
        'group-123',
        userIds,
        'session_created',
        { groupName: 'Sports Group' }
      );

      expect(mockNotificationFactory.createGroupNotifications).toHaveBeenCalledWith({
        groupId: 'group-123',
        userIds,
        type: 'session_created',
        params: { groupName: 'Sports Group' },
        checkMutePreference: false,
      });
    });

    it('should handle empty user list', async () => {
      await createBulkGroupNotifications(
        'group-123',
        [],
        'session_created'
      );

      expect(mockNotificationFactory.createGroupNotifications).not.toHaveBeenCalled();
    });

    it('should remove duplicate user IDs', async () => {
      const userIds = ['user-1', 'user-1', 'user-2'];

      await createBulkGroupNotifications(
        'group-123',
        userIds,
        'session_created'
      );

      expect(mockNotificationFactory.createGroupNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ userIds: ['user-1', 'user-2'] })
      );
    });
  });

  describe('createBulkTeamUpNotifications', () => {
    it('should create TeamUp notifications for multiple users', async () => {
      const userIds = ['user-1', 'user-2'];

      await createBulkTeamUpNotifications(
        'teamup-123',
        userIds,
        'teamup_nearby',
        { title: 'Soccer Game' }
      );

      expect(mockNotificationFactory.createTeamUpNotifications).toHaveBeenCalledWith({
        teamUpRequestId: 'teamup-123',
        userIds,
        type: 'teamup_nearby',
        params: { title: 'Soccer Game' },
        metadata: {},
        checkMutePreference: false,
      });
    });

    it('should include metadata when provided', async () => {
      const userIds = ['user-1'];
      const metadata = { location: 'New York' };

      await createBulkTeamUpNotifications(
        'teamup-123',
        userIds,
        'teamup_nearby',
        {},
        metadata
      );

      expect(mockNotificationFactory.createTeamUpNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ metadata })
      );
    });

    it('should handle empty user list', async () => {
      await createBulkTeamUpNotifications(
        'teamup-123',
        [],
        'teamup_nearby'
      );

      expect(mockNotificationFactory.createTeamUpNotifications).not.toHaveBeenCalled();
    });
  });

  describe('markNotificationsAsReadBulk', () => {
    it('should mark session notifications as read', async () => {
      const notificationIds = ['notif-1', 'notif-2', 'notif-3'];
      mockPrisma.sessionNotification.updateMany = vi.fn().mockResolvedValue({ count: 3 });

      const count = await markNotificationsAsReadBulk(notificationIds, 'session');

      expect(count).toBe(3);
      expect(mockPrisma.sessionNotification.updateMany).toHaveBeenCalledWith({
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
      expect(mockPrisma.sessionNotification.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteNotificationsBulk', () => {
    it('should delete session notifications', async () => {
      const notificationIds = ['notif-1', 'notif-2'];
      mockPrisma.sessionNotification.deleteMany = vi.fn().mockResolvedValue({ count: 2 });

      const count = await deleteNotificationsBulk(notificationIds, 'session');

      expect(count).toBe(2);
      expect(mockPrisma.sessionNotification.deleteMany).toHaveBeenCalledWith({
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
      expect(mockPrisma.sessionNotification.deleteMany).not.toHaveBeenCalled();
    });
  });
});
