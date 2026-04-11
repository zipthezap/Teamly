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
import { generateRecurrenceInstances, calculateDuration, applyDuration } from '../utils/recurrenceService';
import { getSessionActivity } from '../services/sessionNotification';
import { validateSessionStatus } from '../services/sessionValidation';
import { logger } from '../utils/logger';
import { Request, Response } from 'express';
import { createInviteToken } from '../utils/inviteToken';
import { TRANSACTION } from '../config/security';
import * as sessionService from '../services/sessionService';
import { SessionParticipantStatus, GuestParticipantStatus, SportType, SessionNotificationType } from '../../shared/types/event.types';
import * as locationService from '../services/locationService';
import { exportToCSV, exportToICalendar, exportToJSON } from '../services/exportService';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { isRequired, parseCoordinates, parseFloatStrict } from '../utils/validation';
import { isPrismaUniqueError, hasGroupId } from '../utils/typeGuards';
import { ensureResourceExists } from '../utils/controllerHelpers';
import { CacheService } from '../services/cacheService';
import { InviteService, calculateExpirationDate } from '../services/inviteService';
import { permissionService } from '../services/permissionService';
import { Permission } from '../../shared/types/permissions.types';
import { NotificationFactory } from '../services/notificationFactory';
import { recordSearchQuery } from '../services/metricsService';

// ==================== EVENT CRUD OPERATIONS ====================

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
      eventAttendances: attendancesByEvent.get(session.id) || [],
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
      eventAttendances: {
        select: {
          id: true,
          userId: true,
          status: true,
          updatedAt: true
        }
      },
      eventNotifications: {
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

  // Sanitize text inputs
  const sanitized = sessionService.sanitizeSessionData({
    title,
    description,
    sessionType,
    location
  });

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

    const confirmedGuests = await prisma.guestParticipant.count({
      where: {
        sessionId: id,
        status: GuestParticipantStatus.confirmed,
      },
    });

    const currentConfirmedTotal = confirmedParticipants + confirmedGuests;
    if (parsedMaxPlayers < currentConfirmedTotal) {
      throw new BadRequestError(`Max players cannot be lower than current confirmed participants (${currentConfirmedTotal})`);
    }
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
    'eventUpdates',
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
    'eventCancellations',
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

export const joinEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Use a transaction with serializable isolation to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Lock the session row for update to prevent concurrent modifications
      const session = await tx.session.findFirst({
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
          participants: {
            where: { status: 'confirmed' }
          }
        }
      });

      if (!session) {
        throw new Error('EVENT_NOT_FOUND');
      }

      // Check if already joined (database constraint will also catch this)
      const existingParticipant = await tx.eventParticipant.findUnique({
        where: {
          eventId_userId: {
            sessionId: id,
            userId: req.user!.id
          }
        }
      });

      if (existingParticipant) {
        throw new Error('ALREADY_JOINED');
      }

      // Check max players with accurate count
      if (session.maxPlayers) {
        const confirmedCount = session.participants.length;
        
        // Also count confirmed guest participants
        const guestCount = await tx.guestParticipant.count({
          where: {
            sessionId: id,
            status: GuestParticipantStatus.confirmed
          }
        });

        const totalConfirmed = confirmedCount + guestCount;
        
        if (totalConfirmed >= session.maxPlayers) {
          // Add to waitlist instead of rejecting
          const waitlistParticipant = await tx.eventParticipant.create({
            data: {
              sessionId: id,
              userId: req.user!.id,
              status: 'waitlisted'
            }
          });
          return { participant: waitlistParticipant, eventTitle: session.title, groupId: session.groupId, waitlisted: true };
        }
      }

      // Create participant
      const participant = await tx.eventParticipant.create({
        data: {
          sessionId: id,
          userId: req.user!.id,
          status: 'confirmed'
        }
      });

      // Log activity for the user who joined using NotificationFactory
      await NotificationFactory.createSessionNotifications(
        {
          sessionId: id,
          type: SessionNotificationType.join,
          userIds: [req.user!.id],
          params: {
            name: req.user!.name,
            eventTitle: session.title
          },
          metadata: {
            sessionType: session.sessionType,
            eventStartTime: session.startTime,
            groupId: session.groupId,
            participantCount: await tx.eventParticipant.count({
              where: { sessionId: id, status: 'confirmed' }
            }),
            maxPlayers: session.maxPlayers
          },
          checkMutePreference: false // User joining their own session
        },
        tx
      );

      return { participant, eventTitle: session.title, groupId: session.groupId, waitlisted: false };
    }, {
      isolationLevel: 'Serializable', // Highest isolation level to prevent race conditions
      maxWait: TRANSACTION.MAX_WAIT_MS,
      timeout: TRANSACTION.TIMEOUT_MS
    });

    // Invalidate events cache for all group members
    await CacheService.deletePattern(`sessions:user:*:group:${result.groupId}:*`);
    await CacheService.deletePattern(`sessions:user:*:group:all:*`);

    const status = result.waitlisted ? 202 : 201;
    res.status(status).json({
      ...result.participant,
      waitlisted: result.waitlisted,
      message: result.waitlisted
        ? 'Event is full. You have been added to the waitlist.'
        : 'Successfully joined the session.',
    });
  } catch (error: unknown) {
    logger.error('Join session error', 'EventController', { error });
    
    // Handle specific error cases
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage === 'EVENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (errorMessage === 'ALREADY_JOINED') {
      return res.status(400).json({ error: 'Already joined this session' });
    }
    
    // Handle unique constraint violations
    if (isPrismaUniqueError(error)) {
      return res.status(400).json({ error: 'Already joined this session' });
    }
    
    return res.status(500).json({ error: 'Failed to join session' });
  }
};

