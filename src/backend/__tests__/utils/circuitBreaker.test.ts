import { vi } from 'vitest';
import {
  CircuitBreaker,
  emailCircuitBreaker,
  redisCircuitBreaker,
  externalApiCircuitBreaker,
} from '../../utils/circuitBreaker';

const makeBreaker = (overrides: Partial<{
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
  name: string;
}> = {}) =>
  new CircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 1000,
    halfOpenRequests: 2,
    name: 'TestBreaker',
    ...overrides,
  });

/** Helper: exhaust failure threshold so the breaker opens */
const openBreaker = async (cb: CircuitBreaker, failureThreshold = 3) => {
  const fail = () => Promise.reject(new Error('fail'));
  for (let i = 0; i < failureThreshold; i++) {
    await expect(cb.execute(fail)).rejects.toThrow('fail');
  }
};

describe('CircuitBreaker — CLOSED state', () => {
  it('starts in CLOSED state', () => {
    const cb = makeBreaker();
    expect(cb.getStats().state).toBe('CLOSED');
  });

  it('records a success: successes=1, failures=0, state=CLOSED', async () => {
    const cb = makeBreaker();
    await cb.execute(() => Promise.resolve('ok'));
    const stats = cb.getStats();
    expect(stats.state).toBe('CLOSED');
    expect(stats.successes).toBe(1);
    expect(stats.failures).toBe(0);
    expect(stats.totalRequests).toBe(1);
    expect(stats.lastSuccessTime).toBeDefined();
  });

  it('records a failure but stays CLOSED below threshold', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    await expect(cb.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow();
    const stats = cb.getStats();
    expect(stats.state).toBe('CLOSED');
    expect(stats.failures).toBe(1);
  });
});

describe('CircuitBreaker — CLOSED → OPEN transition', () => {
  it('opens after failureThreshold failures', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    await openBreaker(cb, 3);
    expect(cb.getStats().state).toBe('OPEN');
    expect(cb.isOpen()).toBe(true);
  });

  it('rejects immediately with OPEN error without invoking fn', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    await openBreaker(cb, 3);

    const fn = vi.fn().mockResolvedValue('should-not-run');
    await expect(cb.execute(fn)).rejects.toThrow('Circuit breaker is OPEN');
    expect(fn).not.toHaveBeenCalled();
  });

  it('records the last failure time when opening', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    const before = Date.now();
    await openBreaker(cb, 3);
    const stats = cb.getStats();
    expect(stats.lastFailureTime).toBeGreaterThanOrEqual(before);
  });
});

describe('CircuitBreaker — OPEN → HALF_OPEN transition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions to HALF_OPEN after resetTimeout elapses', async () => {
    const cb = makeBreaker({ failureThreshold: 3, resetTimeout: 1000 });
    await openBreaker(cb, 3);
    expect(cb.getStats().state).toBe('OPEN');

    vi.advanceTimersByTime(1001);

    // Next execute should transition to HALF_OPEN and invoke fn
    const fn = vi.fn().mockResolvedValue('recovered');
    await cb.execute(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(cb.getStats().state).toBe('HALF_OPEN');
  });

  it('does not transition to HALF_OPEN before resetTimeout', async () => {
    const cb = makeBreaker({ failureThreshold: 3, resetTimeout: 5000 });
    await openBreaker(cb, 3);

    vi.advanceTimersByTime(4999);

    const fn = vi.fn().mockResolvedValue('ok');
    await expect(cb.execute(fn)).rejects.toThrow('Circuit breaker is OPEN');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('CircuitBreaker — HALF_OPEN → CLOSED transition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('closes after halfOpenRequests consecutive successes', async () => {
    const cb = makeBreaker({ failureThreshold: 3, resetTimeout: 1000, halfOpenRequests: 2 });
    await openBreaker(cb, 3);

    vi.advanceTimersByTime(1001);

    await cb.execute(() => Promise.resolve('ok'));   // 1st half-open success → HALF_OPEN
    expect(cb.getStats().state).toBe('HALF_OPEN');

    await cb.execute(() => Promise.resolve('ok'));   // 2nd half-open success → CLOSED
    expect(cb.getStats().state).toBe('CLOSED');
    expect(cb.isOpen()).toBe(false);
  });
});

