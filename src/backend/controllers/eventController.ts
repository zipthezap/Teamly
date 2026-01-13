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
import { BadRequestError, ForbiddenError } from '../utils/errors';
import { isRequired } from '../utils/validation';
import { ensureResourceExists } from '../utils/controllerHelpers';

export const createEvent = async (req: Request, res: Response) => {
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
    const coordValidation = locationService.validateCoordinates(parseFloat(latitude), parseFloat(longitude));
    if (!coordValidation.valid) {
      throw new BadRequestError(coordValidation.error!);
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
  const isAdmin = await groupService.checkGroupAdmin(groupId, (req.user as any).id);
  if (!isAdmin) {
    throw new ForbiddenError('Only group admins can create events for this group');
  }

  // Determine event status
  const eventStatus = eventService.determineEventStatus(startTime, endTime);

  // Get group members for notifications
  const group = await eventService.getGroupWithMembers(groupId);

  // Generate invite token if event is public
  const inviteToken = isPublic ? createInviteToken() : null;

  const event = await prisma.event.create({
    data: {
      groupId,
      creatorId: (req.user as any).id,
      title: sanitized.title!,
      description: sanitized.description,
      eventType: sanitized.eventType! as SportType,
      location: sanitized.location,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
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
          userId: (req.user as any).id,
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
  const memberIds = group.members.map(m => m.user.id).filter(uid => uid !== (req.user as any).id);
  await eventService.createEventNotifications(group.id, event.title, (req.user as any).name, group.name, memberIds);

  res.status(201).json(enrichedEvent);
};

export const getEvents = async (req: Request, res: Response) => {
  const { 
    groupId, search, eventType, startDate, endDate, location, status, archived,
    limit = '50', offset = '0', cursor
  } = req.query;

  const userId = (req.user as any).id;
  
  // Parse and validate pagination parameters
  const parsedLimit = parseInt(limit as string, 10);
  const parsedOffset = parseInt(offset as string, 10);
  
  // Validate parsed values and apply defaults/caps
  const validatedLimit = isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100);
  const validatedOffset = isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);

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

    // Return paginated response with metadata
    res.json({
      data: enrichedEvents,
      pagination: {
        limit: validatedLimit,
        offset: validatedOffset,
        total: enrichedEvents.length,
        hasMore: events.length === validatedLimit,
        nextCursor
      }
    });
};

export const getEvent = async (req: Request, res: Response) => {
  const { id } = req.params;

  const event = await prisma.event.findFirst({
    where: {
      id,
      group: {
        members: {
          some: {
            userId: (req.user as any).id
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
    const coordValidation = locationService.validateCoordinates(parseFloat(latitude), parseFloat(longitude));
    if (!coordValidation.valid) {
      throw new BadRequestError(coordValidation.error!);
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
  const { isAuthorized } = await eventService.checkEventManagementPermission(event!, (req.user as any).id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the event creator or group admins can update it');
  }

  const updatedEvent = await prisma.event.update({
    where: { id },
    data: {
      ...(sanitized.title && { title: sanitized.title }),
      ...(sanitized.description !== undefined && { description: sanitized.description }),
      ...(sanitized.eventType && { eventType: sanitized.eventType as SportType }),
      ...(sanitized.location !== undefined && { location: sanitized.location }),
      ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
      ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
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
    (updatedEvent as any).participants,
    (req.user as any).id,
    'eventUpdates',
    'eventUpdate',
    updatedEvent.title,
    event!.group.name
  );

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
  const { isAuthorized } = await eventService.checkEventManagementPermission(event!, (req.user as any).id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the event creator or group admins can delete it');
  }

  // Send email notifications to participants
  await eventService.sendEventEmailNotifications(
    event!.participants,
    (req.user as any).id,
    'eventCancellations',
    'eventCancellation',
    event!.title,
    event!.group.name
  );

  await prisma.event.delete({
    where: { id }
  });

  res.json({ message: 'Event deleted successfully' });
};

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
                userId: (req.user as any).id
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
            userId: (req.user as any).id
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
          userId: (req.user as any).id,
          status: 'confirmed'
        }
      });

      // Log activity for the user who joined
      await tx.eventNotification.create({
        data: {
          eventId: id,
          userId: (req.user as any).id,
          type: 'join',
          params: {
            name: (req.user as any).name,
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

      return { participant, eventTitle: event.title };
    }, {
      isolationLevel: 'Serializable', // Highest isolation level to prevent race conditions
      maxWait: TRANSACTION.MAX_WAIT_MS,
      timeout: TRANSACTION.TIMEOUT_MS
    });

    res.status(201).json(result.participant);
  } catch (error: any) {
    logger.error('Join event error', 'EventController', { error });
    
    // Handle specific error cases
    if (error.message === 'EVENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (error.message === 'ALREADY_JOINED') {
      return res.status(400).json({ error: 'Already joined this event' });
    }
    if (error.message === 'EVENT_FULL') {
      return res.status(400).json({ error: 'Event is full' });
    }
    
    // Handle unique constraint violations
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Already joined this event' });
    }
    
    res.status(500).json({ error: 'Failed to join event' });
  }
};

export const leaveEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get event to find the organizer
    const event = await prisma.event.findUnique({
      where: { id },
      select: { creatorId: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const participant = await prisma.eventParticipant.findFirst({
      where: {
        eventId: id,
        userId: (req.user as any).id
      }
    });

    if (!participant) {
      return res.status(404).json({ error: 'Not participating in this event' });
    }

    // Delete participant and attendance records
    await prisma.$transaction([
      prisma.eventParticipant.delete({
        where: { id: participant.id }
      }),
      // Also delete the attendance record (late status) when leaving
      prisma.eventAttendance.deleteMany({
        where: {
          eventId: id,
          userId: (req.user as any).id
        }
      })
    ]);

    // Log activity for the user who left
    // First get the event details
    const leftEvent = await prisma.event.findUnique({
      where: { id },
      select: { 
        title: true, 
        eventType: true, 
        startTime: true,
        groupId: true 
      }
    });

    if (leftEvent) {
      await prisma.eventNotification.create({
        data: {
          eventId: id,
          userId: (req.user as any).id,
          type: 'leave',
          params: {
            name: (req.user as any).name,
            eventTitle: leftEvent.title
          },
          metadata: {
            eventType: leftEvent.eventType,
            eventStartTime: leftEvent.startTime,
            groupId: leftEvent.groupId
          }
        }
      });
    }

    res.json({ message: 'Left event successfully' });
  } catch (error) {
    logger.error('Failed to leave event', 'EventController', { error });
    res.status(500).json({ error: 'Failed to leave event' });
  }
};

export const updateParticipationStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'confirmed', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const participant = await prisma.eventParticipant.findFirst({
      where: {
        eventId: id,
        userId: (req.user as any).id
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
            userId: (req.user as any).id,
            type: status,
            params: {
              name: (req.user as any).name,
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
      }
    }

    res.json(updatedParticipant);
  } catch (error) {
    logger.error('Update participation status error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to update participation status' });
  }
};

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
              userId: (req.user as any).id
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
    let exceptionDates: any = [];
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
    const { isAuthorized } = await eventService.checkEventManagementPermission(event, (req.user as any).id);
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
    const { isAuthorized } = await eventService.checkEventManagementPermission(event, (req.user as any).id);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the event creator or group admins can remove exceptions' });
    }

    // Get existing exceptions
    const existingExceptions = event.exceptionDates 
      ? JSON.parse(JSON.stringify(event.exceptionDates))
      : [];

    // Remove exception
    const updatedExceptions = existingExceptions.filter(
      d => new Date(d).toISOString() !== new Date(exceptionDate).toISOString()
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

// Get user event statistics
export const getUserStatistics = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
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
  try {
    const { id } = req.params;

    // Check if user is the creator of the event or a group admin
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user has permission to manage this event
    const { isAuthorized } = await eventService.checkEventManagementPermission(event, (req.user as any).id);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the event creator or group admins can archive it' });
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: { archived: true }
    });

    res.json({ message: 'Event archived successfully', event: updatedEvent });
  } catch (error) {
    logger.error('Archive event error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to archive event' });
  }
};

// Unarchive an event
export const unarchiveEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user is the creator of the event or a group admin
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user has permission to manage this event
    const { isAuthorized } = await eventService.checkEventManagementPermission(event, (req.user as any).id);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the event creator or group admins can unarchive it' });
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: { archived: false }
    });

    res.json({ message: 'Event unarchived successfully', event: updatedEvent });
  } catch (error) {
    logger.error('Unarchive event error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to unarchive event' });
  }
};

