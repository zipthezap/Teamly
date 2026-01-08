/**
 * Database Health Check Utilities
 * Provides health check and graceful shutdown functionality
 */

import prisma from '../config/database';
import { logger } from '../utils/logger';

/**
 * Checks if the database connection is healthy
 * @returns Promise<boolean> - true if healthy, false otherwise
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    // Try to execute a simple query
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed', 'DatabaseHealth', { error });
    return false;
  }
};

/**
 * Performs graceful shutdown of database connection
 */
export const gracefulShutdown = async (): Promise<void> => {
  logger.info('Initiating graceful shutdown...', 'DatabaseHealth');
  
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed successfully', 'DatabaseHealth');
  } catch (error) {
    logger.error('Error during database disconnection', 'DatabaseHealth', { error });
    throw error;
  }
};

/**
 * Sets up graceful shutdown handlers for common termination signals
 */
export const setupGracefulShutdown = (): void => {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`Received ${signal} signal`, 'DatabaseHealth');
      
      try {
        await gracefulShutdown();
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', 'DatabaseHealth', { error });
        process.exit(1);
      }
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', 'DatabaseHealth', { error });
    gracefulShutdown()
      .then(() => process.exit(1))
      .catch(() => process.exit(1));
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', 'DatabaseHealth', { reason });
    gracefulShutdown()
      .then(() => process.exit(1))
      .catch(() => process.exit(1));
  });
};
