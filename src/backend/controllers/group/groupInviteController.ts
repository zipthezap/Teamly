import prisma from '../../config/database';
import { isValidEmail } from '../../utils/validation';
import { logger } from '../../utils/logger';
import { Request, Response } from 'express';
import * as permissionService from '../../services/permissionService';
import * as locationService from '../../services/locationService';
import * as groupService from '../../services/groupService';
import { GroupNotificationType } from '../../../shared/types/event.types';
import { CacheService } from '../../services/cacheService';
import { Permission } from '../../../shared/types/permissions.types';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '../../utils/errors';
import { createInviteToken } from '../../utils/inviteToken';
import { groupBan } from '../../utils/prismaExtended';
import { NotificationFactory } from '../../services/notificationFactory';
import { InviteService } from '../../services/inviteService';

const MAX_BULK_INVITES = 50;
const MIN_EXPIRES_IN_DAYS = 1;
const MAX_EXPIRES_IN_DAYS = 30;

function validateExpiresInDays(expiresInDays: unknown) {
  if (expiresInDays === undefined || expiresInDays === null) return;
  const n = Number(expiresInDays);
  if (!Number.isInteger(n) || n < MIN_EXPIRES_IN_DAYS || n > MAX_EXPIRES_IN_DAYS) {
    throw new BadRequestError(
      `expiresInDays must be an integer between ${MIN_EXPIRES_IN_DAYS} and ${MAX_EXPIRES_IN_DAYS}`,
      'OUT_OF_RANGE',
      'expiresInDays'
    );
  }
}

export const inviteMember = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email, customMessage, expiresInDays } = req.body;

  if (!email) {
    throw new BadRequestError('Email is required');
  }

  // Validate email format
  if (!isValidEmail(email)) {
    throw new BadRequestError('Invalid email format');
  }

  validateExpiresInDays(expiresInDays);

  // Check if user has permission to invite
  const canInvite = await InviteService.canUserInvite(req.user!.id, id, 'group');
  
  if (!canInvite.allowed) {
    throw new ForbiddenError(canInvite.reason || 'You do not have permission to invite members');
  }

  // Find user to invite
  const userToInvite = await prisma.user.findUnique({
    where: { email }
  });

  if (!userToInvite) {
    throw new NotFoundError('User not found');
  }

  // Prevent inviting yourself
  if (userToInvite.id === req.user!.id) {
    throw new BadRequestError('You cannot invite yourself');
  }

  // Use the InviteService to handle the invitation with optional custom message and expiration
  const result = await InviteService.inviteUserToGroup(id, userToInvite.id, req.user!.id, {
    customMessage,
    expiresInDays
  });

  if (!result.success) {
    // Surface pending-invite conflict clearly
    if (result.error?.includes('pending') || result.error?.includes('already')) {
      throw new ConflictError(result.error, 'INVITE_ALREADY_PENDING');
    }
    throw new BadRequestError(result.error || 'Failed to send invitation');
  }

  res.status(201).json({
    message: 'Invitation sent successfully'
  });
};

/**
 * Revoke a pending invitation
 */
export const revokeInvitation = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email } = req.body;

  if (!email) {
    throw new BadRequestError('Email is required');
  }

  // Check if user has permission to revoke invites
  const hasPermission = await permissionService.hasGroupPermission(
    req.user!.id, 
    id, 
    Permission.GROUP_REVOKE_INVITES
  );

  if (!hasPermission) {
    throw new ForbiddenError('You do not have permission to revoke invitations');
  }

  const result = await InviteService.revokeInvitation('group', id, email, req.user!.id);

  if (!result.success) {
    throw new BadRequestError(result.error || 'Failed to revoke invitation');
  }

  res.json({
    message: 'Invitation revoked successfully'
  });
};

/**
 * Get invite analytics for a group
 */
export const getInviteAnalytics = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { from, to } = req.query;

  // Check if user has permission to view analytics
  const hasPermission = await permissionService.hasGroupPermission(
    req.user!.id, 
    id, 
    Permission.GROUP_VIEW_INVITE_ANALYTICS
  );

  if (!hasPermission) {
    throw new ForbiddenError('You do not have permission to view invite analytics');
  }

  let fromDate: Date | undefined;
  let toDate: Date | undefined;

  if (from) {
    fromDate = new Date(from as string);
    if (isNaN(fromDate.getTime())) throw new BadRequestError('Invalid from date');
  }
  if (to) {
    toDate = new Date(to as string);
    if (isNaN(toDate.getTime())) throw new BadRequestError('Invalid to date');
  }

  const analytics = await InviteService.getInviteAnalytics('group', id, { from: fromDate, to: toDate });

  res.json({ analytics });
};

