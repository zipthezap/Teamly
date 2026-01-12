/**
 * Database Health Check Utilities
 * Provides health check and graceful shutdown functionality
 */

import prisma from '../config/database';
import { logger } from '../utils/logger';
import { checkRedisHealth, isRedisEnabled } from '../config/redis';

export interface DatabaseHealthDetails {
  connected: boolean;
  responseTime?: number;
  error?: string;
}

export interface RedisHealthDetails {
  enabled: boolean;
  connected?: boolean;
  latency?: number;
  error?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  database: DatabaseHealthDetails;
  redis: RedisHealthDetails;
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
  
  // Check Redis health
  const redisHealthCheck = await checkRedisHealth();
  const redis: RedisHealthDetails = {
    enabled: isRedisEnabled(),
    connected: redisHealthCheck.status === 'healthy',
    latency: redisHealthCheck.latency,
    error: redisHealthCheck.error,
  };
  
  // Get memory usage
  const memoryUsage = process.memoryUsage();
  const totalMemory = memoryUsage.heapTotal;
  const usedMemory = memoryUsage.heapUsed;
  const memoryPercentage = Math.round((usedMemory / totalMemory) * 100);
  
  // Configurable thresholds
  const slowDbThreshold = parseInt(process.env.HEALTH_CHECK_DB_SLOW_MS || '1000', 10);
  const memoryThreshold = parseInt(process.env.HEALTH_CHECK_MEMORY_THRESHOLD || '90', 10);
  
  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (!database.connected) {
    status = 'unhealthy';
  } else if (redis.enabled && !redis.connected) {
    status = 'degraded'; // Redis is optional, so degraded instead of unhealthy
  } else if (database.responseTime && database.responseTime > slowDbThreshold) {
    status = 'degraded'; // Slow database response
  } else if (memoryPercentage > memoryThreshold) {
    status = 'degraded'; // High memory usage
  }
  
  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database,
    redis,
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