// Update event status
export const updateEventStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status using the centralized validation function
    const statusValidation = validateEventStatus(status);
    if (!statusValidation.isValid) {
      return res.status(400).json({ error: statusValidation.error });
    }

    // Check if user is the creator of the event or a group admin
    const event = await prisma.event.findUnique({
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
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user has permission to manage this event
    const { isAuthorized } = await eventService.checkEventManagementPermission(event, (req.user as any).id);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the event creator or group admins can update event status' });
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: { status }
    });

    // Create notifications for participants about status change
    const participantIds = event.participants
      .filter(p => p.userId !== (req.user as any).id)
      .map(p => p.userId);
    
    await Promise.all(participantIds.map(userId =>
      prisma.eventNotification.create({
        data: {
          eventId: id,
          userId,
          type: 'status_change',
          params: {
            name: (req.user as any).name,
            eventTitle: event.title,
            newStatus: status,
            oldStatus: event.status
          },
          metadata: { newStatus: status, oldStatus: event.status }
        }
      })
    ));

    res.json({ message: 'Event status updated successfully', event: updatedEvent });
  } catch (error) {
    logger.error('Update event status error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to update event status' });
  }
};

// Get event activity with optional filtering
export const getEventActivityFeed = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, limit, startDate, endDate } = req.query;

    // Check if user has access to the event
    const event = await prisma.event.findFirst({
      where: {
        id,
        group: {
          members: {
            some: {
              userId: (req.user as any).id
            }
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found or access denied' });
    }

    const options: any = {
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
  } catch (error) {
    logger.error('Failed to get event activity', 'EventController', { error });
    res.status(500).json({ error: 'Failed to get event activity' });
  }
};

// Get event by invite token (no authentication required)
// Note: This endpoint allows access to both public AND private events via invite token.
// This is intentional - private events with invite tokens are shared privately via the link,
// which provides controlled access without making the event publicly discoverable.
export const getEventByInviteToken = async (req: Request, res: Response) => {
  try {
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
      return res.status(404).json({ error: 'Event not found or invite link is invalid' });
    }

    res.json(event);
  } catch (error) {
    logger.error('Get event by invite token error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to get event' });
  }
};

// Generate or regenerate invite token for an event
export const generateInviteToken = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user is the creator of the event or a group admin
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user has permission to manage this event
    const { isAuthorized } = await eventService.checkEventManagementPermission(event, (req.user as any).id);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the event creator or group admins can generate invite links' });
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
  } catch (error) {
    logger.error('Generate invite token error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to generate invite token' });
  }
};

