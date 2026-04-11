import prisma from '../config/database';
import { SessionParticipantStatus, GroupNotificationType, SessionNotificationType } from '../../shared/types/event.types';
import { validateRecurrenceRule } from '../utils/recurrenceService';
import { logger } from '../utils/logger';
import { sendEmail } from '../utils/emailService';
import { batchShouldSendEmailNotification, filterUnmutedUsers } from '../utils/notificationHelper';
import { sanitizeString } from '../utils/validation';
import { ValidationResult } from '../../shared/types';
import { permissionService } from './permissionService';
import { Permission } from '../../shared/types/permissions.types';

/**
 * Sanitizes session data inputs
 */
export const sanitizeSessionData = (data: {
  title?: string;
  description?: string;
  sessionType?: string;
  location?: string;
}) => {
  return {
    title: data.title ? sanitizeString(data.title) : undefined,
    description: data.description ? sanitizeString(data.description) : undefined,
    sessionType: data.sessionType ? sanitizeString(data.sessionType) : undefined,
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
 * Validates session time constraints
 */
export const validateSessionTimes = (startTime: string, endTime?: string): ValidationResult => {
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
 * Determines session status based on start and end times
 */
export const determineSessionStatus = (startTime: string, endTime?: string) => {
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
 * Creates session creation notifications for group members
 * Uses batch insert for better performance
 */
export const createSessionNotifications = async (
  groupId: string,
  eventTitle: string,
  creatorName: string,
  groupName: string,
  memberIds: string[]
) => {
  if (memberIds.length === 0) return;

  try {
    // Filter out users who have muted session created notifications
    const unmutedMemberIds = await filterUnmutedUsers(memberIds, 'muteSessionCreated');
    
    if (unmutedMemberIds.length === 0) return;
    
    // Use createMany for batch insert - much faster than individual creates
    await prisma.groupNotification.createMany({
      data: unmutedMemberIds.map(userId => ({
        groupId,
        userId,
        type: GroupNotificationType.session_created,
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
 * Creates session update notifications for participants
 * Uses batch insert for better performance
 */
export const createSessionUpdateNotifications = async (
  sessionId: string,
  eventTitle: string,
  updaterName: string,
  participantIds: string[]
) => {
  if (participantIds.length === 0) return;

  try {
    // Filter out users who have muted session update notifications
    const unmutedParticipantIds = await filterUnmutedUsers(participantIds, 'muteSessionUpdates');
    
    if (unmutedParticipantIds.length === 0) return;
    
    // Use createMany for batch insert - much faster than individual creates
    await prisma.sessionNotification.createMany({
      data: unmutedParticipantIds.map(userId => ({
        sessionId,
        userId,
        type: SessionNotificationType.session_updated,
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
 * Creates session deletion notifications for participants
 */
export const createSessionDeletionNotifications = async (
  sessionId: string,
  eventTitle: string,
  deleterName: string,
  participantIds: string[]
) => {
  if (participantIds.length === 0) return;

  let unmutedParticipantCount = 0;

  try {
    // Filter out users who have muted session cancellation notifications
    const unmutedParticipantIds = await filterUnmutedUsers(participantIds, 'muteSessionCancellations');
    unmutedParticipantCount = unmutedParticipantIds.length;

    if (unmutedParticipantIds.length === 0) return;

    // Use createMany for batch insert - much faster than individual creates
    await prisma.sessionNotification.createMany({
      data: unmutedParticipantIds.map(userId => ({
        sessionId,
        userId,
        type: SessionNotificationType.session_cancelled,
        params: {
          eventTitle,
          name: deleterName
        }
      })),
      skipDuplicates: true
    });
  } catch (error) {
    logger.error('Failed to create batch deletion notifications', 'EventService', {
      error,
      participantCount: participantIds.length,
      unmutedParticipantCount
    });
  }
};

/**
 * Builds session query filters
 */
export const buildSessionFilters = (
  userId: string,
  filters: {
    groupId?: string;
    search?: string;
    sessionType?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
    status?: string;
    archived?: string;
  }
) => {
  const where: Record<string, unknown> = {};
  
  if (filters.groupId) {
    where.groupId = filters.groupId;
  }
  


  // Show events where:
  // - The session is in a group the user is a member of
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
  if (filters.sessionType) {
    where.sessionType = { contains: filters.sessionType, mode: 'insensitive' };
  }

  // Date range filter
  if (filters.startDate || filters.endDate) {
    const startTime: Record<string, Date> = {};
    if (filters.startDate) {
      startTime.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      startTime.lte = new Date(filters.endDate);
    }
    where.startTime = startTime;
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
 * Gets session by ID with full details
 */
export const getEventById = async (sessionId: string) => {
  return await prisma.session.findUnique({
    where: { id: sessionId },
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
 * Checks if user can modify session
 */
export const canModifySession = (
  session: {
    creatorId: string;
    group: {
      members: Array<{ userId: string; role: string }>;
    };
  },
  userId: string
) => {
  // User must be the creator or a group admin or moderator
  if (session.creatorId === userId) {
    return true;
  }
  
  const canManage = session.group.members.some(
    (m) => m.userId === userId && (m.role === 'admin' || m.role === 'moderator')
  );
  
  return canManage;
};

/**
 * Checks if user has permission to manage an session (creator or group admin/moderator)
 * Returns an object with isAuthorized flag and individual checks
 */
export const checkSessionManagementPermission = async (
  session: { id: string; creatorId: string; groupId: string } | null,
  userId: string
): Promise<{
  isAuthorized: boolean;
  isEventCreator: boolean;
  isGroupAdmin: boolean;
}> => {
  if (!session) {
    return { isAuthorized: false, isEventCreator: false, isGroupAdmin: false };
  }

  const isEventCreator = session.creatorId === userId;
  const isGroupAdmin = await permissionService.hasGroupPermission(userId, session.groupId, Permission.GROUP_MANAGE_EVENTS);
  
  return {
    isAuthorized: isEventCreator || isGroupAdmin,
    isEventCreator,
    isGroupAdmin
  };
};

/**
 * Gets participant by user and session ID
 */
export const getParticipant = async (sessionId: string, userId: string) => {
  return await prisma.sessionParticipant.findFirst({
    where: {
      sessionId,
      userId
    }
  });
};

/**
 * Checks if session is full
 */
export const isSessionFull = async (sessionId: string, maxPlayers: number | null) => {
  if (!maxPlayers) {
    return false;
  }

  const confirmedCount = await prisma.sessionParticipant.count({
    where: {
      sessionId,
      status: SessionParticipantStatus.confirmed
    }
  });

  return confirmedCount >= maxPlayers;
};

/**
 * Sends email notifications to session participants (excluding sender)
 */
export const sendSessionEmailNotifications = async (
  participants: Array<{
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>,
  senderId: string,
  notificationType: 'sessionUpdates' | 'sessionCancellations',
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