export const leaveEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Get session details
      const session = await tx.session.findUnique({
        where: { id },
        select: { 
          creatorId: true,
          title: true, 
          sessionType: true, 
          startTime: true,
          groupId: true 
        }
      });

      if (!session) {
        throw new Error('EVENT_NOT_FOUND');
      }

      const participant = await tx.eventParticipant.findFirst({
        where: {
          sessionId: id,
          userId: req.user!.id
        }
      });

      if (!participant) {
        throw new Error('NOT_PARTICIPATING');
      }

      // Delete participant and attendance records sequentially for proper transaction handling
      await tx.eventParticipant.delete({
        where: { id: participant.id }
      });
      
      // Also delete the attendance record (late status) when leaving
      await tx.eventAttendance.deleteMany({
        where: {
          sessionId: id,
          userId: req.user!.id
        }
      });

      // Promote first waitlisted participant if a spot opened up
      let promotedUserId: string | undefined;
      const eventWithMax = await tx.session.findUnique({
        where: { id },
        select: { maxPlayers: true, title: true }
      });
      if (eventWithMax?.maxPlayers && participant.status === 'confirmed') {
        const firstWaitlisted = await tx.eventParticipant.findFirst({
          where: { sessionId: id, status: 'waitlisted' },
          orderBy: { joinedAt: 'asc' },
        });
        if (firstWaitlisted) {
          await tx.eventParticipant.update({
            where: { id: firstWaitlisted.id },
            data: { status: 'confirmed' },
          });
          promotedUserId = firstWaitlisted.userId;
        }
      }

      // Log activity for the user who left using NotificationFactory
      await NotificationFactory.createSessionNotifications(
        {
          sessionId: id,
          type: SessionNotificationType.leave,
          userIds: [req.user!.id],
          params: {
            name: req.user!.name,
            eventTitle: session.title
          },
          metadata: {
            sessionType: session.sessionType,
            eventStartTime: session.startTime,
            groupId: session.groupId
          },
          checkMutePreference: false // User leaving their own session
        },
        tx
      );

      return { groupId: session.groupId, promotedUserId, eventTitle: session.title };
    });

    // Invalidate events cache for all group members
    await CacheService.deletePattern(`sessions:user:*:group:${result.groupId}:*`);
    await CacheService.deletePattern(`sessions:user:*:group:all:*`);

    // Notify the promoted waitlisted user (non-blocking)
    if (result.promotedUserId) {
      NotificationFactory.createSessionNotifications({
        sessionId: id,
        type: SessionNotificationType.confirmed,
        userIds: [result.promotedUserId],
        params: { eventTitle: result.eventTitle },
        metadata: { promotedFromWaitlist: true },
        checkMutePreference: true,
      }).catch(err => logger.error('Failed to notify promoted waitlist user', 'EventController', { error: err }));
    }

    res.json({ message: 'Left session successfully' });
  } catch (error: unknown) {
    logger.error('Failed to leave session', 'EventController', { error });
    
    // Handle specific error cases
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage === 'EVENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (errorMessage === 'NOT_PARTICIPATING') {
      return res.status(404).json({ error: 'Not participating in this session' });
    }
    
    return res.status(500).json({ error: 'Failed to leave session' });
  }
};

export const updateParticipationStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status using enum
    const validStatuses = Object.values(SessionParticipantStatus);
    if (!status || !validStatuses.includes(status as SessionParticipantStatus)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const participant = await tx.eventParticipant.findFirst({
        where: {
          sessionId: id,
          userId: req.user!.id
        }
      });

      if (!participant) {
        return null;
      }

      const updated = await tx.eventParticipant.update({
        where: { id: participant.id },
        data: { status }
      });

      return { updated, previousStatus: participant.status };
    });

    if (!result) {
      return res.status(404).json({ error: 'Not participating in this session' });
    }

    const { updated: updatedParticipant, previousStatus } = result;

    // Log activity for the user who updated their status (only for confirmed/declined)
    if (status === 'confirmed' || status === 'declined') {
      // Get the session details
      const statusEvent = await prisma.session.findUnique({
        where: { id },
        select: { 
          title: true,
          sessionType: true,
          startTime: true,
          groupId: true
        }
      });

      if (statusEvent) {
        await NotificationFactory.createSessionNotifications({
          sessionId: id,
          type: status,
          userIds: [req.user!.id],
          params: {
            name: req.user!.name,
            eventTitle: statusEvent.title
          },
          metadata: {
            sessionType: statusEvent.sessionType,
            eventStartTime: statusEvent.startTime,
            groupId: statusEvent.groupId,
            previousStatus: previousStatus
          },
          checkMutePreference: false // User updating their own status
        });

        // Invalidate events cache when status changes
        await CacheService.deletePattern(`sessions:user:*:group:${statusEvent.groupId}:*`);
        await CacheService.deletePattern(`sessions:user:*:group:all:*`);
      }
    }

    res.json(updatedParticipant);
  } catch (error) {
    logger.error('Update participation status error', 'EventController', { error });
    return res.status(500).json({ error: 'Failed to update participation status' });
  }
};

