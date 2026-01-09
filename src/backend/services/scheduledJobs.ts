import { cleanupExpiredTokens } from '../utils/jwt';
import { cleanupOldEmails } from './emailQueueService';
import { logger } from '../utils/logger';

/**
 * Scheduled Jobs Service
 * Manages periodic cleanup and maintenance tasks
 */

let cleanupInterval: NodeJS.Timeout | null = null;

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

    logger.info('Completed scheduled cleanup tasks', 'ScheduledJobs');
  } catch (error) {
    logger.error('Error running cleanup tasks', 'ScheduledJobs', { error });
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

  // Run initial cleanup
  runCleanupTasks();
};

/**
 * Stop scheduled jobs
 */
export const stopScheduledJobs = (): void => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('Stopped scheduled jobs', 'ScheduledJobs');
  }
};
