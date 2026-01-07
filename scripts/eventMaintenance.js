/**
 * Event Maintenance Script
 * Run this script periodically (e.g., via cron) to:
 * - Update event statuses based on time
 * - Archive old completed events
 * - Expire old event requests
 * 
 * Usage: node scripts/eventMaintenance.js
 * Note: Requires compiled TypeScript - run `npm run build` first
 * 
 * For development: ts-node -r dotenv/config scripts/eventMaintenance.js
 */

// Import from the compiled TypeScript utilities
const { updateEventStatuses, archiveOldEvents, expireOldEventRequests } = require('../dist/backend/utils/eventStatusUpdater');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('=== Event Maintenance Job Started ===');
    console.log('Timestamp:', new Date().toISOString());
    
    // Use the utility functions from the compiled TypeScript
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
    console.error('Make sure to run `npm run build` before executing this script');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