// ==================== RECURRING EVENTS MANAGEMENT ====================

// Get recurring session instances
export const getRecurringEventInstances = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, limit } = req.query;

    // Get the parent session
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
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!session.isRecurring || !session.recurrenceRule) {
      return res.status(400).json({ error: 'Event is not recurring' });
    }

    // Generate instances
    let start: Date;
    if (startDate instanceof Date) {
      start = startDate;
    } else if (typeof startDate === 'string') {
      start = new Date(startDate);
    } else {
      start = session.startTime;
    }
    // Ensure exceptionDates is defined and parsed
    let exceptionDates: string[] = [];
    if (session.exceptionDates) {
      exceptionDates = Array.isArray(session.exceptionDates)
        ? session.exceptionDates
        : JSON.parse(JSON.stringify(session.exceptionDates));
    }
    // Ensure endDate is a Date
    let end: Date;
    if (endDate instanceof Date) {
      end = endDate;
    } else if (typeof endDate === 'string') {
      end = new Date(endDate);
    } else {
      end = session.recurrenceEnd;
    }
    const instances = generateRecurrenceInstances(
      start,
      session.recurrenceRule,
      end,
      exceptionDates,
      limit ? parseInt(limit as string) : 100
    );

    // Calculate duration if endTime exists
    const duration = calculateDuration(session.startTime, session.endTime);

    // Map instances to session objects
    const eventInstances = instances.map(instanceDate => ({
      ...session,
      id: `${session.id}-${instanceDate.toISOString()}`,
      startTime: instanceDate,
      endTime: duration ? applyDuration(instanceDate, duration) : null,
      parentSessionId: session.id,
      isInstance: true
    }));

    res.json(eventInstances);
  } catch (error) {
    logger.error('Failed to get recurring session instances', 'EventController', { error });
    return res.status(500).json({ error: 'Failed to get recurring session instances' });
  }
};

// Add exception date to recurring session
export const addRecurringEventException = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { exceptionDate } = req.body;

    if (!exceptionDate) {
      return res.status(400).json({ error: 'Exception date is required' });
    }

    // Check if user is the creator of the session or a group admin
    const session = await prisma.session.findUnique({
      where: { id }
    });

    if (!session) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user has permission to manage this session
    const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the session creator or group admins can add exceptions' });
    }

    if (!session.isRecurring) {
      return res.status(400).json({ error: 'Event is not recurring' });
    }

    // Get existing exceptions
    const existingExceptions = Array.isArray(session.exceptionDates) 
      ? [...session.exceptionDates] 
      : [];

    // Add new exception if not already present
    const exceptionDateISO = new Date(exceptionDate).toISOString();
    if (!existingExceptions.some((d: string) => new Date(d).toISOString() === exceptionDateISO)) {
      existingExceptions.push(exceptionDateISO);
    }

    // Update session with new exceptions
    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        exceptionDates: existingExceptions
      }
    });

    res.json(updatedSession);
  } catch (error) {
    logger.error('Add recurring session exception error', 'EventController', { error });
    return res.status(500).json({ error: 'Failed to add exception' });
  }
};

// Remove exception date from recurring session
export const removeRecurringEventException = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { exceptionDate } = req.body;

    if (!exceptionDate) {
      return res.status(400).json({ error: 'Exception date is required' });
    }

    // Check if user is the creator of the session or a group admin
    const session = await prisma.session.findUnique({
      where: { id }
    });

    if (!session) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user has permission to manage this session
    const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the session creator or group admins can remove exceptions' });
    }

    // Get existing exceptions
    const existingExceptions = session.exceptionDates 
      ? JSON.parse(JSON.stringify(session.exceptionDates))
      : [];

    // Remove exception
    const updatedExceptions = existingExceptions.filter(
      (d: string | Date) => new Date(d).toISOString() !== new Date(exceptionDate).toISOString()
    );

    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        exceptionDates: updatedExceptions
      }
    });

    res.json(updatedSession);
  } catch (error) {
    logger.error('Failed to remove recurring session exception', 'EventController', { error });
    return res.status(500).json({ error: 'Failed to remove exception' });
  }
};

// ==================== EVENT QUERIES & ANALYTICS ====================

