import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initializeQueryMonitoring,
  queryMonitorMiddleware,
  trackQuery,
  batchQuery,
} from '../../middleware/queryMonitor';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the dynamic import used in getConnectionPoolStats
vi.mock('../../config/database', () => ({
  getPool: vi.fn(() => ({})),
}));

import { logger } from '../../utils/logger';

let reqIdCounter = 0;

const createMockReqRes = (overrides: Record<string, unknown> = {}) => {
  const req: any = {
    method: 'GET',
    path: '/test',
    id: `req-${++reqIdCounter}`,
    ...overrides,
  };
  const res: any = {
    end: vi.fn(),
  };
  const next = vi.fn();
  return { req, res, next };
};

describe('initializeQueryMonitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls logger.info', () => {
    initializeQueryMonitoring();
    expect(logger.info).toHaveBeenCalledWith(
      'Query monitoring initialized',
      'QueryMonitor'
    );
  });
});

describe('queryMonitorMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next()', () => {
    const { req, res, next } = createMockReqRes();
    queryMonitorMiddleware()(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('patches res.end to a new function', () => {
    const { req, res, next } = createMockReqRes();
    const originalEnd = res.end;
    queryMonitorMiddleware()(req, res, next);
    expect(res.end).not.toBe(originalEnd);
  });

  it('does NOT call logger.warn when there are no slow queries and count < 50', () => {
    const { req, res, next } = createMockReqRes();
    queryMonitorMiddleware()(req, res, next);

    // A couple of normal-speed queries
    trackQuery(req.id, 'SELECT 1', 100);
    trackQuery(req.id, 'SELECT 2', 200);

    res.end();

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('calls logger.warn with slow query info when slow queries exist', () => {
    const { req, res, next } = createMockReqRes();
    queryMonitorMiddleware()(req, res, next);

    // Slow query: duration > 1000ms
    trackQuery(req.id, 'SELECT slow_thing FROM big_table', 1500);

    res.end();

    expect(logger.warn).toHaveBeenCalledWith(
      'Request with slow queries detected',
      'QueryMonitor',
      expect.objectContaining({
        method: 'GET',
        path: '/test',
        slowQueries: expect.arrayContaining([
          expect.objectContaining({ duration: 1500 }),
        ]),
      })
    );
  });

  it('calls logger.warn with high query count when query count exceeds 50', () => {
    const { req, res, next } = createMockReqRes();
    queryMonitorMiddleware()(req, res, next);

    // Add 51 queries with normal duration
    for (let i = 0; i < 51; i++) {
      trackQuery(req.id, `SELECT ${i}`, 10);
    }

    res.end();

    expect(logger.warn).toHaveBeenCalledWith(
      'Request with high query count',
      'QueryMonitor',
      expect.objectContaining({ queryCount: 51 })
    );
  });

  it('cleans up the metrics entry from the store after res.end()', () => {
    const { req, res, next } = createMockReqRes();
    queryMonitorMiddleware()(req, res, next);

    res.end();
    vi.clearAllMocks();

    // Calling trackQuery after end should be a no-op (entry was deleted)
    expect(() => trackQuery(req.id, 'SELECT 1', 9999)).not.toThrow();
    // No additional warn since the store no longer has the entry
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('trackQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not throw when requestId is undefined', () => {
    expect(() => trackQuery(undefined, 'SELECT 1', 100)).not.toThrow();
  });

  it('does not throw when requestId is unknown (not in store)', () => {
    expect(() => trackQuery('nonexistent-id', 'SELECT 1', 100)).not.toThrow();
  });

  it('does not call logger.error for a normal duration query', () => {
    const { req, res, next } = createMockReqRes();
    queryMonitorMiddleware()(req, res, next);

    trackQuery(req.id, 'SELECT 1', 500);

    expect(logger.error).not.toHaveBeenCalled();
    res.end();
  });

  it('adds query to slowQueries when duration exceeds 1000ms', () => {
    const { req, res, next } = createMockReqRes();
    queryMonitorMiddleware()(req, res, next);

    trackQuery(req.id, 'SELECT * FROM large_table', 1200);

    res.end();

    expect(logger.warn).toHaveBeenCalledWith(
      'Request with slow queries detected',
      'QueryMonitor',
      expect.objectContaining({
        slowQueries: expect.arrayContaining([
          expect.objectContaining({ query: 'SELECT * FROM large_table', duration: 1200 }),
        ]),
      })
    );
  });

  it('calls logger.error immediately when duration exceeds 3000ms', () => {
    const { req, res, next } = createMockReqRes();
    queryMonitorMiddleware()(req, res, next);

    trackQuery(req.id, 'SELECT * FROM very_large_table', 5000);

    expect(logger.error).toHaveBeenCalledWith(
      'Very slow query detected',
      'QueryMonitor',
      expect.objectContaining({ duration: 5000 })
    );
    res.end();
  });

  it('truncates long query strings to 200 characters in slowQueries', () => {
    const { req, res, next } = createMockReqRes();
    queryMonitorMiddleware()(req, res, next);

    const longQuery = 'SELECT ' + 'a'.repeat(300);
    trackQuery(req.id, longQuery, 1500);

    res.end();

    expect(logger.warn).toHaveBeenCalledWith(
      'Request with slow queries detected',
      'QueryMonitor',
      expect.objectContaining({
        slowQueries: expect.arrayContaining([
          expect.objectContaining({
            query: longQuery.substring(0, 200),
          }),
        ]),
      })
    );
  });
});

describe('batchQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes all queries in parallel and returns results', async () => {
    const queries = [
      vi.fn().mockResolvedValue('result-1'),
      vi.fn().mockResolvedValue('result-2'),
      vi.fn().mockResolvedValue('result-3'),
    ];

    const results = await batchQuery(queries, { parallel: true });

    expect(results).toEqual(['result-1', 'result-2', 'result-3']);
    queries.forEach(q => expect(q).toHaveBeenCalledOnce());
  });

  it('executes all queries sequentially when parallel is false', async () => {
    const callOrder: number[] = [];
    const queries = [0, 1, 2].map(i =>
      vi.fn().mockImplementation(async () => {
        callOrder.push(i);
        return `result-${i}`;
      })
    );

    const results = await batchQuery(queries, { parallel: false });

    expect(results).toEqual(['result-0', 'result-1', 'result-2']);
    expect(callOrder).toEqual([0, 1, 2]);
  });

  it('respects batchSize when splitting queries into chunks', async () => {
    const queries = Array.from({ length: 5 }, (_, i) =>
      vi.fn().mockResolvedValue(`r${i}`)
    );

    const results = await batchQuery(queries, { parallel: true, batchSize: 2 });

    expect(results).toHaveLength(5);
    queries.forEach(q => expect(q).toHaveBeenCalledOnce());
  });

  it('rejects and calls logger.error when any query throws', async () => {
    const error = new Error('db failure');
    const queries = [
      vi.fn().mockResolvedValue('ok'),
      vi.fn().mockRejectedValue(error),
    ];

    await expect(batchQuery(queries)).rejects.toThrow('db failure');
    expect(logger.error).toHaveBeenCalledWith(
      'Batch query execution failed',
      'QueryMonitor',
      expect.objectContaining({ error })
    );
  });

  it('returns an empty array when given an empty query list', async () => {
    const results = await batchQuery([]);
    expect(results).toEqual([]);
  });

  it('calls logger.warn when total batch duration exceeds 1000ms', async () => {
    const dateSpy = vi.spyOn(Date, 'now');
    let calls = 0;
    dateSpy.mockImplementation(() => (calls++ === 0 ? 0 : 2000));

    const queries = [vi.fn().mockResolvedValue('ok')];

    await batchQuery(queries, { parallel: true });

    expect(logger.warn).toHaveBeenCalledWith(
      'Slow batch query execution',
      'QueryMonitor',
      expect.objectContaining({ queryCount: 1, parallel: true })
    );

    dateSpy.mockRestore();
  });
});
