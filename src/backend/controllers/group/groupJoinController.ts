import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { Request, Response } from 'express';
import * as permissionService from '../../services/permissionService';
import * as groupService from '../../services/groupService';
import { NotificationFactory } from '../../services/notificationFactory';
import { CacheService } from '../../services/cacheService';
import { Permission } from '../../../shared/types/permissions.types';
import { GroupNotificationType } from '../../../shared/types/event.types';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '../../utils/errors';
import { groupBan, txAuditLog } from '../../utils/prismaExtended';

const MAX_JOIN_MESSAGE_LENGTH = 500;

// Request to join a public group
export const requestJoinGroup = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { message } = req.body ?? {};

  // Validate join message length if provided
  if (message !== undefined && message !== null && typeof message === 'string') {
    if (message.length > MAX_JOIN_MESSAGE_LENGTH) {
      throw new BadRequestError(
        `message must not exceed ${MAX_JOIN_MESSAGE_LENGTH} characters`,
        'MAX_LENGTH_EXCEEDED',
        'message'
      );
    }
  }

  // Check if group exists and is public
  const group = await prisma.group.findUnique({
    where: { id }
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  if (!group.isPublic) {
    throw new ForbiddenError('Group is not public');
  }

  // Check if user is banned from this group
  const ban = await groupBan(prisma).findUnique({
    where: { groupId_userId: { groupId: id, userId: req.user!.id } }
  });
  if (ban) {
    throw new ForbiddenError('You have been banned from this group.');
  }

  // Check if already a member
  const existingMembership = await prisma.groupMember.findFirst({
    where: {
      groupId: id,
      userId: req.user!.id
    }
  });

  if (existingMembership) {
    throw new BadRequestError('Already a member of this group');
  }

  // Check if already has a pending request
  const existingRequest = await prisma.groupJoinRequest.findFirst({
    where: {
      groupId: id,
      userId: req.user!.id,
      status: 'pending'
    }
  });

  if (existingRequest) {
    throw new BadRequestError('Join request already pending');
  }

  // If auto-approve is enabled, directly add user as member
  if (group.autoApproveJoinRequests) {
    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Check capacity and existing membership atomically
      await groupService.checkGroupCapacityAndMembership(id, req.user!.id, group.maxMembers, tx);

      // Create approved join request for record keeping
      const joinRequest = await tx.groupJoinRequest.create({
        data: {
          groupId: id,
          userId: req.user!.id,
          status: 'approved',
          createdBy: 'USER'
        },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          group: {
            select: { id: true, name: true, description: true }
          }
        }
      });

      // Add user as member
      await tx.groupMember.create({
        data: {
          groupId: id,
          userId: req.user!.id,
          role: 'member'
        }
      });

      return joinRequest;
    });

    // Notify the user that they were accepted
    try {
      await NotificationFactory.createGroupNotifications({
        groupId: id,
        type: GroupNotificationType.accepted,
        userIds: [req.user!.id],
        params: {
          groupName: group.name,
          name: group.name,
        },
        checkMutePreference: false,
      });
    } catch (error) {
      logger.error('Failed to send auto-approval notification', 'GroupController', { error });
    }

    // Invalidate group cache for all affected users
    await CacheService.invalidate('group', id);
    await CacheService.deletePattern(`user:${req.user!.id}:groups:*`);

    res.status(201).json({
      ...result,
      autoApproved: true,
      message: 'Automatically approved and joined group'
    });
    return;
  }

  // Create join request
  const joinRequest = await prisma.groupJoinRequest.create({
    data: {
      groupId: id,
      userId: req.user!.id,
      status: 'pending',
      createdBy: 'USER'
    },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      },
      group: {
        select: { id: true, name: true, description: true }
      }
    }
  });

  // Notify all group admins
  const admins = await prisma.groupMember.findMany({
    where: { groupId: id, role: 'admin' },
    select: { userId: true }
  });
  
  const adminUserIds = admins.map(admin => admin.userId);
  await NotificationFactory.createGroupNotifications({
    groupId: id,
    type: GroupNotificationType.join_request,
    userIds: adminUserIds,
    params: {
      groupName: joinRequest.group.name,
      name: req.user!.name,
    },
    checkMutePreference: true,
  });

  res.status(201).json(joinRequest);
};

// Cancel own join request (user cancels their own pending request)
export const cancelMyJoinRequest = async (req: Request, res: Response) => {
  const { id, requestId } = req.params;
  const userId = req.user!.id;

  const request = await prisma.groupJoinRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new NotFoundError('Join request not found');
  }

  if (request.groupId !== id) {
    throw new BadRequestError('Join request does not belong to this group');
  }

  if (request.userId !== userId) {
    throw new ForbiddenError('You can only cancel your own join requests');
  }

  if (request.status !== 'pending') {
    throw new BadRequestError('This request has already been processed');
  }

  await prisma.groupJoinRequest.delete({ where: { id: requestId } });
  res.status(204).send();
};

