/**
 * Event Notification Service
 * Handles all event-related email notifications
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
  prisma: any
): Promise<void> => {
  await Promise.all(
    userIds.map(userId =>
      prisma.eventNotification.create({
        data: {
          eventId,
          userId,
          type,
        }
      })
    )
  );
};
