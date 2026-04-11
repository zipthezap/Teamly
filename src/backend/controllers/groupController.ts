
import prisma from '../config/database';
import { filterUnmutedUsers } from '../utils/notificationHelper';
import { logger } from '../utils/logger';
import { isValidEmail, parseCoordinates, parseFloatStrict } from '../utils/validation';
import { hasLocation } from '../utils/typeGuards';
import { Request, Response } from 'express';
import path from 'path';
import { 
  validateImage, 
  processImage, 
  deleteFile, 
  deleteOldPicture,
  generateUniqueFilename 
} from '../utils/imageProcessor';
import { UPLOAD_CONFIG } from '../config/upload';
import * as groupService from '../services/groupService';
import * as permissionService from '../services/permissionService';
import * as locationService from '../services/locationService';
import { GroupNotificationType } from '../../shared/types/event.types';
import { CacheService } from '../services/cacheService';
import { Permission } from '../../shared/types/permissions.types';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { createInviteToken } from '../utils/inviteToken';
import { NotificationFactory } from '../services/notificationFactory';
import { recordSearchQuery } from '../services/metricsService';
import { InviteService } from '../services/inviteService';
import { groupBan, txGroupBan, txAuditLog } from '../utils/prismaExtended';

// Time constants for session queries
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_GROUP_NAME_LENGTH = 100;

export const createGroup = async (req: Request, res: Response) => {
  const { 
    name, 
    description, 
    isPublic, 
    latitude, 
    longitude, 
    locationName, 
    city, 
    country,
    sportType,
    maxMembers,
    autoApproveJoinRequests,
    tags,
    allowMemberInvites,
    allowMemberCopyLink
  } = req.body;

  if (!name) {
    throw new BadRequestError('Group name is required');
  }

  // Sanitize text inputs
  const sanitized = groupService.sanitizeGroupData({
    name,
    description,
    locationName,
    city,
    country,
    tags
  });

  if (!sanitized.name) {
    throw new BadRequestError('Group name cannot be empty');
  }

  if (sanitized.name.length > MAX_GROUP_NAME_LENGTH) {
    throw new BadRequestError(`Group name must not exceed ${MAX_GROUP_NAME_LENGTH} characters`);
  }

  // Validate maxMembers if provided
  const maxMembersValidation = groupService.validateMaxMembers(maxMembers);
  if (!maxMembersValidation.valid) {
    throw new BadRequestError(maxMembersValidation.error || 'Invalid max members value');
  }

  // Validate coordinates if provided
  const coordCompletenessCheck = groupService.validateCoordinateCompleteness(latitude, longitude);
  if (!coordCompletenessCheck.valid) {
    throw new BadRequestError(coordCompletenessCheck.error!);
  }

  const coordValidation = await groupService.validateGroupCoordinates(latitude, longitude);
  if (!coordValidation.valid) {
    throw new BadRequestError(coordValidation.error || 'Invalid coordinates');
  }

  // Parse coordinates once if provided
  const coordinates = latitude && longitude ? parseCoordinates(latitude, longitude) : null;

  const group = await prisma.group.create({
    data: {
      name: sanitized.name,
      description: sanitized.description,
      isPublic: isPublic || false,
      latitude: coordinates?.lat ?? null,
      longitude: coordinates?.lon ?? null,
      locationName: sanitized.locationName,
      city: sanitized.city,
      country: sanitized.country,
      sportType: sportType || null,
      maxMembers: maxMembers ? parseInt(maxMembers as string) : null,
      autoApproveJoinRequests: autoApproveJoinRequests || false,
      tags: sanitized.tags,
      allowMemberInvites: allowMemberInvites !== undefined ? allowMemberInvites : false,
      allowMemberCopyLink: allowMemberCopyLink !== undefined ? allowMemberCopyLink : true,
      creatorId: req.user!.id,
      members: {
        create: {
          userId: req.user!.id,
          role: 'admin'
        }
      }
    },
    include: {
      creator: {
        select: { id: true, name: true, email: true }
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      }
    }
  });

  // Notify users nearby (in same city) except creator
  if (group.isPublic && (group.city || group.country)) {
    try {
      // Find users in the same city/country (city-based proximity since User has no lat/lon)
      const cityConditions = [];
      if (group.city) cityConditions.push({ city: { equals: group.city, mode: 'insensitive' as const } });
      if (group.country) cityConditions.push({ country: { equals: group.country, mode: 'insensitive' as const } });

      const nearbyUserCandidates = await prisma.user.findMany({
        where: {
          id: { not: req.user!.id },
          OR: cityConditions,
        },
        select: { id: true },
      });

      const nearbyUserIds = nearbyUserCandidates.map(u => u.id);

      if (nearbyUserIds.length > 0) {
        // Filter out users who have muted nearby group notifications
        const unmutedUserIds = await filterUnmutedUsers(nearbyUserIds, 'muteNearbyGroups');

        if (unmutedUserIds.length > 0) {
          const notificationResults = await Promise.allSettled(
            unmutedUserIds.map(nUserId =>
              prisma.groupNotification.create({
                data: {
                  groupId: group.id,
                  userId: nUserId,
                  type: GroupNotificationType.nearby_created,
                  params: {
                    groupName: group.name,
                    name: req.user!.name,
                  },
                },
              })
            )
          );

          const failures = notificationResults.filter(r => r.status === 'rejected');
          if (failures.length > 0) {
            logger.warn('Some nearby user notifications failed', 'GroupController', {
              failureCount: failures.length,
              totalUsers: unmutedUserIds.length,
            });
          }

          logger.info('Sent nearby group notifications', 'GroupController', {
            groupId: group.id,
            notifiedUsers: unmutedUserIds.length,
          });
        }
      }
    } catch (notifyError) {
      // Non-fatal: group creation should not fail if notifications fail
      logger.error('Error sending nearby group notifications', 'GroupController', { error: notifyError });
    }
  }

  // Invalidate the creator's groups cache so the new group appears immediately
  await CacheService.deletePattern(`user:${req.user!.id}:groups:*`);
  
  res.status(201).json(group);
};