// Get user session statistics
export const getUserStatistics = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const now = new Date();

    // Get all events where user is a participant
    const userParticipations = await prisma.sessionParticipant.findMany({
      where: { userId },
      include: {
        session: {
          include: {
            group: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    // Get events created by user
    const createdEvents = await prisma.session.findMany({
      where: { creatorId: userId },
      include: {
        participants: true,
        group: {
          select: { id: true, name: true }
        }
      }
    });

    // Calculate statistics
    const totalEventsJoined = userParticipations.length;
    const totalEventsCreated = createdEvents.length;
    
    const upcomingEvents = userParticipations.filter(
      p => new Date(p.session.startTime) > now
    ).length;
    
    const pastEvents = userParticipations.filter(
      p => new Date(p.session.startTime) <= now
    ).length;

    const confirmedEvents = userParticipations.filter(
      p => p.status === 'confirmed'
    ).length;

    // Get session type breakdown
    const eventTypeBreakdown: Record<string, number> = {};
    userParticipations.forEach(p => {
      const type = p.session.sessionType;
      eventTypeBreakdown[type] = (eventTypeBreakdown[type] || 0) + 1;
    });

    // Get upcoming events details (next 5)
    const upcomingEventsDetails = userParticipations
      .filter(p => new Date(p.session.startTime) > now)
      .sort((a, b) => new Date(a.session.startTime).getTime() - new Date(b.session.startTime).getTime())
      .slice(0, 5)
      .map(p => ({
        id: p.session.id,
        title: p.session.title,
        sessionType: p.session.sessionType,
        startTime: p.session.startTime,
        group: p.session.group,
        status: p.status
      }));

    const statistics = {
      totalEventsJoined,
      totalEventsCreated,
      upcomingEvents,
      pastEvents,
      confirmedEvents,
      eventTypeBreakdown,
      upcomingEventsDetails,
      createdEventsStats: {
        total: createdEvents.length,
        totalParticipants: createdEvents.reduce((sum, e) => sum + e.participants.length, 0),
        avgParticipantsPerEvent: createdEvents.length > 0 
          ? createdEvents.reduce((sum, e) => sum + e.participants.length, 0) / createdEvents.length
          : 0
      }
    };

    res.json(statistics);
  } catch (error) {
    logger.error('Get user statistics error', 'EventController', { error });
    return res.status(500).json({ error: 'Failed to get statistics' });
  }
};

// Archive an session
export const archiveEvent = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user is the creator of the session or a group admin
  const session = ensureResourceExists(
    await prisma.session.findUnique({ where: { id } }),
    'Event'
  );

  // Check if user has permission to manage this session
  const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the session creator or group admins can archive it');
  }

  const updatedSession = await prisma.session.update({
    where: { id },
    data: { archived: true }
  });

  res.json({ message: 'Event archived successfully', session: updatedSession });
};

// Unarchive an session
export const unarchiveEvent = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user is the creator of the session or a group admin
  const session = ensureResourceExists(
    await prisma.session.findUnique({ where: { id } }),
    'Event'
  );

  // Check if user has permission to manage this session
  const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the session creator or group admins can unarchive it');
  }

  const updatedSession = await prisma.session.update({
    where: { id },
    data: { archived: false }
  });

  res.json({ message: 'Event unarchived successfully', session: updatedSession });
};

// Update session status
export const updateSessionStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  // Validate status using the centralized validation function
  const statusValidation = validateSessionStatus(status);
  if (!statusValidation.isValid) {
    throw new BadRequestError(statusValidation.error!);
  }

  // Check if user is the creator of the session or a group admin
  const session = ensureResourceExists(
    await prisma.session.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, profilePicture: true }
            }
          }
        }
      }
    }),
    'Event'
  );

  // Check if user has permission to manage this session
  const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the session creator or group admins can update session status');
  }

  const updatedSession = await prisma.session.update({
    where: { id },
    data: { status }
  });

  // Create notifications for participants about status change using NotificationFactory
  const participantIds = session.participants
    .filter(p => p.userId !== req.user!.id)
    .map(p => p.userId);
  
  if (participantIds.length > 0) {
    await NotificationFactory.createSessionNotifications({
      sessionId: id,
      type: SessionNotificationType.status_change,
      userIds: participantIds,
      params: {
        name: req.user!.name,
        eventTitle: session.title,
        newStatus: status,
        oldStatus: session.status
      },
      metadata: { 
        newStatus: status, 
        oldStatus: session.status 
      },
      checkMutePreference: true,
      deduplicateWindow: 60000 // 1 minute deduplication window
    });
  }

  res.json({ message: 'Event status updated successfully', session: updatedSession });
};

// Get session activity with optional filtering
export const getEventActivityFeed = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, limit, startDate, endDate } = req.query;

  // Check if user has access to the session
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
    }
  });

  if (!session) {
    throw new NotFoundError('Event not found or access denied');
  }

  const options: Record<string, unknown> = {
    limit: limit ? parseInt(limit as string) : 50
  };

  if (type && typeof type === 'string') {
    options.type = type;
  }

  if (startDate && typeof startDate === 'string') {
    options.startDate = new Date(startDate);
  }

  if (endDate && typeof endDate === 'string') {
    options.endDate = new Date(endDate);
  }

  const activity = await getSessionActivity(id, prisma, options);

  res.json({
    sessionId: id,
    total: activity.length,
    activity
  });
};

