import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';
import { isPrismaQueryEvent } from '../utils/typeGuards';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Please set it in your environment variables.\n' +
    'Example: DATABASE_URL="postgresql://user:password@localhost:5432/teamly?schema=public"'
  );
}

// Enhanced connection pool configuration with optimized defaults
// These defaults are tuned for high-concurrency scenarios
const poolConfig: PoolConfig = {
  connectionString,
  // Maximum number of clients in the pool
  // Increased default from 20 to 50 for better high-concurrency handling
  // Formula: (CPU cores * 2) + effective_spindle_count
  // For most servers: 4-8 cores = 30-50 connections recommended
  max: parseInt(process.env.DB_POOL_MAX || '50', 10),
  // Minimum number of clients in the pool
  // Keep a baseline of active connections to avoid connection spin-up latency
  min: parseInt(process.env.DB_POOL_MIN || '5', 10),
  // Maximum time (ms) a client can remain idle before being closed
  // Reduced to 20s to free up connections faster for reuse
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '20000', 10),
  // Maximum time (ms) to wait for a connection from the pool
  // Increased to 10s to handle temporary spikes
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000', 10),
  // Maximum lifetime (seconds) of a connection in the pool
  // 30 minutes to avoid long-lived connection issues
  maxLifetimeSeconds: parseInt(process.env.DB_MAX_LIFETIME_SECONDS || '1800', 10),
  // Query timeout (ms) - how long a query can run before being cancelled
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT_MS || '30000', 10),
  // Statement timeout (ms) - server-side statement timeout
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '30000', 10),
};

const pool = new Pool(poolConfig);

// Log pool errors
pool.on('error', (err: Error) => {
  logger.error('Unexpected database pool error', 'Database', { error: err });
});

// Log pool connection events in development
if (process.env.NODE_ENV === 'development') {
  pool.on('connect', () => {
    logger.debug('New database connection established', 'Database');
  });
  
  pool.on('remove', () => {
    logger.debug('Database connection removed from pool', 'Database');
  });
}

const adapter = new PrismaPg(pool);

// Enhanced Prisma Client with query logging and error handling
const prisma = new PrismaClient({ 
  adapter,
  log: process.env.NODE_ENV === 'development' 
    ? [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ]
    : [
        { level: 'error', emit: 'event' },
      ],
});

// Log slow queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: unknown) => {
    if (!isPrismaQueryEvent(e)) {
      return;
    }
    if (e.duration > 1000) { // Log queries taking more than 1 second
      logger.warn('Slow query detected', 'Database', {
        query: e.query,
        duration: `${e.duration}ms`,
        params: e.params,
      });
    }
  });
}

// Log database errors
prisma.$on('error' as never, (e: unknown) => {
  logger.error('Database error', 'Database', { error: e });
});

// Log warnings
prisma.$on('warn' as never, (e: unknown) => {
  logger.warn('Database warning', 'Database', { warning: e });
});

// Graceful shutdown handler for database connections
export const closeDatabaseConnections = async (): Promise<void> => {
  try {
    logger.info('Closing database connections...', 'Database');
    await prisma.$disconnect();
    await pool.end();
    logger.info('Database connections closed successfully', 'Database');
  } catch (error) {
    logger.error('Error closing database connections', 'Database', { error });
    throw error;
  }
};

/**
 * Get connection pool for monitoring
 */
export const getPool = () => pool;

/**
 * Get connection pool metrics for monitoring and observability
 * 
 * @returns Object with current pool statistics
 */
export const getPoolMetrics = () => {
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
    maxConnections: poolConfig.max,
    minConnections: poolConfig.min,
    // Safe division: only calculate if max > 0, otherwise 0%
    utilizationPercent: (poolConfig.max && poolConfig.max > 0) 
      ? Math.round((pool.totalCount / poolConfig.max) * 100) 
      : 0,
  };
};

/**
 * Log connection pool metrics
 * Useful for monitoring and debugging connection pool issues
 */
export const logPoolMetrics = () => {
  const metrics = getPoolMetrics();
  logger.info('Database connection pool metrics', 'Database', metrics);
  
  // Warn if pool utilization is high
  if (metrics.utilizationPercent > 80) {
    logger.warn(
      'Database connection pool utilization is high. Consider increasing DB_POOL_MAX',
      'Database',
      metrics
    );
  }
  
  // Warn if there are waiting clients
  if (metrics.waitingClients > 0) {
    logger.warn(
      'Clients waiting for database connections. Pool may be exhausted',
      'Database',
      metrics
    );
  }
};

/**
 * Initialize periodic connection pool monitoring
 * Logs pool metrics every 60 seconds in production
 */
export const initializePoolMonitoring = () => {
  if (process.env.NODE_ENV === 'production') {
    // Log pool metrics every 60 seconds
    setInterval(() => {
      logPoolMetrics();
    }, 60000);
    
    logger.info('Database connection pool monitoring initialized', 'Database');
  }
};

export default prisma;
