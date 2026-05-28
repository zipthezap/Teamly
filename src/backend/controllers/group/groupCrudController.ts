import prisma from '../../config/database';
import { filterUnmutedUsers } from '../../utils/notificationHelper';
import { logger } from '../../utils/logger';
import { parseCoordinates, parseFloatStrict } from '../../utils/validation';
import { hasLocation } from '../../utils/typeGuards';
import { Request, Response } from 'express';
import * as groupService from '../../services/groupService';
import * as permissionService from '../../services/permissionService';
import * as locationService from '../../services/locationService';
import { GroupNotificationType } from '../../../shared/types/event.types';
import { CacheService } from '../../services/cacheService';
import { Permission } from '../../../shared/types/permissions.types';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors';
import { recordSearchQuery } from '../../services/metricsService';
import { THIRTY_DAYS_MS, SEVEN_DAYS_MS, MAX_GROUP_NAME_LENGTH } from './_constants';

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

  // Optimize query - only include sessions if requested
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
      // Only load sessions if explicitly requested to reduce payload
      ...(includeEvents && {
        sessions: {
          where: {
            archived: false,
            startTime: {
              gte: new Date(Date.now() - THIRTY_DAYS_MS)
            }
          },
          orderBy: { startTime: 'asc' },
          take: 20 // Limit sessions per group
        }
      }),
      _count: {
        select: {
          sessions: true,
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

  const mappedGroups = groups.map(group => ({
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
    // Full member view: include emails and sessions
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
        // Only load upcoming sessions with minimal participant data
        sessions: {
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
            sessions: true,
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
          sessions: true,
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
    sessions: [];
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
    // No sessions for non-members (they use the public groups page to discover)
    sessions: [],
  };

  const enrichedGroup = locationService.enrichWithLocationInfo(mappedGroup);

  // Short cache for public view (30 seconds)
  await CacheService.set(cacheKey, enrichedGroup, 30);

  res.json(enrichedGroup);
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
    orderBy = { sessions: { _count: 'desc' } };
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
      _count: { select: { members: true, sessions: true } },
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
      isPublic: true,
      members: { none: { userId: req.user!.id } },
    },
    include: {
      creator: {
        select: { id: true, name: true, profilePicture: true }
      },
      _count: {
        select: { 
          members: true,
          sessions: true
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
