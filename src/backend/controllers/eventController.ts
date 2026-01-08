import prisma from '../config/database';
import { validateRecurrenceRule, generateRecurrenceInstances, calculateDuration, applyDuration } from '../utils/recurrenceService';
import { sendEmail } from '../utils/emailService';
import { batchShouldSendEmailNotification } from '../utils/notificationHelper';
import { getEventActivity } from '../services/eventNotification';
import { validateEventStatus } from '../services/eventValidation';
import { logger } from '../utils/logger';
import { Request, Response } from 'express';

export const createEvent = async (req: Request, res: Response) => {
  try {
    const { 
      groupId, title, description, eventType, location, startTime, endTime, maxPlayers,
      isRecurring, recurrenceRule, recurrenceEnd
    } = req.body;

    if (!groupId || !title || !eventType || !startTime) {
      return res.status(400).json({ error: 'Group ID, title, event type, and start time are required' });
    }

    // Validate that events are single-day only
    if (endTime) {
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      
      // Check if they're on the same day
      if (startDate.toDateString() !== endDate.toDateString()) {
        return res.status(400).json({ error: 'Events must be single-day only. Start and end times must be on the same day.' });
      }
      
      // Check that end time is after start time
      if (endDate <= startDate) {
        return res.status(400).json({ error: 'End time must be after start time.' });
      }
    }

    // Validate recurrence rule if provided
    if (isRecurring && recurrenceRule) {
      if (!validateRecurrenceRule(recurrenceRule)) {
        return res.status(400).json({ error: 'Invalid recurrence rule format' });
      }
    }

    // Check if user is member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: req.user.id
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only group members can create events' });
    }

    // Determine event status based on start and end time
    const now = new Date();
    const eventStartTime = new Date(startTime);
    const eventEndTime = endTime ? new Date(endTime) : null;
    
    let eventStatus = 'upcoming';
    if (eventEndTime && eventEndTime < now) {
      // Event has ended
      eventStatus = 'completed';
    } else if (eventStartTime <= now && (!eventEndTime || eventEndTime >= now)) {
      // Event is currently happening
      eventStatus = 'ongoing';
    } else if (eventStartTime > now) {
      // Event hasn't started yet
      eventStatus = 'upcoming';
    }

    // Get group members for notifications
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
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

    const event = await prisma.event.create({
      data: {
        groupId,
        creatorId: req.user.id,
        title,
        description,
        eventType,
        location,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        maxPlayers: maxPlayers ? parseInt(maxPlayers) : null,
        isRecurring: isRecurring || false,
        recurrenceRule: isRecurring ? recurrenceRule : null,
        recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null,
        status: eventStatus,
        participants: {
          create: {
            userId: req.user.id,
            status: 'confirmed'
          }
        }
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
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

    // Do not log event creation notifications in the event's recent activity
    // Send global notification to group members (except creator)
    const memberIds = group.members.map(m => m.user.id).filter(uid => uid !== req.user.id);
    await Promise.all(memberIds.map(userId =>
      prisma.groupNotification.create({
        data: {
          groupId: group.id,
          userId,
          type: 'eventCreated',
        }
      })
    ));

    res.status(201).json(event);
  } catch (error) {
    logger.error('Create event error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to create event' });
  }
};

export const getEvents = async (req: Request, res: Response) => {
  try {
    const { groupId, search, eventType, startDate, endDate, location, status, archived } = req.query;

    // Build where filter
    const where: any = {};
    
    if (groupId) {
      where.groupId = groupId;
    }
    
    // Only show events from groups the user is a member of
    where.group = {
      members: {
        some: {
          userId: req.user.id
        }
      }
    };

    // Search filter - search in title and description
    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Event type filter
    if (eventType && typeof eventType === 'string') {
      where.eventType = { contains: eventType, mode: 'insensitive' };
    }

    // Location filter
    if (location && typeof location === 'string') {
      where.location = { contains: location, mode: 'insensitive' };
    }

    // Status filter
    if (status && typeof status === 'string') {
      where.status = status;
    }

    // Archived filter
    if (archived !== undefined) {
      where.archived = archived === 'true';
    } else {
      // By default, exclude archived events
      where.archived = false;
    }

    // Date range filters
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) {
        where.startTime.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.startTime.lte = new Date(endDate as string);
      }
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        creator: {
          select: { id: true, name: true, email: true }
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
        },
        eventAttendances: {
          select: {
            id: true,
            userId: true,
            status: true,
            updatedAt: true
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    res.json(events);
  } catch (error) {
    logger.error('Get events error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to get events' });
  }
};

export const getEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findFirst({
      where: {
        id,
        group: {
          members: {
            some: {
              userId: req.user.id
            }
          }
        }
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
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
              select: { name: true, email: true }
            }
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

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    logger.error('Get event error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to get event' });
  }
};

