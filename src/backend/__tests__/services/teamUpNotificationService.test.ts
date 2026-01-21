/**
 * TeamUp Notification Service Tests
 * Tests for TeamUp-specific notification handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies at the top level
vi.mock('../../config/database', () => ({
  default: {
    user: {
      findMany: vi.fn()
    },
    teamUpNotification: {
      createMany: vi.fn()
    },
    emailQueue: {
      create: vi.fn()
    }
  }
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('../../utils/notificationHelper', () => ({
  shouldSendEmailNotification: vi.fn(),
  filterUnmutedUsers: vi.fn()
}));

import prisma from '../../config/database';
import {
  findUsersForTeamUpNotification,
  notifyUsersAboutNewTeamUp
} from '../../services/teamUpNotificationService';
import { shouldSendEmailNotification, filterUnmutedUsers } from '../../utils/notificationHelper';

const mockPrisma = vi.mocked(prisma);
const mockShouldSend = vi.mocked(shouldSendEmailNotification);
const mockFilterUnmuted = vi.mocked(filterUnmutedUsers);

// Test constants
const LARGE_DISCOVERY_RADIUS = 150;

describe('TeamUpNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FRONTEND_URL = 'http://localhost:3001';
  });

  describe('findUsersForTeamUpNotification', () => {
    it('should find users in the same city', async () => {
      const teamUpRequest = {
        id: 'teamup-1',
        title: 'Soccer Game',
        sportType: 'Soccer',
        location: 'Central Park',
        latitude: null,
        longitude: null,
        city: 'New York',
        country: 'USA',
        dateTime: new Date('2026-02-01T10:00:00Z'),
        creatorId: 'creator-1'
      };

      const mockUsers = [
        {
          id: 'user-1',
          city: 'New York',
          country: 'USA',
          discoveryRadius: 25
        },
        {
          id: 'user-2',
          city: 'Los Angeles',
          country: 'USA',
          discoveryRadius: 25
        },
        {
          id: 'user-3',
          city: 'New York',
          country: 'USA',
          discoveryRadius: 10
        }
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await findUsersForTeamUpNotification(teamUpRequest);

      expect(result).toEqual(['user-1', 'user-3']);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: { not: 'creator-1' },
          emailNotifications: true
        }),
        select: {
          id: true,
          city: true,
          country: true,
          discoveryRadius: true
        }
      });
    });

    it('should match users in same country with large discovery radius', async () => {
      const teamUpRequest = {
        id: 'teamup-1',
        title: 'Soccer Game',
        sportType: 'Soccer',
        location: null,
        latitude: null,
        longitude: null,
        city: 'New York',
        country: 'USA',
        dateTime: new Date('2026-02-01T10:00:00Z'),
        creatorId: 'creator-1'
      };

      const mockUsers = [
        {
          id: 'user-1',
          city: 'Los Angeles',
          country: 'USA',
          discoveryRadius: LARGE_DISCOVERY_RADIUS // Large radius
        },
        {
          id: 'user-2',
          city: 'Los Angeles',
          country: 'USA',
          discoveryRadius: 25 // Small radius
        }
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await findUsersForTeamUpNotification(teamUpRequest);

      // Only user-1 with large radius should match
      expect(result).toEqual(['user-1']);
    });

    it('should not match users from different countries', async () => {
      const teamUpRequest = {
        id: 'teamup-1',
        title: 'Soccer Game',
        sportType: 'Soccer',
        location: null,
        latitude: null,
        longitude: null,
        city: 'New York',
        country: 'USA',
        dateTime: new Date('2026-02-01T10:00:00Z'),
        creatorId: 'creator-1'
      };

      const mockUsers = [
        {
          id: 'user-1',
          city: 'London',
          country: 'UK',
          discoveryRadius: LARGE_DISCOVERY_RADIUS
        }
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await findUsersForTeamUpNotification(teamUpRequest);

      expect(result).toEqual([]);
    });

    it('should use default discovery radius when not set', async () => {
      const teamUpRequest = {
        id: 'teamup-1',
        title: 'Soccer Game',
        sportType: 'Soccer',
        location: null,
        latitude: null,
        longitude: null,
        city: 'New York',
        country: 'USA',
        dateTime: new Date('2026-02-01T10:00:00Z'),
        creatorId: 'creator-1'
      };

      const mockUsers = [
        {
          id: 'user-1',
          city: 'New York',
          country: 'USA',
          discoveryRadius: null
        }
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await findUsersForTeamUpNotification(teamUpRequest);

      // Should still match because in same city
      expect(result).toEqual(['user-1']);
    });

    it('should handle errors gracefully', async () => {
      const teamUpRequest = {
        id: 'teamup-1',
        title: 'Soccer Game',
        sportType: 'Soccer',
        location: null,
        latitude: null,
        longitude: null,
        city: 'New York',
        country: 'USA',
        dateTime: new Date('2026-02-01T10:00:00Z'),
        creatorId: 'creator-1'
      };

      mockPrisma.user.findMany.mockRejectedValue(new Error('Database error'));

      const result = await findUsersForTeamUpNotification(teamUpRequest);

      expect(result).toEqual([]);
    });

    it('should handle case-insensitive city matching', async () => {
      const teamUpRequest = {
        id: 'teamup-1',
        title: 'Soccer Game',
        sportType: 'Soccer',
        location: null,
        latitude: null,
        longitude: null,
        city: 'new york',
        country: 'USA',
        dateTime: new Date('2026-02-01T10:00:00Z'),
        creatorId: 'creator-1'
      };

      const mockUsers = [
        {
          id: 'user-1',
          city: 'New York',
          country: 'USA',
          discoveryRadius: 25
        }
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await findUsersForTeamUpNotification(teamUpRequest);

      expect(result).toEqual(['user-1']);
    });
  });

  describe('notifyUsersAboutNewTeamUp', () => {
    it('should send notifications to eligible users', async () => {
      const teamUpRequest = {
        id: 'teamup-1',
        title: 'Soccer Game',
        sportType: 'Soccer',
        location: 'Central Park',
        latitude: null,
        longitude: null,
        city: 'New York',
        country: 'USA',
        dateTime: new Date('2026-02-01T10:00:00Z'),
        creatorId: 'creator-1'
      };

      const mockUsers = [
        {
          id: 'user-1',
          city: 'New York',
          country: 'USA',
          discoveryRadius: 25
        }
      ];

      const mockUsersWithDetails = [
        {
          id: 'user-1',
          name: 'Alice',
          email: 'alice@example.com'
        }
      ];

      mockPrisma.user.findMany
        .mockResolvedValueOnce(mockUsers) // First call for finding users
        .mockResolvedValueOnce(mockUsersWithDetails); // Second call for user details

      mockShouldSend.mockResolvedValue(true);
      mockFilterUnmuted.mockResolvedValue(['user-1']);
      mockPrisma.teamUpNotification.createMany = vi.fn().mockResolvedValue({ count: 1 });
      mockPrisma.emailQueue.create = vi.fn().mockResolvedValue({});

      await notifyUsersAboutNewTeamUp(teamUpRequest);

      expect(mockPrisma.teamUpNotification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            userId: 'user-1',
            teamUpRequestId: 'teamup-1',
            type: 'teamup_nearby'
          })
        ]),
        skipDuplicates: true
      });

      expect(mockPrisma.emailQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recipient: 'alice@example.com',
          subject: 'New TeamUp: Soccer Game',
          templateType: 'teamup_nearby'
        })
      });
    });

    it('should not notify users with disabled notifications', async () => {
      const teamUpRequest = {
        id: 'teamup-1',
        title: 'Soccer Game',
        sportType: 'Soccer',
        location: 'Central Park',
        latitude: null,
        longitude: null,
        city: 'New York',
        country: 'USA',
        dateTime: new Date('2026-02-01T10:00:00Z'),
        creatorId: 'creator-1'
      };

      const mockUsers = [
        {
          id: 'user-1',
          city: 'New York',
          country: 'USA',
          discoveryRadius: 25
        }
      ];

      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers);
      mockShouldSend.mockResolvedValue(false);

      await notifyUsersAboutNewTeamUp(teamUpRequest);

      expect(mockPrisma.teamUpNotification.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.emailQueue.create).not.toHaveBeenCalled();
    });

    it('should not notify muted users', async () => {
      const teamUpRequest = {
        id: 'teamup-1',
        title: 'Soccer Game',
        sportType: 'Soccer',
        location: 'Central Park',
        latitude: null,
        longitude: null,
        city: 'New York',
        country: 'USA',
        dateTime: new Date('2026-02-01T10:00:00Z'),
        creatorId: 'creator-1'
      };

      const mockUsers = [
        {
          id: 'user-1',
          city: 'New York',
          country: 'USA',
          discoveryRadius: 25
        }
      ];

      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers);
      mockShouldSend.mockResolvedValue(true);
      mockFilterUnmuted.mockResolvedValue([]); // All users muted

      await notifyUsersAboutNewTeamUp(teamUpRequest);

      expect(mockPrisma.teamUpNotification.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.emailQueue.create).not.toHaveBeenCalled();
    });

    it('should handle no matching users', async () => {
      const teamUpRequest = {
        id: 'teamup-1',
        title: 'Soccer Game',
        sportType: 'Soccer',
        location: 'Central Park',
        latitude: null,
        longitude: null,
        city: 'New York',
        country: 'USA',
        dateTime: new Date('2026-02-01T10:00:00Z'),
        creatorId: 'creator-1'
      };

      mockPrisma.user.findMany.mockResolvedValue([]);

      await notifyUsersAboutNewTeamUp(teamUpRequest);

      expect(mockPrisma.teamUpNotification.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.emailQueue.create).not.toHaveBeenCalled();
    });

    it('should include location in email when available', async () => {
      const teamUpRequest = {
        id: 'teamup-1',
        title: 'Soccer Game',
        sportType: 'Soccer',
        location: 'Central Park',
        latitude: null,
        longitude: null,
        city: 'New York',
        country: 'USA',
        dateTime: new Date('2026-02-01T10:00:00Z'),
        creatorId: 'creator-1'
      };

      const mockUsers = [
        {
          id: 'user-1',
          city: 'New York',
          country: 'USA',
          discoveryRadius: 25
        }
      ];

      const mockUsersWithDetails = [
        {
          id: 'user-1',
          name: 'Alice',
          email: 'alice@example.com'
        }
      ];

      mockPrisma.user.findMany
        .mockResolvedValueOnce(mockUsers)
        .mockResolvedValueOnce(mockUsersWithDetails);

      mockShouldSend.mockResolvedValue(true);
      mockFilterUnmuted.mockResolvedValue(['user-1']);
      mockPrisma.teamUpNotification.createMany = vi.fn().mockResolvedValue({ count: 1 });
      mockPrisma.emailQueue.create = vi.fn().mockResolvedValue({});

      await notifyUsersAboutNewTeamUp(teamUpRequest);

      const emailCall = mockPrisma.emailQueue.create.mock.calls[0][0];
      expect(emailCall.data.htmlContent).toContain('Central Park');
    });

    it('should handle errors gracefully', async () => {
      const teamUpRequest = {
        id: 'teamup-1',
        title: 'Soccer Game',
        sportType: 'Soccer',
        location: 'Central Park',
        latitude: null,
        longitude: null,
        city: 'New York',
        country: 'USA',
        dateTime: new Date('2026-02-01T10:00:00Z'),
        creatorId: 'creator-1'
      };

      mockPrisma.user.findMany.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(notifyUsersAboutNewTeamUp(teamUpRequest)).resolves.not.toThrow();
    });
  });
});
