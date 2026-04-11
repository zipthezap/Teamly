/**
 * Event Notification Service Tests
 * Tests for session-specific notification handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies at the top level
vi.mock('../../config/database', () => ({
  default: {
    eventNotification: {
      create: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

vi.mock('../../services/emailQueueService', () => ({
  sendEmailWithQueue: vi.fn()
}));

vi.mock('../../utils/notificationHelper', () => ({
  batchShouldSendEmailNotification: vi.fn()
}));

vi.mock('../../utils/validation', () => ({
  escapeHtml: vi.fn((str) => str)
}));

import { PrismaClient, SessionNotificationType } from '@prisma/client';
import prisma from '../../config/database';
import { sendEmailWithQueue } from '../../services/emailQueueService';
import { batchShouldSendEmailNotification } from '../../utils/notificationHelper';
import {
  sendEventInvitations,
  sendEventUpdateNotifications,
  sendEventCancellationNotifications,
  createEventNotifications,
  createActivityNotification,
  getEventActivity
} from '../../services/eventNotification';

const mockPrisma = vi.mocked(prisma);
const mockSendEmail = vi.mocked(sendEmailWithQueue);
const mockBatchNotification = vi.mocked(batchShouldSendEmailNotification);

describe('EventNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendEventInvitations', () => {
    it('should send invitations to eligible recipients', async () => {
      const recipients = [
        { id: 'user-1', name: 'Alice', email: 'alice@example.com', emailNotifications: true },
        { id: 'user-2', name: 'Bob', email: 'bob@example.com', emailNotifications: true },
        { id: 'creator', name: 'Creator', email: 'creator@example.com', emailNotifications: true }
      ];

      const notificationMap = new Map([
        ['user-1', true],
        ['user-2', true]
      ]);
      mockBatchNotification.mockResolvedValue(notificationMap);
      mockSendEmail.mockResolvedValue();

      await sendEventInvitations(
        recipients,
        'creator',
        'Soccer Match',
        new Date('2026-02-01T10:00:00Z'),
        'Sports Group'
      );

      expect(mockBatchNotification).toHaveBeenCalledWith(['user-1', 'user-2'], 'eventInvites');
      expect(mockSendEmail).toHaveBeenCalledTimes(2);
      expect(mockSendEmail).toHaveBeenCalledWith(
        'alice@example.com',
        expect.stringContaining('Event Invitation'),
        expect.any(String),
        expect.objectContaining({
          templateType: 'event_invitation'
        })
      );
    });

    it('should filter out the creator from recipients', async () => {
      const recipients = [
        { id: 'creator', name: 'Creator', email: 'creator@example.com', emailNotifications: true }
      ];

      mockBatchNotification.mockResolvedValue(new Map());

      await sendEventInvitations(
        recipients,
        'creator',
        'Soccer Match',
        new Date('2026-02-01T10:00:00Z'),
        'Sports Group'
      );

      expect(mockBatchNotification).toHaveBeenCalledWith([], 'eventInvites');
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should only send to users with notifications enabled', async () => {
      const recipients = [
        { id: 'user-1', name: 'Alice', email: 'alice@example.com', emailNotifications: true },
        { id: 'user-2', name: 'Bob', email: 'bob@example.com', emailNotifications: true }
      ];

      const notificationMap = new Map([
        ['user-1', true],
        ['user-2', false] // Bob has notifications disabled
      ]);
      mockBatchNotification.mockResolvedValue(notificationMap);
      mockSendEmail.mockResolvedValue();

      await sendEventInvitations(
        recipients,
        'creator',
        'Soccer Match',
        new Date('2026-02-01T10:00:00Z'),
        'Sports Group'
      );

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        'alice@example.com',
        expect.any(String),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('sendEventUpdateNotifications', () => {
    it('should send update notifications to participants', async () => {
      const participants = [
        { user: { id: 'user-1', name: 'Alice', email: 'alice@example.com', emailNotifications: true } },
        { user: { id: 'user-2', name: 'Bob', email: 'bob@example.com', emailNotifications: true } }
      ];

      const notificationMap = new Map([
        ['user-1', true],
        ['user-2', true]
      ]);
      mockBatchNotification.mockResolvedValue(notificationMap);
      mockSendEmail.mockResolvedValue();

      await sendEventUpdateNotifications(
        participants,
        'creator',
        'Soccer Match',
        'Sports Group'
      );

      expect(mockBatchNotification).toHaveBeenCalledWith(['user-1', 'user-2'], 'eventUpdates');
      expect(mockSendEmail).toHaveBeenCalledTimes(2);
    });

    it('should not notify the session creator', async () => {
      const participants = [
        { user: { id: 'creator', name: 'Creator', email: 'creator@example.com', emailNotifications: true } },
        { user: { id: 'user-1', name: 'Alice', email: 'alice@example.com', emailNotifications: true } }
      ];

      const notificationMap = new Map([['user-1', true]]);
      mockBatchNotification.mockResolvedValue(notificationMap);
      mockSendEmail.mockResolvedValue();

      await sendEventUpdateNotifications(
        participants,
        'creator',
        'Soccer Match',
        'Sports Group'
      );

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        'alice@example.com',
        expect.stringContaining('Event Updated'),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('sendEventCancellationNotifications', () => {
    it('should send cancellation notifications to participants', async () => {
      const participants = [
        { user: { id: 'user-1', name: 'Alice', email: 'alice@example.com', emailNotifications: true } },
        { user: { id: 'user-2', name: 'Bob', email: 'bob@example.com', emailNotifications: true } }
      ];

      const notificationMap = new Map([
        ['user-1', true],
        ['user-2', true]
      ]);
      mockBatchNotification.mockResolvedValue(notificationMap);
      mockSendEmail.mockResolvedValue();

      await sendEventCancellationNotifications(
        participants,
        'creator',
        'Soccer Match',
        'Sports Group'
      );

      expect(mockBatchNotification).toHaveBeenCalledWith(['user-1', 'user-2'], 'eventCancellations');
      expect(mockSendEmail).toHaveBeenCalledTimes(2);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Event Cancelled'),
        expect.any(String),
        expect.objectContaining({
          templateType: 'event_cancellation'
        })
      );
    });
  });

  describe('createEventNotifications', () => {
    it('should create notification records for multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      mockPrisma.eventNotification.create = vi.fn().mockResolvedValue({});

      await createEventNotifications(
        'session-123',
        userIds,
        'session_created' as SessionNotificationType,
        mockPrisma as unknown as PrismaClient
      );

      expect(mockPrisma.eventNotification.create).toHaveBeenCalledTimes(3);
      expect(mockPrisma.eventNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: 'session-123',
          userId: 'user-1',
          type: 'session_created'
        })
      });
    });

    it('should include metadata when provided', async () => {
      const userIds = ['user-1'];
      const metadata = { eventTitle: 'Soccer Match', groupName: 'Sports Group' };
      mockPrisma.eventNotification.create = vi.fn().mockResolvedValue({});

      await createEventNotifications(
        'session-123',
        userIds,
        'session_created' as SessionNotificationType,
        mockPrisma as unknown as PrismaClient,
        metadata
      );

      expect(mockPrisma.eventNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: 'session-123',
          userId: 'user-1',
          type: 'session_created',
          metadata
        })
      });
    });

    it('should handle empty user list', async () => {
      mockPrisma.eventNotification.create = vi.fn().mockResolvedValue({});

      await createEventNotifications(
        'session-123',
        [],
        'session_created' as SessionNotificationType,
        mockPrisma as unknown as PrismaClient
      );

      expect(mockPrisma.eventNotification.create).not.toHaveBeenCalled();
    });
  });

  describe('createActivityNotification', () => {
    it('should create a single activity notification', async () => {
      const metadata = { action: 'joined', userName: 'Alice' };
      mockPrisma.eventNotification.create = vi.fn().mockResolvedValue({});

      await createActivityNotification(
        'session-123',
        'user-1',
        'join' as SessionNotificationType,
        metadata,
        mockPrisma as unknown as PrismaClient
      );

      expect(mockPrisma.eventNotification.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-123',
          userId: 'user-1',
          type: 'join',
          metadata,
          params: undefined
        }
      });
    });

    it('should include optional params', async () => {
      const metadata = { action: 'joined' };
      const params = { userName: 'Alice' };
      mockPrisma.eventNotification.create = vi.fn().mockResolvedValue({});

      await createActivityNotification(
        'session-123',
        'user-1',
        'join' as SessionNotificationType,
        metadata,
        mockPrisma as unknown as PrismaClient,
        params
      );

      expect(mockPrisma.eventNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          params
        })
      });
    });
  });

  describe('getEventActivity', () => {
    it('should retrieve session activity with default limit', async () => {
      const mockActivity = [
        {
          id: 'notif-1',
          sessionId: 'session-123',
          userId: 'user-1',
          type: 'join' as SessionNotificationType,
          createdAt: new Date(),
          metadata: {},
          params: {},
          read: false,
          user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' }
        }
      ];

      mockPrisma.eventNotification.findMany = vi.fn().mockResolvedValue(mockActivity);

      const result = await getEventActivity(
        'session-123',
        mockPrisma as unknown as PrismaClient
      );

      expect(result).toEqual(mockActivity);
      expect(mockPrisma.eventNotification.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-123' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50
      });
    });

    it('should filter by notification type', async () => {
      mockPrisma.eventNotification.findMany = vi.fn().mockResolvedValue([]);

      await getEventActivity(
        'session-123',
        mockPrisma as unknown as PrismaClient,
        { type: 'join' as SessionNotificationType }
      );

      expect(mockPrisma.eventNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sessionId: 'session-123',
            type: 'join'
          })
        })
      );
    });

    it('should apply custom limit', async () => {
      mockPrisma.eventNotification.findMany = vi.fn().mockResolvedValue([]);

      await getEventActivity(
        'session-123',
        mockPrisma as unknown as PrismaClient,
        { limit: 20 }
      );

      expect(mockPrisma.eventNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20
        })
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      mockPrisma.eventNotification.findMany = vi.fn().mockResolvedValue([]);

      await getEventActivity(
        'session-123',
        mockPrisma as unknown as PrismaClient,
        { startDate, endDate }
      );

      expect(mockPrisma.eventNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sessionId: 'session-123',
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          })
        })
      );
    });

    it('should filter by start date only', async () => {
      const startDate = new Date('2026-01-01');
      mockPrisma.eventNotification.findMany = vi.fn().mockResolvedValue([]);

      await getEventActivity(
        'session-123',
        mockPrisma as unknown as PrismaClient,
        { startDate }
      );

      expect(mockPrisma.eventNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: startDate
            }
          })
        })
      );
    });

    it('should filter by end date only', async () => {
      const endDate = new Date('2026-01-31');
      mockPrisma.eventNotification.findMany = vi.fn().mockResolvedValue([]);

      await getEventActivity(
        'session-123',
        mockPrisma as unknown as PrismaClient,
        { endDate }
      );

      expect(mockPrisma.eventNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              lte: endDate
            }
          })
        })
      );
    });
  });
});
