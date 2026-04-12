import { describe, it, expect, vi } from 'vitest';
import {
  apiLimiter,
  authLimiter,
  authenticatedLimiter,
  uploadLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
} from '../../middleware/rateLimiter';

describe('RateLimiter Middleware', () => {
  it('apiLimiter is a function (middleware)', () => {
    expect(typeof apiLimiter).toBe('function');
  });

  it('authLimiter is a function (middleware)', () => {
    expect(typeof authLimiter).toBe('function');
  });

  it('authenticatedLimiter is a function (middleware)', () => {
    expect(typeof authenticatedLimiter).toBe('function');
  });

  it('uploadLimiter is a function (middleware)', () => {
    expect(typeof uploadLimiter).toBe('function');
  });

  it('passwordResetLimiter is a function (middleware)', () => {
    expect(typeof passwordResetLimiter).toBe('function');
  });

  it('emailVerificationLimiter is a function (middleware)', () => {
    expect(typeof emailVerificationLimiter).toBe('function');
  });

  it('apiLimiter calls next() on first request', async () => {
    const req: any = {
      ip: '127.0.0.1',
      path: '/api/test',
      method: 'GET',
      user: undefined,
      headers: {},
    };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      getHeader: vi.fn(),
    };
    const next = vi.fn();

    await apiLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('apiLimiter skips rate limiting for /health endpoint', async () => {
    const req: any = {
      ip: '127.0.0.1',
      path: '/health',
      method: 'GET',
      user: undefined,
      headers: {},
    };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      getHeader: vi.fn(),
    };
    const next = vi.fn();

    await apiLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('authLimiter calls next() on first request', async () => {
    const req: any = {
      ip: '10.0.0.1',
      path: '/api/auth/login',
      method: 'POST',
      user: undefined,
      headers: {},
    };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      getHeader: vi.fn(),
    };
    const next = vi.fn();

    await authLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('authenticatedLimiter calls next() on first request', async () => {
    const req: any = {
      ip: '10.0.0.2',
      path: '/api/events',
      method: 'GET',
      user: { id: 'user-123' },
      headers: {},
    };
    const res: any = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      getHeader: vi.fn(),
    };
    const next = vi.fn();

    await authenticatedLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