// ==================== GUEST PARTICIPANT MANAGEMENT ====================

// Get session by invite token (no authentication required)
// Note: This endpoint allows access to both public AND private events via invite token.
// This is intentional - private events with invite tokens are shared privately via the link,
// which provides controlled access without making the session publicly discoverable.
export const getEventByInviteToken = async (req: Request, res: Response) => {
  const { token } = req.params;

  const session = await prisma.session.findFirst({
    where: {
      inviteToken: token
      // Both public and private events can be accessed via valid invite token
      // Private events remain unlisted but accessible to those with the link
    },
    include: {
      creator: {
        select: { id: true, name: true }
      },
      group: {
        select: { id: true, name: true }
      },
      participants: {
        select: {
          id: true,
          status: true,
          user: {
            select: { name: true }
          }
        }
      },
      guestParticipants: {
        select: {
          id: true,
          name: true,
          status: true,
          joinedAt: true
        }
      }
    }
  });

  if (!session) {
    throw new NotFoundError('Event not found or invite link is invalid');
  }

  res.json(session);
};

// Generate or regenerate invite token for an session
export const generateInviteToken = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user is the creator of the session or a group admin
  const session = ensureResourceExists(
    await prisma.session.findUnique({ where: { id } }),
    'Event'
  );

  // Check if user has permission to manage this session
  const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the session creator or group admins can generate invite links');
  }

  // Generate new token
  const inviteToken = createInviteToken();

  // For private events, keep them private but allow invite link access
  // For public events, ensure they stay public
  const updatedSession = await prisma.session.update({
    where: { id },
    data: { 
      inviteToken
    }
  });

  res.json({ 
    inviteToken: updatedSession.inviteToken,
    inviteUrl: `/sessions/join/${updatedSession.inviteToken}`,
    isPublic: updatedSession.isPublic
  });
};

// Join session as guest (no authentication required)
export const joinEventAsGuest = async (req: Request, res: Response) => {
  const { token } = req.params;
  const { name } = req.body;

  if (!name || name.trim().length === 0) {
    throw new BadRequestError('Name is required');
  }

  // Sanitize guest name
  const sanitizedName = sessionService.sanitizeGuestName(name);

  // Use a transaction with serializable isolation to prevent race conditions
  const result = await prisma.$transaction(async (tx) => {
    // Find session by invite token
    const session = await tx.session.findFirst({
      where: {
        inviteToken: token
      }
    });

    if (!session) {
      throw new NotFoundError('Event not found or invite link is invalid');
    }

    // Check max players with accurate count within transaction
    if (session.maxPlayers) {
      const confirmedParticipants = await tx.eventParticipant.count({
        where: {
          sessionId: session.id,
          status: SessionParticipantStatus.confirmed
        }
      });

      const confirmedGuests = await tx.guestParticipant.count({
        where: {
          sessionId: session.id,
          status: GuestParticipantStatus.confirmed
        }
      });

      const totalConfirmed = confirmedParticipants + confirmedGuests;
      
      if (totalConfirmed >= session.maxPlayers) {
        throw new BadRequestError('Event is full');
      }
    }

    // Check for duplicate guest name within this session
    const existingGuest = await tx.guestParticipant.findFirst({
      where: {
        sessionId: session.id,
        name: sanitizedName
      }
    });

    if (existingGuest) {
      throw new BadRequestError('A guest with this name has already joined the session');
    }

    // Create guest participant
    const guestParticipant = await tx.guestParticipant.create({
      data: {
        sessionId: session.id,
        name: sanitizedName,
        status: GuestParticipantStatus.confirmed
      }
    });

    return { guestParticipant, groupId: session.groupId };
  }, {
    isolationLevel: 'Serializable', // Highest isolation level to prevent race conditions
    maxWait: TRANSACTION.MAX_WAIT_MS,
    timeout: TRANSACTION.TIMEOUT_MS
  });

  // Invalidate events cache for all group members
  await CacheService.deletePattern(`sessions:user:*:group:${result.groupId}:*`);
  await CacheService.deletePattern(`sessions:user:*:group:all:*`);

  res.status(201).json({ 
    message: 'Successfully joined session',
    participant: result.guestParticipant
  });
};

