/**
 * Event Maintenance Script
 * Run this script periodically (e.g., via cron) to:
 * - Update event statuses based on time
 * - Archive old completed events
 * - Expire old event requests
 * 
 * Usage: ts-node scripts/eventMaintenance.ts
 * Or after build: node dist/backend/scripts/eventMaintenance.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Update event statuses based on current time
 */
async function updateEventStatuses() {
  const now = new Date();
  let updated = 0;
  let errors = 0;

  try {
    const events = await prisma.event.findMany({
      where: {
        archived: false,
        status: { not: 'cancelled' }
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true
      }
    });

    for (const event of events) {
      let newStatus = event.status;

      if (event.endTime && event.endTime < now) {
        newStatus = 'completed';
      } else if (event.startTime <= now && (!event.endTime || event.endTime >= now)) {
        newStatus = 'ongoing';
      } else if (event.startTime > now) {
        newStatus = 'upcoming';
      }

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
}

/**
 * Archive old completed events (older than 30 days)
 */
async function archiveOldEvents(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  try {
    const result = await prisma.event.updateMany({
      where: {
        archived: false,
        status: 'completed',
        endTime: { lt: cutoffDate }
      },
      data: { archived: true }
    });

    return { archived: result.count, errors: 0 };
  } catch (error) {
    console.error('Error in archiveOldEvents:', error);
    return { archived: 0, errors: 1 };
  }
}

/**
 * Expire old event requests
 */
async function expireOldEventRequests() {
  const now = new Date();
  
  try {
    const result = await prisma.eventRequest.updateMany({
      where: {
        status: 'voting',
        voteDeadline: { lt: now }
      },
      data: { status: 'expired' }
    });

    return { expired: result.count, errors: 0 };
  } catch (error) {
    console.error('Error in expireOldEventRequests:', error);
    return { expired: 0, errors: 1 };
  }
}

async function main() {
  try {
    console.log('=== Event Maintenance Job Started ===');
    console.log('Timestamp:', new Date().toISOString());
    
    const statusResult = await updateEventStatuses();
    const archiveResult = await archiveOldEvents(30);
    const expireResult = await expireOldEventRequests();

    console.log('=== Event Maintenance Job Completed ===');
    console.log('Summary:');
    console.log(`  - Event statuses updated: ${statusResult.updated}`);
    console.log(`  - Events archived: ${archiveResult.archived}`);
    console.log(`  - Event requests expired: ${expireResult.expired}`);
    console.log(`  - Total errors: ${statusResult.errors + archiveResult.errors + expireResult.errors}`);
    
    const totalErrors = statusResult.errors + archiveResult.errors + expireResult.errors;
    if (totalErrors > 0) {
      console.error('WARNING: Some operations failed. Check logs for details.');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('FATAL ERROR during event maintenance:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