export const getGroups = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const includeEvents = req.query.includeEvents === 'true';
  
  // Use cache wrapper for groups query
  const cacheKey = `user:${userId}:groups:${includeEvents}`;
  const cached = await CacheService.get(cacheKey);
  
  if (cached) {
    return res.json(cached);
  }

  // Optimize query - only include events if requested
  const groups = await prisma.group.findMany({
    where: {
      members: {
        some: {
          userId
        }
      }
    },
    include: {
      creator: {
        select: { id: true, name: true, email: true, profilePicture: true }
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, profilePicture: true }
          }
        }
      },
      // Only load events if explicitly requested to reduce payload
      ...(includeEvents && {
        events: {
          where: {
            archived: false,
            startTime: {
              gte: new Date(Date.now() - THIRTY_DAYS_MS)
            }
          },
          orderBy: { startTime: 'asc' },
          take: 20 // Limit events per group
        }
      }),
      _count: {
        select: {
          events: true,
          members: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Map each group to flatten member user fields
  interface GroupMember {
    userId: string;
    user: {
      name: string;
      email: string;
      profilePicture: string | null;
    };
    role: string;
  }

  interface GroupWithMembers {
    members: GroupMember[];
    latitude?: number | null;
    longitude?: number | null;
    locationName?: string | null;
    city?: string | null;
    country?: string | null;
    [key: string]: unknown;
  }

  const mappedGroups = groups.map((group: GroupWithMembers) => ({
    ...group,
    members: group.members.map((member: GroupMember) => ({
      id: member.userId,
      name: member.user.name,
      email: member.user.email,
      profilePicture: member.user.profilePicture,
      role: member.role,
    }))
  }));

  // Enrich with location info
  const enrichedGroups = mappedGroups.map(group => {
    // Only enrich if group has coordinates
    if (hasLocation(group) && group.latitude !== null && group.longitude !== null) {
      return locationService.enrichWithLocationInfo(group);
    }
    return group;
  });

  // Cache for 2 minutes
  await CacheService.set(cacheKey, enrichedGroups, 120);

  res.json(enrichedGroups);
};

export const getGroup = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  // Check membership first so we can build the right cache key and decide what data to return
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: id } },
    select: { role: true }
  });

  const isMember = !!membership;

  // Use separate cache keys for member vs public (non-member) views to avoid data leaks
  const cacheKey = isMember ? `group:${id}:member:${userId}` : `group:${id}:public`;
  const cached = await CacheService.get(cacheKey);
  
  if (cached) {
    return res.json(cached);
  }

  if (isMember) {
    // Full member view: include emails and events
    const group = await prisma.group.findFirst({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, email: true, profilePicture: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, profilePicture: true }
            }
          }
        },
        // Only load upcoming events with minimal participant data
        events: {
          where: {
            archived: false,
            startTime: {
              gte: new Date(Date.now() - SEVEN_DAYS_MS)
            }
          },
          include: {
            creator: {
              select: { id: true, name: true, email: true }
            },
            _count: {
              select: {
                participants: true,
                guestParticipants: true
              }
            }
          },
          orderBy: { startTime: 'asc' },
          take: 50
        },
        _count: {
          select: {
            events: true,
            members: true
          }
        }
      }
    });

    if (!group) {
      throw new NotFoundError('Group not found');
    }

    interface GroupMemberWithUser {
      userId: string;
      user: {
        name: string;
        email: string;
        profilePicture: string | null;
      };
      role: string;
    }

    const mappedGroup = {
      ...group,
      members: group.members.map((member: GroupMemberWithUser) => ({
        id: member.userId,
        name: member.user.name,
        email: member.user.email,
        profilePicture: member.user.profilePicture,
        role: member.role,
      }))
    };

    const enrichedGroup = locationService.enrichWithLocationInfo(mappedGroup);

    // Cache for 1 minute
    await CacheService.set(cacheKey, enrichedGroup, 60);

    return res.json(enrichedGroup);
  }

  // Non-member: only allow viewing public groups (without sensitive member data)
  const group = await prisma.group.findFirst({
    where: { id, isPublic: true },
    include: {
      creator: {
        select: { id: true, name: true, profilePicture: true }
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, profilePicture: true }
          }
        }
      },
      _count: {
        select: {
          events: true,
          members: true
        }
      }
    }
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  interface PublicGroupMemberWithUser {
    userId: string;
    user: {
      name: string;
      profilePicture: string | null;
    };
    role: string;
  }

  interface PublicGroupMemberView {
    id: string;
    name: string;
    email: string | undefined;
    profilePicture: string | null;
    role: string;
  }

  const mappedGroup: Omit<typeof group, 'members'> & {
    members: PublicGroupMemberView[];
    events: [];
  } = {
    ...group,
    // Omit email for non-member public views
    members: group.members.map((member: PublicGroupMemberWithUser) => ({
      id: member.userId,
      name: member.user.name,
      email: undefined as string | undefined,
      profilePicture: member.user.profilePicture,
      role: member.role,
    })),
    // No events for non-members (they use the public groups page to discover)
    events: [],
  };

  const enrichedGroup = locationService.enrichWithLocationInfo(mappedGroup);

  // Short cache for public view (30 seconds)
  await CacheService.set(cacheKey, enrichedGroup, 30);

  res.json(enrichedGroup);
};