describe('CircuitBreaker — HALF_OPEN → OPEN (re-open on failure)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-opens when a failure occurs in HALF_OPEN state', async () => {
    const cb = makeBreaker({ failureThreshold: 3, resetTimeout: 1000, halfOpenRequests: 2 });
    await openBreaker(cb, 3);

    vi.advanceTimersByTime(1001);

    // One success to enter HALF_OPEN
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getStats().state).toBe('HALF_OPEN');

    // Now fail — should re-open
    await expect(cb.execute(() => Promise.reject(new Error('still broken')))).rejects.toThrow();
    expect(cb.getStats().state).toBe('OPEN');
    expect(cb.isOpen()).toBe(true);
  });
});

describe('CircuitBreaker — isOpen()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false in CLOSED state', () => {
    const cb = makeBreaker();
    expect(cb.isOpen()).toBe(false);
  });

  it('returns true in OPEN state before timeout', async () => {
    const cb = makeBreaker({ failureThreshold: 3, resetTimeout: 5000 });
    await openBreaker(cb, 3);
    expect(cb.isOpen()).toBe(true);
  });

  it('returns false in OPEN state after timeout elapses', async () => {
    const cb = makeBreaker({ failureThreshold: 3, resetTimeout: 1000 });
    await openBreaker(cb, 3);
    vi.advanceTimersByTime(1001);
    expect(cb.isOpen()).toBe(false);
  });

  it('returns false in HALF_OPEN state', async () => {
    const cb = makeBreaker({ failureThreshold: 3, resetTimeout: 1000 });
    await openBreaker(cb, 3);
    vi.advanceTimersByTime(1001);

    // Trigger HALF_OPEN by executing
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getStats().state).toBe('HALF_OPEN');
    expect(cb.isOpen()).toBe(false);
  });
});

describe('CircuitBreaker — reset()', () => {
  it('resets to CLOSED state and clears all counters', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    // Cause some activity
    await cb.execute(() => Promise.resolve('ok'));
    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

    cb.reset();

    const stats = cb.getStats();
    expect(stats.state).toBe('CLOSED');
    expect(stats.failures).toBe(0);
    expect(stats.successes).toBe(0);
    expect(cb.isOpen()).toBe(false);
  });

  it('allows normal operation after reset from OPEN state', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    await openBreaker(cb, 3);
    expect(cb.getStats().state).toBe('OPEN');

    cb.reset();

    const result = await cb.execute(() => Promise.resolve('back to normal'));
    expect(result).toBe('back to normal');
    expect(cb.getStats().state).toBe('CLOSED');
  });
});

describe('CircuitBreaker — getStats()', () => {
  it('tracks totalRequests accurately', async () => {
    const cb = makeBreaker({ failureThreshold: 10 });
    await cb.execute(() => Promise.resolve('ok'));
    await cb.execute(() => Promise.resolve('ok'));
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.getStats().totalRequests).toBe(3);
  });

  it('records lastFailureTime and lastSuccessTime', async () => {
    const cb = makeBreaker({ failureThreshold: 10 });
    const before = Date.now();
    await cb.execute(() => Promise.resolve('ok'));
    await expect(cb.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    const stats = cb.getStats();
    expect(stats.lastSuccessTime).toBeGreaterThanOrEqual(before);
    expect(stats.lastFailureTime).toBeGreaterThanOrEqual(before);
  });

  it('returns accurate state in stats', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    expect(cb.getStats().state).toBe('CLOSED');
    await openBreaker(cb, 3);
    expect(cb.getStats().state).toBe('OPEN');
  });
});

describe('pre-configured circuit breakers', () => {
  it('emailCircuitBreaker is an instance of CircuitBreaker', () => {
    expect(emailCircuitBreaker).toBeInstanceOf(CircuitBreaker);
  });

  it('redisCircuitBreaker is an instance of CircuitBreaker', () => {
    expect(redisCircuitBreaker).toBeInstanceOf(CircuitBreaker);
  });

  it('externalApiCircuitBreaker is an instance of CircuitBreaker', () => {
    expect(externalApiCircuitBreaker).toBeInstanceOf(CircuitBreaker);
  });

  it('emailCircuitBreaker starts in CLOSED state', () => {
    expect(emailCircuitBreaker.getStats().state).toBe('CLOSED');
  });

  it('redisCircuitBreaker starts in CLOSED state', () => {
    expect(redisCircuitBreaker.getStats().state).toBe('CLOSED');
  });

  it('externalApiCircuitBreaker starts in CLOSED state', () => {
    expect(externalApiCircuitBreaker.getStats().state).toBe('CLOSED');
  });
});
