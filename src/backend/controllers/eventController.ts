/**
 * Event Controller
 * 
 * This controller manages all event-related operations including:
 * - Event CRUD operations (create, read, update, delete, archive, status)
 * - Event participation (join, leave, update status)
 * - Guest participant management
 * - Recurring events management
 * - Event queries (nearby, statistics, activity feed)
 * - Event export functionality
 */

import prisma from '../config/database';
import { generateRecurrenceInstances, calculateDuration, applyDuration } from '../utils/recurrenceService';
import { getEventActivity } from '../services/eventNotification';
import { validateEventStatus } from '../services/eventValidation';
import { logger } from '../utils/logger';
import { Request, Response } from 'express';
import { createInviteToken } from '../utils/inviteToken';
import { TRANSACTION } from '../config/security';
import * as eventService from '../services/eventService';
import { EventParticipantStatus, GuestParticipantStatus, SportType } from '../../shared/types/event.types';
import * as groupService from '../services/groupService';
import * as locationService from '../services/locationService';
import { exportToCSV, exportToICalendar, exportToJSON } from '../services/exportService';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { isRequired, parseCoordinates, parseFloatStrict } from '../utils/validation';
import { isPrismaUniqueError, hasGroupId } from '../utils/typeGuards';
import { ensureResourceExists } from '../utils/controllerHelpers';
import { CacheService } from '../services/cacheService';

// ==================== EVENT CRUD OPERATIONS ====================

