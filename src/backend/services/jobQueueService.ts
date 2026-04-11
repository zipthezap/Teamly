/**
 * Background Job Queue Service
 * 
 * Provides async job processing for heavy operations to improve API response times.
 * Jobs are processed in the background without blocking HTTP requests.
 * 
 * Uses Redis for distributed job queue if available, falls back to in-memory queue.
 * 
 * Benefits:
 * - API responses return immediately (< 50ms)
 * - Heavy operations processed asynchronously
 * - Automatic retry on failure
 * - Job persistence (with Redis)
 * - Scalable across multiple servers
 */

import { getRedisClient, isRedisEnabled } from '../config/redis';
import { logger } from '../utils/logger';
import { createBulkEventNotifications, createBulkGroupNotifications } from './bulkNotificationService';
import { CacheService } from './cacheService';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import {
  SessionNotificationType,
  GroupNotificationType,
} from '../../shared/types/session.types';

/**
 * Job types
 */
export type JobType = 
  | 'send_bulk_notifications'
  | 'invalidate_cache'
  | 'process_event_update'
  | 'cleanup_old_data'
  | 'send_email_batch';

/**
 * Job data structures for each job type
 */
export interface BulkNotificationJobData {
  type: 'session' | 'group';
  sessionId?: string;
  groupId?: string;
  userIds: string[];
  notificationType: string;
  params?: Prisma.JsonObject;
  metadata?: Prisma.JsonObject;
}

export interface CacheInvalidationJobData {
  patterns: string[];
}

export interface EventUpdateJobData {
  sessionId: string;
  groupId: string;
}

export interface DataCleanupJobData {
  [key: string]: unknown;
}

/**
 * Union type for all job data
 */
export type JobData =
  | BulkNotificationJobData
  | CacheInvalidationJobData
  | EventUpdateJobData
  | DataCleanupJobData;

/**
 * Job data structure
 */
export interface Job {
  id: string;
  type: JobType;
  data: JobData;
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
}

/**
 * Job processing status
 */
export interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

/**
 * In-memory job queue (fallback when Redis unavailable)
 */
class InMemoryJobQueue {
  private queue: Job[] = [];
  private processing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly maxQueueSize = parseInt(process.env.JOB_QUEUE_MAX_SIZE || '1000', 10);

  constructor() {
    // Process jobs every 100ms
    this.processingInterval = setInterval(() => this.processJobs(), 100);
  }

  async enqueue(job: Job): Promise<void> {
    if (this.queue.length >= this.maxQueueSize) {
      logger.warn('Job queue is full, dropping oldest job', 'JobQueue', {
        queueSize: this.queue.length,
        droppedJob: this.queue[0].id,
      });
      this.queue.shift(); // Remove oldest job
    }

    this.queue.push(job);
    logger.debug(`Job enqueued: ${job.type}`, 'JobQueue', { jobId: job.id });
  }

  private async processJobs(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      const job = this.queue.shift();
      if (job) {
        await processJobInternal(job);
      }
    } catch (error) {
      logger.error('Error processing job', 'JobQueue', { error });
    } finally {
      this.processing = false;
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  destroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.queue = [];
  }
}

/**
 * Redis-based job queue (for production)
 */
class RedisJobQueue {
  private readonly queueKey = 'job_queue';
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Process jobs every 100ms
    this.processingInterval = setInterval(() => this.processJobs(), 100);
  }

  async enqueue(job: Job): Promise<void> {
    const redis = getRedisClient();
    if (!redis) {
      throw new Error('Redis client not available');
    }

    const jobData = JSON.stringify(job);
    await redis.rPush(this.queueKey, jobData);
    
    logger.debug(`Job enqueued to Redis: ${job.type}`, 'JobQueue', { jobId: job.id });
  }

  private async processJobs(): Promise<void> {
    const redis = getRedisClient();
    if (!redis) {
      return;
    }

    try {
      // Get job from queue (blocking pop with 0 timeout = non-blocking)
      const jobData = await redis.lPop(this.queueKey);
      
      if (jobData) {
        const job: Job = JSON.parse(jobData);
        await processJobInternal(job);
      }
    } catch (error) {
      logger.error('Error processing job from Redis', 'JobQueue', { error });
    }
  }

  async getQueueSize(): Promise<number> {
    const redis = getRedisClient();
    if (!redis) {
      return 0;
    }

    return await redis.lLen(this.queueKey);
  }

  destroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }
}

/**
 * Process a single job
 */