/**
 * Bulk invite members to a group by email list
 * POST /groups/:id/invitations/bulk
 */
export const bulkInviteMembers = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { emails, customMessage, expiresInDays } = req.body;

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    throw new BadRequestError('emails must be a non-empty array');
  }

  if (emails.length > MAX_BULK_INVITES) {
    throw new BadRequestError(`Cannot invite more than ${MAX_BULK_INVITES} users at once`);
  }

  // Validate each email format
  const invalidEmails = emails.filter((e: unknown) => typeof e !== 'string' || !isValidEmail(e));
  if (invalidEmails.length > 0) {
    const displayInvalid = invalidEmails
      .map((e: unknown) => (typeof e === 'string' ? e : String(e)))
      .slice(0, 5)
      .join(', ');
    throw new BadRequestError(
      `Invalid email format(s): ${displayInvalid}`,
      'INVALID_FORMAT',
      'emails'
    );
  }

  validateExpiresInDays(expiresInDays);

  // De-duplicate emails before processing
  const uniqueEmails = [...new Set((emails as string[]).map((e) => e.toLowerCase()))];

  // Check permission
  const canInvite = await InviteService.canUserInvite(req.user!.id, id, 'group');
  if (!canInvite.allowed) {
    throw new ForbiddenError(canInvite.reason || 'You do not have permission to invite members');
  }

  const result = await InviteService.batchInviteToGroup(id, uniqueEmails, req.user!.id, {
    customMessage,
    expiresInDays,
  });

  res.status(207).json({
    message: 'Bulk invite completed',
    total: result.total,
    successful: result.successful,
    failed: result.failed,
    errors: result.errors,
  });
};

/**
 * Generate a new invite token for the group
 */
export const generateInviteToken = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { expiresInDays = 30 } = req.body;

  // Check if user has permission to manage invites
  const hasPermission = await permissionService.hasGroupPermission(
    req.user!.id, 
    id, 
    Permission.GROUP_INVITE_MEMBERS
  );

  if (!hasPermission) {
    throw new ForbiddenError('You do not have permission to generate invite tokens');
  }

  const result = await InviteService.generateInviteToken('group', id, expiresInDays);

  if (!result.success) {
    throw new BadRequestError(result.error || 'Failed to generate invite token');
  }

  res.json({
    message: 'Invite token generated successfully',
    token: result.token,
    expiresAt: result.expiresAt
  });
};

// Respond to a group invitation (for invited users)
export const respondToInvitation = async (req: Request, res: Response) => {
  const { id, requestId } = req.params;
  const { action } = req.body; // 'accept' or 'decline'

  if (!action || !['accept', 'decline'].includes(action)) {
    throw new BadRequestError('Invalid action. Must be "accept" or "decline"');
  }

  // Get the invitation
  const invitation = await prisma.groupJoinRequest.findUnique({
    where: { id: requestId }
  });

  if (!invitation) {
    throw new NotFoundError('Invitation not found');
  }

  if (invitation.groupId !== id) {
    throw new BadRequestError('Invitation does not belong to this group');
  }

  if (invitation.status !== 'pending') {
    throw new BadRequestError('Invitation already processed');
  }

  // Only the invited user can respond to their invitation
  if (invitation.userId !== req.user!.id) {
    throw new ForbiddenError('You can only respond to your own invitations');
  }

  // Only invitations (not user-initiated requests) can be responded to by users
  if (invitation.createdBy !== 'INVITE') {
    throw new BadRequestError('This is not an invitation. Join requests must be handled by group admins.');
  }

  // Check if invitation has expired
  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    // Automatically mark as rejected
    await prisma.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: 'rejected' }
    });
    throw new BadRequestError('This invitation has expired');
  }

  // If accepting, use a transaction to ensure atomicity
  if (action === 'accept') {
    const result = await prisma.$transaction(async (tx) => {
      // Get group to check max members
      const group = await tx.group.findUnique({
        where: { id },
        select: { maxMembers: true }
      });

      if (!group) {
        throw new NotFoundError('Group not found');
      }

      // Check if user is already a member (race condition protection)
      const existingMembership = await tx.groupMember.findFirst({
        where: {
          groupId: id,
          userId: req.user!.id
        }
      });

      if (existingMembership) {
        throw new BadRequestError('You are already a member of this group');
      }

      // Check max members limit
      if (group.maxMembers) {
        const currentMemberCount = await tx.groupMember.count({
          where: { groupId: id }
        });

        if (currentMemberCount >= group.maxMembers) {
          throw new ConflictError('Group has reached maximum member capacity', 'GROUP_AT_CAPACITY');
        }
      }

      // Update the invitation status
      const updatedInvitation = await tx.groupJoinRequest.update({
        where: { id: requestId },
        data: { status: 'approved' }
      });

      // Add the user as a member
      await tx.groupMember.create({
        data: {
          groupId: id,
          userId: req.user!.id,
          role: 'member'
        }
      });

      return updatedInvitation;
    });

    // Invalidate group cache for all affected users
    const cacheOperations = await Promise.allSettled([
      CacheService.invalidate('group', id),
      CacheService.deletePattern(`user:${req.user!.id}:groups:*`),
      CacheService.deletePattern(`events:user:${req.user!.id}:group:${id}:*`),
      CacheService.deletePattern(`events:user:${req.user!.id}:group:all:*`)
    ]);

    // Log any failures
    const failures = cacheOperations.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.warn('Some cache invalidation operations failed in respondToInvitation', 'GroupController', { 
        failureCount: failures.length,
        totalOperations: cacheOperations.length 
      });
    }

    res.json({ 
      message: 'Invitation accepted successfully',
      invitation: result
    });
  } else {
    // Declining is simpler, just update the status
    const updatedInvitation = await prisma.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: 'rejected' }
    });

    res.json({ 
      message: 'Invitation declined successfully',
      invitation: updatedInvitation
    });
  }
};

