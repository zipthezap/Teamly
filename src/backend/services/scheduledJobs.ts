import { cleanupExpiredTokens } from '../utils/jwt';
import { cleanupOldEmails } from './emailQueueService';
import { logger } from '../utils/logger';
import prisma from '../config/database';
import { sendEmailWithQueue } from './emailQueueService';

/**
 * Scheduled Jobs Service
 * Manages periodic cleanup and maintenance tasks
 */

let cleanupInterval: NodeJS.Timeout | null = null;
let remindersInterval: NodeJS.Timeout | null = null;

/**
 * Run cleanup tasks
 */
export const runCleanupTasks = async (): Promise<void> => {
  try {
    logger.info('Running scheduled cleanup tasks', 'ScheduledJobs');

    // Cleanup expired tokens and sessions
    await cleanupExpiredTokens();

    // Cleanup old processed emails
    await cleanupOldEmails();

    // Mark expired group invitations and join requests
    await expireInvitesAndJoinRequests();

    logger.info('Completed scheduled cleanup tasks', 'ScheduledJobs');
  } catch (error) {
    logger.error('Error running cleanup tasks', 'ScheduledJobs', { error });
  }
};

/**
 * Mark expired group invitations and pending join requests as expired
 */
const expireInvitesAndJoinRequests = async (): Promise<void> => {
  const now = new Date();

  try {
    // Expire INVITE-sourced join requests that have passed their expiresAt
    const expiredInvites = await prisma.groupJoinRequest.updateMany({
      where: {
        status: 'pending',
        createdBy: 'INVITE',
        expiresAt: { lt: now },
      },
      data: { status: 'rejected' },
    });

    if (expiredInvites.count > 0) {
      logger.info(`Expired ${expiredInvites.count} group invite requests`, 'ScheduledJobs');
    }

    // Expire USER-sourced join requests older than 90 days with no expiresAt
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const expiredRequests = await prisma.groupJoinRequest.updateMany({
      where: {
        status: 'pending',
        createdBy: 'USER',
        expiresAt: null,
        createdAt: { lt: ninetyDaysAgo },
      },
      data: { status: 'rejected' },
    });

    if (expiredRequests.count > 0) {
      logger.info(`Expired ${expiredRequests.count} stale join requests`, 'ScheduledJobs');
    }

    // Also sync InviteLog entries to 'expired' for matching records
    await prisma.inviteLog.updateMany({
      where: {
        status: 'sent',
        expiresAt: { lt: now },
      },
      data: { status: 'expired' },
    });
  } catch (error) {
    logger.error('Error expiring invites/join requests', 'ScheduledJobs', { error });
  }
};

/**
 * Send due event reminders
 */
export const sendDueEventReminders = async (): Promise<void> => {
  const now = new Date();
  // Look-ahead window: send reminders due in the next 5 minutes
  const lookahead = new Date(now.getTime() + 5 * 60 * 1000);

  try {
    const dueReminders = await prisma.eventReminder.findMany({
      where: {
        sent: false,
        remindAt: { lte: lookahead },
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startTime: true,
            location: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            emailNotifications: true,
          },
        },
      },
      take: 200, // Process in batches
    });

    if (dueReminders.length === 0) return;

    logger.info(`Processing ${dueReminders.length} due event reminders`, 'ScheduledJobs');

    const results = await Promise.allSettled(
      dueReminders.map(async reminder => {
        // Send email notification if user has email notifications enabled
        if (reminder.user.emailNotifications) {
          const eventDate = reminder.event.startTime.toLocaleString();
          const htmlContent = `
            <h2>Event Reminder</h2>
            <p>Hi ${reminder.user.name},</p>
            <p>This is a reminder for your upcoming event:</p>
            <h3>${reminder.event.title}</h3>
            <p><strong>When:</strong> ${eventDate}</p>
            ${reminder.event.location ? `<p><strong>Where:</strong> ${reminder.event.location}</p>` : ''}
            <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/events/${reminder.event.id}" 
               style="display:inline-block;padding:12px 24px;background-color:#4CAF50;color:white;text-decoration:none;border-radius:4px;">
              View Event
            </a></p>
          `;
          await sendEmailWithQueue(
            reminder.user.email,
            `Reminder: ${reminder.event.title}`,
            htmlContent,
            { templateType: 'eventReminder' }
          );
        }

        // Mark reminder as sent
        await prisma.eventReminder.update({
          where: { id: reminder.id },
          data: { sent: true },
        });
      })
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      logger.warn(`${failed.length} reminders failed to send`, 'ScheduledJobs');
    }

    logger.info(`Sent ${dueReminders.length - failed.length} event reminders`, 'ScheduledJobs');
  } catch (error) {
    logger.error('Error sending event reminders', 'ScheduledJobs', { error });
  }
};

/**
 * Start scheduled cleanup tasks
 */
export const startScheduledJobs = (): void => {
  logger.info('Starting scheduled jobs', 'ScheduledJobs');

  // Run cleanup every hour
  cleanupInterval = setInterval(async () => {
    await runCleanupTasks();
  }, 60 * 60 * 1000); // 1 hour

  // Check for due reminders every 5 minutes
  remindersInterval = setInterval(async () => {
    await sendDueEventReminders();
  }, 5 * 60 * 1000); // 5 minutes

  // Run initial cleanup and reminder check
  runCleanupTasks();
  sendDueEventReminders();
};

/**
 * Stop scheduled jobs
 */
export const stopScheduledJobs = (): void => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  if (remindersInterval) {
    clearInterval(remindersInterval);
    remindersInterval = null;
  }
  logger.info('Stopped scheduled jobs', 'ScheduledJobs');
};
