import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import { Request, Response } from 'express';
import * as permissionService from '../../services/permissionService';
import { GroupNotificationType } from '../../../shared/types/event.types';
import { CacheService } from '../../services/cacheService';
import { Permission } from '../../../shared/types/permissions.types';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors';
import * as groupService from '../../services/groupService';
import { txGroupBan, txAuditLog } from '../../utils/prismaExtended';

const MAX_BAN_REASON_LENGTH = 500;

export const getGroupMembers = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Only allow members of the group to view the member list
  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, profilePicture: true }
          }
        }
      }
    }
  });
  
  if (!group) {
    throw new NotFoundError('Group not found');
  }
  
  // Check if the requesting user is a member
  interface GroupMemberCheck {
    userId: string;
  }

  const isMember = group.members.some((m: GroupMemberCheck) => m.userId === req.user?.id);
  if (!isMember) {
    throw new ForbiddenError('Only group members can view the member list');
  }
  
  // Flatten member user fields for frontend compatibility
  interface GroupMemberDetail {
    userId: string;
    user?: {
      name: string;
      email: string;
      profilePicture: string | null;
    };
    role: string;
  }

  const members = group.members.map((member: GroupMemberDetail) => ({
    id: member.userId,
    name: member.user?.name,
    email: member.user?.email,
    profilePicture: member.user?.profilePicture,
    role: member.role,
  }));
  
  res.setHeader('Cache-Control', 'no-store');
  res.json(members);
};

export const removeMember = async (req: Request, res: Response) => {
  const { id, memberId } = req.params;
  const { reason } = req.body ?? {};

  // Validate optional reason field
  if (reason !== undefined && reason !== null && typeof reason === 'string') {
    if (reason.length > MAX_BAN_REASON_LENGTH) {
      throw new BadRequestError(
        `reason must not exceed ${MAX_BAN_REASON_LENGTH} characters`,
        'MAX_LENGTH_EXCEEDED',
        'reason'
      );
    }
  }

  const canRemove = await permissionService.hasGroupPermission(req.user!.id, id, Permission.GROUP_REMOVE_MEMBERS);
  
  if (!canRemove) {
    logger.debug('User lacks GROUP_REMOVE_MEMBERS permission', 'GroupController', {
      userId: req.user!.id,
      groupId: id,
      memberId,
    });
    throw new ForbiddenError('Only admins can remove members');
  }

  // Prevent admin from removing itself
  const memberToRemove = await prisma.groupMember.findUnique({
    where: { id: memberId },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      }
    }
  });
  
  if (!memberToRemove) {
    throw new NotFoundError('Member not found');
  }

  // Cannot ban yourself
  if (memberToRemove.userId === req.user!.id) {
    throw new BadRequestError('You cannot ban yourself from the group');
  }

  if (memberToRemove.role === 'admin') {
    // Cannot ban an admin unless you are the group creator
    const group = await prisma.group.findUnique({
      where: { id },
      select: { creatorId: true, name: true }
    });
    if (!group || group.creatorId !== req.user!.id) {
      throw new ForbiddenError('Only the group creator can remove admins');
    }
  }

  // Get group name for notification (fetch if not already retrieved)
  const group = await prisma.group.findUnique({
    where: { id },
    select: { name: true }
  });
  await prisma.$transaction(async (tx) => {
    await tx.groupMember.delete({
      where: { id: memberId }
    });

    // Clean up any pending invitations for this user
    await tx.groupJoinRequest.deleteMany({
      where: {
        groupId: id,
        userId: memberToRemove.userId,
        status: 'pending',
        createdBy: 'INVITE'
      }
    });

    // Create a ban record to prevent re-joining (ignored if already banned)
    await txGroupBan(tx).upsert({
      where: { groupId_userId: { groupId: id, userId: memberToRemove.userId } },
      create: { groupId: id, userId: memberToRemove.userId, bannedBy: req.user!.id },
      update: { bannedBy: req.user!.id, bannedAt: new Date() },
    });

    // Audit log
    await txAuditLog(tx).create({
      data: {
        entityType: 'group',
        entityId: id,
        actorId: req.user!.id,
        action: 'member_removed',
        metadata: { removedUserId: memberToRemove.userId, removedUserName: memberToRemove.user.name },
      },
    });
  });

  // Notify the removed member
  if (group) {
    await prisma.groupNotification.create({
      data: {
        groupId: id,
        userId: memberToRemove.userId,
        type: GroupNotificationType.removed,
        params: {
          groupName: group.name,
          name: req.user!.name
        }
      }
    }).catch(error => {
      logger.error('Failed to send removal notification', 'GroupController', { error });
    });
  }

  // Invalidate group cache for all affected users
  await CacheService.invalidate('group', id);
  await CacheService.deletePattern(`user:${memberToRemove.userId}:groups:*`);

  res.json({ message: 'Member removed successfully' });
};