// Get user's pending invitations
export const getUserInvitations = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const invitations = await prisma.groupJoinRequest.findMany({
    where: {
      userId,
      status: 'pending',
      createdBy: 'INVITE'
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          description: true,
          picture: true,
          isPublic: true
        }
      },
      inviter: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(invitations);
};

// Get group info for invite preview (public groups only)
// This allows users to see group details before joining
export const getGroupForInvite = async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const userId = req.user?.id; // Optional auth - user may not be logged in yet

  if (!groupId) {
    throw new BadRequestError('Group ID is required');
  }

  // Get group info with basic details
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      description: true,
      picture: true,
      isPublic: true,
      sportType: true,
      maxMembers: true,
      locationName: true,
      city: true,
      country: true,
      tags: true,
      createdAt: true,
      latitude: true,
      longitude: true,
      creator: {
        select: { id: true, name: true, profilePicture: true }
      },
      _count: {
        select: {
          members: true,
          sessions: true
        }
      }
    }
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // Allow preview for both public groups and private groups that have a valid invite token
  // If the group is private, the caller must supply the token as a query param
  if (!group.isPublic) {
    const { token } = req.query;
    if (!token) {
      throw new ForbiddenError('This is a private group. An invite token is required to preview it.');
    }
    // Verify the token matches the group's current invite token and is not expired
    const tokenValidation = await InviteService.validateInviteToken('group', token as string);
    if (!tokenValidation.valid || tokenValidation.resourceId !== groupId) {
      throw new ForbiddenError('Invalid or expired invite token for this group.');
    }
  }

  // Check if user is already a member (if authenticated)
  let isMember = false;
  if (userId) {
    const membership = await prisma.groupMember.findFirst({
      where: { userId, groupId }
    });
    isMember = !!membership;
  }

  // Enrich with location info
  const enrichedGroup = locationService.enrichWithLocationInfo(group);

  res.json({
    ...enrichedGroup,
    isMember
  });
};

