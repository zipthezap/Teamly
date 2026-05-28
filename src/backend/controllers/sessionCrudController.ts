/**
 * Event Controller
 * 
 * This controller manages all session-related operations including:
 * - Event CRUD operations (create, read, update, delete, archive, status)
 * - Event participation (join, leave, update status)
 * - Guest participant management
 * - Recurring events management
 * - Event queries (nearby, statistics, activity feed)
 * - Event export functionality
 */

import prisma from '../config/database';
import { Request, Response } from 'express';
import { createInviteToken } from '../utils/inviteToken';
import * as sessionService from '../services/sessionService';
import { SessionParticipantStatus, GuestParticipantStatus, SportType } from '../../shared/types/event.types';
import * as locationService from '../services/locationService';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { isRequired, parseCoordinates } from '../utils/validation';
import { ensureResourceExists } from '../utils/controllerHelpers';
import { CacheService } from '../services/cacheService';
import { permissionService } from '../services/permissionService';
import { Permission } from '../../shared/types/permissions.types';
import { guardImmutableFields } from '../utils/guardImmutableFields';

const MAX_SESSION_DESCRIPTION_LENGTH = 2000;
const MAX_SESSION_LOCATION_NAME_LENGTH = 255;
const MAX_SESSION_DURATION_HOURS = 12;
const VALID_SESSION_TYPES = Object.values(SportType);

function validateSessionDescription(description: string | undefined | null) {
  if (description && description.length > MAX_SESSION_DESCRIPTION_LENGTH) {
    throw new BadRequestError(
      `description must not exceed ${MAX_SESSION_DESCRIPTION_LENGTH} characters`,
      'MAX_LENGTH_EXCEEDED',
      'description'
    );
  }
}

function validateSessionLocationName(locationName: string | undefined | null) {
  if (locationName && locationName.length > MAX_SESSION_LOCATION_NAME_LENGTH) {
    throw new BadRequestError(
      `locationName must not exceed ${MAX_SESSION_LOCATION_NAME_LENGTH} characters`,
      'MAX_LENGTH_EXCEEDED',
      'locationName'
    );
  }
}

function validateSessionType(sessionType: unknown) {
  if (sessionType !== undefined && sessionType !== null && sessionType !== '') {
    if (!VALID_SESSION_TYPES.includes(sessionType as SportType)) {
      throw new BadRequestError(
        `sessionType must be one of: ${VALID_SESSION_TYPES.join(', ')}`,
        'INVALID_ENUM_VALUE',
        'sessionType'
      );
    }
  }
}

function validateSessionDuration(startTime: unknown, endTime: unknown) {
  if (!startTime || !endTime) return;
  const start = new Date(startTime as string);
  const end = new Date(endTime as string);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (durationHours > MAX_SESSION_DURATION_HOURS) {
    throw new BadRequestError(
      `Session duration must not exceed ${MAX_SESSION_DURATION_HOURS} hours`,
      'DURATION_TOO_LONG',
      'endTime'
    );
  }
}

