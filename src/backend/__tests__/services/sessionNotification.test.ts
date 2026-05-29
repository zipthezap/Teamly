/**
 * Event Notification Service Tests
 * Tests for session-specific notification handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    sessionNotification: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../services/emailQueueService', () => ({
  sendEmailWithQueue: vi.fn(),
}));

vi.mock('../../utils/notificationHelper', () => ({
  batchShouldSendEmailNotification: vi.fn(),
}));

vi.mock('../../utils/validation', () => ({
  escapeHtml: vi.fn((str: string) => str),
}));

vi.mock('../../services/notificationFactory', () => ({
  NotificationFactory: {
    createSessionNotifications: vi.fn().mockResolvedValue({ created: 0, skipped: 0 }),
  },
}));

import { PrismaClient, SessionNotificationType } from '@prisma/client';
import prisma from '../../config/database';
import { sendEmailWithQueue } from '../../services/emailQueueService';
import { batchShouldSendEmailNotification } from '../../utils/notificationHelper';
import { NotificationFactory } from '../../services/notificationFactory';
import {
  sendEventInvitations,
  sendEventUpdateNotifications,
  sendEventCancellationNotifications,
  createSessionNotifications as createEventNotifications,
  createActivityNotification,
  getSessionActivity,
} from '../../services/sessionNotification';

const mockPrisma = vi.mocked(prisma);
const mockSendEmail = vi.mocked(sendEmailWithQueue);
const mockBatchNotification = vi.mocked(batchShouldSendEmailNotification);
const mockNotificationFactory = vi.mocked(NotificationFactory);

describe('EventNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendEventInvitations', () => {
    it('sends invitations to eligible recipients excluding creator', async () => {
      const recipients = [
        { id: 'user-1', name: 'Alice', email: 'alice@example.com', emailNotifications: true },
        { id: 'user-2', name: 'Bob', email: 'bob@example.com', emailNotifications: true },
        { id: 'creator', name: 'Creator', email: 'creator@example.com', emailNotifications: true },
      ];

      mockBatchNotification.mockResolvedValue(new Map([['user-1', true], ['user-2', true]]));
      mockSendEmail.mockResolvedValue(undefined as never);

      await sendEventInvitations(
        recipients,
        'creator',
        'Soccer Match',
        new Date('2026-02-01T10:00:00Z'),
        'Sports Group'
      );

      expect(mockBatchNotification).toHaveBeenCalledWith(['user-1', 'user-2'], 'sessionInvites');
      expect(mockSendEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendEventUpdateNotifications', () => {
    it('sends updates to opted-in non-creator participants', async () => {
      const participants = [
        { user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' } },
        { user: { id: 'user-2', name: 'Bob', email: 'bob@example.com' } },
        { user: { id: 'creator', name: 'Creator', email: 'creator@example.com' } },
      ];

      mockBatchNotification.mockResolvedValue(new Map([['user-1', true], ['user-2', false]]));
      mockSendEmail.mockResolvedValue(undefined as never);

      await sendEventUpdateNotifications(participants as any, 'creator', 'Session A', 'Group X');

      expect(mockBatchNotification).toHaveBeenCalledWith(['user-1', 'user-2'], 'sessionUpdates');
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        'alice@example.com',
        expect.stringContaining('Event Updated'),
        expect.any(String),
        expect.objectContaining({ templateType: 'event_update' })
      );
    });
  });

  describe('sendEventCancellationNotifications', () => {
    it('sends cancellation emails to opted-in non-creator participants', async () => {
      const participants = [
        { user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' } },
        { user: { id: 'user-2', name: 'Bob', email: 'bob@example.com' } },
      ];

      mockBatchNotification.mockResolvedValue(new Map([['user-1', true], ['user-2', true]]));
      mockSendEmail.mockResolvedValue(undefined as never);

      await sendEventCancellationNotifications(participants as any, 'creator', 'Session A', 'Group X');

      expect(mockBatchNotification).toHaveBeenCalledWith(['user-1', 'user-2'], 'sessionCancellations');
      expect(mockSendEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('createEventNotifications', () => {
    it('delegates batch creation to NotificationFactory', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];

      await createEventNotifications(
        'session-123',
        userIds,
        'session_created' as SessionNotificationType,
        mockPrisma as unknown as PrismaClient
      );

      expect(mockNotificationFactory.createSessionNotifications).toHaveBeenCalledWith(
        {
          sessionId: 'session-123',
          userIds,
          type: 'session_created',
          metadata: undefined,
          params: undefined,
          checkMutePreference: false,
        },
        expect.any(Object)
      );
    });

    it('does not call factory when user list is empty', async () => {
      await createEventNotifications(
        'session-123',
        [],
        'session_created' as SessionNotificationType,
        mockPrisma as unknown as PrismaClient
      );

      expect(mockNotificationFactory.createSessionNotifications).not.toHaveBeenCalled();
    });
  });

  describe('createActivityNotification', () => {
    it('creates a single activity notification via NotificationFactory', async () => {
      const metadata = { action: 'joined', userName: 'Alice' };
      const params = { eventTitle: 'Session A' };

      await createActivityNotification(
        'session-123',
        'user-1',
        'join' as SessionNotificationType,
        metadata,
        mockPrisma as unknown as PrismaClient,
        params
      );

      expect(mockNotificationFactory.createSessionNotifications).toHaveBeenCalledWith(
        {
          sessionId: 'session-123',
          userIds: ['user-1'],
          type: 'join',
          metadata,
          params,
          checkMutePreference: false,
        },
        expect.any(Object)
      );
    });
  });

  describe('getSessionActivity', () => {
    it('retrieves activity with default limit and joins user', async () => {
      const mockActivity = [
        {
          id: 'notif-1',
          sessionId: 'session-123',
          userId: 'user-1',
          type: 'join',
          createdAt: new Date(),
          user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
        },
      ];

      mockPrisma.sessionNotification.findMany = vi.fn().mockResolvedValue(mockActivity as never);

      const result = await getSessionActivity('session-123', mockPrisma as unknown as PrismaClient);

      expect(result).toEqual(mockActivity);
      expect(mockPrisma.sessionNotification.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-123' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });
});