// Join group by invite link - now requires authentication
// SECURITY FIX: Changed to use authenticated user's ID instead of accepting userId from request body
// This prevents privilege escalation where attackers could join as any user
export const joinGroupByInvite = async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const userId = req.user!.id; // Use authenticated user's ID, not from request body
  
  if (!groupId) {
    throw new BadRequestError('Group ID is required');
  }

  // Verify the group exists
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, isPublic: true, maxMembers: true }
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // Join is allowed for public groups, OR private groups with a valid invite token
  if (!group.isPublic) {
    const token = req.body.token || req.query.token;
    if (!token) {
      throw new ForbiddenError('This group is private. Please use the invite token link to join.');
    }
    const tokenValidation = await InviteService.validateInviteToken('group', token as string);
    if (!tokenValidation.valid || tokenValidation.resourceId !== groupId) {
      throw new ForbiddenError('Invalid or expired invite token for this group.');
    }
  }

  // Check if already a member
  const existing = await prisma.groupMember.findFirst({ 
    where: { userId, groupId } 
  });
  
  if (existing) {
    return res.status(200).json({ message: 'Already a member' });
  }

  // Create membership atomically with capacity check to avoid TOCTOU races
  await prisma.$transaction(async (tx) => {
    // Re-check membership within transaction
    const existingMemberTx = await tx.groupMember.findFirst({ where: { userId, groupId } });
    if (existingMemberTx) return; // idempotent

    // Check capacity
    if (group.maxMembers) {
      const currentMemberCount = await tx.groupMember.count({ where: { groupId } });
      if (currentMemberCount >= group.maxMembers) {
        throw new BadRequestError('Group has reached maximum member capacity');
      }
    }

    await tx.groupMember.create({ data: { userId, groupId, role: 'member' } });
  }, { isolationLevel: 'Serializable' });

  // Invalidate group cache for all affected users
  await CacheService.invalidate('group', groupId);
  // Invalidate user groups cache for the joining user
  await CacheService.deletePattern(`user:${userId}:groups:*`);
  // Invalidate events cache since user now has access to group events
  await CacheService.deletePattern(`events:user:${userId}:group:${groupId}:*`);
  await CacheService.deletePattern(`events:user:${userId}:group:all:*`);

  res.status(201).json({ message: 'Joined group successfully' });
};

// Get invite link for a group
export const getInviteLink = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Get group info
  const group = await prisma.group.findUnique({
    where: { id }
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // Check if user is a member of the group
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: id,
      userId: req.user!.id
    }
  });

  if (!membership) {
    throw new ForbiddenError('Only group members can get invite links');
  }

  // Check if user has permission to get invite link
  // Admins and moderators can always get the link
  const isAdminOrModerator = membership.role === 'admin' || membership.role === 'moderator';
  
  if (!isAdminOrModerator && !group.allowMemberCopyLink) {
    throw new ForbiddenError('Only admins and moderators can copy the invite link');
  }

  // Generate invite token if not already present
  let inviteToken = group.inviteToken;
  
  if (!inviteToken) {
    inviteToken = createInviteToken();
    await prisma.group.update({
      where: { id },
      data: { inviteToken }
    });
  }

  // Return the invite token and constructed URL
  res.json({ 
    inviteToken,
    inviteUrl: `/groups/join/${inviteToken}`,
    groupId: id 
  });
};

/**
 * Generate or regenerate invite token for a group
 * Similar to session invite token generation
 */
