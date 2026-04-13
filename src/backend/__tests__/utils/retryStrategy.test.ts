import { vi } from 'vitest';
import {
  withRetry,
  createRetryWrapper,
  dbRetry,
  apiRetry,
  cacheRetry,
  RetryOptions,
} from '../../utils/retryStrategy';

// Use zero-delay options so tests run instantly without fake timers
const fastOptions: Partial<RetryOptions> = {
  initialDelayMs: 0,
  maxDelayMs: 0,
  backoffMultiplier: 1,
};

describe('withRetry', () => {
  it('resolves immediately when the operation succeeds on the first try', async () => {
    const op = vi.fn().mockResolvedValue('success');
    const result = await withRetry(op, { ...fastOptions, maxRetries: 3 });
    expect(result).toBe('success');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries a retryable error up to maxRetries and then throws', async () => {
    const op = vi.fn().mockRejectedValue(new Error('connection refused'));
    await expect(
      withRetry(op, { ...fastOptions, maxRetries: 3 })
    ).rejects.toThrow('connection refused');
    // called on attempt 0 + 3 retries = 4 total
    expect(op).toHaveBeenCalledTimes(4);
  });

  it('does not retry a non-retryable error (no match in default list)', async () => {
    const op = vi.fn().mockRejectedValue(new Error('SyntaxError: bad token'));
    await expect(
      withRetry(op, { ...fastOptions, maxRetries: 3 })
    ).rejects.toThrow('SyntaxError: bad token');
    // Thrown immediately without retry
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries only when the error matches custom retryableErrors', async () => {
    const op = vi.fn().mockRejectedValue(new Error('specific failure'));
    await expect(
      withRetry(op, {
        ...fastOptions,
        maxRetries: 2,
        retryableErrors: ['specific'],
      })
    ).rejects.toThrow('specific failure');
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('does not retry when the error does not match custom retryableErrors', async () => {
    const op = vi.fn().mockRejectedValue(new Error('other failure'));
    await expect(
      withRetry(op, {
        ...fastOptions,
        maxRetries: 3,
        retryableErrors: ['specific'],
      })
    ).rejects.toThrow('other failure');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry callback with correct attempt number and error', async () => {
    const onRetry = vi.fn();
    const error = new Error('connection error');
    const op = vi.fn().mockRejectedValue(error);
    await expect(
      withRetry(op, {
        ...fastOptions,
        maxRetries: 2,
        onRetry,
      })
    ).rejects.toThrow();

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, error, 1);
    expect(onRetry).toHaveBeenNthCalledWith(2, error, 2);
  });

  it('throws the last error after all retries are exhausted', async () => {
    const finalError = new Error('connection lost');
    const op = vi.fn().mockRejectedValue(finalError);
    await expect(
      withRetry(op, { ...fastOptions, maxRetries: 2 })
    ).rejects.toBe(finalError);
  });

  it('succeeds on a later attempt after initial failures', async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection timeout'))
      .mockRejectedValueOnce(new Error('connection timeout'))
      .mockResolvedValue('ok');

    const result = await withRetry(op, { ...fastOptions, maxRetries: 3 });
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('wraps non-Error rejections in an Error', async () => {
    const op = vi.fn().mockRejectedValue('plain string error');
    await expect(
      withRetry(op, { ...fastOptions, maxRetries: 0 })
    ).rejects.toThrow('plain string error');
  });

  describe('exponential backoff delays', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('increases delay exponentially between retries', async () => {
      const delays: number[] = [];

      // Spy on setTimeout: record the delay, then resolve immediately via microtask
      // so the test runs fast and the promise is always awaited before it settles.
      vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: any, ms?: number) => {
        if (typeof ms === 'number') delays.push(ms);
        void Promise.resolve().then(() => fn());
        return 0 as any;
      });

      const op = vi.fn().mockRejectedValue(new Error('connection error'));

      await expect(
        withRetry(op, {
          maxRetries: 3,
          initialDelayMs: 100,
          maxDelayMs: 10_000,
          backoffMultiplier: 2,
        })
      ).rejects.toThrow('connection error');

      // 3 retries produce 3 sleep calls with delays: 100, 200, 400
      expect(delays).toHaveLength(3);
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);
      expect(delays[2]).toBe(400);
    });
  });
});

describe('createRetryWrapper', () => {
  it('returns a function', () => {
    const wrapper = createRetryWrapper(fastOptions);
    expect(typeof wrapper).toBe('function');
  });

  it('the returned wrapper executes the operation', async () => {
    const wrapper = createRetryWrapper({ ...fastOptions, maxRetries: 1 });
    const op = vi.fn().mockResolvedValue(42);
    const result = await wrapper(op);
    expect(result).toBe(42);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('applies the configured retry options', async () => {
    const wrapper = createRetryWrapper({
      ...fastOptions,
      maxRetries: 2,
      retryableErrors: ['connection'],
    });
    const op = vi.fn().mockRejectedValue(new Error('connection error'));
    await expect(wrapper(op)).rejects.toThrow('connection error');
    // 1 initial + 2 retries = 3 total calls
    expect(op).toHaveBeenCalledTimes(3);
  });
});

describe('pre-configured retry wrappers', () => {
  it('dbRetry is a function', () => {
    expect(typeof dbRetry).toBe('function');
  });

  it('apiRetry is a function', () => {
    expect(typeof apiRetry).toBe('function');
  });

  it('cacheRetry is a function', () => {
    expect(typeof cacheRetry).toBe('function');
  });

  it('dbRetry resolves a successful operation', async () => {
    const result = await dbRetry(() => Promise.resolve('db-result'));
    expect(result).toBe('db-result');
  });

  it('apiRetry resolves a successful operation', async () => {
    const result = await apiRetry(() => Promise.resolve('api-result'));
    expect(result).toBe('api-result');
  });

  it('cacheRetry resolves a successful operation', async () => {
    const result = await cacheRetry(() => Promise.resolve('cache-result'));
    expect(result).toBe('cache-result');
  });
});