// Get nearby events based on location and radius
export const getNearbyEvents = async (req: Request, res: Response) => {
  const { latitude, longitude, radius = 10, limit = 50 } = req.query;

  if (!latitude || !longitude) {
    throw new BadRequestError('Latitude and longitude are required');
  }

  const { lat, lon } = parseCoordinates(latitude, longitude);
  const radiusKm = parseFloatStrict(radius, 'Radius');
  const parsedLimit = parseFloatStrict(limit, 'Limit');
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    throw new BadRequestError('Limit must be an integer between 1 and 100');
  }
  const safeLimit = parsedLimit;

  // Validate radius (max 100km to prevent excessive queries)
  if (radiusKm <= 0 || radiusKm > 100) {
    throw new BadRequestError('Radius must be between 0 and 100 kilometers');
  }

  // Record search metric for observability of discovery traffic
  recordSearchQuery('sessions');

  const { latDelta, lonDelta } = locationService.calculateBoundingBox(lat, radiusKm);

  // Get all events with location data
    const sessions = await prisma.session.findMany({
      where: {
        AND: [
          { latitude: { not: null } },
          { longitude: { not: null } },
          { latitude: { gte: lat - latDelta, lte: lat + latDelta } },
          { longitude: { gte: lon - lonDelta, lte: lon + lonDelta } },
        ],
        status: 'upcoming', // Only show upcoming events
        archived: false
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
            status: true
          }
        },
        _count: {
          select: { participants: true }
        }
      },
      orderBy: { startTime: 'asc' },
      take: Math.min(safeLimit * 10, 500) // Wider candidate set from DB bounding box
    });

    // Filter by location and add distance
    const nearbyEvents = locationService.filterByLocation(
      sessions,
      lat,
      lon,
      radiusKm
    ).slice(0, safeLimit); // Limit after filtering

  // Enrich with location info
  const enrichedEvents = nearbyEvents.map(session => 
    locationService.enrichWithLocationInfo(session)
  );

  res.json({
    results: enrichedEvents,
    total: enrichedEvents.length,
    center: { latitude: lat, longitude: lon },
    radius: radiusKm
  });
};

/**
 * Export user's events to various formats
 */
export const exportEvents = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const format = (req.query.format as string)?.toLowerCase() || 'csv';
  
  // Validate format
  if (!['csv', 'ical', 'json'].includes(format)) {
    throw new BadRequestError('Invalid format. Supported formats: csv, ical, json');
  }

  logger.debug('Exporting events', 'EventController', { userId, format });

  // Optimize query - only fetch fields needed for export
  const sessions = await prisma.session.findMany({
    where: {
      participants: {
        some: {
          userId: userId
        }
      }
    },
    select: {
      id: true,
      title: true,
      description: true,
      sessionType: true,
      location: true,
      startTime: true,
      endTime: true,
      status: true,
      maxPlayers: true,
      participants: {
        where: {
          userId: userId
        },
        select: {
          status: true,
          userId: true
        }
      },
      _count: {
        select: {
          participants: true
        }
      },
      group: {
        select: {
          name: true
        }
      },
      creator: {
        select: {
          name: true,
          email: true
        }
      }
    },
    orderBy: {
      startTime: 'desc'
    }
  });

  // Transform events to export format
  const exportData = sessions.map(session => {
    const userParticipant = session.participants.find(p => p.userId === userId);
    
    return {
      id: session.id,
      title: session.title,
      description: session.description,
      sessionType: session.sessionType,
      location: session.location,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      participantStatus: userParticipant?.status || 'unknown',
      groupName: session.group.name,
      creatorName: session.creator.name,
      participantCount: session._count.participants,
      maxPlayers: session.maxPlayers
    };
  });

  // Generate export content based on format
  let content: string;
  let filename: string;
  let contentType: string;

  switch (format) {
    case 'csv':
      content = exportToCSV(exportData);
      filename = `teamly-events-${new Date().toISOString().split('T')[0]}.csv`;
      contentType = 'text/csv';
      break;
    
    case 'ical':
      content = exportToICalendar(exportData);
      filename = `teamly-events-${new Date().toISOString().split('T')[0]}.ics`;
      contentType = 'text/calendar';
      break;
    
    case 'json':
      content = exportToJSON(exportData);
      filename = `teamly-events-${new Date().toISOString().split('T')[0]}.json`;
      contentType = 'application/json';
      break;
    
    default:
      throw new BadRequestError('Invalid format');
  }

  // Set headers for file download
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', Buffer.byteLength(content));
  
  logger.debug('Events exported successfully', 'EventController', { 
    userId, 
    format, 
    eventCount: sessions.length 
  });

  res.send(content);
};

/**
 * Get session participants filtered by status
 * Leverages the composite index [sessionId, status] for optimal performance
 */
export const getEventParticipantsByStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.query;

  // Verify user is a member of the group that owns this session
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
    }
  });

  if (!session) {
    throw new NotFoundError('Event not found');
  }

  // Build where clause to leverage composite index [sessionId, status]
  const where: Record<string, unknown> = { sessionId: id };
  const validStatuses = Object.values(SessionParticipantStatus);
  if (status && validStatuses.includes(status as SessionParticipantStatus)) {
    where.status = status; // Uses composite index [sessionId, status]
  }

  // Get participants with optimal query using composite index
  const participants = await prisma.sessionParticipant.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePicture: true,
          city: true,
          country: true
        }
      }
    },
    orderBy: {
      joinedAt: 'asc'  // Use joinedAt index for sorting
    }
  });

  // Get counts by status for summary
  const statusCounts = await prisma.sessionParticipant.groupBy({
    by: ['status'],
    where: { sessionId: id },
    _count: true
  });

  // Calculate totals
  const totalAllStatuses = statusCounts.reduce((sum, sc) => sum + sc._count, 0);
  
  const summary = {
    total: totalAllStatuses,  // Total of ALL participants regardless of filter
    filtered: participants.length,  // Number of participants matching the filter
    byStatus: Object.fromEntries(
      statusCounts.map(sc => [sc.status, sc._count])
    )
  };

  res.json({
    participants,
    summary,
    filter: status || 'all'
  });
};

