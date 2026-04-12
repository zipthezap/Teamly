import { vi } from 'vitest';
import {
  ErrorSeverity,
  ErrorHandler,
  safeAsync,
} from '../../utils/errorHandling';
import { logger } from '../../utils/logger';

// setup.ts globally mocks logger; we access it here for assertions.

const createMockRes = () => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json } as any;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ErrorSeverity enum', () => {
  it('LOW equals "low"', () => {
    expect(ErrorSeverity.LOW).toBe('low');
  });

  it('MEDIUM equals "medium"', () => {
    expect(ErrorSeverity.MEDIUM).toBe('medium');
  });

  it('HIGH equals "high"', () => {
    expect(ErrorSeverity.HIGH).toBe('high');
  });

  it('CRITICAL equals "critical"', () => {
    expect(ErrorSeverity.CRITICAL).toBe('critical');
  });
});

describe('ErrorHandler.logError', () => {
  it('logs error.message when an Error object is passed', () => {
    const err = new Error('something went wrong');
    ErrorHandler.logError(err, { operation: 'test' });
    expect(logger.error).toHaveBeenCalledWith(
      'something went wrong',
      'ErrorHandler',
      expect.any(Object)
    );
  });

  it('logs "Unknown error" for non-Error values', () => {
    ErrorHandler.logError('plain string', { operation: 'test' });
    expect(logger.error).toHaveBeenCalledWith(
      'Unknown error',
      'ErrorHandler',
      expect.any(Object)
    );
  });

  it('logs "Unknown error" for null', () => {
    ErrorHandler.logError(null, {});
    expect(logger.error).toHaveBeenCalledWith(
      'Unknown error',
      'ErrorHandler',
      expect.any(Object)
    );
  });

  it('includes the stack trace in the log context for Error instances', () => {
    const err = new Error('with stack');
    ErrorHandler.logError(err, {});
    const callArgs = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0];
    const context = callArgs[2];
    expect(context.stack).toBe(err.stack);
  });

  it('does not include a stack for non-Error values', () => {
    ErrorHandler.logError({ foo: 'bar' }, {});
    const callArgs = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0];
    const context = callArgs[2];
    expect(context.stack).toBeUndefined();
  });

  it('passes the custom severity through to the log context', () => {
    ErrorHandler.logError(new Error('critical!'), {}, ErrorSeverity.CRITICAL);
    const context = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(context.severity).toBe(ErrorSeverity.CRITICAL);
  });

  it('uses MEDIUM as the default severity', () => {
    ErrorHandler.logError(new Error('default'), {});
    const context = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(context.severity).toBe(ErrorSeverity.MEDIUM);
  });
});

describe('ErrorHandler.handleDatabaseError', () => {
  it('returns 409 with "already exists" message for P2002 errors', () => {
    const res = createMockRes();
    ErrorHandler.handleDatabaseError({ code: 'P2002' }, {}, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.status(409).json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('already exists') })
    );
  });

  it('returns 404 with "not found" message for P2025 errors', () => {
    const res = createMockRes();
    ErrorHandler.handleDatabaseError({ code: 'P2025' }, {}, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status(404).json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('not found') })
    );
  });

  it('returns 500 for unknown database errors', () => {
    const res = createMockRes();
    ErrorHandler.handleDatabaseError(new Error('unexpected'), {}, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.status(500).json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) })
    );
  });

  it('logs the error as a database error type', () => {
    const res = createMockRes();
    ErrorHandler.handleDatabaseError(new Error('db down'), { userId: '1' }, res);
    expect(logger.error).toHaveBeenCalled();
    const context = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(context.errorType).toBe('database');
  });
});

describe('ErrorHandler.handleValidationError', () => {
  it('returns 400 with the error message for an Error instance', () => {
    const res = createMockRes();
    ErrorHandler.handleValidationError(new Error('Name is required'), {}, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.status(400).json).toHaveBeenCalledWith({ error: 'Name is required' });
  });

  it('returns 400 with "Validation failed" for non-Error values', () => {
    const res = createMockRes();
    ErrorHandler.handleValidationError('bad', {}, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.status(400).json).toHaveBeenCalledWith({ error: 'Validation failed' });
  });

  it('logs the error with validation errorType', () => {
    const res = createMockRes();
    ErrorHandler.handleValidationError(new Error('invalid email'), {}, res);
    const context = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(context.errorType).toBe('validation');
  });
});

describe('ErrorHandler.handleAuthorizationError', () => {
  it('returns 403 with the default permission message', () => {
    const res = createMockRes();
    ErrorHandler.handleAuthorizationError({}, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.status(403).json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('permission') })
    );
  });

  it('returns 403 with a custom message when provided', () => {
    const res = createMockRes();
    ErrorHandler.handleAuthorizationError({}, res, 'Admin access only');
    expect(res.status(403).json).toHaveBeenCalledWith({ error: 'Admin access only' });
  });

  it('logs the error with authorization errorType', () => {
    const res = createMockRes();
    ErrorHandler.handleAuthorizationError({}, res);
    const context = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(context.errorType).toBe('authorization');
  });
});

describe('ErrorHandler.handleNotFoundError', () => {
  it('returns 404 with "{resource} not found" message', () => {
    const res = createMockRes();
    ErrorHandler.handleNotFoundError('User', {}, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status(404).json).toHaveBeenCalledWith({ error: 'User not found' });
  });

  it('includes the resource name in the message', () => {
    const res = createMockRes();
    ErrorHandler.handleNotFoundError('Event', {}, res);
    expect(res.status(404).json).toHaveBeenCalledWith({ error: 'Event not found' });
  });
});

describe('ErrorHandler.handleRateLimitError', () => {
  it('returns 429 with a rate limit message', () => {
    const res = createMockRes();
    ErrorHandler.handleRateLimitError({}, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.status(429).json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Too many requests') })
    );
  });

  it('logs the error with rateLimit errorType', () => {
    const res = createMockRes();
    ErrorHandler.handleRateLimitError({}, res);
    const context = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(context.errorType).toBe('rateLimit');
  });
});

describe('safeAsync', () => {
  it('returns the operation result on success', async () => {
    const result = await safeAsync(() => Promise.resolve(42), {});
    expect(result).toBe(42);
  });

  it('returns null and logs the error when the operation fails (no onError)', async () => {
    const result = await safeAsync(
      () => Promise.reject(new Error('async error')),
      { operation: 'fetchData' }
    );
    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'async error',
      'ErrorHandler',
      expect.any(Object)
    );
  });

  it('calls onError and returns its result when the operation fails', async () => {
    const result = await safeAsync(
      () => Promise.reject(new Error('fail')),
      {},
      () => 'fallback'
    );
    expect(result).toBe('fallback');
  });

  it('passes the caught error to the onError callback', async () => {
    const onError = vi.fn().mockReturnValue('handled');
    const err = new Error('captured');
    await safeAsync(() => Promise.reject(err), {}, onError);
    expect(onError).toHaveBeenCalledWith(err);
  });

  it('still logs the error even when onError is provided', async () => {
    await safeAsync(
      () => Promise.reject(new Error('logged error')),
      {},
      () => null
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
