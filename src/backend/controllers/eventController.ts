import prisma from '../config/database';
import { validateRecurrenceRule, generateRecurrenceInstances, calculateDuration, applyDuration } from '../utils/recurrenceService';
import { sendEmail, sendBatchEmails } from '../utils/emailService';
import { batchShouldSendEmailNotification } from '../utils/notificationHelper';
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

    // Send email notifications to group members
    const recipients = group.members
      .filter(m => m.userId !== req.user.id)
      .map(m => m.user);
    
    // Check which users should receive notifications
    const userIds = recipients.map(r => r.id);
    const notificationMap = await batchShouldSendEmailNotification(userIds, 'eventInvites');
    
    // Send emails
    for (const recipient of recipients) {
      if (notificationMap.get(recipient.id)) {
        await sendEmail(
          recipient.email,
          'eventInvitation',
          recipient.name,
          event.title,
          event.startTime,
          group.name
        );
      }
    }

    // Notify all group members (except creator)
    const memberIds = group.members.map(m => m.userId).filter(uid => uid !== req.user.id);
    await Promise.all(memberIds.map(userId =>
      prisma.eventNotification.create({
        data: {
          eventId: event.id,
          userId,
          type: 'created',
        }
      })
    ));

    res.status(201).json(event);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
};

export const getEvents = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.query;

    const where = {
      group: {
        members: {
          some: {
            userId: req.user.id
          }
        }
      }
    };

    if (groupId) {
      where.groupId = groupId;
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
    console.error('Get events error:', error);
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
    console.error('Get event error:', error);
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
    console.error('Update event error:', error);
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
    console.error('Delete event error:', error);
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

    // Notify event organizer if the user joining is not the organizer
    if (event.creatorId !== req.user.id) {
      await prisma.eventNotification.create({
        data: {
          eventId: id,
          userId: event.creatorId,
          type: 'join'
        }
      });
    }

    res.status(201).json(participant);
  } catch (error) {
    console.error('Join event error:', error);
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

    // Notify event organizer if the user leaving is not the organizer
    if (event.creatorId !== req.user.id) {
      await prisma.eventNotification.create({
        data: {
          eventId: id,
          userId: event.creatorId,
          type: 'leave'
        }
      });
    }

    res.json({ message: 'Left event successfully' });
  } catch (error) {
    console.error('Leave event error:', error);
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
    const event = await prisma.event.findUnique({
      where: { id }
    });

    const updatedParticipant = await prisma.eventParticipant.update({
      where: { id: participant.id },
      data: { status }
    });

    // Create notification for status change (if not the organizer)
    if (event && event.creatorId !== req.user.id) {
      await prisma.eventNotification.create({
        data: {
          eventId: id,
          userId: event.creatorId,
          type: status // 'confirmed' or 'declined'
        }
      });
    }

    res.json(updatedParticipant);
  } catch (error) {
    console.error('Update participation status error:', error);
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
    const exceptionDates = event.exceptionDates ? JSON.parse(JSON.stringify(event.exceptionDates)) : [];
    const instances = generateRecurrenceInstances(
      startDate || event.startTime,
      event.recurrenceRule,
      endDate || event.recurrenceEnd,
      exceptionDates,
      limit ? parseInt(limit) : 100
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
    console.error('Get recurring event instances error:', error);
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

    // Get existing exceptions
    const existingExceptions = event.exceptionDates 
      ? JSON.parse(JSON.stringify(event.exceptionDates))
      : [];

    // Add new exception
    const updatedExceptions = [...existingExceptions, new Date(exceptionDate).toISOString()];

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        exceptionDates: updatedExceptions
      }
    });

    res.json(updatedEvent);
  } catch (error) {
    console.error('Add recurring event exception error:', error);
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
    console.error('Remove recurring event exception error:', error);
    res.status(500).json({ error: 'Failed to remove exception' });
  }
};