// Remove a group member by userId (admin only)
export const removeMemberByUserId = async (req: Request, res: Response) => {
  const { id, userId } = req.params;

  logger.info('Attempting to remove member by userId', 'GroupController', {
    userId: req.user!.id,
    groupId: id,
    targetUserId: userId,
    action: 'GROUP_REMOVE_MEMBERS',
  });
  
  const canRemove = await permissionService.hasGroupPermission(req.user!.id, id, Permission.GROUP_REMOVE_MEMBERS);
  
  logger.info('Remove member by userId permission result', 'GroupController', {
    userId: req.user!.id,
    groupId: id,
    targetUserId: userId,
    canRemove,
  });
  
  if (!canRemove) {
    logger.warn('403 Forbidden: User lacks GROUP_REMOVE_MEMBERS permission', 'GroupController', {
      userId: req.user!.id,
      groupId: id,
      targetUserId: userId,
    });
    throw new ForbiddenError('Only admins can remove members');
  }

  // Find the group member record by groupId and userId
  const memberToRemove = await prisma.groupMember.findFirst({
    where: { groupId: id, userId: userId }
  });
  
  if (!memberToRemove) {
    logger.warn('Attempted to remove non-existent group member by userId', 'GroupController', { groupId: id, userId });
    throw new NotFoundError('Group member not found.');
  }
  
  if (memberToRemove.userId === req.user!.id && memberToRemove.role === 'admin') {
    throw new ForbiddenError('Admins cannot remove themselves from the group.');
  }

  // Use transaction to ensure atomicity
  await prisma.$transaction(async (tx) => {
    await tx.groupMember.delete({
      where: { id: memberToRemove.id }
    });

    // Clean up any pending invitations for this user
    await tx.groupJoinRequest.deleteMany({
      where: {
        groupId: id,
        userId: memberToRemove.userId,
        status: 'pending',
        createdBy: 'INVITE'
      }
    });
  });

  // Invalidate group cache for all affected users
  await CacheService.invalidate('group', id);
  await CacheService.deletePattern(`user:${memberToRemove.userId}:groups:*`);

  // Set no-store header and return updated group
  res.setHeader('Cache-Control', 'no-store');
  const updatedGroup = await prisma.group.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, email: true, profilePicture: true } },
      members: { include: { user: { select: { id: true, name: true, email: true, profilePicture: true } } } }
    }
  });
  
  res.json({ group: updatedGroup, message: 'Member removed successfully' });
};

