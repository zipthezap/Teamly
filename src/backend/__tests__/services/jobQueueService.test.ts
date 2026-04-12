import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/redis', () => ({
  getRedisClient: vi.fn(() => null),
  isRedisEnabled: vi.fn(() => false),
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/bulkNotificationService', () => ({
  createBulkEventNotifications: vi.fn().mockResolvedValue([]),
  createBulkGroupNotifications: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/cacheService', () => ({
  CacheService: {
    deletePattern: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  },
}));

import {
  initializeJobQueue,
  shutdownJobQueue,
  enqueueJob,
  getQueueSize,
  queueBulkNotifications,
  queueCacheInvalidation,
  queueEventUpdate,
} from '../../services/jobQueueService';

describe('JobQueueService', () => {
  beforeEach(() => {
    initializeJobQueue();
  });

  describe('initializeJobQueue', () => {
    it('initializes job queue without throwing', () => {
      expect(() => initializeJobQueue()).not.toThrow();
    });
  });

  describe('enqueueJob', () => {
    it('returns a job id string', async () => {
      const jobId = await enqueueJob('invalidate_cache', { patterns: ['test:*'] });
      expect(typeof jobId).toBe('string');
      expect(jobId).toContain('invalidate_cache');
    });

    it('enqueues bulk notification job', async () => {
      const jobId = await enqueueJob('send_bulk_notifications', {
        type: 'session',
        sessionId: 'session-1',
        groupId: 'group-1',
        userIds: ['user-1', 'user-2'],
        notificationType: 'session_created',
      });
      expect(typeof jobId).toBe('string');
    });

    it('enqueues cache invalidation job', async () => {
      const jobId = await enqueueJob('invalidate_cache', { patterns: ['events:*', 'session:abc:*'] });
      expect(typeof jobId).toBe('string');
    });

    it('enqueues event update job', async () => {
      const jobId = await enqueueJob('process_event_update', { sessionId: 'session-1', groupId: 'group-1' });
      expect(typeof jobId).toBe('string');
    });

    it('generates unique job IDs', async () => {
      const id1 = await enqueueJob('invalidate_cache', { patterns: ['a:*'] });
      const id2 = await enqueueJob('invalidate_cache', { patterns: ['b:*'] });
      expect(id1).not.toBe(id2);
    });
  });

  describe('getQueueSize', () => {
    it('returns a number', async () => {
      const size = await getQueueSize();
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('queueBulkNotifications', () => {
    it('enqueues bulk notification job and returns id', async () => {
      const jobId = await queueBulkNotifications(
        'session',
        'session-123',
        'group-123',
        ['user-1', 'user-2'],
        'session_created',
        { sessionTitle: 'Test' }
      );
      expect(typeof jobId).toBe('string');
    });

    it('works with group type', async () => {
      const jobId = await queueBulkNotifications(
        'group',
        undefined,
        'group-456',
        ['user-3'],
        'group_created'
      );
      expect(typeof jobId).toBe('string');
    });
  });

  describe('queueCacheInvalidation', () => {
    it('enqueues cache invalidation job and returns id', async () => {
      const jobId = await queueCacheInvalidation(['events:*', 'session:xyz:*']);
      expect(typeof jobId).toBe('string');
    });
  });

  describe('queueEventUpdate', () => {
    it('enqueues event update job and returns id', async () => {
      const jobId = await queueEventUpdate('session-abc', 'group-xyz');
      expect(typeof jobId).toBe('string');
    });
  });

  describe('shutdownJobQueue', () => {
    it('shuts down without throwing', () => {
      expect(() => shutdownJobQueue()).not.toThrow();
    });
  });
});