// Get all members for a group
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

export const updateGroup = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    name, 
    description, 
    isPublic, 
    latitude, 
    longitude, 
    locationName, 
    city, 
    country,
    sportType,
    maxMembers,
    autoApproveJoinRequests,
    tags,
    allowMemberInvites,
    allowMemberCopyLink
  } = req.body;

  // Check if user has permission to update the group
  const canUpdate = await permissionService.hasGroupPermission(req.user!.id, id, Permission.GROUP_UPDATE);
  if (!canUpdate) {
    throw new ForbiddenError('Only admins and moderators can update the group');
  }

  // Validate maxMembers if provided
  const maxMembersValidation = groupService.validateMaxMembers(maxMembers);
  if (!maxMembersValidation.valid) {
    throw new BadRequestError(maxMembersValidation.error || 'Invalid max members value');
  }

  // Sanitize text inputs
  const sanitized = groupService.sanitizeGroupData({
    name,
    description,
    locationName,
    city,
    country,
    tags
  });

  // Validate that coordinates are provided together (not partially)
  const coordCompletenessCheck = groupService.validateCoordinateCompleteness(latitude, longitude);
  if (!coordCompletenessCheck.valid) {
    throw new BadRequestError(coordCompletenessCheck.error!);
  }

  // Validate coordinates if provided
  const coordValidation = await groupService.validateGroupCoordinates(latitude, longitude);
  if (!coordValidation.valid) {
    throw new BadRequestError(coordValidation.error || 'Invalid coordinates');
  }

  const group = await prisma.group.update({
    where: { id },
    data: {
      ...(sanitized.name && { name: sanitized.name }),
      ...(sanitized.description !== undefined && { description: sanitized.description }),
      ...(isPublic !== undefined && { isPublic }),
      ...(() => {
        if (latitude !== undefined && longitude !== undefined && latitude && longitude) {
          const coords = parseCoordinates(latitude, longitude);
          return { latitude: coords.lat, longitude: coords.lon };
        }
        return {};
      })(),
      ...(sanitized.locationName !== undefined && { locationName: sanitized.locationName }),
      ...(sanitized.city !== undefined && { city: sanitized.city }),
      ...(sanitized.country !== undefined && { country: sanitized.country }),
      ...(sportType !== undefined && { sportType: sportType || null }),
      ...(maxMembers !== undefined && { maxMembers: maxMembers ? parseInt(maxMembers as string) : null }),
      ...(autoApproveJoinRequests !== undefined && { autoApproveJoinRequests }),
      ...(sanitized.tags !== undefined && { tags: sanitized.tags }),
      ...(allowMemberInvites !== undefined && { allowMemberInvites }),
      ...(allowMemberCopyLink !== undefined && { allowMemberCopyLink })
    },
    include: {
      creator: {
        select: { id: true, name: true, email: true, profilePicture: true }
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, profilePicture: true }
          }
        }
      }
    }
  });

  // Invalidate group cache after update for all affected users
  await Promise.allSettled([
    CacheService.invalidate('group', id),
    ...group.members.map(member => 
      CacheService.deletePattern(`user:${member.userId}:groups:*`)
    )
  ]);

  res.json(group);
};

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

  const MAX_BULK = 50;
  if (emails.length > MAX_BULK) {
    throw new BadRequestError(`Cannot invite more than ${MAX_BULK} users at once`);
  }

  // Check permission
  const canInvite = await InviteService.canUserInvite(req.user!.id, id, 'group');
  if (!canInvite.allowed) {
    throw new ForbiddenError(canInvite.reason || 'You do not have permission to invite members');
  }

  const result = await InviteService.batchInviteToGroup(id, emails, req.user!.id, {
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

export const removeMember = async (req: Request, res: Response) => {
  const { id, memberId } = req.params;

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
  
  if (memberToRemove.userId === req.user!.id && memberToRemove.role === 'admin') {
    throw new ForbiddenError('Admins cannot remove themselves from the group.');
  }

  // Get group name for notification
  const group = await prisma.group.findUnique({
    where: { id },
    select: { name: true }
  });

  // Use transaction to ensure atomicity
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

// Get all public groups (for discovery)
export const getPublicGroups = async (req: Request, res: Response) => {
  // SECURITY FIX: Use optional chaining since this endpoint uses optionalAuthMiddleware
  const userId = req.user?.id;

  const {
    q,
    sportType,
    sort = 'newest',
    limit = '20',
    cursor,
  } = req.query;

  const parsedLimit = Math.min(parseInt(limit as string, 10) || 20, 100);
  const validSorts = ['newest', 'most_members', 'most_events', 'most_active'];
  const sortField = validSorts.includes(sort as string) ? (sort as string) : 'newest';

  // Build where clause
  const whereClause: Record<string, unknown> = { isPublic: true };

  // Exclude groups the user already belongs to
  if (userId) {
    whereClause.members = { none: { userId } };
  }

  // Full-text search on name, description, tags
  if (q) {
    const query = (q as string).trim().slice(0, 100);
    if (query) {
      whereClause.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { tags: { contains: query, mode: 'insensitive' } },
        { city: { contains: query, mode: 'insensitive' } },
      ];
    }
  }

  // Filter by sport type
  if (sportType) {
    whereClause.sportType = sportType as string;
  }

  // Cursor-based pagination (cursor = last group's createdAt:id)
  if (cursor) {
    try {
      const [cursorTime, cursorId] = (cursor as string).split('_');
      const cursorDate = new Date(cursorTime);
      if (!isNaN(cursorDate.getTime())) {
        whereClause.AND = [
          {
            OR: [
              { createdAt: { lt: cursorDate } },
              { createdAt: cursorDate, id: { lt: cursorId } },
            ],
          },
        ];
      }
    } catch {
      // Ignore invalid cursor
    }
  }

  // Determine order
  let orderBy: Record<string, unknown> | Array<Record<string, unknown>>;
  if (sortField === 'most_members') {
    orderBy = { members: { _count: 'desc' } };
  } else if (sortField === 'most_events') {
    orderBy = { events: { _count: 'desc' } };
  } else if (sortField === 'most_active') {
    // Most active = most recently updated (proxies for recent session/member activity)
    orderBy = [{ updatedAt: 'desc' }, { id: 'desc' }];
  } else {
    orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];
  }

  const groups = await prisma.group.findMany({
    where: whereClause,
    include: {
      creator: { select: { id: true, name: true, profilePicture: true } },
      _count: { select: { members: true, events: true } },
    },
    orderBy,
    take: parsedLimit + 1, // Fetch one extra to determine hasMore
  });

  const hasMore = groups.length > parsedLimit;
  const pageGroups = hasMore ? groups.slice(0, parsedLimit) : groups;

  // Build next cursor from last item
  let nextCursor: string | null = null;
  if (hasMore && pageGroups.length > 0) {
    const last = pageGroups[pageGroups.length - 1];
    nextCursor = `${last.createdAt.toISOString()}_${last.id}`;
  }

  // Enrich with location info
  const enrichedGroups = pageGroups.map(group =>
    locationService.enrichWithLocationInfo(group)
  );

  res.json({
    groups: enrichedGroups,
    hasMore,
    nextCursor,
    total: enrichedGroups.length,
  });
};

// Request to join a public group
export const requestJoinGroup = async (req: Request, res: Response) => {
  const { id } = req.params;

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
    const result = await prisma.$transaction(async (tx: typeof prisma) => {
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
    await prisma.groupNotification.create({
      data: {
        groupId: id,
        userId: req.user!.id,
        type: 'accepted',
        params: {
          groupName: group.name,
          name: group.name // Use group name to indicate automatic approval
        }
      }
    }).catch((error: Error) => {
      logger.error('Failed to send auto-approval notification', 'GroupController', { error });
    });

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
  
  // Filter out admins who have muted group join request notifications
  const adminUserIds = admins.map(admin => admin.userId);
  const unmutedAdminIds = await filterUnmutedUsers(adminUserIds, 'muteGroupRequests');
  
  await Promise.all(unmutedAdminIds.map((userId: string) =>
    prisma.groupNotification.create({
      data: {
        groupId: id,
        userId: userId,
        type: 'join_request',
        params: {
          groupName: joinRequest.group.name,
          name: req.user!.name
        }
      }
    })
  ));

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

  // Update the join request status
  const updatedRequest = await prisma.groupJoinRequest.update({
    where: { id: requestId },
    data: { status: action === 'approve' ? 'approved' : 'rejected' }
  });

  // If approved, add the user as a member
  if (action === 'approve') {
    let groupName: string | undefined;
    
    // Use transaction to check capacity and add member atomically
    await prisma.$transaction(async (tx) => {
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
    });

    // Create notification for the user who was accepted
    if (groupName) {
      await prisma.groupNotification.create({
        data: {
          groupId: id,
          userId: joinRequest.userId,
          type: 'accepted',
          params: {
            groupName,
            name: req.user!.name
          }
        }
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
  }

  res.json({ 
    message: `Join request ${action}d successfully`,
    request: updatedRequest
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
          throw new BadRequestError('Group has reached maximum member capacity');
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
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(invitations);
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
          events: true
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
    select: { id: true, name: true, isPublic: true }
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

  // Create membership
  await prisma.groupMember.create({
    data: { userId, groupId, role: 'member' }
  });

  // Invalidate group cache for all affected users
  await CacheService.invalidate('group', groupId);
  // Invalidate user groups cache for the joining user
  await CacheService.deletePattern(`user:${userId}:groups:*`);
  // Invalidate events cache since user now has access to group events
  await CacheService.deletePattern(`events:user:${userId}:group:${groupId}:*`);
  await CacheService.deletePattern(`events:user:${userId}:group:all:*`);

  res.status(201).json({ message: 'Joined group successfully' });
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

    // Clean up any pending invitations for this user
    await tx.groupJoinRequest.deleteMany({
      where: {
        groupId: id,
        userId: userId,
        status: 'pending',
        createdBy: 'INVITE'
      }
    });

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
 * Upload or update group picture
 */
export const uploadGroupPicture = async (req: Request, res: Response) => {
  let tempFilePath: string | undefined;
  let finalFilePath: string | undefined;

  try {
    const { id } = req.params;

    // Check if user is admin of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: id,
        userId: req.user!.id,
        role: 'admin'
      }
    });

    if (!membership) {
      throw new ForbiddenError('Only group admins can update group picture');
    }

    // Check if file was uploaded
    if (!req.file) {
      throw new BadRequestError('No file uploaded');
    }

    tempFilePath = req.file.path;

    // Validate the image
    const validation = await validateImage(tempFilePath);
    if (!validation.valid) {
      await deleteFile(tempFilePath);
      throw new BadRequestError(validation.error || 'Invalid image file');
    }

    // Verify group exists before processing
    const groupExists = await prisma.group.findUnique({
      where: { id },
      select: { id: true, picture: true },
    });

    if (!groupExists) {
      await deleteFile(tempFilePath);
      throw new NotFoundError('Group not found');
    }

    // Generate unique filename for the processed image
    const filename = generateUniqueFilename(req.file.originalname, 'group_');
    finalFilePath = path.join(UPLOAD_CONFIG.UPLOAD_DIR.GROUPS, filename);

    // Process the image (resize, optimize, strip EXIF)
    await processImage(tempFilePath, finalFilePath, {
      width: UPLOAD_CONFIG.IMAGE.GROUP_WIDTH,
      height: UPLOAD_CONFIG.IMAGE.GROUP_HEIGHT,
      fit: 'cover',
      quality: UPLOAD_CONFIG.IMAGE.JPEG_QUALITY,
      format: 'jpeg',
    });

    // Delete temp file
    await deleteFile(tempFilePath);
    tempFilePath = undefined;

    // Delete old picture if it exists
    if (groupExists.picture) {
      await deleteOldPicture(groupExists.picture);
    }

    // Generate the URL for the picture
    const pictureUrl = `/uploads/groups/${filename}`;

    // Update group's picture in database
    const updatedGroup = await prisma.group.update({
      where: { id },
      data: { picture: pictureUrl },
      include: {
        creator: {
          select: { id: true, name: true, email: true, profilePicture: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, profilePicture: true }
            }
          }
        }
      }
    });

    logger.debug('Group picture uploaded successfully', 'GroupController', { 
      groupId: id,
      userId: req.user!.id 
    });

    // Invalidate group cache for all affected users
    await Promise.allSettled([
      CacheService.invalidate('group', id),
      ...updatedGroup.members.map(member => 
        CacheService.deletePattern(`user:${member.userId}:groups:*`)
      )
    ]);

    res.json({ 
      group: updatedGroup,
      message: 'Group picture uploaded successfully' 
    });
  } catch (error) {
    logger.error('Failed to upload group picture', 'GroupController', { error });

    // Clean up files on error
    if (tempFilePath) {
      await deleteFile(tempFilePath);
    }
    if (finalFilePath) {
      await deleteFile(finalFilePath);
    }

    // Re-throw the error so asyncHandler can handle it properly
    throw error;
  }
};

/**
 * Delete group picture
 */
export const deleteGroupPicture = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user is admin of the group
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: id,
      userId: req.user!.id,
      role: 'admin'
    }
  });

  if (!membership) {
    throw new ForbiddenError('Only group admins can delete group picture');
  }

  // Get current group to check for existing picture
  const currentGroup = await prisma.group.findUnique({
    where: { id },
    select: { picture: true },
  });

  if (!currentGroup?.picture) {
    throw new NotFoundError('No group picture to delete');
  }

  // Delete the file
  await deleteOldPicture(currentGroup.picture);

  // Update group's picture in database
  const updatedGroup = await prisma.group.update({
    where: { id },
    data: { picture: null },
    include: {
      creator: {
        select: { id: true, name: true, email: true, profilePicture: true }
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, profilePicture: true }
          }
        }
      }
    }
  });

  logger.debug('Group picture deleted successfully', 'GroupController', { 
    groupId: id,
    userId: req.user!.id 
  });

  // Invalidate group cache for all affected users
  await Promise.allSettled([
    CacheService.invalidate('group', id),
    ...updatedGroup.members.map(member => 
      CacheService.deletePattern(`user:${member.userId}:groups:*`)
    )
  ]);

  res.json({ 
    group: updatedGroup,
    message: 'Group picture deleted successfully' 
  });
};


