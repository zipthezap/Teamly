/**
 * Tests for InviteService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InviteService } from '../../services/inviteService';
import prisma from '../../config/database';

// Mock dependencies
vi.mock('../../config/database', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    group: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    session: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    groupMember: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    groupJoinRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn()
    },
    sessionParticipant: {
      findMany: vi.fn(),
      deleteMany: vi.fn()
    },
    inviteLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn()
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
    info: vi.fn(),
    warn: vi.fn()
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
    it('should allow session creator to invite', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: 'session-1',
        creatorId: 'user-1',
        group: null
      } as any);

      const result = await InviteService.canUserInvite('user-1', 'session-1', 'session');

      expect(result.allowed).toBe(true);
    });

    it('should allow group admin to invite to session', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: 'session-1',
        creatorId: 'other-user',
        group: {
          members: [{ role: 'admin' }]
        }
      } as any);

      const result = await InviteService.canUserInvite('user-1', 'session-1', 'session');

      expect(result.allowed).toBe(true);
    });

    it('should deny non-creator for events', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: 'session-1',
        creatorId: 'other-user',
        group: null
      } as any);

      const result = await InviteService.canUserInvite('user-1', 'session-1', 'session');

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
    it('should return pending group and session invitations', async () => {
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
          sessionId: 'session-1',
          userId: 'user-1',
          status: 'pending',
          session: {
            id: 'session-1',
            title: 'Test Event'
          }
        }
      ];

      vi.mocked(prisma.groupJoinRequest.findMany).mockResolvedValue(mockGroupInvitations as any);
      vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue(mockEventInvitations as any);

      const result = await InviteService.getUserPendingInvitations('user-1');

      expect(result.groups).toHaveLength(1);
      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(2);
    });
  });

  describe('generateInviteToken', () => {
    it('should generate invite token for a group with expiration', async () => {
      const mockGroup = { id: 'group-1', name: 'Test Group' };
      vi.mocked(prisma.group.update).mockResolvedValue(mockGroup as any);

      const result = await InviteService.generateInviteToken('group', 'group-1', 30);

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      expect(prisma.group.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'group-1' },
          data: expect.objectContaining({
            inviteToken: expect.any(String),
            inviteTokenExpiresAt: expect.any(Date)
          })
        })
      );
    });

    it('should generate invite token for an session', async () => {
      const mockEvent = { id: 'session-1', title: 'Test Event' };
      vi.mocked(prisma.session.update).mockResolvedValue(mockEvent as any);

      const result = await InviteService.generateInviteToken('session', 'session-1', 7);

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });
  });

  describe('validateInviteToken', () => {
    it('should validate non-expired invite token', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const mockGroup = { id: 'group-1', inviteTokenExpiresAt: futureDate };
      vi.mocked(prisma.group.findUnique).mockResolvedValue(mockGroup as any);

      const result = await InviteService.validateInviteToken('group', 'valid-token');

      expect(result.valid).toBe(true);
      expect(result.resourceId).toBe('group-1');
    });

    it('should reject expired invite token', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const mockGroup = { id: 'group-1', name: 'Test Group', inviteTokenExpiresAt: pastDate };
      vi.mocked(prisma.group.findUnique).mockResolvedValue(mockGroup as any);

      const result = await InviteService.validateInviteToken('group', 'expired-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('This invite link has expired');
    });

    it('should reject invalid token', async () => {
      vi.mocked(prisma.group.findUnique).mockResolvedValue(null);

      const result = await InviteService.validateInviteToken('group', 'invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid invite link');
    });
  });

  describe('getInviteAnalytics', () => {
    it('should return invite statistics for a group', async () => {
      const mockLogs = [
        { status: 'sent' },
        { status: 'sent' },
        { status: 'accepted' },
        { status: 'declined' },
        { status: 'expired' },
        { status: 'revoked' }
      ];
      vi.mocked(prisma.inviteLog.findMany).mockResolvedValue(mockLogs as any);

      const result = await InviteService.getInviteAnalytics('group', 'group-1');

      expect(result.total).toBe(6);
      expect(result.sent).toBe(2);
      expect(result.accepted).toBe(1);
      expect(result.declined).toBe(1);
      expect(result.expired).toBe(1);
      expect(result.revoked).toBe(1);
      expect(result.pending).toBe(2); // sent = pending
    });
  });

  describe('revokeInvitation', () => {
    it('should revoke a group invitation successfully', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.groupJoinRequest.deleteMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(prisma.inviteLog.updateMany).mockResolvedValue({ count: 1 } as any);

      const result = await InviteService.revokeInvitation('group', 'group-1', 'test@example.com', 'admin-1');

      expect(result.success).toBe(true);
      expect(prisma.groupJoinRequest.deleteMany).toHaveBeenCalled();
      expect(prisma.inviteLog.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'revoked',
            revokedBy: 'admin-1'
          })
        })
      );
    });

    it('should fail if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await InviteService.revokeInvitation('group', 'group-1', 'notfound@example.com', 'admin-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('should fail if no pending invitation found', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.groupJoinRequest.deleteMany).mockResolvedValue({ count: 0 } as any);

      const result = await InviteService.revokeInvitation('group', 'group-1', 'test@example.com', 'admin-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No pending invitation found');
    });
  });
});