export const createEvent = async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
  const { 
    groupId, title, description, eventType, location, startTime, endTime, maxPlayers,
    isRecurring, recurrenceRule, recurrenceEnd, isPublic,
    latitude, longitude, locationName, city, country
  } = req.body;

  // Validate required fields
  isRequired(groupId, 'Group ID');
  isRequired(title, 'Title');
  isRequired(eventType, 'Event type');
  isRequired(startTime, 'Start time');

  // Sanitize text inputs
  const sanitized = eventService.sanitizeEventData({
    title,
    description,
    eventType,
    location
  });

  // Validate sanitized required fields are not empty
  if (!sanitized.title || !sanitized.eventType) {
    throw new BadRequestError('Title and event type cannot be empty or whitespace-only');
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

  // Validate event times
  const timeValidation = eventService.validateEventTimes(startTime, endTime);
  if (!timeValidation.valid) {
    throw new BadRequestError(timeValidation.error!);
  }

  // Validate recurrence rule if provided
  const recurrenceValidation = eventService.validateRecurrence(isRecurring, recurrenceRule);
  if (!recurrenceValidation.valid) {
    throw new BadRequestError(recurrenceValidation.error!);
  }

  // Check if user is admin of the group
  const isAdmin = await groupService.checkGroupAdmin(groupId, req.user!.id);
  if (!isAdmin) {
    throw new ForbiddenError('Only group admins can create events for this group');
  }

  // Determine event status
  const eventStatus = eventService.determineEventStatus(startTime, endTime);

  // Get group members for notifications
  const group = await eventService.getGroupWithMembers(groupId);

  // Generate invite token if event is public
  const inviteToken = isPublic ? createInviteToken() : null;

  // Parse coordinates once if provided
  const coordinates = latitude && longitude ? parseCoordinates(latitude, longitude) : null;

  const event = await prisma.event.create({
    data: {
      groupId,
      creatorId: req.user!.id,
      title: sanitized.title!,
      description: sanitized.description,
      eventType: sanitized.eventType! as SportType,
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
          status: EventParticipantStatus.confirmed
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

  // Enrich event with location info if coordinates are available
  const enrichedEvent = locationService.enrichWithLocationInfo(event);

  // Send global notification to group members (except creator)
  const memberIds = group.members.map(m => m.userId).filter(uid => uid !== req.user!.id);
  await eventService.createEventNotifications(group.id, event.title, req.user!.name, group.name, memberIds);

  // Invalidate events cache for all group members
  await CacheService.deletePattern(`events:user:*:group:${groupId}:*`);
  await CacheService.deletePattern(`events:user:*:group:all:*`);

  res.status(201).json(enrichedEvent);
};

export const getEvents = async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
  const { 
    groupId, search, eventType, startDate, endDate, location, status, archived,
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
  const hasFilters = search || eventType || startDate || endDate || location || status || archived;
  const cacheKey = !hasFilters && !cursor 
    ? `events:user:${userId}:group:${groupId || 'all'}:limit:${validatedLimit}:offset:${validatedOffset}`
    : null;

  // Try cache for simple queries
  if (cacheKey) {
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
  }

  // Build where filter using service
  const where = eventService.buildEventFilters(userId, {
    groupId: groupId as string,
    search: search as string,
    eventType: eventType as string,
    startDate: startDate as string,
    endDate: endDate as string,
    location: location as string,
    status: status as string,
    archived: archived as string
  });

  // Add cursor-based pagination if cursor is provided
  if (cursor) {
    where.id = { gt: cursor as string };
  }

  // Optimize query - get participant info separately for large result sets
  const events = await prisma.event.findMany({
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
    });

    // Get participant data only for returned events (batch query)
    const eventIds = events.map(e => e.id);
    const participants = await prisma.eventParticipant.findMany({
      where: { 
        eventId: { in: eventIds }
      },
      select: {
        id: true,
        userId: true,
        status: true,
        joinedAt: true,
        eventId: true,
        user: {
          select: { id: true, name: true, profilePicture: true }
        }
      }
    });

    // Get attendance data for returned events (batch query)
    const attendances = await prisma.eventAttendance.findMany({
      where: {
        eventId: { in: eventIds }
      },
      select: {
        id: true,
        userId: true,
        status: true,
        updatedAt: true,
        eventId: true
      }
    });

    // Map participants and attendances to events
    const participantsByEvent = new Map<string, typeof participants[number][]>();
    const attendancesByEvent = new Map<string, typeof attendances[number][]>();
    
    participants.forEach(p => {
      if (!participantsByEvent.has(p.eventId)) {
        participantsByEvent.set(p.eventId, []);
      }
      participantsByEvent.get(p.eventId)!.push(p);
    });

    attendances.forEach(a => {
      if (!attendancesByEvent.has(a.eventId)) {
        attendancesByEvent.set(a.eventId, []);
      }
      attendancesByEvent.get(a.eventId)!.push(a);
    });

    // Attach participants and attendances to events
    const eventsWithParticipants = events.map(event => ({
      ...event,
      participants: participantsByEvent.get(event.id) || [],
      eventAttendances: attendancesByEvent.get(event.id) || []
    }));

    // Sort events by priority (in-memory for this page of results only)
    // 1. Events user joined + private (from groups user is in)
    // 2. Events user joined + public
    // 3. Other events (not joined)
    const eventsWithJoinStatus = eventsWithParticipants.map(event => {
      const participantIds = new Set(event.participants.map(p => p.userId));
      return {
        event,
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
      
      const aPriority = getPriority(a.isJoined, a.event.isPublic);
      const bPriority = getPriority(b.isJoined, b.event.isPublic);
      
      // First sort by priority
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Within same priority, sort by start time
      return new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime();
    }).map(item => item.event);

    // Enrich with location info
    const enrichedEvents = sortedEvents.map(event => 
      locationService.enrichWithLocationInfo(event)
    );

    // Calculate next cursor for cursor-based pagination
    const nextCursor = events.length === validatedLimit ? events[events.length - 1].id : null;

    const response = {
      data: enrichedEvents,
      pagination: {
        limit: validatedLimit,
        offset: validatedOffset,
        total: enrichedEvents.length,
        hasMore: events.length === validatedLimit,
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

  const event = await prisma.event.findFirst({
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

  ensureResourceExists(event, 'Event');

  const enrichedEvent = locationService.enrichWithLocationInfo(event!);

  res.json(enrichedEvent);
};

export const updateEvent = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, eventType, location, startTime, endTime, maxPlayers, isPublic,
          latitude, longitude, locationName, city, country } = req.body;

  // Sanitize text inputs
  const sanitized = eventService.sanitizeEventData({
    title,
    description,
    eventType,
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
    const timeValidation = eventService.validateEventTimes(startTime, endTime);
    if (!timeValidation.valid) {
      throw new BadRequestError(timeValidation.error!);
    }
  }

  // Check if user is the creator of the event or a group admin
  const event = await prisma.event.findUnique({
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

  ensureResourceExists(event, 'Event');

  // Check if user has permission to manage this event
  const { isAuthorized } = await eventService.checkEventManagementPermission(event!, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the event creator or group admins can update it');
  }

  // Parse coordinates once if both are provided
  const updateCoordinates = latitude !== undefined && longitude !== undefined && latitude && longitude 
    ? parseCoordinates(latitude, longitude) 
    : null;

  const updatedEvent = await prisma.event.update({
    where: { id },
    data: {
      ...(sanitized.title && { title: sanitized.title }),
      ...(sanitized.description !== undefined && { description: sanitized.description }),
      ...(sanitized.eventType && { eventType: sanitized.eventType as SportType }),
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

  // Enrich event with location info if coordinates are available
  const enrichedEvent = locationService.enrichWithLocationInfo(updatedEvent);

  // Send email notifications to participants
  await eventService.sendEventEmailNotifications(
    updatedEvent.participants,
    req.user!.id,
    'eventUpdates',
    'eventUpdate',
    updatedEvent.title,
    event!.group.name
  );

  // Invalidate events cache
  await CacheService.deletePattern(`events:user:*:group:${event!.groupId}:*`);
  await CacheService.deletePattern(`events:user:*:group:all:*`);

  res.json(enrichedEvent);
};

export const deleteEvent = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user is the creator of the event or a group admin
  const event = await prisma.event.findUnique({
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

  ensureResourceExists(event, 'Event');

  // Check if user has permission to manage this event
  const { isAuthorized } = await eventService.checkEventManagementPermission(event!, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the event creator or group admins can delete it');
  }

  // Send email notifications to participants
  await eventService.sendEventEmailNotifications(
    event!.participants,
    req.user!.id,
    'eventCancellations',
    'eventCancellation',
    event!.title,
    event!.group.name
  );

  await prisma.event.delete({
    where: { id }
  });

  // Invalidate events cache
  await CacheService.deletePattern(`events:user:*:group:${event!.groupId}:*`);
  await CacheService.deletePattern(`events:user:*:group:all:*`);

  res.json({ message: 'Event deleted successfully' });
};

// ==================== EVENT PARTICIPATION OPERATIONS ====================

export const joinEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Use a transaction with serializable isolation to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Lock the event row for update to prevent concurrent modifications
      const event = await tx.event.findFirst({
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

      if (!event) {
        throw new Error('EVENT_NOT_FOUND');
      }

      // Check if already joined (database constraint will also catch this)
      const existingParticipant = await tx.eventParticipant.findUnique({
        where: {
          eventId_userId: {
            eventId: id,
            userId: req.user!.id
          }
        }
      });

      if (existingParticipant) {
        throw new Error('ALREADY_JOINED');
      }

      // Check max players with accurate count
      if (event.maxPlayers) {
        const confirmedCount = event.participants.length;
        
        // Also count confirmed guest participants
        const guestCount = await tx.guestParticipant.count({
          where: {
            eventId: id,
            status: GuestParticipantStatus.confirmed
          }
        });

        const totalConfirmed = confirmedCount + guestCount;
        
        if (totalConfirmed >= event.maxPlayers) {
          throw new Error('EVENT_FULL');
        }
      }

      // Create participant
      const participant = await tx.eventParticipant.create({
        data: {
          eventId: id,
          userId: req.user!.id,
          status: 'confirmed'
        }
      });

      // Log activity for the user who joined
      await tx.eventNotification.create({
        data: {
          eventId: id,
          userId: req.user!.id,
          type: 'join',
          params: {
            name: req.user!.name,
            eventTitle: event.title
          },
          metadata: {
            eventType: event.eventType,
            eventStartTime: event.startTime,
            groupId: event.groupId,
            participantCount: await tx.eventParticipant.count({
              where: { eventId: id, status: 'confirmed' }
            }),
            maxPlayers: event.maxPlayers
          }
        }
      });

      return { participant, eventTitle: event.title, groupId: event.groupId };
    }, {
      isolationLevel: 'Serializable', // Highest isolation level to prevent race conditions
      maxWait: TRANSACTION.MAX_WAIT_MS,
      timeout: TRANSACTION.TIMEOUT_MS
    });

    // Invalidate events cache for all group members
    await CacheService.deletePattern(`events:user:*:group:${result.groupId}:*`);
    await CacheService.deletePattern(`events:user:*:group:all:*`);

    res.status(201).json(result.participant);
  } catch (error: unknown) {
    logger.error('Join event error', 'EventController', { error });
    
    // Handle specific error cases
    const errorMessage = (error as Error).message;
    if (errorMessage === 'EVENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (errorMessage === 'ALREADY_JOINED') {
      return res.status(400).json({ error: 'Already joined this event' });
    }
    if (errorMessage === 'EVENT_FULL') {
      return res.status(400).json({ error: 'Event is full' });
    }
    
    // Handle unique constraint violations
    if (isPrismaUniqueError(error)) {
      return res.status(400).json({ error: 'Already joined this event' });
    }
    
    res.status(500).json({ error: 'Failed to join event' });
  }
};

export const leaveEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Get event details
      const event = await tx.event.findUnique({
        where: { id },
        select: { 
          creatorId: true,
          title: true, 
          eventType: true, 
          startTime: true,
          groupId: true 
        }
      });

      if (!event) {
        throw new Error('EVENT_NOT_FOUND');
      }

      const participant = await tx.eventParticipant.findFirst({
        where: {
          eventId: id,
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
          eventId: id,
          userId: req.user!.id
        }
      });

      // Log activity for the user who left
      await tx.eventNotification.create({
        data: {
          eventId: id,
          userId: req.user!.id,
          type: 'leave',
          params: {
            name: req.user!.name,
            eventTitle: event.title
          },
          metadata: {
            eventType: event.eventType,
            eventStartTime: event.startTime,
            groupId: event.groupId
          }
        }
      });

      return { groupId: event.groupId };
    });

    // Invalidate events cache for all group members
    await CacheService.deletePattern(`events:user:*:group:${result.groupId}:*`);
    await CacheService.deletePattern(`events:user:*:group:all:*`);

    res.json({ message: 'Left event successfully' });
  } catch (error: unknown) {
    logger.error('Failed to leave event', 'EventController', { error });
    
    // Handle specific error cases
    const errorMessage = (error as Error).message;
    if (errorMessage === 'EVENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (errorMessage === 'NOT_PARTICIPATING') {
      return res.status(404).json({ error: 'Not participating in this event' });
    }
    
    res.status(500).json({ error: 'Failed to leave event' });
  }
};

export const updateParticipationStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status using enum
    const validStatuses = Object.values(EventParticipantStatus);
    if (!status || !validStatuses.includes(status as EventParticipantStatus)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const participant = await prisma.eventParticipant.findFirst({
      where: {
        eventId: id,
        userId: req.user!.id
      }
    });

    if (!participant) {
      return res.status(404).json({ error: 'Not participating in this event' });
    }

    // Get the event to find the organizer
    // (event variable removed, not used)

    const updatedParticipant = await prisma.eventParticipant.update({
      where: { id: participant.id },
      data: { status }
    });

    // Log activity for the user who updated their status (only for confirmed/declined)
    if (status === 'confirmed' || status === 'declined') {
      // Get the event details
      const statusEvent = await prisma.event.findUnique({
        where: { id },
        select: { 
          title: true,
          eventType: true,
          startTime: true,
          groupId: true
        }
      });

      if (statusEvent) {
        await prisma.eventNotification.create({
          data: {
            eventId: id,
            userId: req.user!.id,
            type: status,
            params: {
              name: req.user!.name,
              eventTitle: statusEvent.title
            },
            metadata: {
              eventType: statusEvent.eventType,
              eventStartTime: statusEvent.startTime,
              groupId: statusEvent.groupId,
              previousStatus: participant.status
            }
          }
        });

        // Invalidate events cache when status changes
        await CacheService.deletePattern(`events:user:*:group:${statusEvent.groupId}:*`);
        await CacheService.deletePattern(`events:user:*:group:all:*`);
      }
    }

    res.json(updatedParticipant);
  } catch (error) {
    logger.error('Update participation status error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to update participation status' });
  }
};

// ==================== RECURRING EVENTS MANAGEMENT ====================

// Get recurring event instances
export const getRecurringEventInstances = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, limit } = req.query;

    // Get the parent event
    const event = await prisma.event.findFirst({
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

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!event.isRecurring || !event.recurrenceRule) {
      return res.status(400).json({ error: 'Event is not recurring' });
    }

    // Generate instances
    let start: Date;
    if (startDate instanceof Date) {
      start = startDate;
    } else if (typeof startDate === 'string') {
      start = new Date(startDate);
    } else {
      start = event.startTime;
    }
    // Ensure exceptionDates is defined and parsed
    let exceptionDates: string[] = [];
    if (event.exceptionDates) {
      exceptionDates = Array.isArray(event.exceptionDates)
        ? event.exceptionDates
        : JSON.parse(JSON.stringify(event.exceptionDates));
    }
    // Ensure endDate is a Date
    let end: Date;
    if (endDate instanceof Date) {
      end = endDate;
    } else if (typeof endDate === 'string') {
      end = new Date(endDate);
    } else {
      end = event.recurrenceEnd;
    }
    const instances = generateRecurrenceInstances(
      start,
      event.recurrenceRule,
      end,
      exceptionDates,
      limit ? parseInt(limit as string) : 100
    );

    // Calculate duration if endTime exists
    const duration = calculateDuration(event.startTime, event.endTime);

    // Map instances to event objects
    const eventInstances = instances.map(instanceDate => ({
      ...event,
      id: `${event.id}-${instanceDate.toISOString()}`,
      startTime: instanceDate,
      endTime: duration ? applyDuration(instanceDate, duration) : null,
      parentEventId: event.id,
      isInstance: true
    }));

    res.json(eventInstances);
  } catch (error) {
    logger.error('Failed to get recurring event instances', 'EventController', { error });
    res.status(500).json({ error: 'Failed to get recurring event instances' });
  }
};

// Add exception date to recurring event
export const addRecurringEventException = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { exceptionDate } = req.body;

    if (!exceptionDate) {
      return res.status(400).json({ error: 'Exception date is required' });
    }

    // Check if user is the creator of the event or a group admin
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user has permission to manage this event
    const { isAuthorized } = await eventService.checkEventManagementPermission(event, req.user!.id);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the event creator or group admins can add exceptions' });
    }

    if (!event.isRecurring) {
      return res.status(400).json({ error: 'Event is not recurring' });
    }

    // Get existing exceptions
    const existingExceptions = Array.isArray(event.exceptionDates) 
      ? [...event.exceptionDates] 
      : [];

    // Add new exception if not already present
    const exceptionDateISO = new Date(exceptionDate).toISOString();
    if (!existingExceptions.some((d: string) => new Date(d).toISOString() === exceptionDateISO)) {
      existingExceptions.push(exceptionDateISO);
    }

    // Update event with new exceptions
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        exceptionDates: existingExceptions
      }
    });

    res.json(updatedEvent);
  } catch (error) {
    logger.error('Add recurring event exception error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to add exception' });
  }
};

