/**
 * Event Notification Service
 * Handles all event-related email notifications and activity tracking
 */

import { sendEmailWithQueue } from './emailQueueService';
import { batchShouldSendEmailNotification } from '../utils/notificationHelper';

interface User {
  id: string;
  name: string;
  email: string;
  emailNotifications?: boolean;
}

/**
 * Send event invitation notifications to group members
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
  const notificationMap = await batchShouldSendEmailNotification(userIds, 'eventInvites');
  
  // Send emails to users who have notifications enabled using template system
  const emailPromises = filteredRecipients
    .filter(recipient => notificationMap.get(recipient.id))
    .map(recipient => {
      const htmlContent = `
        <h2>You're Invited to an Event!</h2>
        <p>Hi ${recipient.name},</p>
        <p>You have been invited to participate in:</p>
        <h3>${eventTitle}</h3>
        <p><strong>When:</strong> ${eventStartTime.toLocaleString()}</p>
        <p><strong>Group:</strong> ${groupName}</p>
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
 * Send event update notifications to participants
 */
export const sendEventUpdateNotifications = async (
  participants: any[],
  creatorId: string,
  eventTitle: string,
  groupName: string
): Promise<void> => {
  const recipients = participants
    .filter(p => p.user.id !== creatorId)
    .map(p => p.user);
  
  // Check which users should receive notifications
  const userIds = recipients.map(r => r.id);
  const notificationMap = await batchShouldSendEmailNotification(userIds, 'eventUpdates');
  
  // Send emails using template system
  const emailPromises = recipients
    .filter(recipient => notificationMap.get(recipient.id))
    .map(recipient => {
      const htmlContent = `
        <h2>Event Updated</h2>
        <p>Hi ${recipient.name},</p>
        <p>The event "${eventTitle}" in group "${groupName}" has been updated.</p>
        <p>Please check the event details for any changes.</p>
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
 * Send event cancellation notifications to participants
 */
export const sendEventCancellationNotifications = async (
  participants: any[],
  creatorId: string,
  eventTitle: string,
  groupName: string
): Promise<void> => {
  const recipients = participants
    .filter(p => p.user.id !== creatorId)
    .map(p => p.user);
  
  // Check which users should receive notifications
  const userIds = recipients.map(r => r.id);
  const notificationMap = await batchShouldSendEmailNotification(userIds, 'eventCancellations');
  
  // Send emails using template system
  const emailPromises = recipients
    .filter(recipient => notificationMap.get(recipient.id))
    .map(recipient => {
      const htmlContent = `
        <h2>Event Cancelled</h2>
        <p>Hi ${recipient.name},</p>
        <p>Unfortunately, the event "${eventTitle}" in group "${groupName}" has been cancelled.</p>
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
 * Create event notification records in database
 */
export const createEventNotifications = async (
  eventId: string,
  userIds: string[],
  type: string,
  prisma: any,
  metadata?: any,
  params?: any
): Promise<void> => {
  await Promise.all(
    userIds.map(userId =>
      prisma.eventNotification.create({
        data: {
          eventId,
          userId,
          type,
          metadata: metadata || undefined,
          params: params || undefined,
        }
      })
    )
  );
};

/**
 * Create a batch of activity notifications with metadata
 */
export const createActivityNotification = async (
  eventId: string,
  userId: string,
  type: string,
  metadata: any,
  prisma: any,
  params?: any
): Promise<void> => {
  await prisma.eventNotification.create({
    data: {
      eventId,
      userId,
      type,
      metadata,
      params: params || undefined,
    }
  });
};

/**
 * Get recent activity for an event with optional filtering
 */
export const getEventActivity = async (
  eventId: string,
  prisma: any,
  options?: {
    limit?: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<any[]> => {
  const where: any = { eventId };
  
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
  
  const notifications = await prisma.eventNotification.findMany({
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

