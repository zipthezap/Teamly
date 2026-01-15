import prisma from '../config/database';
import { sendEmail as sendEmailDirect } from '../utils/emailService';
import { logger } from '../utils/logger';
import { EMAIL_RETRY } from '../config/security';
import { emailCircuitBreaker } from '../utils/circuitBreaker';
import { Prisma } from '@prisma/client';

/**
 * Email Queue Service
 * Provides reliable email delivery with retry mechanism and queue management
 */

interface EmailOptions {
  recipient: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  templateType?: string;
  templateData?: Prisma.JsonObject;
  maxAttempts?: number;
  scheduledAt?: Date;
}

/**
 * Enqueue an email for delivery
 */
export const enqueueEmail = async (options: EmailOptions): Promise<string> => {
  try {
    const email = await prisma.emailQueue.create({
      data: {
        recipient: options.recipient,
        subject: options.subject,
        htmlContent: options.htmlContent,
        textContent: options.textContent,
        templateType: options.templateType,
        templateData: options.templateData,
        maxAttempts: options.maxAttempts || 3,
        scheduledAt: options.scheduledAt || new Date(),
        status: 'pending'
      }
    });

    logger.info('Email enqueued', 'EmailQueueService', {
      emailId: email.id,
      recipient: email.recipient,
      subject: email.subject
    });

    return email.id;
  } catch (error) {
    logger.error('Failed to enqueue email', 'EmailQueueService', { error, options });
    throw error;
  }
};

/**
 * Process pending emails in the queue
 */
export const processPendingEmails = async (): Promise<void> => {
  try {
    // Get pending or retry emails that are due
    const emails = await prisma.emailQueue.findMany({
      where: {
        OR: [
          { status: 'pending' },
          { status: 'retry' }
        ],
        scheduledAt: {
          lte: new Date()
        }
      },
      take: 50, // Process in batches
      orderBy: {
        scheduledAt: 'asc'
      }
    });

    // Filter emails that haven't exceeded max attempts
    const validEmails = emails.filter(email => email.attempts < email.maxAttempts);

    logger.info('Processing email queue', 'EmailQueueService', { count: validEmails.length });

    for (const email of validEmails) {
      await processEmail(email.id);
    }
  } catch (error) {
    logger.error('Failed to process email queue', 'EmailQueueService', { error });
  }
};

/**
 * Process a single email
 */
export const processEmail = async (emailId: string): Promise<boolean> => {
  try {
    // Get email details
    const email = await prisma.emailQueue.findUnique({
      where: { id: emailId }
    });

    if (!email) {
      logger.warn('Email not found in queue', 'EmailQueueService', { emailId });
      return false;
    }

    // Check if already sent or max attempts reached
    if (email.status === 'sent' || email.attempts >= email.maxAttempts) {
      return false;
    }

    // Increment attempts
    await prisma.emailQueue.update({
      where: { id: emailId },
      data: {
        attempts: email.attempts + 1,
        status: 'retry'
      }
    });

    try {
      // Send email with circuit breaker protection
      await emailCircuitBreaker.execute(async () => {
        await sendEmailDirect(
          email.recipient,
          email.subject,
          email.htmlContent
        );
      });

      // Mark as sent
      await prisma.emailQueue.update({
        where: { id: emailId },
        data: {
          status: 'sent',
          sentAt: new Date(),
          lastError: null
        }
      });

      logger.info('Email sent successfully', 'EmailQueueService', {
        emailId,
        recipient: email.recipient,
        attempts: email.attempts + 1
      });

      return true;
    } catch (sendError: unknown) {
      // Calculate next retry time with exponential backoff using configured values
      const delay = EMAIL_RETRY.BASE_DELAY_MS * Math.pow(EMAIL_RETRY.BACKOFF_MULTIPLIER, email.attempts);
      const nextScheduledAt = new Date(Date.now() + delay);
      const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';

      const newStatus = email.attempts + 1 >= email.maxAttempts ? 'failed' : 'retry';

      await prisma.emailQueue.update({
        where: { id: emailId },
        data: {
          status: newStatus,
          lastError: errorMessage,
          scheduledAt: newStatus === 'retry' ? nextScheduledAt : email.scheduledAt
        }
      });

      logger.error('Failed to send email', 'EmailQueueService', {
        emailId,
        recipient: email.recipient,
        attempts: email.attempts + 1,
        error: errorMessage,
        nextRetry: newStatus === 'retry' ? nextScheduledAt : null
      });

      return false;
    }
  } catch (error) {
    logger.error('Error processing email', 'EmailQueueService', { error, emailId });
    return false;
  }
};