// Remove exception date from recurring event
export const removeRecurringEventException = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { exceptionDate } = req.body;

    if (!exceptionDate) {
      return res.status(400).json({ error: 'Exception date is required' });
    }

    // Check if user is the creator of the event or a group admin
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user has permission to manage this event
    const { isAuthorized } = await eventService.checkEventManagementPermission(event, req.user!.id);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the event creator or group admins can remove exceptions' });
    }

    // Get existing exceptions
    const existingExceptions = event.exceptionDates 
      ? JSON.parse(JSON.stringify(event.exceptionDates))
      : [];

    // Remove exception
    const updatedExceptions = existingExceptions.filter(
      (d: string | Date) => new Date(d).toISOString() !== new Date(exceptionDate).toISOString()
    );

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        exceptionDates: updatedExceptions
      }
    });

    res.json(updatedEvent);
  } catch (error) {
    logger.error('Failed to remove recurring event exception', 'EventController', { error });
    res.status(500).json({ error: 'Failed to remove exception' });
  }
};

// ==================== EVENT QUERIES & ANALYTICS ====================

// Get user event statistics
export const getUserStatistics = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const now = new Date();

    // Get all events where user is a participant
    const userParticipations = await prisma.eventParticipant.findMany({
      where: { userId },
      include: {
        event: {
          include: {
            group: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    // Get events created by user
    const createdEvents = await prisma.event.findMany({
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
      p => new Date(p.event.startTime) > now
    ).length;
    
    const pastEvents = userParticipations.filter(
      p => new Date(p.event.startTime) <= now
    ).length;

    const confirmedEvents = userParticipations.filter(
      p => p.status === 'confirmed'
    ).length;

    // Get event type breakdown
    const eventTypeBreakdown: Record<string, number> = {};
    userParticipations.forEach(p => {
      const type = p.event.eventType;
      eventTypeBreakdown[type] = (eventTypeBreakdown[type] || 0) + 1;
    });

    // Get upcoming events details (next 5)
    const upcomingEventsDetails = userParticipations
      .filter(p => new Date(p.event.startTime) > now)
      .sort((a, b) => new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime())
      .slice(0, 5)
      .map(p => ({
        id: p.event.id,
        title: p.event.title,
        eventType: p.event.eventType,
        startTime: p.event.startTime,
        group: p.event.group,
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
    res.status(500).json({ error: 'Failed to get statistics' });
  }
};

// Archive an event
export const archiveEvent = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user is the creator of the event or a group admin
  const event = ensureResourceExists(
    await prisma.event.findUnique({ where: { id } }),
    'Event'
  );

  // Check if user has permission to manage this event
  const { isAuthorized } = await eventService.checkEventManagementPermission(event, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the event creator or group admins can archive it');
  }

  const updatedEvent = await prisma.event.update({
    where: { id },
    data: { archived: true }
  });

  res.json({ message: 'Event archived successfully', event: updatedEvent });
};

// Unarchive an event
export const unarchiveEvent = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user is the creator of the event or a group admin
  const event = ensureResourceExists(
    await prisma.event.findUnique({ where: { id } }),
    'Event'
  );

  // Check if user has permission to manage this event
  const { isAuthorized } = await eventService.checkEventManagementPermission(event, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the event creator or group admins can unarchive it');
  }

  const updatedEvent = await prisma.event.update({
    where: { id },
    data: { archived: false }
  });

  res.json({ message: 'Event unarchived successfully', event: updatedEvent });
};

// Update event status
export const updateEventStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  // Validate status using the centralized validation function
  const statusValidation = validateEventStatus(status);
  if (!statusValidation.isValid) {
    throw new BadRequestError(statusValidation.error!);
  }

  // Check if user is the creator of the event or a group admin
  const event = ensureResourceExists(
    await prisma.event.findUnique({
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

  // Check if user has permission to manage this event
  const { isAuthorized } = await eventService.checkEventManagementPermission(event, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the event creator or group admins can update event status');
  }

  const updatedEvent = await prisma.event.update({
    where: { id },
    data: { status }
  });

  // Create notifications for participants about status change
  const participantIds = event.participants
    .filter(p => p.userId !== req.user!.id)
    .map(p => p.userId);
  
  await Promise.all(participantIds.map(userId =>
    prisma.eventNotification.create({
      data: {
        eventId: id,
        userId,
        type: 'status_change',
        params: {
          name: req.user!.name,
          eventTitle: event.title,
          newStatus: status,
          oldStatus: event.status
        },
        metadata: { newStatus: status, oldStatus: event.status }
      }
    })
  ));

  res.json({ message: 'Event status updated successfully', event: updatedEvent });
};

// Get event activity with optional filtering
export const getEventActivityFeed = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, limit, startDate, endDate } = req.query;

  // Check if user has access to the event
  const event = await prisma.event.findFirst({
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

  if (!event) {
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

  const activity = await getEventActivity(id, prisma, options);

  res.json({
    eventId: id,
    total: activity.length,
    activity
  });
};

// ==================== GUEST PARTICIPANT MANAGEMENT ====================

// Get event by invite token (no authentication required)
// Note: This endpoint allows access to both public AND private events via invite token.
// This is intentional - private events with invite tokens are shared privately via the link,
// which provides controlled access without making the event publicly discoverable.
export const getEventByInviteToken = async (req: Request, res: Response) => {
  const { token } = req.params;

  const event = await prisma.event.findFirst({
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

  if (!event) {
    throw new NotFoundError('Event not found or invite link is invalid');
  }

  res.json(event);
};

// Generate or regenerate invite token for an event
export const generateInviteToken = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user is the creator of the event or a group admin
  const event = ensureResourceExists(
    await prisma.event.findUnique({ where: { id } }),
    'Event'
  );

  // Check if user has permission to manage this event
  const { isAuthorized } = await eventService.checkEventManagementPermission(event, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the event creator or group admins can generate invite links');
  }

  // Generate new token
  const inviteToken = createInviteToken();

  // For private events, keep them private but allow invite link access
  // For public events, ensure they stay public
  const updatedEvent = await prisma.event.update({
    where: { id },
    data: { 
      inviteToken
    }
  });

  res.json({ 
    inviteToken: updatedEvent.inviteToken,
    inviteUrl: `/events/join/${updatedEvent.inviteToken}`,
    isPublic: updatedEvent.isPublic
  });
};

// Join event as guest (no authentication required)
export const joinEventAsGuest = async (req: Request, res: Response) => {
  const { token } = req.params;
  const { name } = req.body;

  if (!name || name.trim().length === 0) {
    throw new BadRequestError('Name is required');
  }

  // Sanitize guest name
  const sanitizedName = eventService.sanitizeGuestName(name);

  // Use a transaction with serializable isolation to prevent race conditions
  const result = await prisma.$transaction(async (tx) => {
    // Find event by invite token
    const event = await tx.event.findFirst({
      where: {
        inviteToken: token
      }
    });

    if (!event) {
      throw new NotFoundError('Event not found or invite link is invalid');
    }

    // Check max players with accurate count within transaction
    if (event.maxPlayers) {
      const confirmedParticipants = await tx.eventParticipant.count({
        where: {
          eventId: event.id,
          status: EventParticipantStatus.confirmed
        }
      });

      const confirmedGuests = await tx.guestParticipant.count({
        where: {
          eventId: event.id,
          status: GuestParticipantStatus.confirmed
        }
      });

      const totalConfirmed = confirmedParticipants + confirmedGuests;
      
      if (totalConfirmed >= event.maxPlayers) {
        throw new BadRequestError('Event is full');
      }
    }

    // Create guest participant
    const guestParticipant = await tx.guestParticipant.create({
      data: {
        eventId: event.id,
        name: sanitizedName,
        status: GuestParticipantStatus.confirmed
      }
    });

    return { guestParticipant, groupId: event.groupId };
  }, {
    isolationLevel: 'Serializable', // Highest isolation level to prevent race conditions
    maxWait: TRANSACTION.MAX_WAIT_MS,
    timeout: TRANSACTION.TIMEOUT_MS
  });

  // Invalidate events cache for all group members
  await CacheService.deletePattern(`events:user:*:group:${result.groupId}:*`);
  await CacheService.deletePattern(`events:user:*:group:all:*`);

  res.status(201).json({ 
    message: 'Successfully joined event',
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

  // Validate radius (max 100km to prevent excessive queries)
  if (radiusKm <= 0 || radiusKm > 100) {
    throw new BadRequestError('Radius must be between 0 and 100 kilometers');
  }

  // Get all events with location data
    const events = await prisma.event.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
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
      take: parseInt(limit as string) * 2 // Get more than needed for filtering
    });

    // Filter by location and add distance
    const nearbyEvents = locationService.filterByLocation(
      events,
      lat,
      lon,
      radiusKm
    ).slice(0, parseInt(limit as string)); // Limit after filtering

  // Enrich with location info
  const enrichedEvents = nearbyEvents.map(event => 
    locationService.enrichWithLocationInfo(event)
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
  const events = await prisma.event.findMany({
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
      eventType: true,
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
  const exportData = events.map(event => {
    const userParticipant = event.participants.find(p => p.userId === userId);
    
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      location: event.location,
      startTime: event.startTime,
      endTime: event.endTime,
      status: event.status,
      participantStatus: userParticipant?.status || 'unknown',
      groupName: event.group.name,
      creatorName: event.creator.name,
      participantCount: event._count.participants,
      maxPlayers: event.maxPlayers
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
    eventCount: events.length 
  });

  res.send(content);
};

/**
 * Get event participants filtered by status
 * Leverages the composite index [eventId, status] for optimal performance
 */
export const getEventParticipantsByStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.query;

  // Verify user is a member of the group that owns this event
  const event = await prisma.event.findFirst({
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

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Build where clause to leverage composite index [eventId, status]
  const where: Record<string, unknown> = { eventId: id };
  const validStatuses = Object.values(EventParticipantStatus);
  if (status && validStatuses.includes(status as EventParticipantStatus)) {
    where.status = status; // Uses composite index [eventId, status]
  }

  // Get participants with optimal query using composite index
  const participants = await prisma.eventParticipant.findMany({
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
  const statusCounts = await prisma.eventParticipant.groupBy({
    by: ['status'],
    where: { eventId: id },
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
 * Helper function to verify event creator authorization for guest management
 * Returns the event and guest participant if authorization succeeds
 */
const verifyGuestManagementAuth = async (
  eventId: string,
  guestId: string,
  userId: string
): Promise<{ event: unknown; guest: unknown } | { error: string; status: number }> => {
  // Check if user is the creator of the event
  const event = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!event) {
    return { error: 'Event not found', status: 404 };
  }

  if (event.creatorId !== userId) {
    return { error: 'Only the event creator can manage guest participants', status: 403 };
  }

  // Verify guest participant belongs to this event
  const guest = await prisma.guestParticipant.findFirst({
    where: {
      id: guestId,
      eventId: eventId
    }
  });

  if (!guest) {
    return { error: 'Guest participant not found', status: 404 };
  }

  return { event, guest };
};

/**
 * Update guest participant name
 * Allows the event creator to update a guest's name
 */
export const updateGuestParticipant = async (req: Request, res: Response) => {
  const { id, guestId } = req.params;
  const { name } = req.body;

  if (!name || name.trim().length === 0) {
    throw new BadRequestError('Name is required');
  }

  // Sanitize guest name
  const sanitizedName = eventService.sanitizeGuestName(name);

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
  if (hasGroupId(authResult.event)) {
    await CacheService.deletePattern(`events:user:*:group:${authResult.event.groupId}:*`);
    await CacheService.deletePattern(`events:user:*:group:all:*`);
  }

  res.json(updatedGuest);
};

/**
 * Update guest participant status
 * Allows the event creator to update a guest's status (confirmed/declined)
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
  if (hasGroupId(authResult.event)) {
    await CacheService.deletePattern(`events:user:*:group:${authResult.event.groupId}:*`);
    await CacheService.deletePattern(`events:user:*:group:all:*`);
  }

  res.json(updatedGuest);
};

/**
 * Remove guest participant from event
 * Allows the event creator to remove a guest participant
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
  if (hasGroupId(authResult.event)) {
    await CacheService.deletePattern(`events:user:*:group:${authResult.event.groupId}:*`);
    await CacheService.deletePattern(`events:user:*:group:all:*`);
  }

  res.json({ message: 'Guest participant removed successfully' });
};

/**
 * Get all guest participants for an event
 * Allows any group member to view guest participants with optional status filtering
 * Note: Uses group membership check (not event creator) to allow all group members to see guests
 */
export const getGuestParticipants = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.query;

  // Verify user is a member of the group that owns this event
  // This allows any group member to view guests, not just the creator
  const event = await prisma.event.findFirst({
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

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Build where clause
  const where: Record<string, unknown> = { eventId: id };
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
    where: { eventId: id },
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
