/**
 * Event Notification Service
 * Handles all event-related email notifications and activity tracking
 */

import { sendEmail } from '../utils/emailService';
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
  
  // Send emails to users who have notifications enabled
  const emailPromises = filteredRecipients
    .filter(recipient => notificationMap.get(recipient.id))
    .map(recipient => 
      sendEmail(
        recipient.email,
        'eventInvitation',
        recipient.name,
        eventTitle,
        eventStartTime,
        groupName
      )
    );

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
  
  // Send emails
  const emailPromises = recipients
    .filter(recipient => notificationMap.get(recipient.id))
    .map(recipient =>
      sendEmail(
        recipient.email,
        'eventUpdate',
        recipient.name,
        eventTitle,
        groupName
      )
    );

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
  
  // Send emails
  const emailPromises = recipients
    .filter(recipient => notificationMap.get(recipient.id))
    .map(recipient =>
      sendEmail(
        recipient.email,
        'eventCancellation',
        recipient.name,
        eventTitle,
        groupName
      )
    );

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
  metadata?: any
): Promise<void> => {
  await Promise.all(
    userIds.map(userId =>
      prisma.eventNotification.create({
        data: {
          eventId,
          userId,
          type,
          metadata: metadata || undefined,
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
  prisma: any
): Promise<void> => {
  await prisma.eventNotification.create({
    data: {
      eventId,
      userId,
      type,
      metadata,
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

