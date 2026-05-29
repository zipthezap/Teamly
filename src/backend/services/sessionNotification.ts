/**
 * Event Notification Service
 * Handles all session-related email notifications and activity tracking
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { SessionNotificationType } from '../../shared/types/event.types';
import { sendEmailWithQueue } from './emailQueueService';
import { batchShouldSendEmailNotification } from '../utils/notificationHelper';
import { escapeHtml } from '../utils/validation';
import { NotificationFactory } from './notificationFactory';
import { NotificationMetadata, NotificationParams } from './notificationFactory';

interface User {
  id: string;
  name: string;
  email: string;
  emailNotifications?: boolean;
}

interface EventParticipantWithUser {
  user: User;
}

/**
 * Send session invitation notifications to group members
 */
export const sendEventInvitations = async (
  recipients: User[],
  creatorId: string,
  eventTitle: string,
  eventStartTime: Date,
  groupName: string
): Promise<void> => {
  // Filter out the creator
  const filteredRecipients = recipients.filter(r => r.id !== creatorId);
  
  // Check which users should receive notifications
  const userIds = filteredRecipients.map(r => r.id);
  const notificationMap = await batchShouldSendEmailNotification(userIds, 'sessionInvites');
  
  // Send emails to users who have notifications enabled using template system
  const emailPromises = filteredRecipients
    .filter(recipient => notificationMap.get(recipient.id))
    .map(recipient => {
      const htmlContent = `
        <h2>You're Invited to an Event!</h2>
        <p>Hi ${escapeHtml(recipient.name)},</p>
        <p>You have been invited to participate in:</p>
        <h3>${escapeHtml(eventTitle)}</h3>
        <p><strong>When:</strong> ${eventStartTime.toLocaleString()}</p>
        <p><strong>Group:</strong> ${escapeHtml(groupName)}</p>
        <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/events">View Event Details</a></p>
      `;
      
      return sendEmailWithQueue(
        recipient.email,
        `Event Invitation: ${eventTitle}`,
        htmlContent,
        {
          templateType: 'event_invitation',
          templateData: {
            recipientName: recipient.name,
            eventTitle,
            eventStartTime: eventStartTime.toISOString(),
            groupName
          }
        }
      );
    });

  await Promise.all(emailPromises);
};

/**
 * Send session update notifications to participants
 */
export const sendEventUpdateNotifications = async (
  participants: EventParticipantWithUser[],
  creatorId: string,
  eventTitle: string,
  groupName: string
): Promise<void> => {
  const recipients = participants
    .filter(p => p.user.id !== creatorId)
    .map(p => p.user);
  
  // Check which users should receive notifications
  const userIds = recipients.map(r => r.id);
  const notificationMap = await batchShouldSendEmailNotification(userIds, 'sessionUpdates');
  
  // Send emails using template system
  const emailPromises = recipients
    .filter(recipient => notificationMap.get(recipient.id))
    .map(recipient => {
      const htmlContent = `
        <h2>Event Updated</h2>
        <p>Hi ${escapeHtml(recipient.name)},</p>
        <p>The session "${escapeHtml(eventTitle)}" in group "${escapeHtml(groupName)}" has been updated.</p>
        <p>Please check the session details for any changes.</p>
        <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/events">View Event</a></p>
      `;
      
      return sendEmailWithQueue(
        recipient.email,
        `Event Updated: ${eventTitle}`,
        htmlContent,
        {
          templateType: 'event_update',
          templateData: {
            recipientName: recipient.name,
            eventTitle,
            groupName
          }
        }
      );
    });

  await Promise.all(emailPromises);
};

/**
 * Send session cancellation notifications to participants
 */
export const sendEventCancellationNotifications = async (
  participants: EventParticipantWithUser[],
  creatorId: string,
  eventTitle: string,
  groupName: string
): Promise<void> => {
  const recipients = participants
    .filter(p => p.user.id !== creatorId)
    .map(p => p.user);
  
  // Check which users should receive notifications
  const userIds = recipients.map(r => r.id);
  const notificationMap = await batchShouldSendEmailNotification(userIds, 'sessionCancellations');
  
  // Send emails using template system
  const emailPromises = recipients
    .filter(recipient => notificationMap.get(recipient.id))
    .map(recipient => {
      const htmlContent = `
        <h2>Event Cancelled</h2>
        <p>Hi ${escapeHtml(recipient.name)},</p>
        <p>Unfortunately, the session "${escapeHtml(eventTitle)}" in group "${escapeHtml(groupName)}" has been cancelled.</p>
        <p>We apologize for any inconvenience this may cause.</p>
        <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/events">Browse Other Events</a></p>
      `;
      
      return sendEmailWithQueue(
        recipient.email,
        `Event Cancelled: ${eventTitle}`,
        htmlContent,
        {
          templateType: 'event_cancellation',
          templateData: {
            recipientName: recipient.name,
            eventTitle,
            groupName
          }
        }
      );
    });

  await Promise.all(emailPromises);
};

/**
 * Create session notification records in database
 */
export const createSessionNotifications = async (
  sessionId: string,
  userIds: string[],
  type: SessionNotificationType,
  prisma: PrismaClient,
  metadata?: Prisma.InputJsonValue,
  params?: Prisma.InputJsonValue
): Promise<void> => {
  if (userIds.length === 0) return;

  await NotificationFactory.createSessionNotifications(
    {
      sessionId,
      type,
      userIds,
      metadata: (metadata as NotificationMetadata | undefined) || undefined,
      params: (params as NotificationParams | undefined) || undefined,
      checkMutePreference: false,
    },
    prisma as unknown as Prisma.TransactionClient
  );
};

/**
 * Create a batch of activity notifications with metadata
 */
export const createActivityNotification = async (
  sessionId: string,
  userId: string,
  type: SessionNotificationType,
  metadata: Prisma.InputJsonValue,
  prisma: PrismaClient,
  params?: Prisma.InputJsonValue
): Promise<void> => {
  await NotificationFactory.createSessionNotifications(
    {
      sessionId,
      type,
      userIds: [userId],
      metadata: (metadata as NotificationMetadata | undefined) || undefined,
      params: (params as NotificationParams | undefined) || undefined,
      checkMutePreference: false,
    },
    prisma as unknown as Prisma.TransactionClient
  );
};

/**
 * Get recent activity for an session with optional filtering
 */
export const getSessionActivity = async (
  sessionId: string,
  prisma: PrismaClient,
  options?: {
    limit?: number;
    type?: SessionNotificationType;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<Array<{ id: string; type: string; userId: string; sessionId: string; createdAt: Date; user: { id: string; name: string; email: string } }>> => {
  const where: Prisma.SessionNotificationWhereInput = { sessionId };
  
  if (options?.type) {
    where.type = options.type;
  }
  
  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      where.createdAt.gte = options.startDate;
    }
    if (options.endDate) {
      where.createdAt.lte = options.endDate;
    }
  }
  
  const notifications = await prisma.sessionNotification.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: options?.limit || 50
  });
  
  return notifications;
};

