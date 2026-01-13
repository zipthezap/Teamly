/**
 * Query Monitoring Middleware
 * 
 * Monitors database query performance and logs slow queries
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Query performance thresholds in milliseconds
 */
const QUERY_THRESHOLDS = {
  SLOW: 1000,      // Warn for queries over 1 second
  VERY_SLOW: 3000, // Error for queries over 3 seconds
};

/**
 * Track active queries per request
 */
interface QueryMetrics {
  count: number;
  totalDuration: number;
  slowQueries: Array<{
    query: string;
    duration: number;
  }>;
}

/**
 * Request context storage for query metrics
 */
const queryMetricsStore = new Map<string, QueryMetrics>();

/**
 * Initialize query monitoring for Prisma
 */
export function initializeQueryMonitoring(): void {
  // Note: This requires Prisma logging to be enabled in database.ts
  // The actual monitoring happens via Prisma's event emitters
  logger.info('Query monitoring initialized', 'QueryMonitor');
}

/**
 * Middleware to track query metrics per request
 */
export function queryMonitorMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.id || `${Date.now()}-${Math.random()}`;
    const startTime = Date.now();

    // Initialize metrics for this request
    queryMetricsStore.set(requestId, {
      count: 0,
      totalDuration: 0,
      slowQueries: [],
    });

    // Attach request ID for tracking
    (req as any).queryRequestId = requestId;

    // Intercept response end to log metrics
    const originalEnd = res.end;
    res.end = function (this: Response, ...args: any[]): Response {
      const metrics = queryMetricsStore.get(requestId);
      const requestDuration = Date.now() - startTime;

      if (metrics) {
        // Log request summary if there were slow queries
        if (metrics.slowQueries.length > 0) {
          logger.warn('Request with slow queries detected', 'QueryMonitor', {
            method: req.method,
            path: req.path,
            requestDuration,
            queryCount: metrics.count,
            totalQueryDuration: metrics.totalDuration,
            slowQueries: metrics.slowQueries,
          });
        } else if (metrics.count > 50) {
          // Log if too many queries (potential N+1 problem)
          logger.warn('Request with high query count', 'QueryMonitor', {
            method: req.method,
            path: req.path,
            requestDuration,
            queryCount: metrics.count,
            totalQueryDuration: metrics.totalDuration,
          });
        }

        // Clean up
        queryMetricsStore.delete(requestId);
      }

      return originalEnd.apply(this, args as any);
    };

    next();
  };
}

/**
 * Track a database query
 * This should be called from database query interceptors
 */
export function trackQuery(requestId: string | undefined, query: string, duration: number): void {
  if (!requestId) return;

  const metrics = queryMetricsStore.get(requestId);
  if (!metrics) return;

  metrics.count++;
  metrics.totalDuration += duration;

  // Track slow queries
  if (duration > QUERY_THRESHOLDS.SLOW) {
    metrics.slowQueries.push({
      query: query.substring(0, 200), // Truncate long queries
      duration,
    });

    // Log very slow queries immediately
    if (duration > QUERY_THRESHOLDS.VERY_SLOW) {
      logger.error('Very slow query detected', 'QueryMonitor', {
        query: query.substring(0, 500),
        duration,
      });
    }
  }
}

/**
 * Batch query helper
 * Executes multiple queries efficiently and tracks performance
 */
export async function batchQuery<T>(
  queries: Array<() => Promise<T>>,
  options: {
    parallel?: boolean;
    batchSize?: number;
  } = {}
): Promise<T[]> {
  const { parallel = true, batchSize = 10 } = options;
  const startTime = Date.now();

  try {
    let results: T[];

    if (parallel) {
      // Execute in batches to avoid overwhelming the connection pool
      results = [];
      for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(q => q()));
        results.push(...batchResults);
      }
    } else {
      // Execute sequentially
      results = [];
      for (const query of queries) {
        results.push(await query());
      }
    }

    const duration = Date.now() - startTime;
    
    if (duration > QUERY_THRESHOLDS.SLOW) {
      logger.warn('Slow batch query execution', 'QueryMonitor', {
        queryCount: queries.length,
        duration,
        parallel,
        batchSize,
      });
    }

    return results;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Batch query execution failed', 'QueryMonitor', {
      queryCount: queries.length,
      duration,
      error,
    });
    throw error;
  }
}

/**
 * Connection pool statistics
 */
export async function getConnectionPoolStats(): Promise<{
  total: number;
  idle: number;
  waiting: number;
}> {
  try {
    // Get pool stats from the database config
    const { getPool } = await import('../config/database');
    const pool = getPool();
    
    return {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };
  } catch (error) {
    logger.error('Failed to get connection pool stats', 'QueryMonitor', { error });
    return {
      total: 0,
      idle: 0,
      waiting: 0,
    };
  }
}

logger.info('Query monitor module initialized', 'QueryMonitor');