// Get nearby groups based on location and radius
export const getNearbyGroups = async (req: Request, res: Response) => {
  const { latitude, longitude, radius, limit = 50 } = req.query;

  if (!latitude || !longitude) {
    throw new BadRequestError('Latitude and longitude are required');
  }

  const { lat, lon } = parseCoordinates(latitude, longitude);
  const parsedLimit = parseFloatStrict(limit, 'Limit');
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    throw new BadRequestError('Limit must be an integer between 1 and 100');
  }
  const safeLimit = parsedLimit;
  
  // Use user's discoveryRadius if no radius provided
  let radiusKm: number;
  if (radius) {
    radiusKm = parseFloatStrict(radius, 'Radius');
  } else {
    // Get user's discovery radius preference
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { discoveryRadius: true }
    });
    radiusKm = user?.discoveryRadius || 25; // Default to 25km if not set
  }

  // Validate coordinates
  const coordValidation = locationService.validateCoordinates(lat, lon);
  if (!coordValidation.valid) {
    throw new BadRequestError(coordValidation.error || 'Invalid coordinates');
  }

  // Validate radius (max 100km to prevent excessive queries)
  if (radiusKm <= 0 || radiusKm > 100) {
    throw new BadRequestError('Radius must be a number between 0 and 100 kilometers');
  }

  // Record search metric for observability of discovery traffic
  recordSearchQuery('groups');

  const { latDelta, lonDelta } = locationService.calculateBoundingBox(lat, radiusKm);

  // Get all public groups with location data
  const groups = await prisma.group.findMany({
    where: {
      AND: [
        { latitude: { not: null } },
        { longitude: { not: null } },
        { latitude: { gte: lat - latDelta, lte: lat + latDelta } },
        { longitude: { gte: lon - lonDelta, lte: lon + lonDelta } },
      ],
      isPublic: true
    },
    include: {
      creator: {
        select: { id: true, name: true, profilePicture: true }
      },
      _count: {
        select: { 
          members: true,
          events: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(safeLimit * 10, 500) // Wider candidate set from DB bounding box
  });

  // Filter by location and add distance, leveraging user's discoveryRadius
  const nearbyGroups = locationService.filterByLocation(
    groups,
    lat,
    lon,
    radiusKm
  ).slice(0, safeLimit); // Limit after filtering

  // Enrich with location info
  const enrichedGroups = nearbyGroups.map(group => 
    locationService.enrichWithLocationInfo(group)
  );

  res.json({
    results: enrichedGroups,
    total: enrichedGroups.length,
    center: { latitude: lat, longitude: lon },
    radius: radiusKm,
    usingUserPreference: !radius // Indicate if using user's preferred radius
  });
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

// Delete a group (admin only)
export const deleteGroup = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Verify group exists first and get members for cache invalidation
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

  const canDelete = await permissionService.hasGroupPermission(req.user!.id, id, Permission.GROUP_DELETE);
  
  if (!canDelete) {
    logger.debug('User lacks GROUP_DELETE permission', 'GroupController', {
      userId: req.user!.id,
      groupId: id,
    });
    throw new ForbiddenError('Only admins can delete the group');
  }

  // Delete group and cascade related data (members, events, etc.)
  await prisma.group.delete({
    where: { id },
  });

  // Invalidate all group-related caches
  // Use Promise.allSettled to ensure all cache operations are attempted even if one fails
  const cacheOperations = [
    CacheService.invalidate('group', id),
    ...group.members.flatMap(member => [
      CacheService.deletePattern(`user:${member.userId}:groups:*`),
      CacheService.deletePattern(`events:user:${member.userId}:group:${id}:*`),
      CacheService.deletePattern(`events:user:${member.userId}:group:all:*`)
    ])
  ];
  
  await Promise.allSettled(cacheOperations).catch((error: Error) => {
    logger.error('Cache invalidation error in deleteGroup', 'GroupController', { error });
  });

  res.json({ message: 'Group deleted successfully' });
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
        select: { members: true, events: true }
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
    eventCount: group._count.events,
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

  // Check max members limit
  if (group.maxMembers) {
    const currentMemberCount = await prisma.groupMember.count({
      where: { groupId: group.id }
    });

    if (currentMemberCount >= group.maxMembers) {
      throw new BadRequestError('Group has reached maximum member capacity');
    }
  }

  // Check if there's already a pending join request AND create the join request atomically
  // to prevent duplicate join requests under concurrent requests
  const joinRequest = await prisma.$transaction(async (tx) => {
    const existingRequest = await tx.groupJoinRequest.findFirst({
      where: {
        groupId: group.id,
        userId,
        status: 'pending'
      }
    });

    if (existingRequest) {
      throw new BadRequestError('You already have a pending join request for this group');
    }

    // Create join request with LINK source
    return tx.groupJoinRequest.create({
      data: {
        groupId: group.id,
        userId,
        status: 'pending',
        createdBy: 'LINK'
      }
    });
  });

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
        type: 'accepted',
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
        type: 'join_request',
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
