import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { generateWeakETag, generateStrongETag, etagMiddleware } from '../../middleware/etag';

// ─── Unit tests for ETag generators ─────────────────────────────────────────

describe('generateWeakETag', () => {
  it('returns a weak ETag in W/"hash" format', () => {
    const body = 'hello world';
    const result = generateWeakETag(body);
    const md5 = crypto.createHash('md5').update(body).digest('hex');
    expect(result).toBe(`W/"${md5}"`);
  });

  it('returns different ETags for different inputs', () => {
    expect(generateWeakETag('foo')).not.toBe(generateWeakETag('bar'));
  });
});

describe('generateStrongETag', () => {
  it('returns a strong ETag in "sha256hash" format', () => {
    const body = 'hello world';
    const result = generateStrongETag(body);
    const sha256 = crypto.createHash('sha256').update(body).digest('hex');
    expect(result).toBe(`"${sha256}"`);
  });

  it('returns different ETags for different inputs', () => {
    expect(generateStrongETag('foo')).not.toBe(generateStrongETag('bar'));
  });
});

// ─── etagMiddleware tests ────────────────────────────────────────────────────

function makeResMock() {
  const originalJson = vi.fn().mockReturnThis();
  const originalSend = vi.fn().mockReturnThis();
  const end = vi.fn();
  const status = vi.fn().mockReturnValue({ end });
  const setHeader = vi.fn();

  const res: any = {
    json: originalJson,
    send: originalSend,
    status,
    end,
    setHeader,
  };
  // Bind to replicate what the middleware does with .bind(res)
  res.json = originalJson;
  res.send = originalSend;

  return { res, originalJson, originalSend, status, end, setHeader };
}

describe('etagMiddleware({ weak: true })', () => {
  it('sets ETag header on GET response', () => {
    const req: any = { method: 'GET', headers: {} };
    const { res, setHeader } = makeResMock();
    const next = vi.fn();

    const middleware = etagMiddleware({ weak: true });
    middleware(req as Request, res as Response, next as NextFunction);

    // Trigger the overridden res.json
    res.json({ data: 'test' });

    expect(setHeader).toHaveBeenCalledWith('ETag', expect.stringMatching(/^W\/"[a-f0-9]+"$/));
  });

  it('returns 304 when If-None-Match matches the ETag', () => {
    const body = { data: 'test' };
    const etag = generateWeakETag(JSON.stringify(body));

    const req: any = {
      method: 'GET',
      headers: { 'if-none-match': etag },
    };
    const { res, originalJson, status, end } = makeResMock();
    const next = vi.fn();

    const middleware = etagMiddleware({ weak: true });
    middleware(req as Request, res as Response, next as NextFunction);

    res.json(body);

    expect(status).toHaveBeenCalledWith(304);
    expect(end).toHaveBeenCalled();
    expect(originalJson).not.toHaveBeenCalled();
  });

  it('returns full response when If-None-Match does not match', () => {
    const req: any = {
      method: 'GET',
      headers: { 'if-none-match': '"nonmatchingetag"' },
    };
    const { res, originalJson, status } = makeResMock();
    const next = vi.fn();

    const middleware = etagMiddleware({ weak: true });
    middleware(req as Request, res as Response, next as NextFunction);

    const body = { data: 'hello' };
    res.json(body);

    expect(status).not.toHaveBeenCalledWith(304);
    expect(originalJson).toHaveBeenCalledWith(body);
  });

  it('calls next() to continue the middleware chain', () => {
    const req: any = { method: 'GET', headers: {} };
    const { res } = makeResMock();
    const next = vi.fn();

    const middleware = etagMiddleware({ weak: true });
    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
  });
});

describe('etagMiddleware — non-GET requests', () => {
  it('skips POST requests and calls next without modifying res.json', () => {
    const req: any = { method: 'POST', headers: {} };
    const { res, originalJson } = makeResMock();
    const originalJsonRef = originalJson;
    const next = vi.fn();

    const middleware = etagMiddleware({ weak: true });
    middleware(req as Request, res as Response, next as NextFunction);

    // res.json should NOT have been replaced
    expect(res.json).toBe(originalJsonRef);
    expect(next).toHaveBeenCalled();
  });

  it('skips PUT requests', () => {
    const req: any = { method: 'PUT', headers: {} };
    const { res, originalJson } = makeResMock();
    const originalJsonRef = originalJson;
    const next = vi.fn();

    const middleware = etagMiddleware({ weak: true });
    middleware(req as Request, res as Response, next as NextFunction);

    expect(res.json).toBe(originalJsonRef);
    expect(next).toHaveBeenCalled();
  });
});