// Join event as guest (no authentication required)
export const joinEventAsGuest = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Use a transaction with serializable isolation to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Find event by invite token
      const event = await tx.event.findFirst({
        where: {
          inviteToken: token
        }
      });

      if (!event) {
        throw new Error('EVENT_NOT_FOUND');
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
          throw new Error('EVENT_FULL');
        }
      }

      // Create guest participant
      const guestParticipant = await tx.guestParticipant.create({
        data: {
          eventId: event.id,
          name: name.trim(),
          status: GuestParticipantStatus.confirmed
        }
      });

      return guestParticipant;
    }, {
      isolationLevel: 'Serializable', // Highest isolation level to prevent race conditions
      maxWait: TRANSACTION.MAX_WAIT_MS,
      timeout: TRANSACTION.TIMEOUT_MS
    });

    res.status(201).json({ 
      message: 'Successfully joined event',
      participant: result
    });
  } catch (error: any) {
    logger.error('Join event as guest error', 'EventController', { error });
    
    // Handle specific error cases
    if (error.message === 'EVENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Event not found or invite link is invalid' });
    }
    if (error.message === 'EVENT_FULL') {
      return res.status(400).json({ error: 'Event is full' });
    }
    
    res.status(500).json({ error: 'Failed to join event' });
  }
};

// Get nearby events based on location and radius
export const getNearbyEvents = async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, radius = 10, limit = 50 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const lat = parseFloat(latitude as string);
    const lon = parseFloat(longitude as string);
    const radiusKm = parseFloat(radius as string);

    // Validate coordinates
    const coordValidation = locationService.validateCoordinates(lat, lon);
    if (!coordValidation.valid) {
      return res.status(400).json({ error: coordValidation.error });
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
  } catch (error) {
    logger.error('Get nearby events error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to get nearby events' });
  }
};

