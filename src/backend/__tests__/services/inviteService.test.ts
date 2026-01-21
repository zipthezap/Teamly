/**
 * Tests for InviteService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InviteService } from '../../services/inviteService';
import prisma from '../../config/database';
import { NotificationFactory } from '../../services/notificationFactory';

// Mock dependencies
vi.mock('../../config/database', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    group: {
      findUnique: vi.fn()
    },
    event: {
      findUnique: vi.fn()
    },
    groupMember: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    groupJoinRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn()
    },
    eventParticipant: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('./emailQueueService', () => ({
  sendEmailWithQueue: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../utils/notificationHelper', () => ({
  shouldSendEmailNotification: vi.fn().mockResolvedValue(true)
}));

vi.mock('./notificationFactory', () => ({
  NotificationFactory: {
    createGroupNotifications: vi.fn().mockResolvedValue({ created: 1, skipped: 0 })
  }
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn()
  }
}));

describe('InviteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('inviteUserToGroup', () => {
    // Note: This functionality is complex to mock fully in unit tests.
    // Integration tests would be more appropriate for complete testing.
    // The existing controllers tests verify this behavior works correctly.
    
    it('should return error if group not found', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValue(null);

      const result = await InviteService.inviteUserToGroup(
        'nonexistent-group',
        'invitee-1',
        'inviter-1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Group not found');
    });
  });

  describe('batchInviteToGroup', () => {
    // Note: Batch invitations are complex to test due to multiple service dependencies.
    // The implementation is verified through integration tests.
    it('should handle invalid emails', async () => {
      const emails = ['invalid-email'];
      
      const result = await InviteService.batchInviteToGroup(
        'group-1',
        emails,
        'inviter-1'
      );

      expect(result.total).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].email).toBe('invalid-email');
      expect(result.errors[0].error).toBe('Invalid email format');
    });

    it('should handle users not found', async () => {
      const emails = ['notfound@test.com'];
      
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const result = await InviteService.batchInviteToGroup(
        'group-1',
        emails,
        'inviter-1'
      );

      expect(result.total).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('User not found');
    });
  });

  describe('canUserInvite', () => {
    it('should allow event creator to invite', async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: 'event-1',
        creatorId: 'user-1',
        group: null
      } as any);

      const result = await InviteService.canUserInvite('user-1', 'event-1', 'event');

      expect(result.allowed).toBe(true);
    });

    it('should allow group admin to invite to event', async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: 'event-1',
        creatorId: 'other-user',
        group: {
          members: [{ role: 'admin' }]
        }
      } as any);

      const result = await InviteService.canUserInvite('user-1', 'event-1', 'event');

      expect(result.allowed).toBe(true);
    });

    it('should deny non-creator for events', async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({
        id: 'event-1',
        creatorId: 'other-user',
        group: null
      } as any);

      const result = await InviteService.canUserInvite('user-1', 'event-1', 'event');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Insufficient permissions');
    });

    it('should allow group admin to invite', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValue({
        id: 'group-1',
        members: [{ role: 'admin' }],
        allowMemberInvites: false
      } as any);

      const result = await InviteService.canUserInvite('user-1', 'group-1', 'group');

      expect(result.allowed).toBe(true);
    });

    it('should allow regular member if allowMemberInvites is true', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValue({
        id: 'group-1',
        members: [{ role: 'member' }],
        allowMemberInvites: true
      } as any);

      const result = await InviteService.canUserInvite('user-1', 'group-1', 'group');

      expect(result.allowed).toBe(true);
    });

    it('should deny regular member if allowMemberInvites is false', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValue({
        id: 'group-1',
        members: [{ role: 'member' }],
        allowMemberInvites: false
      } as any);

      const result = await InviteService.canUserInvite('user-1', 'group-1', 'group');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Only admins and moderators can invite members');
    });
  });

  describe('getUserPendingInvitations', () => {
    it('should return pending group and event invitations', async () => {
      const mockGroupInvitations = [
        {
          id: 'req-1',
          groupId: 'group-1',
          userId: 'user-1',
          status: 'pending',
          createdBy: 'invite',
          group: {
            id: 'group-1',
            name: 'Test Group'
          }
        }
      ];

      const mockEventInvitations = [
        {
          id: 'part-1',
          eventId: 'event-1',
          userId: 'user-1',
          status: 'pending',
          event: {
            id: 'event-1',
            title: 'Test Event'
          }
        }
      ];

      vi.mocked(prisma.groupJoinRequest.findMany).mockResolvedValue(mockGroupInvitations as any);
      vi.mocked(prisma.eventParticipant.findMany).mockResolvedValue(mockEventInvitations as any);

      const result = await InviteService.getUserPendingInvitations('user-1');

      expect(result.groups).toHaveLength(1);
      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(2);
    });
  });
});