export const createEvent = async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
  const { 
    groupId, title, description, sessionType, location, startTime, endTime, maxPlayers,
    isRecurring, recurrenceRule, recurrenceEnd, isPublic,
    latitude, longitude, locationName, city, country
  } = req.body;

  // Validate required fields
  isRequired(groupId, 'Group ID');
  isRequired(title, 'Title');
  isRequired(sessionType, 'Event type');
  isRequired(startTime, 'Start time');

  // Validate sessionType against enum
  validateSessionType(sessionType);

  // Sanitize text inputs
  const sanitized = sessionService.sanitizeSessionData({
    title,
    description,
    sessionType,
    location
  });

  // Validate sanitized required fields are not empty
  if (!sanitized.title || !sanitized.sessionType) {
    throw new BadRequestError('Title and session type cannot be empty or whitespace-only');
  }

  validateSessionDescription(sanitized.description);
  validateSessionLocationName(locationName);
  validateSessionDuration(startTime, endTime);

  // Validate coordinates if provided
  if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
    parseCoordinates(latitude, longitude);
    // Coordinates are validated by parseCoordinates, no need for additional check
  }

  // Validate maxPlayers if provided
  if (maxPlayers !== undefined && maxPlayers !== null) {
    const parsedMaxPlayers = parseInt(maxPlayers);
    if (isNaN(parsedMaxPlayers) || parsedMaxPlayers < 2 || parsedMaxPlayers > 1000) {
      throw new BadRequestError('Max players must be a number between 2 and 1000');
    }
  }

  // Validate session times
  const timeValidation = sessionService.validateSessionTimes(startTime, endTime);
  if (!timeValidation.valid) {
    throw new BadRequestError(timeValidation.error!);
  }

  // Validate recurrence rule if provided
  const recurrenceValidation = sessionService.validateRecurrence(isRecurring, recurrenceRule);
  if (!recurrenceValidation.valid) {
    throw new BadRequestError(recurrenceValidation.error!);
  }

  // Ensure group exists before permission check to avoid misleading permission errors
  const group = await sessionService.getGroupWithMembers(groupId);

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  // Check if user has permission to create events in this group (admin or moderator)
  const canCreate = await permissionService.hasGroupPermission(req.user!.id, groupId, Permission.EVENT_CREATE);
  if (!canCreate) {
    throw new ForbiddenError('Only group admins and moderators can create events for this group');
  }

  // Determine session status
  const eventStatus = sessionService.determineSessionStatus(startTime, endTime);

  // Generate invite token if session is public
  const inviteToken = isPublic ? createInviteToken() : null;

  // Parse coordinates once if provided
  const coordinates = latitude && longitude ? parseCoordinates(latitude, longitude) : null;

  const session = await prisma.session.create({
    data: {
      groupId,
      creatorId: req.user!.id,
      title: sanitized.title!,
      description: sanitized.description,
      sessionType: sanitized.sessionType! as SportType,
      location: sanitized.location,
      latitude: coordinates?.lat ?? null,
      longitude: coordinates?.lon ?? null,
      locationName: locationName || null,
      city: city || null,
      country: country || null,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : null,
      maxPlayers: maxPlayers ? parseInt(maxPlayers) : null,
      isRecurring: isRecurring || false,
      recurrenceRule: isRecurring ? recurrenceRule : null,
      recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null,
      status: eventStatus,
      isPublic: isPublic || false,
      inviteToken,
      participants: {
        create: {
          userId: req.user!.id,
          status: SessionParticipantStatus.confirmed
        }
      }
    },
    include: {
      creator: {
        select: { id: true, name: true, email: true, profilePicture: true }
      },
      group: {
        select: { id: true, name: true }
      },
      participants: {
        select: {
          id: true,
          userId: true,
          status: true,
          joinedAt: true,
          user: {
            select: { name: true }
          }
        }
      }
    }
  });

  // Enrich session with location info if coordinates are available
  const enrichedSession = locationService.enrichWithLocationInfo(session);

  // Send global notification to group members (except creator)
  const memberIds = group.members.map(m => m.userId).filter(uid => uid !== req.user!.id);
  await sessionService.createSessionNotifications(group.id, session.title, req.user!.name, group.name, memberIds);

  // Invalidate events cache for all group members
  await CacheService.deletePattern(`sessions:user:*:group:${groupId}:*`);
  await CacheService.deletePattern(`sessions:user:*:group:all:*`);

  res.status(201).json(enrichedSession);
};
export const getEvents = async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
  const { 
    groupId, search, sessionType, startDate, endDate, location, status, archived,
    limit = '50', offset = '0', cursor
  } = req.query;

  const userId = req.user!.id;
  
  // Parse and validate pagination parameters
  const parsedLimit = parseInt(limit as string, 10);
  const parsedOffset = parseInt(offset as string, 10);
  
  // Validate parsed values and apply defaults/caps
  const validatedLimit = isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100);
  const validatedOffset = isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);

  // Generate cache key for simple queries without search/filters
  const hasFilters = search || sessionType || startDate || endDate || location || status || archived;
  const cacheKey = !hasFilters && !cursor 
    ? `sessions:user:${userId}:group:${groupId || 'all'}:limit:${validatedLimit}:offset:${validatedOffset}`
    : null;

  // Try cache for simple queries
  if (cacheKey) {
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
  }

  // Build where filter using service
  const where = sessionService.buildSessionFilters(userId, {
    groupId: groupId as string,
    search: search as string,
    sessionType: sessionType as string,
    startDate: startDate as string,
    endDate: endDate as string,
    location: location as string,
    status: status as string,
    archived: archived as string
  });

  // Add cursor-based pagination if cursor is provided
  if (cursor) {
    let decodedCursor: { startTime: string; id: string };
    try {
      decodedCursor = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8')) as { startTime: string; id: string };
    } catch {
      throw new BadRequestError('Invalid cursor: malformed base64url payload');
    }

    const cursorStartTime = new Date(decodedCursor.startTime);
    if (!decodedCursor.id || Number.isNaN(cursorStartTime.getTime())) {
      throw new BadRequestError('Invalid cursor: missing id or invalid startTime');
    }

    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { startTime: { gt: cursorStartTime } },
          { AND: [{ startTime: cursorStartTime }, { id: { gt: decodedCursor.id } }] }
        ]
      }
    ];
  }

  // Optimize query - get participant info separately for large result sets
  const [sessions, totalCount] = await Promise.all([
    prisma.session.findMany({
      where,
      include: {
        creator: {
          select: { id: true, name: true, email: true, profilePicture: true }
        },
        group: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            participants: true,
            guestParticipants: true,
            comments: true
          }
        }
      },
      orderBy: [
        { startTime: 'asc' },
        { id: 'asc' } // Secondary sort for cursor stability
      ],
      take: validatedLimit,
      skip: cursor ? 0 : validatedOffset // Skip only for offset pagination
    }),
    prisma.session.count({ where })
  ]);

    // Get participant data only for returned events (batch query)
    const sessionIds = sessions.map(e => e.id);
    const participants = await prisma.sessionParticipant.findMany({
      where: { 
        sessionId: { in: sessionIds }
      },
      select: {
        id: true,
        userId: true,
        status: true,
        joinedAt: true,
        sessionId: true,
        user: {
          select: { id: true, name: true, profilePicture: true }
        }
      }
    });

    // Get attendance data for returned events (batch query)
    const attendances = await prisma.sessionAttendance.findMany({
      where: {
        sessionId: { in: sessionIds }
      },
      select: {
        id: true,
        userId: true,
        status: true,
        updatedAt: true,
        sessionId: true
      }
    });

    // Map participants and attendances to events
    const participantsByEvent = new Map<string, typeof participants[number][]>();
    const attendancesByEvent = new Map<string, typeof attendances[number][]>();
    
    participants.forEach(p => {
      if (!participantsByEvent.has(p.sessionId)) {
        participantsByEvent.set(p.sessionId, []);
      }
      participantsByEvent.get(p.sessionId)!.push(p);
    });

    attendances.forEach(a => {
      if (!attendancesByEvent.has(a.sessionId)) {
        attendancesByEvent.set(a.sessionId, []);
      }
      attendancesByEvent.get(a.sessionId)!.push(a);
    });

    // Batch query user's membership role in all unique groups for this result set
    const uniqueGroupIds = [...new Set(sessions.map(e => e.groupId).filter(Boolean))];
    const userMemberships = await prisma.groupMember.findMany({
      where: {
        userId,
        groupId: { in: uniqueGroupIds }
      },
      select: { groupId: true, role: true }
    });
    const membershipByGroupId = new Map(userMemberships.map(m => [m.groupId, m.role]));

    // Attach participants, attendances, and user's group role to events
    const sessionsWithParticipants = sessions.map(session => ({
      ...session,
      participants: participantsByEvent.get(session.id) || [],
      sessionAttendances: attendancesByEvent.get(session.id) || [],
      userGroupRole: membershipByGroupId.get(session.groupId) ?? null
    }));

    // Sort events by priority (in-memory for this page of results only)
    // 1. Events user joined + private (from groups user is in)
    // 2. Events user joined + public
    // 3. Other events (not joined)
    const eventsWithJoinStatus = sessionsWithParticipants.map(session => {
      const participantIds = new Set(session.participants.map(p => p.userId));
      return {
        session,
        isJoined: participantIds.has(userId)
      };
    });
    
    const sortedEvents = eventsWithJoinStatus.sort((a, b) => {
      // Calculate priority (lower number = higher priority)
      const getPriority = (isJoined: boolean, isPublic: boolean) => {
        if (isJoined && !isPublic) return 1; // Joined + Private
        if (isJoined && isPublic) return 2;  // Joined + Public
        return 3; // Other events (not joined)
      };
      
      const aPriority = getPriority(a.isJoined, a.session.isPublic);
      const bPriority = getPriority(b.isJoined, b.session.isPublic);
      
      // First sort by priority
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Within same priority, sort by start time
      return new Date(a.session.startTime).getTime() - new Date(b.session.startTime).getTime();
    }).map(item => item.session);

    // Enrich with location info
    const enrichedEvents = sortedEvents.map(session => 
      locationService.enrichWithLocationInfo(session)
    );

    // Calculate next cursor for cursor-based pagination aligned with DB sort (startTime, id)
    const nextCursor = sessions.length === validatedLimit
      ? Buffer.from(
          JSON.stringify({
            startTime: sessions[sessions.length - 1].startTime,
            id: sessions[sessions.length - 1].id
          }),
          'utf8'
        ).toString('base64url')
      : null;

    const response = {
      data: enrichedEvents,
      pagination: {
        limit: validatedLimit,
        offset: validatedOffset,
        total: totalCount,
        hasMore: sessions.length === validatedLimit,
        nextCursor
      }
    };

    // Cache simple queries for 30 seconds
    if (cacheKey) {
      await CacheService.set(cacheKey, response, 30);
    }

    // Return paginated response with metadata
    res.json(response);
};
export const getEvent = async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
  const { id } = req.params;

  const session = await prisma.session.findFirst({
    where: {
      id,
      group: {
        members: {
          some: {
            userId: req.user!.id
          }
        }
      }
    },
    include: {
      creator: {
        select: { id: true, name: true, email: true, profilePicture: true }
      },
      group: {
        select: { id: true, name: true }
      },
      participants: {
        select: {
          id: true,
          userId: true,
          status: true,
          joinedAt: true,
          user: {
            select: { name: true, email: true, profilePicture: true }
          }
        },
        orderBy: {
          joinedAt: 'asc'  // Sort by when they joined, leveraging the joinedAt index
        }
      },
      guestParticipants: {
        select: {
          id: true,
          name: true,
          status: true,
          joinedAt: true
        },
        orderBy: {
          joinedAt: 'asc'  // Sort by when they joined
        }
      },
      sessionAttendances: {
        select: {
          id: true,
          userId: true,
          status: true,
          updatedAt: true
        }
      },
      sessionNotifications: {
        select: {
          id: true,
          userId: true,
          type: true,
          createdAt: true,
          user: {
            select: { name: true }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  });

  ensureResourceExists(session, 'Event');

  const enrichedSession = locationService.enrichWithLocationInfo(session!);

  res.json(enrichedSession);
};
export const updateEvent = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, sessionType, location, startTime, endTime, maxPlayers, isPublic,
          latitude, longitude, locationName, city, country } = req.body;

  // Block changes to fields that are immutable after session creation
  guardImmutableFields(req.body, ['groupId', 'creatorId', 'sessionType']);

  // Sanitize text inputs
  const sanitized = sessionService.sanitizeSessionData({
    title,
    description,
    sessionType,
    location
  });

  validateSessionDescription(sanitized.description);
  validateSessionLocationName(locationName);
  validateSessionDuration(startTime, endTime);

  // Validate startTime cannot be in the past
  if (startTime) {
    const newStart = new Date(startTime);
    if (!isNaN(newStart.getTime()) && newStart <= new Date()) {
      throw new BadRequestError('startTime cannot be set to a past time', 'DATE_MUST_BE_FUTURE', 'startTime');
    }
  }

  // Validate coordinates if provided
  if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
    parseCoordinates(latitude, longitude);
    // Coordinates are validated by parseCoordinates
  }

  // Validate maxPlayers if provided
  if (maxPlayers !== undefined && maxPlayers !== null) {
    const parsedMaxPlayers = parseInt(maxPlayers);
    if (isNaN(parsedMaxPlayers) || parsedMaxPlayers < 2 || parsedMaxPlayers > 1000) {
      throw new BadRequestError('Max players must be a number between 2 and 1000');
    }
  }

  // Validate that events are single-day only if both times are provided
  if (startTime && endTime) {
    const timeValidation = sessionService.validateSessionTimes(startTime, endTime);
    if (!timeValidation.valid) {
      throw new BadRequestError(timeValidation.error!);
    }
  }

  // Check if user is the creator of the session or a group admin
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      group: {
        select: { id: true, name: true }
      },
      participants: {
        include: {
          user: {
            select: { id: true, name: true, email: true, profilePicture: true }
          }
        }
      }
    }
  });

  ensureResourceExists(session, 'Event');

  // Check if user has permission to update this session (creator, moderator, or admin)
  const canUpdate = await permissionService.hasEventPermission(req.user!.id, id, Permission.EVENT_UPDATE);
  if (!canUpdate) {
    throw new ForbiddenError('Only the session creator, moderators, or group admins can update it');
  }

  if (maxPlayers !== undefined && maxPlayers !== null) {
    const parsedMaxPlayers = parseInt(maxPlayers);

    const confirmedParticipants = await prisma.sessionParticipant.count({
      where: {
        sessionId: id,
        status: SessionParticipantStatus.confirmed,
      },
    });

    const waitlistedParticipants = await prisma.sessionParticipant.count({
      where: {
        sessionId: id,
        status: SessionParticipantStatus.waitlisted,
      },
    });

    const confirmedGuests = await prisma.guestParticipant.count({
      where: {
        sessionId: id,
        status: GuestParticipantStatus.confirmed,
      },
    });

    const currentConfirmedTotal = confirmedParticipants + confirmedGuests;
    const totalIncludingWaitlisted = currentConfirmedTotal + waitlistedParticipants;
    if (parsedMaxPlayers < currentConfirmedTotal) {
      throw new BadRequestError(`Max players cannot be lower than current confirmed participants (${currentConfirmedTotal})`);
    }
    if (parsedMaxPlayers < totalIncludingWaitlisted) {
      throw new BadRequestError(`Max players cannot be lower than confirmed and waitlisted participants (${totalIncludingWaitlisted})`);
    }
    // Warn-level: if lower than total including waitlist, proceed (waitlisted are already past capacity)
  }

  // Parse coordinates once if both are provided
  const updateCoordinates = latitude !== undefined && longitude !== undefined && latitude && longitude 
    ? parseCoordinates(latitude, longitude) 
    : null;

  const updatedSession = await prisma.session.update({
    where: { id },
    data: {
      ...(sanitized.title && { title: sanitized.title }),
      ...(sanitized.description !== undefined && { description: sanitized.description }),
      ...(sanitized.sessionType && { sessionType: sanitized.sessionType as SportType }),
      ...(sanitized.location !== undefined && { location: sanitized.location }),
      ...(updateCoordinates ? {
        latitude: updateCoordinates.lat,
        longitude: updateCoordinates.lon
      } : {}),
      ...(locationName !== undefined && { locationName: locationName || null }),
      ...(city !== undefined && { city: city || null }),
      ...(country !== undefined && { country: country || null }),
      ...(startTime && { startTime: new Date(startTime) }),
      ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
      ...(maxPlayers !== undefined && { maxPlayers: maxPlayers ? parseInt(maxPlayers) : null }),
      ...(isPublic !== undefined && { isPublic }),
      ...(isPublic === false && { inviteToken: null })
    },
    include: {
      creator: {
        select: { id: true, name: true, email: true, profilePicture: true }
      },
      group: {
        select: { id: true, name: true }
      },
      participants: {
        select: {
          id: true,
          userId: true,
          status: true,
          joinedAt: true,
          user: {
            select: { 
              id: true,
              name: true, 
              email: true,
              emailNotifications: true
            }
          }
        }
      }
    }
  });

  // Enrich session with location info if coordinates are available
  const enrichedSession = locationService.enrichWithLocationInfo(updatedSession);

  // Send email notifications to participants
  await sessionService.sendSessionEmailNotifications(
    updatedSession.participants,
    req.user!.id,
    'sessionUpdates',
    'eventUpdate',
    updatedSession.title,
    session!.group.name
  );

  // Send in-app notifications to participants (except updater)
  const participantIds = updatedSession.participants
    .map((p) => p.userId)
    .filter((uid) => uid !== req.user!.id);
  await sessionService.createSessionUpdateNotifications(id, updatedSession.title, req.user!.name, participantIds);

  // Invalidate events cache
  await CacheService.deletePattern(`sessions:user:*:group:${session!.groupId}:*`);
  await CacheService.deletePattern(`sessions:user:*:group:all:*`);

  res.json(enrichedSession);
};
export const deleteEvent = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user is the creator of the session or a group admin
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      group: {
        select: { id: true, name: true }
      },
      participants: {
        include: {
          user: {
            select: { 
              id: true, 
              name: true, 
              email: true,
              emailNotifications: true
            }
          }
        }
      }
    }
  });

  ensureResourceExists(session, 'Event');

  // Check if user has permission to delete this session (creator or group admin)
  const canDelete = await permissionService.hasEventPermission(req.user!.id, id, Permission.EVENT_DELETE);
  if (!canDelete) {
    throw new ForbiddenError('Only the session creator or group admins can delete it');
  }

  // Collect participant IDs before deletion for in-app notifications
  const participantIds = session!.participants
    .map((p) => p.userId)
    .filter((uid) => uid !== req.user!.id);

  // Send email notifications to participants
  await sessionService.sendSessionEmailNotifications(
    session!.participants,
    req.user!.id,
    'sessionCancellations',
    'eventCancellation',
    session!.title,
    session!.group.name
  );

  // Send in-app notifications to participants before deleting the session
  await sessionService.createSessionDeletionNotifications(id, session!.title, req.user!.name, participantIds);

  await prisma.session.delete({
    where: { id }
  });

  // Invalidate events cache
  await CacheService.deletePattern(`sessions:user:*:group:${session!.groupId}:*`);
  await CacheService.deletePattern(`sessions:user:*:group:all:*`);

  res.json({ message: 'Event deleted successfully' });
};

// ==================== EVENT PARTICIPATION OPERATIONS ====================
