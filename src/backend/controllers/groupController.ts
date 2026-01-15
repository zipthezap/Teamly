import prisma from '../config/database';
import { sendEmailWithQueue } from '../services/emailQueueService';
import { shouldSendEmailNotification } from '../utils/notificationHelper';
import { logger } from '../utils/logger';
import { escapeHtml, isValidEmail } from '../utils/validation';
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

// Time constants for event queries
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const createGroup = async (req: Request, res: Response) => {
  const { name, description, isPublic, latitude, longitude, locationName, city, country } = req.body;

  if (!name) {
    throw new BadRequestError('Group name is required');
  }

  // Sanitize text inputs
  const sanitized = groupService.sanitizeGroupData({
    name,
    description,
    locationName,
    city,
    country
  });

  // Validate coordinates if provided
  const coordValidation = await groupService.validateGroupCoordinates(latitude, longitude);
  if (!coordValidation.valid) {
    throw new BadRequestError(coordValidation.error || 'Invalid coordinates');
  }

  const group = await prisma.group.create({
    data: {
      name: sanitized.name,
      description: sanitized.description,
      isPublic: isPublic || false,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      locationName: sanitized.locationName,
      city: sanitized.city,
      country: sanitized.country,
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

  // Notify users nearby (within 10km) except creator
  if (latitude && longitude) {
    // Future feature: Find nearby users and notify them
    // const R = 6371; // km
    // const toRad = deg => deg * Math.PI / 180;
    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user!.id }
      },
      select: { id: true }
    });
    // Calculate which users are nearby - unused for now but kept for future feature
    // const isNearby = (lat1, lon1, lat2, lon2) => {
    //   const dLat = toRad(lat2 - lat1);
    //   const dLon = toRad(lon2 - lon1);
    //   const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    //             Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    //             Math.sin(dLon/2) * Math.sin(dLon/2);
    //   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    //   return R * c < 10; // 10km
    // };
    const nearbyUserIds = users.map(u => u.id);
    
    // Use Promise.allSettled to handle individual notification failures gracefully
    const notificationResults = await Promise.allSettled(
      nearbyUserIds.map(userId =>
        prisma.groupNotification.create({
          data: {
            groupId: group.id,
            userId,
            type: GroupNotificationType.nearby_created,
            params: {
              groupName: group.name,
              name: req.user!.name
            }
          }
        })
      )
    );

    // Log any failures but don't block group creation
    const failures = notificationResults.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.warn('Some nearby user notifications failed', 'GroupController', { 
        failureCount: failures.length,
        totalUsers: nearbyUserIds.length 
      });
    }
  }
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
  const mappedGroups = groups.map((group: any) => ({
    ...group,
    members: group.members.map((member: any) => ({
      id: member.userId,
      name: member.user.name,
      email: member.user.email,
      profilePicture: member.user.profilePicture,
      role: member.role,
    }))
  }));

  // Enrich with location info
  const enrichedGroups = mappedGroups.map(group => 
    locationService.enrichWithLocationInfo(group)
  );

  // Cache for 2 minutes
  await CacheService.set(cacheKey, enrichedGroups, 120);

  res.json(enrichedGroups);
};