async function processJobInternal(job: Job): Promise<void> {
  const startTime = Date.now();
  
  try {
    logger.info(`Processing job: ${job.type}`, 'JobQueue', { jobId: job.id });

    switch (job.type) {
      case 'send_bulk_notifications':
        await handleBulkNotifications(job.data as BulkNotificationJobData);
        break;
      
      case 'invalidate_cache':
        await handleCacheInvalidation(job.data as CacheInvalidationJobData);
        break;
      
      case 'process_event_update':
        await handleEventUpdate(job.data as EventUpdateJobData);
        break;
      
      case 'cleanup_old_data':
        await handleDataCleanup(job.data as DataCleanupJobData);
        break;
      
      default:
        logger.warn(`Unknown job type: ${job.type}`, 'JobQueue', { jobId: job.id });
    }

    const duration = Date.now() - startTime;
    logger.info(`Job completed: ${job.type}`, 'JobQueue', { 
      jobId: job.id, 
      duration: `${duration}ms` 
    });
  } catch (error) {
    job.attempts += 1;

    logger.error(`Job failed: ${job.type}`, 'JobQueue', { 
      jobId: job.id, 
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      error 
    });

    // Retry if not exceeded max attempts
    if (job.attempts < job.maxAttempts) {
      const delay = Math.min(1000 * Math.pow(2, job.attempts), 30000); // Exponential backoff, max 30s
      logger.info(`Retrying job in ${delay}ms`, 'JobQueue', { jobId: job.id });
      
      setTimeout(async () => {
        await jobQueue.enqueue(job);
      }, delay);
    } else {
      logger.error(`Job exceeded max attempts, discarding`, 'JobQueue', { jobId: job.id });
    }
  }
}

/**
 * Job handlers
 */

async function handleBulkNotifications(data: BulkNotificationJobData): Promise<void> {
  const { type, sessionId, groupId, userIds, notificationType, params, metadata } = data;

  if (type === 'session' && sessionId) {
    await createBulkEventNotifications(sessionId, userIds, notificationType as SessionNotificationType, params, metadata);
  } else if (type === 'group' && groupId) {
    await createBulkGroupNotifications(groupId, userIds, notificationType as GroupNotificationType, params);
  }
}

async function handleCacheInvalidation(data: CacheInvalidationJobData): Promise<void> {
  const { patterns } = data;

  for (const pattern of patterns) {
    await CacheService.deletePattern(pattern);
  }
}

async function handleEventUpdate(data: EventUpdateJobData): Promise<void> {
  // Handle session updates that require cache invalidation
  const { sessionId, groupId } = data;

  await Promise.all([
    CacheService.deletePattern(`events:*:group:${groupId}:*`),
    CacheService.deletePattern(`session:${sessionId}:*`),
  ]);
}

async function handleDataCleanup(data: DataCleanupJobData): Promise<void> {
  // Implement data cleanup logic
  logger.info('Data cleanup job executed', 'JobQueue', data);
}

/**
 * Singleton job queue instance
 */
let jobQueue: InMemoryJobQueue | RedisJobQueue;

/**
 * Initialize job queue
 */
export function initializeJobQueue(): void {
  if (isRedisEnabled()) {
    jobQueue = new RedisJobQueue();
    logger.info('Job queue initialized with Redis backend', 'JobQueue');
  } else {
    jobQueue = new InMemoryJobQueue();
    logger.info('Job queue initialized with in-memory backend', 'JobQueue');
  }
}

/**
 * Shutdown job queue
 */
export function shutdownJobQueue(): void {
  if (jobQueue) {
    jobQueue.destroy();
    logger.info('Job queue shut down', 'JobQueue');
  }
}

/**
 * Enqueue a job for background processing
 */
export async function enqueueJob(
  type: JobType,
  data: JobData,
  maxAttempts: number = 3
): Promise<string> {
  // Generate cryptographically secure unique ID for the job
  // Using crypto.randomUUID() ensures uniqueness even in high-concurrency scenarios
  const jobId = `${type}-${Date.now()}-${crypto.randomUUID()}`;
  
  const job: Job = {
    id: jobId,
    type,
    data,
    createdAt: new Date(),
    attempts: 0,
    maxAttempts,
  };

  await jobQueue.enqueue(job);
  
  return job.id;
}

/**
 * Get queue size
 */
export async function getQueueSize(): Promise<number> {
  if (jobQueue instanceof RedisJobQueue) {
    return await jobQueue.getQueueSize();
  } else {
    return jobQueue.getQueueSize();
  }
}

/**
 * Helper functions for common job types
 */

/**
 * Queue bulk notification job
 */
export async function queueBulkNotifications(
  type: 'session' | 'group',
  sessionId: string | undefined,
  groupId: string | undefined,
  userIds: string[],
  notificationType: string,
  params?: Record<string, unknown>,
  metadata?: Record<string, unknown>
): Promise<string> {
  return await enqueueJob('send_bulk_notifications', {
    type,
    sessionId,
    groupId,
    userIds,
    notificationType,
    params,
    metadata,
  });
}

/**
 * Queue cache invalidation job
 */
export async function queueCacheInvalidation(patterns: string[]): Promise<string> {
  return await enqueueJob('invalidate_cache', { patterns });
}

/**
 * Queue session update processing
 */
export async function queueEventUpdate(sessionId: string, groupId: string): Promise<string> {
  return await enqueueJob('process_event_update', { sessionId, groupId });
}