export const updateEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, eventType, location, startTime, endTime, maxPlayers } = req.body;

    // Validate that events are single-day only if both times are provided
    if (startTime && endTime) {
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      
      // Check if they're on the same day
      if (startDate.toDateString() !== endDate.toDateString()) {
        return res.status(400).json({ error: 'Events must be single-day only. Start and end times must be on the same day.' });
      }
      
      // Check that end time is after start time
      if (endDate <= startDate) {
        return res.status(400).json({ error: 'End time must be after start time.' });
      }
    }

    // Check if user is the creator of the event
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        group: {
          select: { id: true, name: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    if (!event || event.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only the event creator can update it' });
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(eventType && { eventType }),
        ...(location !== undefined && { location }),
        ...(startTime && { startTime: new Date(startTime) }),
        ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
        ...(maxPlayers !== undefined && { maxPlayers: maxPlayers ? parseInt(maxPlayers) : null })
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
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

    // Send email notifications to participants
    const recipients = updatedEvent.participants
      .filter(p => p.user.id !== req.user.id)
      .map(p => p.user);
    
    // Check which users should receive notifications
    const userIds = recipients.map(r => r.id);
    const notificationMap = await batchShouldSendEmailNotification(userIds, 'eventUpdates');
    
    // Send emails
    for (const recipient of recipients) {
      if (notificationMap.get(recipient.id)) {
        await sendEmail(
          recipient.email,
          'eventUpdate',
          recipient.name,
          updatedEvent.title,
          event.group.name
        );
      }
    }

    res.json(updatedEvent);
  } catch (error) {
    logger.error('Failed to update event', 'EventController', { error });
    res.status(500).json({ error: 'Failed to update event' });
  }
};

export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user is the creator of the event
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

    if (!event || event.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only the event creator can delete it' });
    }

    // Send email notifications to participants
    const recipients = event.participants
      .filter(p => p.user.id !== req.user.id)
      .map(p => p.user);
    
    // Check which users should receive notifications
    const userIds = recipients.map(r => r.id);
    const notificationMap = await batchShouldSendEmailNotification(userIds, 'eventCancellations');
    
    // Send emails
    for (const recipient of recipients) {
      if (notificationMap.get(recipient.id)) {
        await sendEmail(
          recipient.email,
          'eventCancellation',
          recipient.name,
          event.title,
          event.group.name
        );
      }
    }

    await prisma.event.delete({
      where: { id }
    });

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    logger.error('Delete event error', 'EventController', { error });
    res.status(500).json({ error: 'Failed to delete event' });
  }
};

export const joinEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user is member of the group
    const event = await prisma.event.findFirst({
      where: {
        id,
        group: {
          members: {
            some: {
              userId: req.user.id
            }
          }
        }
      },
      include: {
        participants: true
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if already joined
    const existingParticipant = event.participants.find(p => p.userId === req.user.id);
    if (existingParticipant) {
      return res.status(400).json({ error: 'Already joined this event' });
    }

    // Check max players
    if (event.maxPlayers) {
      const confirmedCount = event.participants.filter(p => p.status === 'confirmed').length;
      if (confirmedCount >= event.maxPlayers) {
        return res.status(400).json({ error: 'Event is full' });
      }
    }

    const participant = await prisma.eventParticipant.create({
      data: {
        eventId: id,
        userId: req.user.id,
        status: 'confirmed'
      }
    });

    // Log activity for the user who joined
    await prisma.eventNotification.create({
      data: {
        eventId: id,
        userId: req.user.id,
        type: 'join'
      }
    });

    res.status(201).json(participant);
  } catch (error) {
    logger.error('Join event error', 'EventController', { error });
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
        userId: req.user.id
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
          userId: req.user.id
        }
      })
    ]);

    // Log activity for the user who left
    await prisma.eventNotification.create({
      data: {
        eventId: id,
        userId: req.user.id,
        type: 'leave'
      }
    });

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
        userId: req.user.id
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

    // Log activity for the user who updated their status
    await prisma.eventNotification.create({
      data: {
        eventId: id,
        userId: req.user.id,
        type: status // 'confirmed' or 'declined'
      }
    });

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
              userId: req.user.id
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

    // Check if user is the creator of the event
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event || event.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only the event creator can add exceptions' });
    }

    if (!event.isRecurring) {
      return res.status(400).json({ error: 'Event is not recurring' });
    }
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

    // Check if user is the creator of the event
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event || event.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only the event creator can remove exceptions' });
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
    const userId = req.user.id;
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

    // Check if user is the creator of the event
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event || event.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only the event creator can archive it' });
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

    // Check if user is the creator of the event
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event || event.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only the event creator can unarchive it' });
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

    // Check if user is the creator of the event
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    if (!event || event.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only the event creator can update event status' });
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: { status }
    });

    // Create notifications for participants about status change
    const participantIds = event.participants
      .filter(p => p.userId !== req.user.id)
      .map(p => p.userId);
    
    await Promise.all(participantIds.map(userId =>
      prisma.eventNotification.create({
        data: {
          eventId: id,
          userId,
          type: 'status_change',
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
              userId: req.user.id
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