export const generateGroupInviteToken = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Get group and check permissions
  const group = await prisma.group.findUnique({
    where: { id }
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // Check if user has permission to generate invite links
  const canInvite = await InviteService.canUserInvite(req.user!.id, id, 'group');
  
  if (!canInvite.allowed) {
    throw new ForbiddenError(canInvite.reason || 'Only admins and moderators can generate invite links');
  }

  // Generate new token
  const inviteToken = createInviteToken();

  const updatedGroup = await prisma.group.update({
    where: { id },
    data: { inviteToken }
  });

  logger.info('Group invite token generated', 'GroupController', {
    groupId: id,
    userId: req.user!.id
  });

  res.json({ 
    inviteToken: updatedGroup.inviteToken,
    inviteUrl: `/groups/join/${updatedGroup.inviteToken}`
  });
};

/**
 * Get group by invite token (public endpoint)
 */
export const getGroupByInviteToken = async (req: Request, res: Response) => {
  const { token } = req.params;

  const group = await prisma.group.findFirst({
    where: {
      inviteToken: token
    },
    include: {
      creator: {
        select: { id: true, name: true, profilePicture: true }
      },
      _count: {
        select: { members: true, sessions: true }
      }
    }
  });

  if (!group) {
    throw new NotFoundError('Group not found or invite link is invalid');
  }

  // Return sanitized group info (without sensitive data)
  res.json({
    id: group.id,
    name: group.name,
    description: group.description,
    sportType: group.sportType,
    isPublic: group.isPublic,
    maxMembers: group.maxMembers,
    memberCount: group._count.members,
    eventCount: group._count.sessions,
    picture: group.picture,
    creator: group.creator,
    tags: group.tags
  });
};

/**
 * Join group via invite token (authenticated endpoint)
 */
export const joinGroupByInviteToken = async (req: Request, res: Response) => {
  const { token } = req.params;
  const userId = req.user!.id;

  // Validate invite token and check expiration
  const validation = await InviteService.validateInviteToken('group', token);
  
  if (!validation.valid) {
    throw new BadRequestError(validation.error || 'Invalid or expired invite link');
  }

  const group = await prisma.group.findFirst({
    where: {
      inviteToken: token
    }
  });

  if (!group) {
    throw new NotFoundError('Group not found or invite link is invalid');
  }

  // Check if user is banned from this group
  const ban = await groupBan(prisma).findUnique({
    where: { groupId_userId: { groupId: group.id, userId } }
  });
  if (ban) {
    throw new ForbiddenError('You have been banned from this group.');
  }

  // Check if user is already a member
  const existingMembership = await prisma.groupMember.findFirst({
    where: {
      groupId: group.id,
      userId
    }
  });

  if (existingMembership) {
    throw new BadRequestError('You are already a member of this group');
  }
  // Check max members limit and create join request atomically to prevent
  // races where concurrent join attempts bypass capacity checks.
  const joinRequest = await prisma.$transaction(async (tx) => {
    // Re-check membership inside transaction
    const existingMembershipTx = await tx.groupMember.findFirst({
      where: { groupId: group.id, userId }
    });
    if (existingMembershipTx) {
      throw new BadRequestError('You are already a member of this group');
    }

    // Check max members limit using the transactional client
    if (group.maxMembers) {
      const currentMemberCount = await tx.groupMember.count({ where: { groupId: group.id } });
      if (currentMemberCount >= group.maxMembers) {
        throw new BadRequestError('Group has reached maximum member capacity');
      }
    }

    // Check if there's already a pending join request
    const existingRequest = await tx.groupJoinRequest.findFirst({
      where: { groupId: group.id, userId, status: 'pending' }
    });
    if (existingRequest) {
      throw new BadRequestError('You already have a pending join request for this group');
    }

    // Create join request with LINK source
    return tx.groupJoinRequest.create({
      data: { groupId: group.id, userId, status: 'pending', createdBy: 'LINK' }
    });
  }, { isolationLevel: 'Serializable' });

  // Auto-approve if the group setting allows it
  if (group.autoApproveJoinRequests) {
    await prisma.$transaction(async (tx) => {
      // Check capacity and existing membership atomically
      await groupService.checkGroupCapacityAndMembership(group.id, userId, group.maxMembers, tx);

      // Update join request to approved
      await tx.groupJoinRequest.update({
        where: { id: joinRequest.id },
        data: { status: 'approved' }
      });

      // Create membership
      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId,
          role: 'member'
        }
      });
    });

    // Notify group admins about new member
    const admins = await prisma.groupMember.findMany({
      where: {
        groupId: group.id,
        role: { in: ['admin', 'moderator'] }
      },
      select: { userId: true }
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true }
    });

    if (admins.length > 0 && user) {
      await NotificationFactory.createGroupNotifications({
        groupId: group.id,
        type: GroupNotificationType.accepted,
        userIds: admins.map(a => a.userId),
        params: {
          groupName: group.name,
          name: user.name
        },
        checkMutePreference: true
      });
    }

    logger.info('User joined group via invite link (auto-approved)', 'GroupController', {
      groupId: group.id,
      userId
    });

    res.status(200).json({
      message: 'Successfully joined the group',
      autoApproved: true,
      groupId: group.id
    });
  } else {
    // Notify admins about join request
    const admins = await prisma.groupMember.findMany({
      where: {
        groupId: group.id,
        role: { in: ['admin', 'moderator'] }
      },
      select: { userId: true }
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true }
    });

    if (admins.length > 0 && user) {
      await NotificationFactory.createGroupNotifications({
        groupId: group.id,
        type: GroupNotificationType.join_request,
        userIds: admins.map(a => a.userId),
        params: {
          groupName: group.name,
          name: user.name
        },
        checkMutePreference: true
      });
    }

    logger.info('User requested to join group via invite link', 'GroupController', {
      groupId: group.id,
      userId
    });

    res.status(201).json({
      message: 'Join request sent successfully. Waiting for approval.',
      autoApproved: false,
      groupId: group.id
    });
  }

  // Invalidate caches
  await Promise.allSettled([
    CacheService.deletePattern(`group:${group.id}:*`),
    CacheService.deletePattern(`user:${userId}:groups:*`)
  ]);
};
