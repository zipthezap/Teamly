/**
 * Database Health Check Utilities
 * Provides health check and graceful shutdown functionality
 */

import prisma from '../config/database';
import { logger } from '../utils/logger';

export interface DatabaseHealthDetails {
  connected: boolean;
  responseTime?: number;
  error?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  database: DatabaseHealthDetails;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

/**
 * Checks if the database connection is healthy
 * @returns Promise<DatabaseHealthDetails> - database health information
 */
export const checkDatabaseHealth = async (): Promise<DatabaseHealthDetails> => {
  const startTime = Date.now();
  
  try {
    // Try to execute a simple query
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    
    return {
      connected: true,
      responseTime,
    };
  } catch (error) {
    logger.error('Database health check failed', 'DatabaseHealth', { error });
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Performs a comprehensive health check
 * @returns Promise<HealthCheckResult> - complete health check results
 */
export const performHealthCheck = async (): Promise<HealthCheckResult> => {
  const database = await checkDatabaseHealth();
  
  // Get memory usage
  const memoryUsage = process.memoryUsage();
  const totalMemory = memoryUsage.heapTotal;
  const usedMemory = memoryUsage.heapUsed;
  const memoryPercentage = Math.round((usedMemory / totalMemory) * 100);
  
  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (!database.connected) {
    status = 'unhealthy';
  } else if (database.responseTime && database.responseTime > 1000) {
    status = 'degraded'; // Slow database response
  } else if (memoryPercentage > 90) {
    status = 'degraded'; // High memory usage
  }
  
  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database,
    memory: {
      used: Math.round(usedMemory / 1024 / 1024), // MB
      total: Math.round(totalMemory / 1024 / 1024), // MB
      percentage: memoryPercentage,
    },
  };
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
