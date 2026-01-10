import prisma from '../config/database';
import { validateRecurrenceRule } from '../utils/recurrenceService';
import { logger } from '../utils/logger';
import { sendEmail } from '../utils/emailService';
import { batchShouldSendEmailNotification } from '../utils/notificationHelper';

/**
 * Validates event time constraints
 */
export const validateEventTimes = (startTime: string, endTime?: string) => {
  const startDate = new Date(startTime);
  const now = new Date();
  
  if (startDate <= now) {
    return { valid: false, error: 'Event date and time must be in the future.' };
  }

  if (endTime) {
    const endDate = new Date(endTime);
    
    // Check if they're on the same day
    if (startDate.toDateString() !== endDate.toDateString()) {
      return { valid: false, error: 'Events must be single-day only. Start and end times must be on the same day.' };
    }
    
    // Check that end time is after start time
    if (endDate <= startDate) {
      return { valid: false, error: 'End time must be after start time.' };
    }
  }

  return { valid: true };
};

/**
 * Validates recurrence settings
 */
export const validateRecurrence = (isRecurring: boolean, recurrenceRule?: string) => {
  if (isRecurring && recurrenceRule) {
    if (!validateRecurrenceRule(recurrenceRule)) {
      return { valid: false, error: 'Invalid recurrence rule format' };
    }
  }
  return { valid: true };
};

/**
 * Determines event status based on start and end times
 */
export const determineEventStatus = (startTime: string, endTime?: string) => {
  const now = new Date();
  const eventStartTime = new Date(startTime);
  const eventEndTime = endTime ? new Date(endTime) : null;

  if (eventEndTime && eventEndTime < now) {
    return 'completed';
  } else if (eventStartTime <= now && (!eventEndTime || eventEndTime >= now)) {
    return 'ongoing';
  } else if (eventStartTime > now) {
    return 'upcoming';
  }
  return 'upcoming';
};

/**
 * Gets group with members for notifications
 */
export const getGroupWithMembers = async (groupId: string) => {
  return await prisma.group.findUnique({
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
};

/**
 * Creates event creation notifications for group members
 */
export const createEventNotifications = async (
  groupId: string,
  eventTitle: string,
  creatorName: string,
  groupName: string,
  memberIds: string[]
) => {
  await Promise.all(memberIds.map(userId =>
    prisma.groupNotification.create({
      data: {
        groupId,
        userId,
        type: 'eventCreated',
        params: {
          eventTitle,
          name: creatorName,
          groupName
        }
      }
    }).catch(error => {
      logger.error('Failed to create notification', 'EventService', { error, userId });
    })
  ));
};

/**
 * Creates event update notifications for participants
 */
export const createEventUpdateNotifications = async (
  eventId: string,
  eventTitle: string,
  updaterName: string,
  participantIds: string[]
) => {
  await Promise.all(participantIds.map(userId =>
    prisma.eventNotification.create({
      data: {
        eventId,
        userId,
        type: 'eventUpdated',
        params: {
          eventTitle,
          name: updaterName
        }
      }
    }).catch(error => {
      logger.error('Failed to create update notification', 'EventService', { error, userId });
    })
  ));
};

/**
 * Creates event deletion notifications for participants
 */
export const createEventDeletionNotifications = async (
  eventId: string,
  eventTitle: string,
  deleterName: string,
  participantIds: string[]
) => {
  await Promise.all(participantIds.map(userId =>
    prisma.eventNotification.create({
      data: {
        eventId,
        userId,
        type: 'eventCancelled',
        params: {
          eventTitle,
          name: deleterName
        }
      }
    }).catch(error => {
      logger.error('Failed to create deletion notification', 'EventService', { error, userId });
    })
  ));
};

/**
 * Builds event query filters
 */
export const buildEventFilters = (
  userId: string,
  filters: {
    groupId?: string;
    search?: string;
    eventType?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
    status?: string;
    archived?: string;
  }
) => {
  const where: any = {};
  
  if (filters.groupId) {
    where.groupId = filters.groupId;
  }
  
  // Only show events from groups the user is a member of
  where.group = {
    members: {
      some: {
        userId
      }
    }
  };

  // Search filter
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  // Event type filter
  if (filters.eventType) {
    where.eventType = { contains: filters.eventType, mode: 'insensitive' };
  }

  // Date range filter
  if (filters.startDate || filters.endDate) {
    where.startTime = {};
    if (filters.startDate) {
      where.startTime.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.startTime.lte = new Date(filters.endDate);
    }
  }

  // Location filter
  if (filters.location) {
    where.location = { contains: filters.location, mode: 'insensitive' };
  }

  // Status filter
  if (filters.status) {
    where.status = filters.status;
  }

  // Archived filter - only apply if explicitly provided
  if (filters.archived !== undefined) {
    where.archived = filters.archived === 'true';
  }

  return where;
};

/**
 * Gets event by ID with full details
 */
export const getEventById = async (eventId: string) => {
  return await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      creator: {
        select: { id: true, name: true, email: true, profilePicture: true }
      },
      group: {
        select: { 
          id: true, 
          name: true, 
          description: true,
          members: {
            select: {
              userId: true,
              role: true
            }
          }
        }
      },
      participants: {
        include: {
          user: {
            select: { 
              id: true, 
              name: true, 
              email: true, 
              profilePicture: true 
            }
          }
        }
      },
      comments: {
        include: {
          user: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
};

/**
 * Checks if user can modify event
 */
export const canModifyEvent = (event: any, userId: string) => {
  // User must be the creator or a group admin
  if (event.creatorId === userId) {
    return true;
  }
  
  const isGroupAdmin = event.group.members.some(
    (m: any) => m.userId === userId && m.role === 'admin'
  );
  
  return isGroupAdmin;
};

/**
 * Gets participant by user and event ID
 */
export const getParticipant = async (eventId: string, userId: string) => {
  return await prisma.eventParticipant.findFirst({
    where: {
      eventId,
      userId
    }
  });
};

/**
 * Checks if event is full
 */
export const isEventFull = async (eventId: string, maxPlayers: number | null) => {
  if (!maxPlayers) {
    return false;
  }

  const confirmedCount = await prisma.eventParticipant.count({
    where: {
      eventId,
      status: 'confirmed'
    }
  });

  return confirmedCount >= maxPlayers;
};

/**
 * Sends email notifications to event participants (excluding sender)
 */
export const sendEventEmailNotifications = async (
  participants: any[],
  senderId: string,
  notificationType: 'eventUpdates' | 'eventCancellations',
  emailType: 'eventUpdate' | 'eventCancellation',
  eventTitle: string,
  groupName: string
) => {
  const recipients = participants
    .filter(p => p.user.id !== senderId)
    .map(p => p.user);
  
  // Check which users should receive notifications
  const userIds = recipients.map(r => r.id);
  const notificationMap = await batchShouldSendEmailNotification(userIds, notificationType);
  
  // Send emails (each recipient gets their own personalized email)
  for (const recipient of recipients) {
    if (notificationMap.get(recipient.id)) {
      await sendEmail(
        recipient.email,
        emailType,
        recipient.name,  // Use recipient's name for personalization
        eventTitle,
        groupName
      ).catch(error => {
        logger.error('Failed to send email notification', 'EventService', { error, recipient });
      });
    }
  }
};
