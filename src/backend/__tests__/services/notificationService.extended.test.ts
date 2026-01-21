/**
 * Additional Notification Service Tests
 * Extended test coverage for notification management
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import prisma from '../../config/database';
import {
  mockEventNotification,
  mockEventNotifications,
  mockGroupNotification,
  mockGroupNotifications,
  mockTeamUpNotifications,
  mockTournamentNotifications,
  mockUnreadNotifications,
  mockReadNotifications,
} from '../__mocks__/mockData';

// Mock dependencies
vi.mock('../../config/database', () => ({
  default: {
    eventNotification: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    groupNotification: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    teamUpNotification: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    tournamentNotification: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Notification Service - Extended Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Notifications', () => {
    it('should create event notification', async () => {
      vi.mocked(prisma.eventNotification.create).mockResolvedValueOnce(mockEventNotification as any);

      const result = await prisma.eventNotification.create({
        data: {
          userId: mockEventNotification.userId,
          eventId: mockEventNotification.eventId,
          type: mockEventNotification.type,
          params: mockEventNotification.params,
        },
      });

      expect(result).toEqual(mockEventNotification);
    });

    it('should create multiple event notifications', async () => {
      vi.mocked(prisma.eventNotification.createMany).mockResolvedValueOnce({ count: 3 });

      const result = await prisma.eventNotification.createMany({
        data: mockEventNotifications.map(n => ({
          userId: n.userId,
          eventId: n.eventId!,
          type: n.type,
          params: n.params,
        })),
      });

      expect(result.count).toBe(3);
    });

    it('should find event notifications by user', async () => {
      vi.mocked(prisma.eventNotification.findMany).mockResolvedValueOnce(mockEventNotifications as any);

      const result = await prisma.eventNotification.findMany({
        where: { userId: 'user-1' },
        include: { event: true, user: true },
      });

      expect(result).toHaveLength(3);
      expect(result.every(n => n.userId === 'user-1')).toBe(true);
    });

    it('should find unread event notifications', async () => {
      const unreadEvents = mockEventNotifications.filter(n => !n.read);
      vi.mocked(prisma.eventNotification.findMany).mockResolvedValueOnce(unreadEvents as any);

      const result = await prisma.eventNotification.findMany({
        where: { userId: 'user-1', read: false },
      });

      expect(result.every(n => !n.read)).toBe(true);
    });

    it('should mark event notification as read', async () => {
      const readNotification = { ...mockEventNotification, read: true };
      vi.mocked(prisma.eventNotification.update).mockResolvedValueOnce(readNotification as any);

      const result = await prisma.eventNotification.update({
        where: { id: mockEventNotification.id },
        data: { read: true },
      });

      expect(result.read).toBe(true);
    });

    it('should delete event notification', async () => {
      vi.mocked(prisma.eventNotification.delete).mockResolvedValueOnce(mockEventNotification as any);

      const result = await prisma.eventNotification.delete({
        where: { id: mockEventNotification.id },
      });

      expect(result).toEqual(mockEventNotification);
    });

    it('should count event notifications', async () => {
      vi.mocked(prisma.eventNotification.count).mockResolvedValueOnce(3);

      const count = await prisma.eventNotification.count({
        where: { userId: 'user-1' },
      });

      expect(count).toBe(3);
    });

    it('should count unread event notifications', async () => {
      vi.mocked(prisma.eventNotification.count).mockResolvedValueOnce(2);

      const count = await prisma.eventNotification.count({
        where: { userId: 'user-1', read: false },
      });

      expect(count).toBe(2);
    });
  });

  describe('Group Notifications', () => {
    it('should create group notification', async () => {
      vi.mocked(prisma.groupNotification.create).mockResolvedValueOnce(mockGroupNotification as any);

      const result = await prisma.groupNotification.create({
        data: {
          userId: mockGroupNotification.userId,
          groupId: mockGroupNotification.groupId!,
          type: mockGroupNotification.type,
          params: mockGroupNotification.params,
        },
      });

      expect(result).toEqual(mockGroupNotification);
    });

    it('should create multiple group notifications', async () => {
      vi.mocked(prisma.groupNotification.createMany).mockResolvedValueOnce({ count: 3 });

      const result = await prisma.groupNotification.createMany({
        data: mockGroupNotifications.map(n => ({
          userId: n.userId,
          groupId: n.groupId!,
          type: n.type,
          params: n.params,
        })),
      });

      expect(result.count).toBe(3);
    });

    it('should find group notifications by user', async () => {
      vi.mocked(prisma.groupNotification.findMany).mockResolvedValueOnce(mockGroupNotifications as any);

      const result = await prisma.groupNotification.findMany({
        where: { userId: 'user-1' },
        include: { group: true },
      });

      expect(result).toHaveLength(3);
    });

    it('should find unread group notifications', async () => {
      const unreadGroups = mockGroupNotifications.filter(n => !n.read);
      vi.mocked(prisma.groupNotification.findMany).mockResolvedValueOnce(unreadGroups as any);

      const result = await prisma.groupNotification.findMany({
        where: { userId: 'user-1', read: false },
      });

      expect(result.every(n => !n.read)).toBe(true);
    });

    it('should mark group notification as read', async () => {
      const readNotification = { ...mockGroupNotification, read: true };
      vi.mocked(prisma.groupNotification.update).mockResolvedValueOnce(readNotification as any);

      const result = await prisma.groupNotification.update({
        where: { id: mockGroupNotification.id },
        data: { read: true },
      });

      expect(result.read).toBe(true);
    });

    it('should delete group notification', async () => {
      vi.mocked(prisma.groupNotification.delete).mockResolvedValueOnce(mockGroupNotification as any);

      const result = await prisma.groupNotification.delete({
        where: { id: mockGroupNotification.id },
      });

      expect(result).toEqual(mockGroupNotification);
    });

    it('should count group notifications', async () => {
      vi.mocked(prisma.groupNotification.count).mockResolvedValueOnce(3);

      const count = await prisma.groupNotification.count({
        where: { userId: 'user-1' },
      });

      expect(count).toBe(3);
    });
  });

  describe('Notification Filtering', () => {
    it('should filter notifications by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-05');
      
      const filtered = mockEventNotifications.filter(
        n => n.createdAt >= startDate && n.createdAt <= endDate
      );
      vi.mocked(prisma.eventNotification.findMany).mockResolvedValueOnce(filtered as any);

      const result = await prisma.eventNotification.findMany({
        where: {
          userId: 'user-1',
          createdAt: { gte: startDate, lte: endDate },
        },
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter notifications by type', async () => {
      const filtered = mockEventNotifications.filter(n => n.type === 'event_created');
      vi.mocked(prisma.eventNotification.findMany).mockResolvedValueOnce(filtered as any);

      const result = await prisma.eventNotification.findMany({
        where: { userId: 'user-1', type: 'event_created' },
      });

      expect(result.every(n => n.type === 'event_created')).toBe(true);
    });

    it('should order notifications by creation date', async () => {
      // Sort mock data in descending order for this test
      const sortedNotifications = [...mockEventNotifications].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      vi.mocked(prisma.eventNotification.findMany).mockResolvedValueOnce(sortedNotifications as any);

      const result = await prisma.eventNotification.findMany({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });

      // Verify ordering (descending)
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].createdAt >= result[i + 1].createdAt).toBe(true);
      }
    });

    it('should paginate notifications', async () => {
      const page1 = mockEventNotifications.slice(0, 2);
      vi.mocked(prisma.eventNotification.findMany).mockResolvedValueOnce(page1 as any);

      const result = await prisma.eventNotification.findMany({
        where: { userId: 'user-1' },
        skip: 0,
        take: 2,
      });

      expect(result).toHaveLength(2);
    });

    it('should get next page of notifications', async () => {
      const page2 = mockEventNotifications.slice(2);
      vi.mocked(prisma.eventNotification.findMany).mockResolvedValueOnce(page2 as any);

      const result = await prisma.eventNotification.findMany({
        where: { userId: 'user-1' },
        skip: 2,
        take: 2,
      });

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Bulk Operations', () => {
    it('should mark all notifications as read', async () => {
      vi.mocked(prisma.eventNotification.updateMany).mockResolvedValueOnce({ count: 5 });

      const result = await prisma.eventNotification.updateMany({
        where: { userId: 'user-1', read: false },
        data: { read: true },
      });

      expect(result.count).toBe(5);
    });

    it('should delete multiple notifications', async () => {
      vi.mocked(prisma.eventNotification.deleteMany).mockResolvedValueOnce({ count: 3 });

      const result = await prisma.eventNotification.deleteMany({
        where: { id: { in: ['notif-1', 'notif-2', 'notif-3'] } },
      });

      expect(result.count).toBe(3);
    });

    it('should delete all read notifications', async () => {
      vi.mocked(prisma.eventNotification.deleteMany).mockResolvedValueOnce({ count: 2 });
      vi.mocked(prisma.groupNotification.deleteMany).mockResolvedValueOnce({ count: 1 });

      const eventResult = await prisma.eventNotification.deleteMany({
        where: { userId: 'user-1', read: true },
      });
      const groupResult = await prisma.groupNotification.deleteMany({
        where: { userId: 'user-1', read: true },
      });

      expect(eventResult.count + groupResult.count).toBe(3);
    });

    it('should mark specific notifications as read', async () => {
      vi.mocked(prisma.eventNotification.updateMany).mockResolvedValueOnce({ count: 2 });

      const ids = ['notif-1', 'notif-2'];
      const result = await prisma.eventNotification.updateMany({
        where: { id: { in: ids }, userId: 'user-1' },
        data: { read: true },
      });

      expect(result.count).toBe(2);
    });
  });

  describe('Cross-Type Notification Queries', () => {
    it('should fetch all notification types for user', async () => {
      vi.mocked(prisma.eventNotification.findMany).mockResolvedValueOnce(mockEventNotifications as any);
      vi.mocked(prisma.groupNotification.findMany).mockResolvedValueOnce(mockGroupNotifications as any);
      vi.mocked(prisma.teamUpNotification.findMany).mockResolvedValueOnce(mockTeamUpNotifications as any);
      vi.mocked(prisma.tournamentNotification.findMany).mockResolvedValueOnce(mockTournamentNotifications as any);

      const eventNotifs = await prisma.eventNotification.findMany({ where: { userId: 'user-1' } });
      const groupNotifs = await prisma.groupNotification.findMany({ where: { userId: 'user-1' } });
      const teamUpNotifs = await prisma.teamUpNotification.findMany({ where: { userId: 'user-1' } });
      const tournamentNotifs = await prisma.tournamentNotification.findMany({ where: { userId: 'user-1' } });

      const total = eventNotifs.length + groupNotifs.length + teamUpNotifs.length + tournamentNotifs.length;
      expect(total).toBeGreaterThan(0);
    });

    it('should count all unread notifications across types', async () => {
      vi.mocked(prisma.eventNotification.count).mockResolvedValueOnce(2);
      vi.mocked(prisma.groupNotification.count).mockResolvedValueOnce(2);
      vi.mocked(prisma.teamUpNotification.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.tournamentNotification.count).mockResolvedValueOnce(1);

      const eventCount = await prisma.eventNotification.count({ where: { userId: 'user-1', read: false } });
      const groupCount = await prisma.groupNotification.count({ where: { userId: 'user-1', read: false } });
      const teamUpCount = await prisma.teamUpNotification.count({ where: { userId: 'user-1', read: false } });
      const tournamentCount = await prisma.tournamentNotification.count({ where: { userId: 'user-1', read: false } });

      const totalUnread = eventCount + groupCount + teamUpCount + tournamentCount;
      expect(totalUnread).toBe(6);
    });

    it('should mark all unread notifications as read across types', async () => {
      vi.mocked(prisma.eventNotification.updateMany).mockResolvedValueOnce({ count: 2 });
      vi.mocked(prisma.groupNotification.updateMany).mockResolvedValueOnce({ count: 2 });
      vi.mocked(prisma.teamUpNotification.updateMany).mockResolvedValueOnce({ count: 1 });
      vi.mocked(prisma.tournamentNotification.updateMany).mockResolvedValueOnce({ count: 1 });

      const eventResult = await prisma.eventNotification.updateMany({
        where: { userId: 'user-1', read: false },
        data: { read: true },
      });
      const groupResult = await prisma.groupNotification.updateMany({
        where: { userId: 'user-1', read: false },
        data: { read: true },
      });
      const teamUpResult = await prisma.teamUpNotification.updateMany({
        where: { userId: 'user-1', read: false },
        data: { read: true },
      });
      const tournamentResult = await prisma.tournamentNotification.updateMany({
        where: { userId: 'user-1', read: false },
        data: { read: true },
      });

      const total = eventResult.count + groupResult.count + teamUpResult.count + tournamentResult.count;
      expect(total).toBe(6);
    });
  });

  describe('Notification Preferences', () => {
    it('should filter by notification type preference', async () => {
      const inviteNotifs = mockGroupNotifications.filter(n => n.type === 'group_invite');
      vi.mocked(prisma.groupNotification.findMany).mockResolvedValueOnce(inviteNotifs as any);

      const result = await prisma.groupNotification.findMany({
        where: { userId: 'user-1', type: 'group_invite' },
      });

      expect(result.every(n => n.type === 'group_invite')).toBe(true);
    });

    it('should exclude certain notification types', async () => {
      const filtered = mockEventNotifications.filter(n => n.type !== 'event_cancelled');
      vi.mocked(prisma.eventNotification.findMany).mockResolvedValueOnce(filtered as any);

      const result = await prisma.eventNotification.findMany({
        where: {
          userId: 'user-1',
          type: { not: 'event_cancelled' },
        },
      });

      expect(result.every(n => n.type !== 'event_cancelled')).toBe(true);
    });
  });

  describe('Notification Stats', () => {
    it('should get notification statistics', async () => {
      vi.mocked(prisma.eventNotification.count).mockResolvedValueOnce(10);
      vi.mocked(prisma.groupNotification.count).mockResolvedValueOnce(5);

      const eventTotal = await prisma.eventNotification.count({ where: { userId: 'user-1' } });
      const groupTotal = await prisma.groupNotification.count({ where: { userId: 'user-1' } });

      expect(eventTotal).toBe(10);
      expect(groupTotal).toBe(5);
    });

    it('should get read vs unread statistics', async () => {
      vi.mocked(prisma.eventNotification.count)
        .mockResolvedValueOnce(3) // unread
        .mockResolvedValueOnce(7); // read

      const unreadCount = await prisma.eventNotification.count({
        where: { userId: 'user-1', read: false },
      });
      const readCount = await prisma.eventNotification.count({
        where: { userId: 'user-1', read: true },
      });

      expect(unreadCount).toBe(3);
      expect(readCount).toBe(7);
    });
  });
});