// Assign or update group member role (admin only)
export const updateMemberRole = async (req: Request, res: Response) => {
  const { id, memberId } = req.params;
  const { role } = req.body;

  // Validate role with explicit type check
  if (!role || !groupService.isValidRole(role)) {
    throw new BadRequestError('Invalid role. Must be "admin" or "member"');
  }

  // Use a transaction to prevent race conditions when demoting admins
  const result = await prisma.$transaction(async (tx) => {
    // Check if user is admin of the group
    const adminMembership = await tx.groupMember.findFirst({
      where: {
        groupId: id,
        userId: req.user!.id,
        role: 'admin'
      }
    });

    if (!adminMembership) {
      throw new ForbiddenError('Only admins can update member roles');
    }

    // Get the member to update with groupId constraint
    const memberToUpdate = await tx.groupMember.findFirst({
      where: {
        id: memberId,
        groupId: id
      }
    });

    if (!memberToUpdate) {
      throw new NotFoundError('Member not found in this group');
    }

    // Prevent promoting/demoting the group creator
    const groupRecord = await tx.group.findUnique({
      where: { id },
      select: { creatorId: true }
    });
    if (groupRecord && memberToUpdate.userId === groupRecord.creatorId) {
      throw new ForbiddenError('The group creator\'s role cannot be changed');
    }

    // Check if trying to demote the last admin
    if (memberToUpdate.role === 'admin' && role === 'member') {
      const adminCount = await tx.groupMember.count({
        where: {
          groupId: id,
          role: 'admin'
        }
      });

      if (adminCount <= 1) {
        throw new BadRequestError('Cannot demote the last admin. Please assign another admin first.');
      }
    }

    // Update the member role
    const updatedMember = await tx.groupMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Audit log
    await txAuditLog(tx).create({
      data: {
        entityType: 'group',
        entityId: id,
        actorId: req.user!.id,
        action: 'role_changed',
        metadata: { targetUserId: memberToUpdate.userId, previousRole: memberToUpdate.role, newRole: role },
      },
    });

    return updatedMember;
  });

  // Invalidate group cache for all affected users
  // Use Promise.allSettled to ensure all cache operations are attempted even if one fails
  await Promise.allSettled([
    CacheService.invalidate('group', id),
    CacheService.deletePattern(`user:${result.userId}:groups:*`),
    CacheService.deletePattern(`events:user:${result.userId}:group:${id}:*`),
    CacheService.deletePattern(`events:user:${result.userId}:group:all:*`),
    permissionService.clearUserPermissionCache(result.userId)
  ]).catch((error: Error) => {
    logger.error('Cache invalidation error in updateMemberRole', 'GroupController', { error });
  });

  res.json(result);
};

