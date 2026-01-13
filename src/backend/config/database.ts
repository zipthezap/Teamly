import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Please set it in your environment variables.\n' +
    'Example: DATABASE_URL="postgresql://user:password@localhost:5432/teamly?schema=public"'
  );
}

// Enhanced connection pool configuration
const poolConfig: PoolConfig = {
  connectionString,
  // Maximum number of clients in the pool
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  // Minimum number of clients in the pool
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  // Maximum time (ms) a client can remain idle before being closed
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
  // Maximum time (ms) to wait for a connection from the pool
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
  // Maximum lifetime (ms) of a connection in the pool
  maxLifetimeSeconds: parseInt(process.env.DB_MAX_LIFETIME_SECONDS || '1800', 10),
  // Query timeout (ms) - how long a query can run before being cancelled
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT_MS || '30000', 10),
  // Statement timeout (ms) - server-side statement timeout
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '30000', 10),
};

const pool = new Pool(poolConfig);

// Log pool errors
pool.on('error', (err) => {
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
  prisma.$on('query' as never, (e: any) => {
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
prisma.$on('error' as never, (e: any) => {
  logger.error('Database error', 'Database', { error: e });
});

// Log warnings
prisma.$on('warn' as never, (e: any) => {
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

export default prisma;
