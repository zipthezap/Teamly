import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sanitizeString } from '../utils/validation';
import { CacheService } from './cacheService';

/**
 * Checks if user is admin of a group
 */
export const checkGroupAdmin = async (groupId: string, userId: string) => {
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId,
      userId,
      role: 'admin'
    }
  });
  return !!membership;
};

/**
 * Checks if user is member of a group
 */
export const checkGroupMember = async (groupId: string, userId: string) => {
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId,
      userId
    }
  });
  return !!membership;
};

/**
 * Gets group by ID with full details
 * Uses caching for better performance
 */
export const getGroupById = async (groupId: string) => {
  return await CacheService.wrap(
    `group:full:${groupId}`,
    300, // Cache for 5 minutes
    async () => {
      return await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePicture: true,
              profilePictures: true,
              createdAt: true,
              updatedAt: true,
              deletedAt: true,
              createdBy: true,
              updatedBy: true
            }
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  profilePicture: true,
                  profilePictures: true,
                  createdAt: true,
                  updatedAt: true,
                  deletedAt: true,
                  createdBy: true,
                  updatedBy: true
                }
              }
            }
          },
          events: {
            where: { archived: false },
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              eventType: true,
              status: true,
              maxPlayers: true,
              _count: {
                select: { participants: true }
              }
            },
            orderBy: { startTime: 'asc' }
          }
        }
      });
    }
  );
};

/**
 * Sanitizes group data inputs
 */
export const sanitizeGroupData = (data: {
  name?: string;
  description?: string;
  locationName?: string;
  city?: string;
  country?: string;
}) => {
  return {
    name: data.name ? sanitizeString(data.name) : undefined,
    description: data.description ? sanitizeString(data.description) : undefined,
    locationName: data.locationName ? sanitizeString(data.locationName) : undefined,
    city: data.city ? sanitizeString(data.city) : undefined,
    country: data.country ? sanitizeString(data.country) : undefined
  };
};

/**
 * Creates group join request notification
 */
export const createJoinRequestNotification = async (
  groupId: string,
  requesterId: string,
  requesterName: string,
  groupName: string,
  adminIds: string[]
) => {
  await Promise.all(adminIds.map(adminId =>
    prisma.groupNotification.create({
      data: {
        groupId,
        userId: adminId,
        type: 'join_request',
        params: {
          requesterId,
          requesterName,
          groupName
        }
      }
    }).catch(error => {
      logger.error('Failed to create join request notification', 'GroupService', { error, adminId });
    })
  ));
};

/**
 * Creates member invitation notification
 */
export const createInvitationNotification = async (
  groupId: string,
  groupName: string,
  invitedUserId: string,
  inviterName: string
) => {
  await prisma.groupNotification.create({
    data: {
      groupId,
      userId: invitedUserId,
      type: 'invited',
      params: {
        groupName,
        inviterName
      }
    }
  }).catch(error => {
    logger.error('Failed to create invitation notification', 'GroupService', { error, invitedUserId });
  });
};

/**
 * Creates member addition notification
 */
export const createMemberAddedNotification = async (
  groupId: string,
  groupName: string,
  newMemberId: string,
  existingMemberIds: string[]
) => {
  const newMember = await prisma.user.findUnique({
    where: { id: newMemberId },
    select: { name: true }
  });

  if (!newMember) return;

  await Promise.all(existingMemberIds.map(memberId =>
    prisma.groupNotification.create({
      data: {
        groupId,
        userId: memberId,
        type: 'accepted',
        params: {
          memberName: newMember.name,
          groupName
        }
      }
    }).catch(error => {
      logger.error('Failed to create member added notification', 'GroupService', { error, memberId });
    })
  ));
};

/**
 * Gets group admins
 */
export const getGroupAdmins = async (groupId: string) => {
  const adminMembers = await prisma.groupMember.findMany({
    where: {
      groupId,
      role: 'admin'
    },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      }
    }
  });
  return adminMembers.map(m => m.user);
};

/**
 * Gets group members excluding specific user
 */
export const getGroupMembersExcludingUser = async (groupId: string, excludeUserId: string) => {
  const members = await prisma.groupMember.findMany({
    where: {
      groupId,
      userId: { not: excludeUserId }
    },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      }
    }
  });
  return members.map(m => m.user);
};

/**
 * Checks if group has any admin members
 */
export const hasAdminMembers = async (groupId: string) => {
  const adminCount = await prisma.groupMember.count({
    where: {
      groupId,
      role: 'admin'
    }
  });
  return adminCount > 0;
};

/**
 * Builds group query filters
 */
export const buildGroupFilters = (
  userId: string,
  filters: {
    search?: string;
    city?: string;
    country?: string;
    isPublic?: string;
  }
) => {
  const where: any = {
    members: {
      some: {
        userId
      }
    }
  };

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } }
    ];
  }

  if (filters.city) {
    where.city = { contains: filters.city, mode: 'insensitive' };
  }

  if (filters.country) {
    where.country = { contains: filters.country, mode: 'insensitive' };
  }

  if (filters.isPublic !== undefined) {
    where.isPublic = filters.isPublic === 'true';
  }

  return where;
};

/**
 * Validates group member role
 */
export const isValidRole = (role: string): role is 'admin' | 'moderator' | 'member' => {
  return role === 'admin' || role === 'moderator' || role === 'member';
};

/**
 * Gets a specific group member
 */
export const getGroupMember = async (groupId: string, userId: string) => {
  return await prisma.groupMember.findFirst({
    where: {
      groupId,
      userId
    }
  });
};

/**
 * Checks if user is a member of a group (alias for checkGroupMember)
 */
export const isGroupMember = checkGroupMember;

/**
 * Checks if user is admin or moderator of a group
 */
export const checkGroupAdminOrModerator = async (groupId: string, userId: string) => {
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId,
      userId,
      role: {
        in: ['admin', 'moderator']
      }
    }
  });
  return !!membership;
};