/**
 * Export user's events to various formats
 */
export const exportEvents = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const format = (req.query.format as string)?.toLowerCase() || 'csv';
    
    // Validate format
    if (!['csv', 'ical', 'json'].includes(format)) {
      return res.status(400).json({ 
        error: 'Invalid format. Supported formats: csv, ical, json' 
      });
    }

    logger.info('Exporting events', 'EventController', { userId, format });

    // Fetch all events user is participating in
    const events = await prisma.event.findMany({
      where: {
        participants: {
          some: {
            userId: userId
          }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
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
        participantCount: event.participants.length,
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
        return res.status(400).json({ error: 'Invalid format' });
    }

    // Set headers for file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(content));
    
    logger.info('Events exported successfully', 'EventController', { 
      userId, 
      format, 
      eventCount: events.length 
    });

    res.send(content);
  } catch (error) {
    logger.error('Export events error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to export events' });
  }
};

/**
 * Get event participants filtered by status
 * Leverages the composite index [eventId, status] for optimal performance
 */
export const getEventParticipantsByStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.query;

    // Verify user is a member of the group that owns this event
    const event = await prisma.event.findFirst({
      where: {
        id,
        group: {
          members: {
            some: {
              userId: (req.user as any).id
            }
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Build where clause to leverage composite index [eventId, status]
    const where: any = { eventId: id };
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
  } catch (error) {
    logger.error('Get event participants by status error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to get event participants' });
  }
};

/**
 * Helper function to verify event creator authorization for guest management
 * Returns the event and guest participant if authorization succeeds
 */
const verifyGuestManagementAuth = async (
  eventId: string,
  guestId: string,
  userId: string
): Promise<{ event: any; guest: any } | { error: string; status: number }> => {
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
  try {
    const { id, guestId } = req.params;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Verify authorization and get guest
    const authResult = await verifyGuestManagementAuth(id, guestId, (req.user as any).id);
    if ('error' in authResult) {
      return res.status(authResult.status).json({ error: authResult.error });
    }

    // Update guest participant name
    const updatedGuest = await prisma.guestParticipant.update({
      where: { id: guestId },
      data: { name: name.trim() }
    });

    res.json(updatedGuest);
  } catch (error) {
    logger.error('Update guest participant error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to update guest participant' });
  }
};

/**
 * Update guest participant status
 * Allows the event creator to update a guest's status (confirmed/declined)
 */
export const updateGuestParticipantStatus = async (req: Request, res: Response) => {
  try {
    const { id, guestId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = Object.values(GuestParticipantStatus);
    if (!status || !validStatuses.includes(status as GuestParticipantStatus)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be one of: confirmed, declined' 
      });
    }

    // Verify authorization and get guest
    const authResult = await verifyGuestManagementAuth(id, guestId, (req.user as any).id);
    if ('error' in authResult) {
      return res.status(authResult.status).json({ error: authResult.error });
    }

    // Update guest participant status
    const updatedGuest = await prisma.guestParticipant.update({
      where: { id: guestId },
      data: { status: status as GuestParticipantStatus }
    });

    res.json(updatedGuest);
  } catch (error) {
    logger.error('Update guest participant status error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to update guest participant status' });
  }
};

/**
 * Remove guest participant from event
 * Allows the event creator to remove a guest participant
 */
export const removeGuestParticipant = async (req: Request, res: Response) => {
  try {
    const { id, guestId } = req.params;

    // Verify authorization and get guest
    const authResult = await verifyGuestManagementAuth(id, guestId, (req.user as any).id);
    if ('error' in authResult) {
      return res.status(authResult.status).json({ error: authResult.error });
    }

    // Delete guest participant
    await prisma.guestParticipant.delete({
      where: { id: guestId }
    });

    res.json({ message: 'Guest participant removed successfully' });
  } catch (error) {
    logger.error('Remove guest participant error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to remove guest participant' });
  }
};

/**
 * Get all guest participants for an event
 * Allows any group member to view guest participants with optional status filtering
 * Note: Uses group membership check (not event creator) to allow all group members to see guests
 */
export const getGuestParticipants = async (req: Request, res: Response) => {
  try {
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
              userId: (req.user as any).id
            }
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Build where clause
    const where: any = { eventId: id };
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
  } catch (error) {
    logger.error('Get guest participants error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to get guest participants' });
  }
};
