/**
 * Database Health Utility Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkDatabaseHealth,
  performHealthCheck,
  gracefulShutdown,
  setupGracefulShutdown,
} from '../../utils/databaseHealth';
import prisma from '../../config/database';
import { checkRedisHealth, isRedisEnabled } from '../../config/redis';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../config/database', () => ({
  default: {
    $queryRaw: vi.fn(),
    $disconnect: vi.fn(),
  },
  getPool: vi.fn().mockReturnValue({ totalCount: 5, idleCount: 3 }),
}));

vi.mock('../../config/redis', () => ({
  checkRedisHealth: vi.fn(),
  isRedisEnabled: vi.fn(),
  getRedisClient: vi.fn(() => null),
}));

const mockPrisma = prisma as {
  $queryRaw: ReturnType<typeof vi.fn>;
  $disconnect: ReturnType<typeof vi.fn>;
};

const mockCheckRedisHealth = checkRedisHealth as ReturnType<typeof vi.fn>;
const mockIsRedisEnabled = isRedisEnabled as ReturnType<typeof vi.fn>;

// ─── checkDatabaseHealth ────────────────────────────────────────────────────

describe('checkDatabaseHealth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns connected=true with a numeric responseTime on success', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await checkDatabaseHealth();

    expect(result.connected).toBe(true);
    expect(typeof result.responseTime).toBe('number');
  });

  it('includes pool stats with total, idle, and active counts', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const result = await checkDatabaseHealth();

    expect(result.pool).toBeDefined();
    expect(result.pool?.total).toBe(5);
    expect(result.pool?.idle).toBe(3);
    expect(result.pool?.active).toBe(2); // totalCount - idleCount
  });

  it('returns connected=false with an error string when $queryRaw throws', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    const result = await checkDatabaseHealth();

    expect(result.connected).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.error).toContain('connection refused');
  });
});

// ─── performHealthCheck ─────────────────────────────────────────────────────

describe('performHealthCheck', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns status=healthy when DB is fast and redis is healthy', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockIsRedisEnabled.mockReturnValue(true);
    mockCheckRedisHealth.mockResolvedValue({ status: 'healthy', latency: 1 });

    const result = await performHealthCheck();

    expect(result.status).toBe('healthy');
  });

  it('returns status=degraded when DB response is slow', async () => {
    // Simulate a 2000ms response time by advancing Date.now between calls
    let callCount = 0;
    const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => (callCount++ === 0 ? 0 : 2000));

    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockIsRedisEnabled.mockReturnValue(false);
    mockCheckRedisHealth.mockResolvedValue({ status: 'healthy', latency: 1 });

    const result = await performHealthCheck();

    expect(result.status).toBe('degraded');
    dateSpy.mockRestore();
  });

  it('returns status=degraded when redis is enabled but not connected', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockIsRedisEnabled.mockReturnValue(true);
    mockCheckRedisHealth.mockResolvedValue({ status: 'unhealthy', error: 'timeout' });

    const result = await performHealthCheck();

    expect(result.status).toBe('degraded');
  });

  it('returns status=unhealthy when the DB is disconnected', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('no connection'));
    mockIsRedisEnabled.mockReturnValue(false);
    mockCheckRedisHealth.mockResolvedValue({ status: 'healthy' });

    const result = await performHealthCheck();

    expect(result.status).toBe('unhealthy');
  });

  it('returns status=degraded when memory usage exceeds the threshold', async () => {
    process.env.HEALTH_CHECK_MEMORY_THRESHOLD = '90';
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockIsRedisEnabled.mockReturnValue(false);
    mockCheckRedisHealth.mockResolvedValue({ status: 'healthy' });

    const memorySpy = vi.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 950 * 1024 * 1024,
      heapTotal: 1000 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
      rss: 0,
    } as NodeJS.MemoryUsage);

    const result = await performHealthCheck();

    expect(result.status).toBe('degraded');
    memorySpy.mockRestore();
    delete process.env.HEALTH_CHECK_MEMORY_THRESHOLD;
  });

  it('always includes timestamp, uptime, database, redis, and memory fields', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockIsRedisEnabled.mockReturnValue(false);
    mockCheckRedisHealth.mockResolvedValue({ status: 'healthy' });

    const result = await performHealthCheck();

    expect(typeof result.timestamp).toBe('string');
    expect(typeof result.uptime).toBe('number');
    expect(result.database).toBeDefined();
    expect(result.redis).toBeDefined();
    expect(result.memory).toBeDefined();
    expect(typeof result.memory.used).toBe('number');
    expect(typeof result.memory.total).toBe('number');
    expect(typeof result.memory.percentage).toBe('number');
  });
});

// ─── gracefulShutdown ───────────────────────────────────────────────────────

describe('gracefulShutdown', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls prisma.$disconnect and resolves', async () => {
    mockPrisma.$disconnect.mockResolvedValue(undefined);

    await expect(gracefulShutdown()).resolves.toBeUndefined();
    expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
  });

  it('rethrows when $disconnect throws', async () => {
    mockPrisma.$disconnect.mockRejectedValue(new Error('disconnect error'));

    await expect(gracefulShutdown()).rejects.toThrow('disconnect error');
  });
});

// ─── setupGracefulShutdown ──────────────────────────────────────────────────

describe('setupGracefulShutdown', () => {
  it('registers handlers for SIGTERM and SIGINT', () => {
    const processOnSpy = vi
      .spyOn(process, 'on')
      .mockImplementation(() => process);

    setupGracefulShutdown();

    const registeredEvents = processOnSpy.mock.calls.map(([event]) => event);
    expect(registeredEvents).toContain('SIGTERM');
    expect(registeredEvents).toContain('SIGINT');

    processOnSpy.mockRestore();
  });
});
