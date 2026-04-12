import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';

describe('asyncHandler', () => {
  const makeResMock = (): Partial<Response> & { json: ReturnType<typeof vi.fn> } => ({
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis() as any,
  });

  it('calls res.json correctly when the handler resolves', async () => {
    const req = {} as Request;
    const res = makeResMock() as unknown as Response;
    const next = vi.fn() as NextFunction;

    const handler = asyncHandler(async (_req, response) => {
      response.json({ ok: true });
    });

    await new Promise<void>((resolve) => {
      handler(req, res, (...args) => {
        (next as any)(...args);
        resolve();
      });
      // resolve after microtasks if next is never called
      Promise.resolve().then(resolve);
    });

    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next(error) when the handler rejects', async () => {
    const req = {} as Request;
    const res = makeResMock() as unknown as Response;
    const next = vi.fn() as NextFunction;
    const error = new Error('async failure');

    const handler = asyncHandler(async () => {
      throw error;
    });

    await new Promise<void>((resolve) => {
      handler(req, res, (...args) => {
        (next as any)(...args);
        resolve();
      });
    });

    expect(next).toHaveBeenCalledWith(error);
    expect((res.json as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('calls next(error) when the handler throws synchronously', async () => {
    const req = {} as Request;
    const res = makeResMock() as unknown as Response;
    const next = vi.fn() as NextFunction;
    const error = new Error('sync failure');

    // asyncHandler wraps the fn in Promise.resolve(), so sync throws
    // are caught by the .catch(next) chain
    const handler = asyncHandler(async () => {
      throw error;
    });

    await new Promise<void>((resolve) => {
      handler(req, res, (...args) => {
        (next as any)(...args);
        resolve();
      });
    });

    expect(next).toHaveBeenCalledWith(error);
  });
});
