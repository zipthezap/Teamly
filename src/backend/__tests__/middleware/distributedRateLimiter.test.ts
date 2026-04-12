import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/redis', () => ({
  getRedisClient: vi.fn(() => null),
  isRedisEnabled: vi.fn(() => false),
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  createRateLimiterMiddleware,
  distributedApiLimiter,
  distributedAuthLimiter,
  distributedAuthenticatedLimiter,
  distributedUploadLimiter,
  distributedPasswordResetLimiter,
  distributedEmailVerificationLimiter,
} from '../../middleware/distributedRateLimiter';

describe('Distributed RateLimiter Middleware', () => {
  it('createRateLimiterMiddleware returns a function', () => {
    const middleware = createRateLimiterMiddleware({ windowMs: 60000, max: 100 });
    expect(typeof middleware).toBe('function');
  });

  it('distributedApiLimiter is a function', () => {
    expect(typeof distributedApiLimiter).toBe('function');
  });

  it('distributedAuthLimiter is a function', () => {
    expect(typeof distributedAuthLimiter).toBe('function');
  });

  it('distributedAuthenticatedLimiter is a function', () => {
    expect(typeof distributedAuthenticatedLimiter).toBe('function');
  });

  it('distributedUploadLimiter is a function', () => {
    expect(typeof distributedUploadLimiter).toBe('function');
  });

  it('distributedPasswordResetLimiter is a function', () => {
    expect(typeof distributedPasswordResetLimiter).toBe('function');
  });

  it('distributedEmailVerificationLimiter is a function', () => {
    expect(typeof distributedEmailVerificationLimiter).toBe('function');
  });

  it('distributedApiLimiter calls next() on first request (in-memory fallback)', async () => {
    const req: any = { ip: '127.0.0.1', path: '/api/test', method: 'GET', user: undefined };
    const res: any = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await distributedApiLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('distributedAuthLimiter calls next() on first request', async () => {
    const req: any = { ip: '127.0.0.2', path: '/api/auth/login', method: 'POST', user: undefined };
    const res: any = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await distributedAuthLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('distributedAuthenticatedLimiter calls next() with authenticated user', async () => {
    const req: any = { ip: '127.0.0.3', path: '/api/events', method: 'GET', user: { id: 'user-123' } };
    const res: any = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await distributedAuthenticatedLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('createRateLimiterMiddleware calls next on first request', async () => {
    const middleware = createRateLimiterMiddleware({ windowMs: 60000, max: 100, keyPrefix: 'test-prefix' });
    const req: any = { ip: '127.0.0.4', path: '/test', method: 'GET', user: undefined };
    const res: any = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
