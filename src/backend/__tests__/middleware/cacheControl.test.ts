import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { cacheControl, noCache } from '../../middleware/cacheControl';

const makeResMock = () => ({
  setHeader: vi.fn(),
});

const makeReq = (): Partial<Request> => ({});

const makeNext = (): NextFunction => vi.fn() as unknown as NextFunction;

describe('cacheControl middleware', () => {
  it('sets Cache-Control: private, max-age=60 for private cache', () => {
    const res = makeResMock();
    const next = makeNext();

    const middleware = cacheControl(60, { private: true });
    middleware(makeReq() as Request, res as unknown as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=60');
    expect(next).toHaveBeenCalled();
  });

  it('sets Cache-Control: public, max-age=300 by default', () => {
    const res = makeResMock();
    const next = makeNext();

    const middleware = cacheControl(300);
    middleware(makeReq() as Request, res as unknown as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=300');
    expect(next).toHaveBeenCalled();
  });

  it('includes stale-while-revalidate when option is set', () => {
    const res = makeResMock();
    const next = makeNext();

    const middleware = cacheControl(60, { staleWhileRevalidate: 30 });
    middleware(makeReq() as Request, res as unknown as Response, next);

    const headerValue = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(headerValue).toContain('stale-while-revalidate=30');
    expect(headerValue).toContain('public');
    expect(headerValue).toContain('max-age=60');
    expect(next).toHaveBeenCalled();
  });

  it('includes no-transform when option is set', () => {
    const res = makeResMock();
    const next = makeNext();

    const middleware = cacheControl(120, { noTransform: true });
    middleware(makeReq() as Request, res as unknown as Response, next);

    const headerValue = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(headerValue).toContain('no-transform');
    expect(next).toHaveBeenCalled();
  });
});

describe('noCache middleware', () => {
  it('sets Cache-Control: no-store header', () => {
    const res = makeResMock();
    const next = makeNext();

    noCache(makeReq() as Request, res as unknown as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
  });

  it('sets Pragma: no-cache header', () => {
    const res = makeResMock();
    const next = makeNext();

    noCache(makeReq() as Request, res as unknown as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
  });

  it('sets Expires: 0 header', () => {
    const res = makeResMock();
    const next = makeNext();

    noCache(makeReq() as Request, res as unknown as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('Expires', '0');
  });

  it('calls next()', () => {
    const res = makeResMock();
    const next = makeNext();

    noCache(makeReq() as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
  });
});