/**
 * Get email queue statistics
 */
export const getQueueStats = async (): Promise<Record<string, number>> => {
  try {
    const stats = await prisma.emailQueue.groupBy({
      by: ['status'],
      _count: true
    });

    const result: Record<string, number> = {};
    for (const stat of stats) {
      result[stat.status] = stat._count;
    }

    return result;
  } catch (error) {
    logger.error('Failed to get queue stats', 'EmailQueueService', { error });
    return {};
  }
};

/**
 * Clean up old processed emails (older than 30 days)
 */
export const cleanupOldEmails = async (): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await prisma.emailQueue.deleteMany({
      where: {
        status: 'sent',
        sentAt: {
          lt: thirtyDaysAgo
        }
      }
    });

    logger.info('Cleaned up old emails', 'EmailQueueService', { count: result.count });
  } catch (error) {
    logger.error('Failed to cleanup old emails', 'EmailQueueService', { error });
  }
};

/**
 * Retry failed emails
 */
export const retryFailedEmails = async (): Promise<void> => {
  try {
    // Get failed emails that haven't exceeded max attempts
    const failedEmails = await prisma.emailQueue.findMany({
      where: {
        status: 'failed'
      }
    });

    const eligibleEmails = failedEmails.filter(email => email.attempts < email.maxAttempts);

    // Reset them to retry status
    for (const email of eligibleEmails) {
      await prisma.emailQueue.update({
        where: { id: email.id },
        data: {
          status: 'retry',
          scheduledAt: new Date()
        }
      });
    }

    logger.info('Reset failed emails for retry', 'EmailQueueService', { count: eligibleEmails.length });
  } catch (error) {
    logger.error('Failed to retry failed emails', 'EmailQueueService', { error });
  }
};

/**
 * Enhanced sendEmail wrapper that uses the queue
 */
export const sendEmailWithQueue = async (
  recipient: string,
  subject: string,
  htmlContent: string,
  options?: {
    textContent?: string;
    templateType?: string;
    templateData?: Prisma.JsonObject;
    maxAttempts?: number;
    immediate?: boolean; // If true, send immediately without queue
  }
): Promise<void> => {
  if (options?.immediate) {
    // Send immediately without queue
    await sendEmailDirect(recipient, subject, htmlContent);
  } else {
    // Enqueue for reliable delivery
    await enqueueEmail({
      recipient,
      subject,
      htmlContent,
      textContent: options?.textContent,
      templateType: options?.templateType,
      templateData: options?.templateData,
      maxAttempts: options?.maxAttempts || 3
    });
  }
};

/**
 * Start email queue processor (should be called on server startup)
 */
export const startEmailQueueProcessor = (): NodeJS.Timeout => {
  logger.info('Starting email queue processor', 'EmailQueueService');
  
  // Process queue every minute
  const interval = setInterval(async () => {
    await processPendingEmails();
  }, 60 * 1000); // 1 minute

  // Initial processing
  processPendingEmails();

  return interval;
};

/**
 * Stop email queue processor
 */
export const stopEmailQueueProcessor = (interval: NodeJS.Timeout): void => {
  clearInterval(interval);
  logger.info('Stopped email queue processor', 'EmailQueueService');
};
