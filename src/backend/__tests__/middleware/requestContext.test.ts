import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { requestContext, performanceMonitor } from '../../middleware/requestContext';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { logger } from '../../utils/logger';

const createMockReq = (overrides: Record<string, unknown> = {}) => ({
  method: 'GET',
  path: '/test',
  query: {},
  ip: '127.0.0.1',
  headers: {} as Record<string, string>,
  id: undefined as string | undefined,
  startTime: undefined as number | undefined,
  ...overrides,
});

const createMockRes = () => {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    setHeader: vi.fn(),
    statusCode: 200,
  });
};

describe('requestContext middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets req.id to a generated value when no x-request-id header is present', () => {
    const req = createMockReq() as any;
    const res = createMockRes() as any;
    const next = vi.fn();

    requestContext(req, res, next);

    expect(req.id).toBeDefined();
    expect(typeof req.id).toBe('string');
    expect(req.id.length).toBeGreaterThan(0);
  });

  it('uses x-request-id header value as req.id when present', () => {
    const req = createMockReq({
      headers: { 'x-request-id': 'custom-id-abc' },
    }) as any;
    const res = createMockRes() as any;
    const next = vi.fn();

    requestContext(req, res, next);

    expect(req.id).toBe('custom-id-abc');
  });

  it('sets req.startTime to a number', () => {
    const req = createMockReq() as any;
    const res = createMockRes() as any;
    const next = vi.fn();

    requestContext(req, res, next);

    expect(typeof req.startTime).toBe('number');
    expect(req.startTime).toBeGreaterThan(0);
  });

  it('calls res.setHeader with X-Request-ID and the assigned req.id', () => {
    const req = createMockReq() as any;
    const res = createMockRes() as any;
    const next = vi.fn();

    requestContext(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.id);
  });

  it('calls logger.info on entry', () => {
    const req = createMockReq() as any;
    const res = createMockRes() as any;
    const next = vi.fn();

    requestContext(req, res, next);

    expect(logger.info).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(
      'GET /test',
      'RequestContext',
      expect.objectContaining({ method: 'GET', path: '/test' })
    );
  });

  it('calls next()', () => {
    const req = createMockReq() as any;
    const res = createMockRes() as any;
    const next = vi.fn();

    requestContext(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('calls logger.info with duration when res emits finish', () => {
    const req = createMockReq() as any;
    const res = createMockRes() as any;
    const next = vi.fn();

    requestContext(req, res, next);
    vi.clearAllMocks(); // clear the entry log call so we can isolate finish call

    res.emit('finish');

    expect(logger.info).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(
      'GET /test completed',
      'RequestContext',
      expect.objectContaining({
        requestId: req.id,
        statusCode: 200,
        duration: expect.stringMatching(/^\d+ms$/),
      })
    );
  });
});

describe('performanceMonitor middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT call logger.warn when duration is below threshold', () => {
    const threshold = 1000;
    const middleware = performanceMonitor(threshold);
    const req = createMockReq({ startTime: Date.now() }) as any;
    const res = createMockRes() as any;
    const next = vi.fn();

    middleware(req, res, next);
    res.emit('finish');

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('calls next()', () => {
    const middleware = performanceMonitor(1000);
    const req = createMockReq({ startTime: Date.now() }) as any;
    const res = createMockRes() as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('calls logger.warn with path/method/duration when duration exceeds threshold', () => {
    const threshold = 1000;
    const middleware = performanceMonitor(threshold);
    // Set startTime far enough in the past so duration will exceed threshold
    const req = createMockReq({
      startTime: Date.now() - (threshold + 500),
      id: 'slow-req-1',
    }) as any;
    const res = createMockRes() as any;
    const next = vi.fn();

    middleware(req, res, next);
    res.emit('finish');

    expect(logger.warn).toHaveBeenCalledWith(
      'Slow request detected',
      'PerformanceMonitor',
      expect.objectContaining({
        method: 'GET',
        path: '/test',
        duration: expect.stringMatching(/^\d+ms$/),
        threshold: `${threshold}ms`,
      })
    );
  });

  it('uses 1000ms as the default slow threshold', () => {
    const middleware = performanceMonitor(); // default threshold
    // Duration well below 1000ms
    const req = createMockReq({ startTime: Date.now() }) as any;
    const res = createMockRes() as any;
    const next = vi.fn();

    middleware(req, res, next);
    res.emit('finish');

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