// Leave a group
export const leaveGroup = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  // SECURITY FIX: Use transaction to prevent race condition where last admin could leave
  const result = await prisma.$transaction(async (tx) => {
    // Find the membership
    const membership = await tx.groupMember.findFirst({
      where: {
        groupId: id,
        userId: userId
      }
    });

    if (!membership) {
      throw new NotFoundError('Not a member of this group');
    }

    // If user is admin, check if they're the only admin
    if (membership.role === 'admin') {
      const adminCount = await tx.groupMember.count({
        where: {
          groupId: id,
          role: 'admin'
        }
      });

      // If this is the only admin, check total member count
      if (adminCount <= 1) {
        const totalMembers = await tx.groupMember.count({
          where: { groupId: id }
        });

        // If admin is the only member, delete the group
        if (totalMembers <= 1) {
          await tx.group.delete({
            where: { id }
          });
          // Since we know there's only one member (current user), use their userId directly
          return { groupDeleted: true, members: [{ userId }] };
        }

        // If there are other members but no other admins
        throw new BadRequestError('Cannot leave group as the only admin. Please assign another admin first or delete the group.');
      }
    }

    // Delete the membership atomically
    await tx.groupMember.delete({
      where: { id: membership.id }
    });

    // Clean up any pending join requests/invitations for this user (both
    // admin-sent invites and the user's own self-submitted requests)
    await tx.groupJoinRequest.deleteMany({
      where: {
        groupId: id,
        userId: userId,
        status: 'pending',
      }
    });

    // Automatically leave all sessions belonging to this group.
    // This keeps dashboard/session feeds in sync after leaving a group.
    const groupSessions = await tx.session.findMany({
      where: { groupId: id },
      select: { id: true },
    });
    const groupSessionIds = groupSessions.map((s) => s.id);
    if (groupSessionIds.length > 0) {
      await tx.sessionParticipant.deleteMany({
        where: {
          userId,
          sessionId: { in: groupSessionIds },
        },
      });

      await tx.sessionAttendance.deleteMany({
        where: {
          userId,
          sessionId: { in: groupSessionIds },
        },
      });
    }

    return { groupDeleted: false, members: [] };
  });

  // Invalidate group cache for all affected users
  if (result.groupDeleted) {
    // Group was deleted, invalidate caches for all members
    const cacheOperations = [
      CacheService.invalidate('group', id),
      ...result.members.flatMap(member => [
        CacheService.deletePattern(`user:${member.userId}:groups:*`),
        CacheService.deletePattern(`events:user:${member.userId}:group:${id}:*`),
        CacheService.deletePattern(`events:user:${member.userId}:group:all:*`)
      ])
    ];
    
    const results = await Promise.allSettled(cacheOperations);
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.error('Some cache invalidation operations failed in leaveGroup', 'GroupController', { 
        failureCount: failures.length,
        totalOperations: cacheOperations.length 
      });
    }

    res.json({ message: 'Group deleted successfully as you were the last member', groupDeleted: true });
  } else {
    // Regular leave, invalidate caches
    await CacheService.invalidate('group', id);
    await CacheService.deletePattern(`user:${userId}:groups:*`);
    await CacheService.deletePattern(`events:user:${userId}:group:${id}:*`);
    await CacheService.deletePattern(`events:user:${userId}:group:all:*`);

    res.json({ message: 'Left group successfully', groupDeleted: false });
  }
};

// Transfer admin rights to another member
export const transferAdmin = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') {
    throw new BadRequestError('Group ID is required');
  }
  const { newAdminEmail } = req.body;
  if (!newAdminEmail || typeof newAdminEmail !== 'string' || !newAdminEmail.trim()) {
    throw new BadRequestError('newAdminEmail must be a non-empty string');
  }
  
  // Get group with members for cache invalidation
  const group = await prisma.group.findUnique({
    where: { id },
    select: {
      id: true,
      members: {
        select: { userId: true }
      }
    }
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // Check if user is current admin
  const currentAdmin = await prisma.groupMember.findFirst({
    where: { groupId: id, userId: req.user!.id, role: 'admin' }
  });
  if (!currentAdmin) {
    throw new ForbiddenError('Only current admin can transfer admin rights.');
  }
  // Find new admin member
  const newAdminUser = await prisma.user.findUnique({ where: { email: newAdminEmail } });
  if (!newAdminUser) {
    throw new NotFoundError('Selected user not found.');
  }
  if (newAdminUser.id === req.user!.id) {
    throw new BadRequestError('Cannot transfer admin rights to yourself.');
  }
  const newAdminMembership = await prisma.groupMember.findFirst({
    where: { groupId: id, userId: newAdminUser.id },
    select: { id: true, role: true }
  });
  if (!newAdminMembership) {
    throw new NotFoundError('Selected user is not a member of the group.');
  }

  if (newAdminMembership.role === 'admin') {
    throw new BadRequestError('Selected user is already an admin.');
  }
  // Use transaction to update roles
  await prisma.$transaction([
    prisma.groupMember.update({
      where: { id: newAdminMembership.id },
      data: { role: 'admin' }
    }),
    prisma.groupMember.update({
      where: { id: currentAdmin.id },
      data: { role: 'member' }
    })
  ]);
  
  // Invalidate group cache for all affected users (role changes affect all members)
  await Promise.allSettled([
    CacheService.invalidate('group', id),
    ...group.members.map(member => 
      CacheService.deletePattern(`user:${member.userId}:groups:*`)
    )
  ]);
  
  res.json({ message: 'Admin rights transferred successfully.' });
};