// Get join requests for a group (admin only)
export const getJoinRequests = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user has permission to manage roles (admins only)
  const canManageRoles = await permissionService.hasGroupPermission(req.user!.id, id, Permission.GROUP_MANAGE_ROLES);
  if (!canManageRoles) {
    throw new ForbiddenError('Only admins can view join requests');
  }

  const joinRequests = await prisma.groupJoinRequest.findMany({
    where: {
      groupId: id,
      status: 'pending'
    },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  res.json(joinRequests);
};

// Approve or reject a join request (admin only)
export const handleJoinRequest = async (req: Request, res: Response) => {
  const { id, requestId } = req.params;
  const { action } = req.body; // 'approve' or 'reject'

  if (!action || !['approve', 'reject'].includes(action)) {
    throw new BadRequestError('Invalid action. Must be "approve" or "reject"');
  }

  // Check if user has permission to manage roles (admins only)
  const canManageRoles = await permissionService.hasGroupPermission(req.user!.id, id, Permission.GROUP_MANAGE_ROLES);
  if (!canManageRoles) {
    throw new ForbiddenError('Only admins can handle join requests');
  }

  // Get the join request
  const joinRequest = await prisma.groupJoinRequest.findUnique({
    where: { id: requestId }
  });

  if (!joinRequest) {
    throw new NotFoundError('Join request not found');
  }

  if (joinRequest.groupId !== id) {
    throw new BadRequestError('Join request does not belong to this group');
  }

  if (joinRequest.status !== 'pending') {
    throw new BadRequestError('Join request already processed');
  }

  // For approve: check the group still exists and hasn't reached capacity
  if (action === 'approve') {
    const groupCheck = await prisma.group.findUnique({
      where: { id },
      select: { maxMembers: true, name: true }
    });
    if (!groupCheck) {
      throw new NotFoundError(`Group ${id} not found`);
    }
    if (groupCheck.maxMembers !== null) {
      const currentCount = await prisma.groupMember.count({ where: { groupId: id } });
      if (currentCount >= groupCheck.maxMembers) {
        throw new ConflictError(
          `Group has reached its maximum capacity (${groupCheck.maxMembers} members). Cannot approve this request.`,
          'GROUP_AT_CAPACITY'
        );
      }
    }
  }

  let updatedRequest: Awaited<ReturnType<typeof prisma.groupJoinRequest.update>> | null = null;

  // If approving, perform update + member create in a single transaction to avoid
  // races where the request becomes approved but the member create later fails.
  if (action === 'approve') {
    let groupName: string | undefined;
    updatedRequest = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Get group to check max members and get name for notification
      const group = await tx.group.findUnique({
        where: { id },
        select: { maxMembers: true, name: true }
      });

      if (!group) {
        throw new NotFoundError('Group not found');
      }

      groupName = group.name;

      // Check capacity and existing membership atomically
      await groupService.checkGroupCapacityAndMembership(id, joinRequest.userId, group.maxMembers, tx);

      // Update the join request status to approved
      const upd = await tx.groupJoinRequest.update({
        where: { id: requestId },
        data: { status: 'approved' }
      });

      // Add the user as a member
      await tx.groupMember.create({
        data: {
          groupId: id,
          userId: joinRequest.userId,
          role: 'member'
        }
      });

      // Audit log
      await txAuditLog(tx).create({
        data: {
          entityType: 'group',
          entityId: id,
          actorId: req.user!.id,
          action: 'join_request_approved',
          metadata: { requestId, requestedUserId: joinRequest.userId },
        },
      });

      return upd;
    }, { isolationLevel: 'Serializable' });

    // Create notification for the user who was accepted
    if (groupName) {
      await NotificationFactory.createGroupNotifications({
        groupId: id,
        type: GroupNotificationType.accepted,
        userIds: [joinRequest.userId],
        params: {
          groupName,
          name: req.user!.name,
        },
        checkMutePreference: false,
      });
    }

    // Invalidate group cache for all affected users
    // Use Promise.allSettled to ensure all cache operations are attempted even if one fails
    await Promise.allSettled([
      CacheService.invalidate('group', id),
      CacheService.deletePattern(`user:${joinRequest.userId}:groups:*`),
      CacheService.deletePattern(`events:user:${joinRequest.userId}:group:${id}:*`),
      CacheService.deletePattern(`events:user:${joinRequest.userId}:group:all:*`)
    ]).catch((error: Error) => {
      logger.error('Cache invalidation error in handleJoinRequest', 'GroupController', { error });
    });
  } else {
    // For reject: update the join request status (no member create needed)
    updatedRequest = await prisma.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: 'rejected' }
    });
  }

  res.json({ message: `Join request ${action}d successfully`, request: updatedRequest });
};

// Get the current user's own pending join requests (requests they submitted)
export const getMyJoinRequests = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const requests = await prisma.groupJoinRequest.findMany({
    where: {
      userId,
      status: 'pending',
      createdBy: 'USER',
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          description: true,
          picture: true,
          isPublic: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(requests);
};
