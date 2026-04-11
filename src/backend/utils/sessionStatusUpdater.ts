/**
 * Event Status Updater Utility
 * Automatically updates session statuses based on current time
 */

import prisma from '../config/database';
import { logger } from './logger';

/**
 * Configuration constants for session status management
 */
const EVENT_CONFIG = {
  // Hours after start time to keep an session 'ongoing' when no end time is specified
  DEFAULT_ONGOING_HOURS: 24,
  // Days before archiving completed events
  DEFAULT_ARCHIVE_DAYS: 30,
  // Milliseconds in one hour (for time calculations)
  MS_PER_HOUR: 1000 * 60 * 60
};

/**
 * Update session statuses based on current time
 * - Events that have passed their end time -> 'completed'
 * - Events currently happening -> 'ongoing'
 * - Events in the future -> 'upcoming'
 */
export const updateSessionStatuses = async (): Promise<{
  updated: number;
  errors: number;
}> => {
  const now = new Date();
  let updated = 0;
  let errors = 0;

  try {
    // Get all non-archived events that are not cancelled
    const sessions = await prisma.session.findMany({
      where: {
        archived: false,
        status: {
          not: 'cancelled'
        }
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true
      }
    });

    // Update each session based on time
    for (const session of sessions) {
      let newStatus = session.status;

      if (session.endTime && session.endTime < now) {
        // Event has ended
        newStatus = 'completed';
      } else if (session.startTime <= now) {
        // Event has started
        if (session.endTime && session.endTime >= now) {
          // Event is currently happening (has end time and hasn't ended)
          newStatus = 'ongoing';
        } else if (!session.endTime) {
          // Event has no end time - mark as ongoing if within configured hours
          // Otherwise mark as completed
          const hoursSinceStart = (now.getTime() - session.startTime.getTime()) / EVENT_CONFIG.MS_PER_HOUR;
          newStatus = hoursSinceStart <= EVENT_CONFIG.DEFAULT_ONGOING_HOURS ? 'ongoing' : 'completed';
        }
      } else if (session.startTime > now) {
        // Event hasn't started yet
        newStatus = 'upcoming';
      }

      // Only update if status has changed
      if (newStatus !== session.status) {
        try {
          await prisma.session.update({
            where: { id: session.id },
            data: { status: newStatus }
          });
          updated++;
        } catch (error) {
          logger.error('Failed to update session status', 'SessionStatusUpdater', { 
            sessionId: session.id, 
            error 
          });
          errors++;
        }
      }
    }

    return { updated, errors };
  } catch (error) {
    logger.error('Error in updateSessionStatuses', 'SessionStatusUpdater', { error });
    throw error;
  }
};

/**
 * Archive old completed events (older than specified days)
 */
export const archiveOldEvents = async (daysOld: number = EVENT_CONFIG.DEFAULT_ARCHIVE_DAYS): Promise<{
  archived: number;
  errors: number;
}> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  let archived = 0;
  let errors = 0;

  try {
    const result = await prisma.session.updateMany({
      where: {
        archived: false,
        status: 'completed',
        endTime: {
          lt: cutoffDate
        }
      },
      data: {
        archived: true
      }
    });

    archived = result.count;
    return { archived, errors };
  } catch (error) {
    logger.error('Error in archiveOldEvents', 'SessionStatusUpdater', { error });
    errors++;
    return { archived, errors };
  }
};

/**
 * Expire old session requests that have passed their deadline
 */
export const expireOldEventRequests = async (): Promise<{
  expired: number;
  errors: number;
}> => {
  const now = new Date();
  let expired = 0;
  let errors = 0;

  try {
    const result = await prisma.sessionRequest.updateMany({
      where: {
        status: 'voting',
        voteDeadline: {
          lt: now
        }
      },
      data: {
        status: 'expired'
      }
    });

    expired = result.count;
    return { expired, errors };
  } catch (error) {
    logger.error('Error in expireOldEventRequests', 'SessionStatusUpdater', { error });
    errors++;
    return { expired, errors };
  }
};

/**
 * Run all maintenance tasks
 */
export const runEventMaintenance = async (): Promise<{
  statusesUpdated: number;
  eventsArchived: number;
  requestsExpired: number;
  errors: number;
}> => {
  logger.info('Starting session maintenance', 'SessionStatusUpdater');
  
  const statusResult = await updateSessionStatuses();
  const archiveResult = await archiveOldEvents(EVENT_CONFIG.DEFAULT_ARCHIVE_DAYS);
  const expireResult = await expireOldEventRequests();

  const summary = {
    statusesUpdated: statusResult.updated,
    eventsArchived: archiveResult.archived,
    requestsExpired: expireResult.expired,
    errors: statusResult.errors + archiveResult.errors + expireResult.errors
  };

  logger.info('Event maintenance complete', 'SessionStatusUpdater', summary);
  return summary;
};
