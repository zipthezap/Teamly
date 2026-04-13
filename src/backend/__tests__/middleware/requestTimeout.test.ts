import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { requestTimeout, TimeoutDurations } from '../../middleware/requestTimeout';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const createMockReq = (overrides: Record<string, unknown> = {}) => ({
  method: 'GET',
  path: '/test',
  ip: '127.0.0.1',
  ...overrides,
});

const createMockRes = (headersSent = false) => {
  const emitter = new EventEmitter();
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return Object.assign(emitter, { status, json, headersSent });
};

describe('requestTimeout middleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('calls next() immediately after middleware is invoked', () => {
    const middleware = requestTimeout(5000);
    const req = createMockReq() as any;
    const res = createMockRes() as any;
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('sends 408 with correct body when timeout fires and headersSent is false', () => {
    const timeoutMs = 5000;
    const middleware = requestTimeout(timeoutMs);
    const req = createMockReq() as any;
    const res = createMockRes(false) as any;
    const next = vi.fn();

    middleware(req, res, next);
    vi.advanceTimersByTime(timeoutMs + 1);

    expect(res.status).toHaveBeenCalledWith(408);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Request timeout',
      message: 'The server took too long to process your request. Please try again.',
    });
  });

  it('does NOT send 408 when res emits finish before timeout fires', () => {
    const timeoutMs = 5000;
    const middleware = requestTimeout(timeoutMs);
    const req = createMockReq() as any;
    const res = createMockRes(false) as any;
    const next = vi.fn();

    middleware(req, res, next);
    res.emit('finish');
    vi.advanceTimersByTime(timeoutMs + 1);

    expect(res.status).not.toHaveBeenCalled();
  });

  it('does NOT send 408 when res emits close before timeout fires', () => {
    const timeoutMs = 5000;
    const middleware = requestTimeout(timeoutMs);
    const req = createMockReq() as any;
    const res = createMockRes(false) as any;
    const next = vi.fn();

    middleware(req, res, next);
    res.emit('close');
    vi.advanceTimersByTime(timeoutMs + 1);

    expect(res.status).not.toHaveBeenCalled();
  });

  it('does NOT call res.status when headersSent is true when timeout fires', () => {
    const timeoutMs = 5000;
    const middleware = requestTimeout(timeoutMs);
    const req = createMockReq() as any;
    const res = createMockRes(true) as any;
    const next = vi.fn();

    middleware(req, res, next);
    vi.advanceTimersByTime(timeoutMs + 1);

    expect(res.status).not.toHaveBeenCalled();
  });

  it('defaults to a 30000ms timeout', () => {
    const middleware = requestTimeout();
    const req = createMockReq() as any;
    const res = createMockRes(false) as any;
    const next = vi.fn();

    middleware(req, res, next);

    vi.advanceTimersByTime(29999);
    expect(res.status).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2);
    expect(res.status).toHaveBeenCalledWith(408);
  });

  describe('TimeoutDurations constants', () => {
    it('has SHORT = 10000', () => {
      expect(TimeoutDurations.SHORT).toBe(10000);
    });

    it('has MEDIUM = 30000', () => {
      expect(TimeoutDurations.MEDIUM).toBe(30000);
    });

    it('has LONG = 60000', () => {
      expect(TimeoutDurations.LONG).toBe(60000);
    });

    it('has UPLOAD = 120000', () => {
      expect(TimeoutDurations.UPLOAD).toBe(120000);
    });
  });
});