/**
 * Helper function to verify session creator authorization for guest management
 * Returns the session and guest participant if authorization succeeds
 */
const verifyGuestManagementAuth = async (
  sessionId: string,
  guestId: string,
  userId: string
): Promise<{ session: unknown; guest: unknown } | { error: string; status: number }> => {
  // Check if user is the creator of the session
  const session = await prisma.session.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    return { error: 'Event not found', status: 404 };
  }

  if (session.creatorId !== userId) {
    return { error: 'Only the session creator can manage guest participants', status: 403 };
  }

  // Verify guest participant belongs to this session
  const guest = await prisma.guestParticipant.findFirst({
    where: {
      id: guestId,
      sessionId: sessionId
    }
  });

  if (!guest) {
    return { error: 'Guest participant not found', status: 404 };
  }

  return { session, guest };
};

/**
 * Update guest participant name
 * Allows the session creator to update a guest's name
 */
export const updateGuestParticipant = async (req: Request, res: Response) => {
  const { id, guestId } = req.params;
  const { name } = req.body;

  if (!name || name.trim().length === 0) {
    throw new BadRequestError('Name is required');
  }

  // Sanitize guest name
  const sanitizedName = sessionService.sanitizeGuestName(name);

  // Verify authorization and get guest
  const authResult = await verifyGuestManagementAuth(id, guestId, req.user!.id);
  if ('error' in authResult) {
    if (authResult.status === 404) {
      throw new NotFoundError(authResult.error);
    }
    throw new ForbiddenError(authResult.error);
  }

  // Update guest participant name
  const updatedGuest = await prisma.guestParticipant.update({
    where: { id: guestId },
    data: { name: sanitizedName }
  });

  // Invalidate events cache for all group members
  if (hasGroupId(authResult.session)) {
    await CacheService.deletePattern(`sessions:user:*:group:${authResult.session.groupId}:*`);
    await CacheService.deletePattern(`sessions:user:*:group:all:*`);
  }

  res.json(updatedGuest);
};

/**
 * Update guest participant status
 * Allows the session creator to update a guest's status (confirmed/declined)
 */
export const updateGuestParticipantStatus = async (req: Request, res: Response) => {
  const { id, guestId } = req.params;
  const { status } = req.body;

  // Validate status
  const validStatuses = Object.values(GuestParticipantStatus);
  if (!status || !validStatuses.includes(status as GuestParticipantStatus)) {
    throw new BadRequestError('Invalid status. Must be one of: confirmed, declined');
  }

  // Verify authorization and get guest
  const authResult = await verifyGuestManagementAuth(id, guestId, req.user!.id);
  if ('error' in authResult) {
    if (authResult.status === 404) {
      throw new NotFoundError(authResult.error);
    }
    throw new ForbiddenError(authResult.error);
  }

  // Update guest participant status
  const updatedGuest = await prisma.guestParticipant.update({
    where: { id: guestId },
    data: { status: status as GuestParticipantStatus }
  });

  // Invalidate events cache for all group members
  if (hasGroupId(authResult.session)) {
    await CacheService.deletePattern(`sessions:user:*:group:${authResult.session.groupId}:*`);
    await CacheService.deletePattern(`sessions:user:*:group:all:*`);
  }

  res.json(updatedGuest);
};

/**
 * Remove guest participant from session
 * Allows the session creator to remove a guest participant
 */
export const removeGuestParticipant = async (req: Request, res: Response) => {
  const { id, guestId } = req.params;

  // Verify authorization and get guest
  const authResult = await verifyGuestManagementAuth(id, guestId, req.user!.id);
  if ('error' in authResult) {
    if (authResult.status === 404) {
      throw new NotFoundError(authResult.error);
    }
    throw new ForbiddenError(authResult.error);
  }

  // Delete guest participant
  await prisma.guestParticipant.delete({
    where: { id: guestId }
  });

  // Invalidate events cache for all group members
  if (hasGroupId(authResult.session)) {
    await CacheService.deletePattern(`sessions:user:*:group:${authResult.session.groupId}:*`);
    await CacheService.deletePattern(`sessions:user:*:group:all:*`);
  }

  res.json({ message: 'Guest participant removed successfully' });
};

/**
 * Get all guest participants for an session
 * Allows any group member to view guest participants with optional status filtering
 * Note: Uses group membership check (not session creator) to allow all group members to see guests
 */