export const getGroup = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  // Try cache first
  const cacheKey = `group:${id}:user:${userId}`;
  const cached = await CacheService.get(cacheKey);
  
  if (cached) {
    return res.json(cached);
  }

  // Optimize query - use separate queries to avoid loading all participants
  const group = await prisma.group.findFirst({
    where: {
      id,
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
        take: 50 // Limit events to improve performance
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

  // Map members to flatten user fields
  const mappedGroup = {
    ...group,
    members: group.members.map((member: any) => ({
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

  res.json(enrichedGroup);
};

export const updateGroup = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, isPublic, latitude, longitude, locationName, city, country } = req.body;

  // Check if user has permission to update the group
  const canUpdate = await permissionService.hasGroupPermission(req.user!.id, id, Permission.GROUP_UPDATE);
  if (!canUpdate) {
    throw new ForbiddenError('Only admins and moderators can update the group');
  }

  // Sanitize text inputs
  const sanitized = groupService.sanitizeGroupData({
    name,
    description,
    locationName,
    city,
    country
  });

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
      ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
      ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
      ...(sanitized.locationName !== undefined && { locationName: sanitized.locationName }),
      ...(sanitized.city !== undefined && { city: sanitized.city }),
      ...(sanitized.country !== undefined && { country: sanitized.country })
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

  // Invalidate group cache after update
  await CacheService.invalidate('group', id);

  res.json(group);
};

export const inviteMember = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email } = req.body;

  if (!email) {
    throw new BadRequestError('Email is required');
  }

  // Validate email format
  if (!isValidEmail(email)) {
    throw new BadRequestError('Invalid email format');
  }

  // Check if user has permission to invite members (admins and moderators)
  const canInvite = await permissionService.hasGroupPermission(req.user!.id, id, Permission.GROUP_INVITE_MEMBERS);
  if (!canInvite) {
    throw new ForbiddenError('Only admins and moderators can invite members');
  }

  // Get group info - FIX: Return 404 if group doesn't exist
  const group = await prisma.group.findUnique({
    where: { id }
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // Find user to invite
  const userToInvite = await prisma.user.findUnique({
    where: { email }
  });

  if (!userToInvite) {
    throw new NotFoundError('User not found');
  }

  // Check if user is already a member
  const existingMembership = await prisma.groupMember.findFirst({
    where: {
      groupId: id,
      userId: userToInvite.id
    }
  });

  if (existingMembership) {
    throw new BadRequestError('User is already a member');
  }

  const newMember = await prisma.groupMember.create({
    data: {
      groupId: id,
      userId: userToInvite.id,
      role: 'member'
    },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      }
    }
  });

  // Send email notification
  const inviterUser = await prisma.user.findUnique({
    where: { id: req.user!.id }
  });

  const shouldSend = await shouldSendEmailNotification(userToInvite.id, 'groupInvites');

  if (shouldSend && inviterUser) {
    const htmlContent = `
      <h2>You've Been Invited to Join a Group!</h2>
      <p>Hi ${escapeHtml(userToInvite.name)},</p>
      <p>${escapeHtml(inviterUser.name)} has invited you to join the group:</p>
      <h3>${escapeHtml(group.name)}</h3>
      <p>${escapeHtml(group.description || '')}</p>
      <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/groups">View Group</a></p>
    `;
    
    await sendEmailWithQueue(
      userToInvite.email,
      `Group Invitation: ${group.name}`,
      htmlContent,
      {
        templateType: 'group_invitation',
        templateData: {
          recipientName: userToInvite.name,
          groupName: group.name,
          groupDescription: group.description,
          inviterName: inviterUser.name
        }
      }
    );
  }

  // Invalidate group cache for all affected users
  await CacheService.invalidate('group', id);
  // Invalidate user groups cache for the invited user
  await CacheService.deletePattern(`user:${userToInvite.id}:groups:*`);

  res.status(201).json(newMember);
};

export const removeMember = async (req: Request, res: Response) => {
  const { id, memberId } = req.params;

  // Debug log for permission check
  logger.info('Attempting to remove member', 'GroupController', {
    userId: req.user!.id,
    groupId: id,
    memberId,
    action: 'GROUP_REMOVE_MEMBERS',
  });
  const canRemove = await permissionService.hasGroupPermission(req.user!.id, id, Permission.GROUP_REMOVE_MEMBERS);
  logger.info('Remove member permission result', 'GroupController', {
    userId: req.user!.id,
    groupId: id,
    memberId,
    canRemove,
  });
  if (!canRemove) {
    logger.warn('403 Forbidden: User lacks GROUP_REMOVE_MEMBERS permission', 'GroupController', {
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

  await prisma.groupMember.delete({
    where: { id: memberId }
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

    return updatedMember;
  });

  res.json(result);
};

// Get all public groups (for discovery)
export const getPublicGroups = async (req: Request, res: Response) => {
  // SECURITY FIX: Use optional chaining since this endpoint uses optionalAuthMiddleware
  const userId = req.user?.id;
  
  // Build where clause to exclude groups user is already a member of
  const whereClause: any = {
    isPublic: true
  };
  
  // If user is authenticated, exclude groups they're already a member of
  if (userId) {
    whereClause.members = {
      none: {
        userId: userId
      }
    };
  }
  
  const groups = await prisma.group.findMany({
    where: whereClause,
    include: {
      creator: {
        select: { id: true, name: true, email: true, profilePicture: true }
      },
      _count: {
        select: { members: true, events: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Enrich with location info
  const enrichedGroups = groups.map(group => 
    locationService.enrichWithLocationInfo(group)
  );

  res.json(enrichedGroups);
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

  // Create join request
  const joinRequest = await prisma.groupJoinRequest.create({
    data: {
      groupId: id,
      userId: req.user!.id,
      status: 'pending'
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
  await Promise.all(admins.map(admin =>
    prisma.groupNotification.create({
      data: {
        groupId: id,
        userId: admin.userId,
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
    await prisma.groupMember.create({
      data: {
        groupId: id,
        userId: joinRequest.userId,
        role: 'member'
      }
    });

    // Get group name for notification
    const groupInfo = await prisma.group.findUnique({
      where: { id },
      select: { name: true }
    });

    // Create notification for the user who was accepted
    if (groupInfo) {
      await prisma.groupNotification.create({
        data: {
          groupId: id,
          userId: joinRequest.userId,
          type: 'accepted',
          params: {
            groupName: groupInfo.name,
            name: req.user!.name
          }
        }
      });
    }
  }

  res.json({ 
    message: `Join request ${action}d successfully`,
    request: updatedRequest
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

  // Verify the group exists and is public (or implement invite token validation here)
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, isPublic: true }
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // For now, only allow joining public groups via invite link
  // TODO: Implement proper invite token system for private groups
  if (!group.isPublic) {
    throw new ForbiddenError('Cannot join private group without proper invitation');
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
  await prisma.$transaction(async (tx) => {
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

      if (adminCount <= 1) {
        throw new BadRequestError('Cannot leave group as the only admin. Please assign another admin first or delete the group.');
      }
    }

    // Delete the membership atomically
    await tx.groupMember.delete({
      where: { id: membership.id }
    });
  });

  // Invalidate group cache for all affected users
  await CacheService.invalidate('group', id);
  // Invalidate user groups cache for the leaving user
  await CacheService.deletePattern(`user:${userId}:groups:*`);
  // Invalidate events cache since user no longer has access to group events
  await CacheService.deletePattern(`events:user:${userId}:group:${id}:*`);
  await CacheService.deletePattern(`events:user:${userId}:group:all:*`);

  res.json({ message: 'Left group successfully' });
};

// Get invite link for a group
export const getInviteLink = async (req: Request, res: Response) => {
  const { id } = req.params;

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

  // Return the group ID which can be used to construct the invite link on the frontend
  res.json({ groupId: id });
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
      return res.status(403).json({ error: 'Only group admins can update group picture' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    tempFilePath = req.file.path;

    // Validate the image
    const validation = await validateImage(tempFilePath);
    if (!validation.valid) {
      await deleteFile(tempFilePath);
      return res.status(400).json({ error: validation.error });
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

    // Get current group to check for existing picture
    const currentGroup = await prisma.group.findUnique({
      where: { id },
      select: { picture: true },
    });

    // Delete old picture if it exists
    if (currentGroup?.picture) {
      await deleteOldPicture(currentGroup.picture);
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

    logger.info('Group picture uploaded successfully', 'GroupController', { 
      groupId: id,
      userId: req.user!.id 
    });

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

    res.status(500).json({ error: 'Failed to upload group picture' });
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

  logger.info('Group picture deleted successfully', 'GroupController', { 
    groupId: id,
    userId: req.user!.id 
  });

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

  const lat = parseFloat(latitude as string);
  const lon = parseFloat(longitude as string);
  
  // Use user's discoveryRadius if no radius provided
  let radiusKm: number;
  if (radius) {
    radiusKm = parseFloat(radius as string);
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

  // Get all public groups with location data
  const groups = await prisma.group.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
      isPublic: true
    },
    include: {
      creator: {
        select: { id: true, name: true, email: true, profilePicture: true }
      },
      _count: {
        select: { 
          members: true,
          events: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit as string) * 2 // Get more than needed for filtering
  });

  // Filter by location and add distance, leveraging user's discoveryRadius
  const nearbyGroups = locationService.filterByLocation(
    groups,
    lat,
    lon,
    radiusKm
  ).slice(0, parseInt(limit as string)); // Limit after filtering

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
  const { newAdminEmail } = req.body;
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
  const newAdminMembership = await prisma.groupMember.findFirst({
    where: { groupId: id, userId: newAdminUser.id }
  });
  if (!newAdminMembership) {
    throw new NotFoundError('Selected user is not a member of the group.');
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
  
  // Invalidate group cache after role changes
  await CacheService.invalidate('group', id);
  
  res.json({ message: 'Admin rights transferred successfully.' });
};

// Delete a group (admin only)
export const deleteGroup = async (req: Request, res: Response) => {
  const { id } = req.params;
  // Debug log for permission check
  logger.info('Attempting to delete group', 'GroupController', {
    userId: req.user!.id,
    groupId: id,
    action: 'GROUP_DELETE',
  });
  const canDelete = await permissionService.hasGroupPermission(req.user!.id, id, Permission.GROUP_DELETE);
  logger.info('Delete group permission result', 'GroupController', {
    userId: req.user!.id,
    groupId: id,
    canDelete,
  });
  if (!canDelete) {
    logger.warn('403 Forbidden: User lacks GROUP_DELETE permission', 'GroupController', {
      userId: req.user!.id,
      groupId: id,
    });
    throw new ForbiddenError('Only admins can delete the group');
  }
  // Delete group and cascade related data (members, events, etc.)
  await prisma.group.delete({
    where: { id },
  });
  res.json({ message: 'Group deleted successfully' });
};
