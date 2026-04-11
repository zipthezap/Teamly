/**
 * Database Query Optimization Utilities
 * 
 * This module provides utilities to optimize Prisma queries
 * and prevent common performance issues.
 */

import { logger } from './logger';

/**
 * Standard select fields for user data to prevent over-fetching
 */
export const USER_SELECT_MINIMAL = {
  id: true,
  name: true,
  email: true,
  profilePicture: true,
} as const;

/**
 * Standard select fields for group data
 */
export const GROUP_SELECT_MINIMAL = {
  id: true,
  name: true,
  description: true,
  sportType: true,
} as const;

/**
 * Standard select fields for session data
 */
export const EVENT_SELECT_MINIMAL = {
  id: true,
  title: true,
  description: true,
  sessionType: true,
  startTime: true,
  endTime: true,
  location: true,
  maxPlayers: true,
  status: true,
} as const;

/**
 * Batch size for bulk operations to prevent memory issues
 */
export const BATCH_SIZE = parseInt(process.env.DB_BATCH_SIZE || '100', 10);
const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 1000;

/**
 * Execute operations in batches to prevent memory issues with large datasets
 * 
 * @param items - Array of items to process
 * @param operation - Async function to execute for each batch
 * @param batchSize - Size of each batch (default: BATCH_SIZE, min: 1, max: 1000)
 */
export async function executeBatched<T, R>(
  items: T[],
  operation: (batch: T[]) => Promise<R>,
  batchSize: number = BATCH_SIZE
): Promise<R[]> {
  // Validate and sanitize batch size
  const validBatchSize = Math.max(MIN_BATCH_SIZE, Math.min(batchSize, MAX_BATCH_SIZE));
  
  if (validBatchSize !== batchSize) {
    logger.warn('Batch size adjusted to safe limits', 'QueryOptimization', {
      requested: batchSize,
      adjusted: validBatchSize
    });
  }
  
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += validBatchSize) {
    const batch = items.slice(i, i + validBatchSize);
    try {
      const result = await operation(batch);
      results.push(result);
    } catch (error) {
      logger.error('Batch operation failed', 'QueryOptimization', {
        batchIndex: Math.floor(i / validBatchSize),
        batchSize: batch.length,
        error
      });
      throw error;
    }
  }
  
  return results;
}

/**
 * Helper to create a safe pagination limit
 * 
 * @param limit - Requested limit (can be string, number, or undefined)
 * @param defaultLimit - Default limit to use if none provided
 * @param maxLimit - Maximum allowed limit
 */
export function sanitizePaginationLimit(
  limit: string | number | undefined,
  defaultLimit: number = 50,
  maxLimit: number = 100
): number {
  if (limit === undefined || limit === null) {
    return defaultLimit;
  }
  
  const parsed = typeof limit === 'string' ? parseInt(limit, 10) : limit;
  
  if (isNaN(parsed) || parsed < 1) {
    return defaultLimit;
  }
  
  return Math.min(parsed, maxLimit);
}

/**
 * Helper to create a safe pagination offset
 * 
 * @param offset - Requested offset (can be string, number, or undefined)
 */
export function sanitizePaginationOffset(
  offset: string | number | undefined
): number {
  if (offset === undefined || offset === null) {
    return 0;
  }
  
  const parsed = typeof offset === 'string' ? parseInt(offset, 10) : offset;
  
  if (isNaN(parsed) || parsed < 0) {
    return 0;
  }
  
  return parsed;
}

/**
 * Type for pagination parameters
 */
export interface PaginationParams {
  limit: number;
  offset: number;
}

/**
 * Type for pagination metadata
 */
export interface PaginationMetadata {
  limit: number;
  offset: number;
  total?: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Create pagination metadata for API responses
 */
export function createPaginationMetadata(
  params: PaginationParams,
  resultCount: number,
  total?: number,
  nextCursor?: string
): PaginationMetadata {
  return {
    limit: params.limit,
    offset: params.offset,
    total,
    hasMore: resultCount === params.limit,
    nextCursor
  };
}
