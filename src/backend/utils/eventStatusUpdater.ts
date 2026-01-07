/**
 * Event Status Updater Utility
 * Automatically updates event statuses based on current time
 */

import prisma from '../config/database';

/**
 * Update event statuses based on current time
 * - Events that have passed their end time -> 'completed'
 * - Events currently happening -> 'ongoing'
 * - Events in the future -> 'upcoming'
 */
export const updateEventStatuses = async (): Promise<{
  updated: number;
  errors: number;
}> => {
  const now = new Date();
  let updated = 0;
  let errors = 0;

  try {
    // Get all non-archived events that are not cancelled
    const events = await prisma.event.findMany({
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

    // Update each event based on time
    for (const event of events) {
      let newStatus = event.status;

      if (event.endTime && event.endTime < now) {
        // Event has ended
        newStatus = 'completed';
      } else if (event.startTime <= now) {
        // Event has started
        if (event.endTime && event.endTime >= now) {
          // Event is currently happening (has end time and hasn't ended)
          newStatus = 'ongoing';
        } else if (!event.endTime) {
          // Event has no end time - mark as ongoing if it started within the last 24 hours
          // Otherwise mark as completed
          const hoursSinceStart = (now.getTime() - event.startTime.getTime()) / (1000 * 60 * 60);
          newStatus = hoursSinceStart <= 24 ? 'ongoing' : 'completed';
        }
      } else if (event.startTime > now) {
        // Event hasn't started yet
        newStatus = 'upcoming';
      }

      // Only update if status has changed
      if (newStatus !== event.status) {
        try {
          await prisma.event.update({
            where: { id: event.id },
            data: { status: newStatus }
          });
          updated++;
        } catch (error) {
          console.error(`Failed to update event ${event.id}:`, error);
          errors++;
        }
      }
    }

    return { updated, errors };
  } catch (error) {
    console.error('Error in updateEventStatuses:', error);
    throw error;
  }
};

/**
 * Archive old completed events (older than specified days)
 */
export const archiveOldEvents = async (daysOld: number = 30): Promise<{
  archived: number;
  errors: number;
}> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  let archived = 0;
  let errors = 0;

  try {
    const result = await prisma.event.updateMany({
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
    console.error('Error in archiveOldEvents:', error);
    errors++;
    return { archived, errors };
  }
};

/**
 * Expire old event requests that have passed their deadline
 */
export const expireOldEventRequests = async (): Promise<{
  expired: number;
  errors: number;
}> => {
  const now = new Date();
  let expired = 0;
  let errors = 0;

  try {
    const result = await prisma.eventRequest.updateMany({
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
    console.error('Error in expireOldEventRequests:', error);
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
  console.log('Starting event maintenance...');
  
  const statusResult = await updateEventStatuses();
  const archiveResult = await archiveOldEvents(30);
  const expireResult = await expireOldEventRequests();

  const summary = {
    statusesUpdated: statusResult.updated,
    eventsArchived: archiveResult.archived,
    requestsExpired: expireResult.expired,
    errors: statusResult.errors + archiveResult.errors + expireResult.errors
  };

  console.log('Event maintenance complete:', summary);
  return summary;
};
