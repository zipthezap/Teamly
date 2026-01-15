import prisma from '../config/database';
import { EventParticipantStatus, GroupNotificationType, EventNotificationType } from '../../shared/types/event.types';
import { validateRecurrenceRule } from '../utils/recurrenceService';
import { logger } from '../utils/logger';
import { sendEmail } from '../utils/emailService';
import { batchShouldSendEmailNotification } from '../utils/notificationHelper';
import { sanitizeString } from '../utils/validation';
import { ValidationResult } from '../../shared/types';
import { checkGroupAdmin } from './groupService';

/**
 * Sanitizes event data inputs
 */
export const sanitizeEventData = (data: {
  title?: string;
  description?: string;
  eventType?: string;
  location?: string;
}) => {
  return {
    title: data.title ? sanitizeString(data.title) : undefined,
    description: data.description ? sanitizeString(data.description) : undefined,
    eventType: data.eventType ? sanitizeString(data.eventType) : undefined,
    location: data.location ? sanitizeString(data.location) : undefined
  };
};

/**
 * Sanitizes guest participant name
 * Returns sanitized name or falls back to trimmed name
 */
export const sanitizeGuestName = (name: string): string => {
  const sanitized = sanitizeString(name);
  return sanitized.length > 0 ? sanitized : name.trim();
};

/**
 * Validates event time constraints
 */
export const validateEventTimes = (startTime: string, endTime?: string): ValidationResult => {
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
export const validateRecurrence = (isRecurring: boolean, recurrenceRule?: string): ValidationResult => {
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
 * Uses batch insert for better performance
 */
export const createEventNotifications = async (
  groupId: string,
  eventTitle: string,
  creatorName: string,
  groupName: string,
  memberIds: string[]
) => {
  if (memberIds.length === 0) return;

  try {
    // Use createMany for batch insert - much faster than individual creates
    await prisma.groupNotification.createMany({
      data: memberIds.map(userId => ({
        groupId,
        userId,
        type: GroupNotificationType.event_created,
        params: {
          eventTitle,
          name: creatorName,
          groupName
        }
      })),
      skipDuplicates: true // Avoid errors on duplicate entries
    });
  } catch (error) {
    logger.error('Failed to create batch notifications', 'EventService', { 
      error, 
      memberCount: memberIds.length 
    });
  }
};

/**
 * Creates event update notifications for participants
 * Uses batch insert for better performance
 */
export const createEventUpdateNotifications = async (
  eventId: string,
  eventTitle: string,
  updaterName: string,
  participantIds: string[]
) => {
  if (participantIds.length === 0) return;

  try {
    // Use createMany for batch insert - much faster than individual creates
    await prisma.eventNotification.createMany({
      data: participantIds.map(userId => ({
        eventId,
        userId,
        type: EventNotificationType.event_updated,
        params: {
          eventTitle,
          name: updaterName
        }
      })),
      skipDuplicates: true // Avoid errors on duplicate entries
    });
  } catch (error) {
    logger.error('Failed to create batch update notifications', 'EventService', { 
      error, 
      participantCount: participantIds.length 
    });
  }
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
        type: EventNotificationType.event_cancelled,
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
  


  // Show events where:
  // - The event is in a group the user is a member of
  // - OR the user is a participant
  // - OR the user is the creator
  const accessControlOR = [
    // Event is in a group the user is a member of
    {
      group: {
        members: {
          some: {
            userId
          }
        }
      }
    },
    // User is a participant
    {
      participants: {
        some: {
          userId
        }
      }
    },
    // User is the creator
    {
      creatorId: userId
    }
  ];

  // Search filter - combine with access control using AND
  if (filters.search) {
    where.AND = [
      { OR: accessControlOR },
      {
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ]
      }
    ];
  } else {
    // No search filter, just apply access control
    where.OR = accessControlOR;
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

  // Archived filter - exclude archived events by default
  if (filters.archived !== undefined) {
    where.archived = filters.archived === 'true';
  } else {
    // By default, exclude archived events
    where.archived = false;
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
 * Checks if user has permission to manage an event (creator or group admin)
 * Returns an object with isAuthorized flag and individual checks
 */
export const checkEventManagementPermission = async (
  event: { id: string; creatorId: string; groupId: string } | null,
  userId: string
): Promise<{
  isAuthorized: boolean;
  isEventCreator: boolean;
  isGroupAdmin: boolean;
}> => {
  if (!event) {
    return { isAuthorized: false, isEventCreator: false, isGroupAdmin: false };
  }

  const isEventCreator = event.creatorId === userId;
  const isGroupAdmin = await checkGroupAdmin(event.groupId, userId);
  
  return {
    isAuthorized: isEventCreator || isGroupAdmin,
    isEventCreator,
    isGroupAdmin
  };
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
      status: EventParticipantStatus.confirmed
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
