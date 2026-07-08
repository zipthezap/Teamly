/**
 * Group Service Tests
 * Tests for group management business logic
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BadRequestError } from '../../utils/errors';
import {
  checkGroupAdmin,
  checkGroupMember,
  checkGroupAdminOrModerator,
  getGroupById,
  sanitizeGroupData,
  validateGroupCoordinates,
  validateMaxMembers,
  createJoinRequestNotification,
  createInvitationNotification,
  createMemberAddedNotification,
  getGroupAdmins,
  getGroupMembersExcludingUser,
  hasAdminMembers,
  buildGroupFilters,
  isValidRole,
  getGroupMember,
  isGroupMember,
  checkGroupCapacityAndMembership,
  validateCoordinateCompleteness,
} from '../../services/groupService';
import prisma from '../../config/database';
import { CacheService } from '../../services/cacheService';

// Mock dependencies
vi.mock('../../config/database', () => ({
  default: {
    groupMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    group: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    groupNotification: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../utils/validation', () => ({
  sanitizeString: vi.fn((str: string) => str.trim()),
  escapeHtml: vi.fn((str: string) =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  ),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../services/cacheService', () => ({
  CacheService: {
    wrap: vi.fn((key, ttl, fn) => fn()),
  },
}));

vi.mock('../../services/locationService', () => ({
  validateCoordinates: vi.fn((lat, lon) => {
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { valid: true };
    }
    return { valid: false, error: 'Invalid coordinates' };
  }),
}));

vi.mock('../../services/notificationFactory', () => ({
  NotificationFactory: {
    createGroupNotifications: vi.fn().mockResolvedValue({ created: 0, skipped: 0 }),
  },
}));

import { NotificationFactory } from '../../services/notificationFactory';

describe('Group Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockNotificationFactory = vi.mocked(NotificationFactory);

  describe('checkGroupAdmin', () => {
    it('should return true if user is group admin', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce({ id: 'member-1', role: 'admin' } as unknown);

      const result = await checkGroupAdmin('group-1', 'user-1');

      expect(result).toBe(true);
      expect(prisma.groupMember.findFirst).toHaveBeenCalledWith({
        where: {
          groupId: 'group-1',
          userId: 'user-1',
          role: 'admin'
        }
      });
    });

    it('should return false if user is not group admin', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(null);

      const result = await checkGroupAdmin('group-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('checkGroupMember', () => {
    it('should return true if user is group member', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce({ id: 'member-1', role: 'member' } as unknown);

      const result = await checkGroupMember('group-1', 'user-1');

      expect(result).toBe(true);
      expect(prisma.groupMember.findFirst).toHaveBeenCalledWith({
        where: {
          groupId: 'group-1',
          userId: 'user-1'
        }
      });
    });

    it('should return false if user is not group member', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(null);

      const result = await checkGroupMember('group-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('checkGroupAdminOrModerator', () => {
    it('should return true if user is admin', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce({ id: 'member-1', role: 'admin' } as unknown);

      const result = await checkGroupAdminOrModerator('group-1', 'user-1');

      expect(result).toBe(true);
      expect(prisma.groupMember.findFirst).toHaveBeenCalledWith({
        where: {
          groupId: 'group-1',
          userId: 'user-1',
          role: { in: ['admin', 'moderator'] }
        }
      });
    });

    it('should return true if user is moderator', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce({ id: 'member-1', role: 'moderator' } as unknown);

      const result = await checkGroupAdminOrModerator('group-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false if user is regular member', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(null);

      const result = await checkGroupAdminOrModerator('group-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('getGroupById', () => {
    it('should retrieve group with full details using cache', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test Group',
        creator: { id: 'user-1', name: 'Creator' },
        members: [],
        events: []
      };
      vi.mocked(prisma.group.findUnique).mockResolvedValueOnce(mockGroup as unknown);

      const result = await getGroupById('group-1');

      expect(result).toEqual(mockGroup);
      expect(CacheService.wrap).toHaveBeenCalledWith(
        'group:full:group-1',
        300,
        expect.any(Function)
      );
    });

    it('should include only non-archived events', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test Group',
        creator: { id: 'user-1', name: 'Creator' },
        members: [],
        events: []
      };
      vi.mocked(prisma.group.findUnique).mockResolvedValueOnce(mockGroup as unknown);

      await getGroupById('group-1');

      // Verify that the cache function calls prisma.group.findUnique
      const cacheWrapCall = vi.mocked(CacheService.wrap).mock.calls[0];
      const fetchFunction = cacheWrapCall[2];
      await fetchFunction();

      expect(prisma.group.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'group-1' },
          include: expect.objectContaining({
            sessions: expect.objectContaining({
              where: { archived: false }
            })
          })
        })
      );
    });
  });

  describe('sanitizeGroupData', () => {
    it('should sanitize all string fields', () => {
      const result = sanitizeGroupData({
        name: '  Test Group  ',
        description: '  Test description  ',
        locationName: '  Location  ',
        city: '  New York  ',
        country: '  USA  ',
        tags: '  soccer, basketball  ',
      });

      expect(result.name).toBe('Test Group');
      expect(result.description).toBe('Test description');
      expect(result.locationName).toBe('Location');
      expect(result.city).toBe('New York');
      expect(result.country).toBe('USA');
      expect(result.tags).toBe('soccer, basketball');
    });

    it('should handle undefined fields', () => {
      const result = sanitizeGroupData({});

      expect(result.name).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.locationName).toBeUndefined();
      expect(result.city).toBeUndefined();
      expect(result.country).toBeUndefined();
      expect(result.tags).toBeUndefined();
    });

    it('should handle partial data', () => {
      const result = sanitizeGroupData({
        name: '  Test Group  ',
        city: '  New York  ',
      });

      expect(result.name).toBe('Test Group');
      expect(result.city).toBe('New York');
      expect(result.description).toBeUndefined();
    });
  });

  describe('validateGroupCoordinates', () => {
    it('should return valid true for valid coordinates', async () => {
      const result = await validateGroupCoordinates(40.7128, -74.0060);

      expect(result.valid).toBe(true);
    });

    it('should return valid false for invalid latitude', async () => {
      const result = await validateGroupCoordinates(91, -74.0060);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return valid false for invalid longitude', async () => {
      const result = await validateGroupCoordinates(40.7128, -181);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return valid true if coordinates are undefined', async () => {
      const result = await validateGroupCoordinates(undefined, undefined);

      expect(result.valid).toBe(true);
    });

    it('should return valid true if coordinates are null', async () => {
      const result = await validateGroupCoordinates(null, null);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateMaxMembers', () => {
    it('should return valid true for valid max members', () => {
      const result = validateMaxMembers(100);

      expect(result.valid).toBe(true);
    });

    it('should return valid false for max members less than 2', () => {
      const result = validateMaxMembers(1);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('between 2 and 10,000');
    });

    it('should return valid false for max members greater than 10000', () => {
      const result = validateMaxMembers(10001);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('between 2 and 10,000');
    });

    it('should return valid true for undefined max members', () => {
      const result = validateMaxMembers(undefined);

      expect(result.valid).toBe(true);
    });

    it('should return valid true for null max members', () => {
      const result = validateMaxMembers(null);

      expect(result.valid).toBe(true);
    });

    it('should return valid true for empty string', () => {
      const result = validateMaxMembers('');

      expect(result.valid).toBe(true);
    });

    it('should parse string values correctly', () => {
      const result = validateMaxMembers('100');

      expect(result.valid).toBe(true);
    });

    it('should return valid false for invalid string values', () => {
      const result = validateMaxMembers('1');

      expect(result.valid).toBe(false);
    });
  });

  describe('createJoinRequestNotification', () => {
    it('should create notifications for all admins', async () => {
      await createJoinRequestNotification(
        'group-1',
        'user-1',
        'John Doe',
        'Test Group',
        ['admin-1', 'admin-2']
      );

      expect(mockNotificationFactory.createGroupNotifications).toHaveBeenCalledWith({
        groupId: 'group-1',
        type: 'join_request',
        userIds: ['admin-1', 'admin-2'],
        params: {
          requesterId: 'user-1',
          requesterName: 'John Doe',
          groupName: 'Test Group',
        },
        checkMutePreference: false,
      });
    });

    it('should not create notifications if no admins', async () => {
      await createJoinRequestNotification(
        'group-1',
        'user-1',
        'John Doe',
        'Test Group',
        []
      );

      expect(mockNotificationFactory.createGroupNotifications).not.toHaveBeenCalled();
    });
  });

  describe('createInvitationNotification', () => {
    it('should create invitation notification', async () => {
      await createInvitationNotification(
        'group-1',
        'Test Group',
        'user-1',
        'Inviter Name'
      );

      expect(mockNotificationFactory.createGroupNotifications).toHaveBeenCalledWith({
        groupId: 'group-1',
        type: 'invited',
        userIds: ['user-1'],
        params: {
          groupName: 'Test Group',
          inviterName: 'Inviter Name',
        },
        checkMutePreference: false,
      });
    });
  });

  describe('createMemberAddedNotification', () => {
    it('should create notifications for all existing members', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'user-1', name: 'New Member' } as unknown);

      await createMemberAddedNotification(
        'group-1',
        'Test Group',
        'user-1',
        ['member-1', 'member-2']
      );

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { name: true }
      });
      expect(mockNotificationFactory.createGroupNotifications).toHaveBeenCalledWith({
        groupId: 'group-1',
        type: 'accepted',
        userIds: ['member-1', 'member-2'],
        params: {
          memberName: 'New Member',
          groupName: 'Test Group',
        },
        checkMutePreference: false,
      });
    });

    it('should not create notifications if new member not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      await createMemberAddedNotification(
        'group-1',
        'Test Group',
        'user-1',
        ['member-1', 'member-2']
      );

      expect(mockNotificationFactory.createGroupNotifications).not.toHaveBeenCalled();
    });
  });

  describe('getGroupAdmins', () => {
    it('should return list of admin users', async () => {
      const mockAdmins = [
        { user: { id: 'admin-1', name: 'Admin 1', email: 'admin1@test.com' } },
        { user: { id: 'admin-2', name: 'Admin 2', email: 'admin2@test.com' } }
      ];
      vi.mocked(prisma.groupMember.findMany).mockResolvedValueOnce(mockAdmins as unknown);

      const result = await getGroupAdmins('group-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockAdmins[0].user);
      expect(prisma.groupMember.findMany).toHaveBeenCalledWith({
        where: {
          groupId: 'group-1',
          role: 'admin'
        },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      });
    });
  });

  describe('getGroupMembersExcludingUser', () => {
    it('should return members excluding specific user', async () => {
      const mockMembers = [
        { user: { id: 'user-2', name: 'User 2', email: 'user2@test.com' } },
        { user: { id: 'user-3', name: 'User 3', email: 'user3@test.com' } }
      ];
      vi.mocked(prisma.groupMember.findMany).mockResolvedValueOnce(mockMembers as unknown);

      const result = await getGroupMembersExcludingUser('group-1', 'user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockMembers[0].user);
      expect(prisma.groupMember.findMany).toHaveBeenCalledWith({
        where: {
          groupId: 'group-1',
          userId: { not: 'user-1' }
        },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      });
    });
  });

  describe('hasAdminMembers', () => {
    it('should return true if group has admins', async () => {
      vi.mocked(prisma.groupMember.count).mockResolvedValueOnce(2);

      const result = await hasAdminMembers('group-1');

      expect(result).toBe(true);
      expect(prisma.groupMember.count).toHaveBeenCalledWith({
        where: {
          groupId: 'group-1',
          role: 'admin'
        }
      });
    });

    it('should return false if group has no admins', async () => {
      vi.mocked(prisma.groupMember.count).mockResolvedValueOnce(0);

      const result = await hasAdminMembers('group-1');

      expect(result).toBe(false);
    });
  });

  describe('buildGroupFilters', () => {
    const userId = 'test-user-id';

    it('should build filters with user membership', () => {
      const filters = buildGroupFilters(userId, {});

      expect(filters.members).toEqual({
        some: { userId }
      });
    });

    it('should build filters with search term', () => {
      const filters = buildGroupFilters(userId, { search: 'soccer' });

      expect(filters.OR).toBeDefined();
      expect(Array.isArray(filters.OR)).toBe(true);
    });

    it('should build filters with city', () => {
      const filters = buildGroupFilters(userId, { city: 'New York' });

      expect(filters.city).toEqual({ contains: 'New York', mode: 'insensitive' });
    });

    it('should build filters with country', () => {
      const filters = buildGroupFilters(userId, { country: 'USA' });

      expect(filters.country).toEqual({ contains: 'USA', mode: 'insensitive' });
    });

    it('should build filters with isPublic', () => {
      const filters = buildGroupFilters(userId, { isPublic: 'true' });

      expect(filters.isPublic).toBe(true);
    });

    it('should build filters with multiple criteria', () => {
      const filters = buildGroupFilters(userId, {
        search: 'soccer',
        city: 'New York',
        isPublic: 'false'
      });

      expect(filters.OR).toBeDefined();
      expect(filters.city).toBeDefined();
      expect(filters.isPublic).toBe(false);
    });
  });

  describe('isValidRole', () => {
    it('should return true for admin role', () => {
      expect(isValidRole('admin')).toBe(true);
    });

    it('should return true for moderator role', () => {
      expect(isValidRole('moderator')).toBe(true);
    });

    it('should return true for member role', () => {
      expect(isValidRole('member')).toBe(true);
    });

    it('should return false for invalid role', () => {
      expect(isValidRole('invalid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidRole('')).toBe(false);
    });
  });

  describe('getGroupMember', () => {
    it('should return group member if found', async () => {
      const mockMember = { id: 'member-1', groupId: 'group-1', userId: 'user-1', role: 'member' };
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(mockMember as unknown);

      const result = await getGroupMember('group-1', 'user-1');

      expect(result).toEqual(mockMember);
      expect(prisma.groupMember.findFirst).toHaveBeenCalledWith({
        where: {
          groupId: 'group-1',
          userId: 'user-1'
        }
      });
    });

    it('should return null if member not found', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(null);

      const result = await getGroupMember('group-1', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('isGroupMember', () => {
    it('should be an alias for checkGroupMember', () => {
      expect(isGroupMember).toBe(checkGroupMember);
    });
  });

  describe('buildGroupFilters - additional edge cases', () => {
    const userId = 'test-user-id';

    it('should handle empty search term', () => {
      const filters = buildGroupFilters(userId, { search: '' });

      // Should not add search filter for empty string
      expect(filters.OR).toBeUndefined();
    });

    it('should handle multiple search and filter criteria', () => {
      const filters = buildGroupFilters(userId, {
        search: 'soccer',
        city: 'New York',
        country: 'USA',
        isPublic: 'true'
      });

      expect(filters.OR).toBeDefined();
      expect(filters.city).toBeDefined();
      expect(filters.country).toBeDefined();
      expect(filters.isPublic).toBe(true);
    });

    it('should parse isPublic string false correctly', () => {
      const filters = buildGroupFilters(userId, { isPublic: 'false' });

      expect(filters.isPublic).toBe(false);
    });
  });

  describe('validateMaxMembers - additional edge cases', () => {
    it('should handle boundary value at minimum (2)', () => {
      const result = validateMaxMembers(2);

      expect(result.valid).toBe(true);
    });

    it('should handle boundary value at maximum (10000)', () => {
      const result = validateMaxMembers(10000);

      expect(result.valid).toBe(true);
    });

    it('should handle string representation of boundary values', () => {
      expect(validateMaxMembers('2').valid).toBe(true);
      expect(validateMaxMembers('10000').valid).toBe(true);
      expect(validateMaxMembers('1').valid).toBe(false);
      expect(validateMaxMembers('10001').valid).toBe(false);
    });

    it('should handle non-numeric string values', () => {
      const result = validateMaxMembers('not-a-number');

      // Should return invalid for non-numeric strings
      expect(result.valid).toBe(false);
    });

    it('should handle negative numbers', () => {
      const result = validateMaxMembers(-5);

      expect(result.valid).toBe(false);
    });

    it('should handle zero', () => {
      const result = validateMaxMembers(0);

      expect(result.valid).toBe(false);
    });
  });

  describe('sanitizeGroupData - additional edge cases', () => {
    it('should handle null values', () => {
      const result = sanitizeGroupData({
        name: null as unknown,
        description: null as unknown
      });

      expect(result.name).toBeUndefined();
      expect(result.description).toBeUndefined();
    });

    it('should handle mixed case and special characters', () => {
      const result = sanitizeGroupData({
        name: '  Test-Group_123!  ',
        tags: '  Soccer, Basketball, Tennis  '
      });

      expect(result.name).toBe('Test-Group_123!');
      expect(result.tags).toBe('Soccer, Basketball, Tennis');
    });
  });

  // ─── checkGroupCapacityAndMembership ─────────────────────────────────────────

  describe('checkGroupCapacityAndMembership', () => {
    it('should throw BadRequestError if user is already a member', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({ id: 'member-1' } as unknown);

      await expect(
        checkGroupCapacityAndMembership('group-1', 'user-1', null)
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw with correct message when user is already a member', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({ id: 'member-1' } as unknown);

      await expect(
        checkGroupCapacityAndMembership('group-1', 'user-1', null)
      ).rejects.toThrow('User is already a member of this group');
    });

    it('should throw BadRequestError if group has reached max capacity', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.groupMember.count).mockResolvedValueOnce(10);

      await expect(
        checkGroupCapacityAndMembership('group-1', 'user-1', 10)
      ).rejects.toThrow('Group has reached maximum member capacity');
    });

    it('should not throw when user is not a member and group is not full', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.groupMember.count).mockResolvedValueOnce(5);

      await expect(
        checkGroupCapacityAndMembership('group-1', 'user-1', 10)
      ).resolves.toBeUndefined();
    });

    it('should skip capacity check when maxMembers is null', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(null);

      await expect(
        checkGroupCapacityAndMembership('group-1', 'user-1', null)
      ).resolves.toBeUndefined();

      expect(prisma.groupMember.count).not.toHaveBeenCalled();
    });

    it('should not throw when current member count is below maxMembers', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.groupMember.count).mockResolvedValueOnce(9);

      await expect(
        checkGroupCapacityAndMembership('group-1', 'user-1', 10)
      ).resolves.toBeUndefined();
    });
  });

  // ─── validateCoordinateCompleteness ──────────────────────────────────────────

  describe('validateCoordinateCompleteness', () => {
    it('should return valid true when both coordinates are provided', () => {
      expect(validateCoordinateCompleteness(40.7, -74.0)).toEqual({ valid: true });
    });

    it('should return valid true when both coordinates are undefined', () => {
      expect(validateCoordinateCompleteness(undefined, undefined)).toEqual({ valid: true });
    });

    it('should return valid true when both coordinates are null', () => {
      expect(validateCoordinateCompleteness(null, null)).toEqual({ valid: true });
    });

    it('should return valid false when only latitude is provided', () => {
      const result = validateCoordinateCompleteness(40.7, undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Both latitude and longitude must be provided together');
    });

    it('should return valid false when only longitude is provided', () => {
      const result = validateCoordinateCompleteness(undefined, -74.0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Both latitude and longitude must be provided together');
    });

    it('should return valid false when lat is null but lon is provided', () => {
      const result = validateCoordinateCompleteness(null, -74.0);
      expect(result.valid).toBe(false);
    });
  });
});