export const getGuestParticipants = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.query;

  // Verify user is a member of the group that owns this session
  // This allows any group member to view guests, not just the creator
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
    }
  });

  if (!session) {
    throw new NotFoundError('Event not found');
  }

  // Build where clause
  const where: Record<string, unknown> = { sessionId: id };
  const validStatuses = Object.values(GuestParticipantStatus);
  if (status && validStatuses.includes(status as GuestParticipantStatus)) {
    where.status = status;
  }

  // Get guest participants
  const guestParticipants = await prisma.guestParticipant.findMany({
    where,
    orderBy: {
      joinedAt: 'asc'  // Use joinedAt index for sorting
    }
  });

  // Get counts by status for summary
  const statusCounts = await prisma.guestParticipant.groupBy({
    by: ['status'],
    where: { sessionId: id },
    _count: true
  });

  const summary = {
    total: statusCounts.reduce((sum, sc) => sum + sc._count, 0),
    filtered: guestParticipants.length,
    byStatus: Object.fromEntries(
      statusCounts.map(sc => [sc.status, sc._count])
    )
  };

  res.json({
    guestParticipants,
    summary,
    filter: status || 'all'
  });
};

/**
 * Invite a user to an session
 */
export const inviteToEvent = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email, customMessage, expiresInDays } = req.body;

  if (!email) {
    throw new BadRequestError('Email is required');
  }

  // Check if user has permission to invite using proper permission system
  const hasPermission = await permissionService.hasEventPermission(
    req.user!.id,
    id,
    Permission.EVENT_INVITE_MEMBERS
  );
  
  if (!hasPermission) {
    throw new ForbiddenError('You do not have permission to invite members to this session');
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

  // Get session and inviter details first
  const [session, inviter] = await Promise.all([
    prisma.session.findUnique({ where: { id } }),
    prisma.user.findUnique({ where: { id: req.user!.id } })
  ]);

  if (!session || !inviter) {
    throw new NotFoundError('Event or inviter not found');
  }

  // Calculate expiration
  const expiresAt = expiresInDays 
    ? calculateExpirationDate(expiresInDays)
    : undefined;

  // Use transaction to prevent race conditions
  await prisma.$transaction(async (tx) => {
    // Check if user is already a participant
    const existingParticipant = await tx.eventParticipant.findUnique({
      where: {
        eventId_userId: {
          sessionId: id,
          userId: userToInvite.id
        }
      }
    });

    if (existingParticipant) {
      throw new BadRequestError('User is already a participant or has a pending invitation');
    }

    // Create session participant with pending status
    await tx.eventParticipant.create({
      data: {
        sessionId: id,
        userId: userToInvite.id,
        status: 'pending'
      }
    });

    // Create invite log
    await InviteService.createInviteLog({
      inviterType: 'session',
      entityId: id,
      inviterId: req.user!.id,
      inviteeEmail: userToInvite.email,
      inviteeId: userToInvite.id,
      status: 'sent',
      message: customMessage,
      expiresAt
    });
  });

  // Send invitation email
  await InviteService.sendInvitationEmail({
    recipientName: userToInvite.name,
    recipientEmail: userToInvite.email,
    inviterName: inviter.name,
    resourceId: id,
    resourceName: session.title,
    resourceDescription: session.description || undefined,
    resourceType: 'session',
    actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/events/${id}`,
    customMessage,
    expiresAt
  });

  res.status(201).json({
    message: 'Invitation sent successfully'
  });
};

/**
 * Revoke an session invitation
 */
export const revokeEventInvitation = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email } = req.body;

  if (!email) {
    throw new BadRequestError('Email is required');
  }

  // Check if user has permission to revoke invites
  const hasPermission = await permissionService.hasEventPermission(
    req.user!.id, 
    id, 
    Permission.EVENT_REVOKE_INVITES
  );

  if (!hasPermission) {
    throw new ForbiddenError('You do not have permission to revoke session invitations');
  }

  const result = await InviteService.revokeInvitation('session', id, email, req.user!.id);

  if (!result.success) {
    throw new BadRequestError(result.error || 'Failed to revoke invitation');
  }

  res.json({
    message: 'Invitation revoked successfully'
  });
};

/**
 * Get invite analytics for an session
 */
export const getEventInviteAnalytics = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user has permission to view analytics
  const hasPermission = await permissionService.hasEventPermission(
    req.user!.id, 
    id, 
    Permission.EVENT_VIEW_INVITE_ANALYTICS
  );

  if (!hasPermission) {
    throw new ForbiddenError('You do not have permission to view session invite analytics');
  }

  const analytics = await InviteService.getInviteAnalytics('session', id);

  res.json({
    analytics
  });
};

/**
 * Generate a new invite token for the session
 */
export const generateEventInviteToken = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { expiresInDays = 30 } = req.body;

  // Check if user has permission to manage invites
  const hasPermission = await permissionService.hasEventPermission(
    req.user!.id, 
    id, 
    Permission.EVENT_INVITE_MEMBERS
  );

  if (!hasPermission) {
    throw new ForbiddenError('You do not have permission to generate invite tokens');
  }

  const result = await InviteService.generateInviteToken('session', id, expiresInDays);

  if (!result.success) {
    throw new BadRequestError(result.error || 'Failed to generate invite token');
  }

  res.json({
    message: 'Invite token generated successfully',
    token: result.token,
    expiresAt: result.expiresAt
  });
};
