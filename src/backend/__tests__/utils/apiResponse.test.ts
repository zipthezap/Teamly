import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendSuccess, sendError, calculatePagination, ErrorCodes } from '../../utils/apiResponse';
import type { Response } from 'express';

function makeMockRes() {
  const json = vi.fn();
  const res = {
    status: vi.fn().mockReturnThis(),
    json,
  } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockImplementation(() => ({ json }));
  return { res, json };
}

describe('sendSuccess', () => {
  let res: Response;
  let json: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ({ res, json } = makeMockRes());
  });

  it('defaults to status 200', () => {
    sendSuccess(res, { id: '1' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('sets success: true and includes data', () => {
    sendSuccess(res, { id: '1' });
    const body = json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ id: '1' });
  });

  it('includes a timestamp in meta', () => {
    sendSuccess(res, {});
    const body = json.mock.calls[0][0];
    expect(body.meta.timestamp).toBeDefined();
    expect(() => new Date(body.meta.timestamp)).not.toThrow();
  });

  it('uses custom statusCode', () => {
    sendSuccess(res, {}, { statusCode: 201 });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('sets message when provided', () => {
    sendSuccess(res, {}, { message: 'Created' });
    const body = json.mock.calls[0][0];
    expect(body.message).toBe('Created');
  });

  it('includes pagination in meta when provided', () => {
    const pagination = { page: 1, perPage: 10, total: 50, totalPages: 5, hasNextPage: true, hasPrevPage: false };
    sendSuccess(res, [], { pagination });
    const body = json.mock.calls[0][0];
    expect(body.meta.pagination).toEqual(pagination);
  });

  it('meta.pagination is undefined when not provided', () => {
    sendSuccess(res, {});
    const body = json.mock.calls[0][0];
    expect(body.meta.pagination).toBeUndefined();
  });
});

describe('sendError', () => {
  let res: Response;
  let json: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ({ res, json } = makeMockRes());
  });

  it('defaults to status 500', () => {
    sendError(res, { code: 'ERR', message: 'fail' });
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('sets success: false with error shape', () => {
    sendError(res, { code: 'ERR', message: 'fail' });
    const body = json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ERR');
    expect(body.error.message).toBe('fail');
  });

  it('uses custom statusCode', () => {
    sendError(res, { code: 'NOT_FOUND', message: 'not found' }, { statusCode: 404 });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('includes timestamp in meta', () => {
    sendError(res, { code: 'ERR', message: 'fail' });
    const body = json.mock.calls[0][0];
    expect(body.meta.timestamp).toBeDefined();
  });
});

describe('calculatePagination', () => {
  it('page=1, perPage=10, total=100 → totalPages=10, hasNextPage=true, hasPrevPage=false', () => {
    const result = calculatePagination(1, 10, 100);
    expect(result.totalPages).toBe(10);
    expect(result.hasNextPage).toBe(true);
    expect(result.hasPrevPage).toBe(false);
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(10);
    expect(result.total).toBe(100);
  });

  it('page=10, perPage=10, total=100 → hasNextPage=false, hasPrevPage=true', () => {
    const result = calculatePagination(10, 10, 100);
    expect(result.hasNextPage).toBe(false);
    expect(result.hasPrevPage).toBe(true);
  });

  it('page=5, perPage=10, total=100 → hasNextPage=true, hasPrevPage=true', () => {
    const result = calculatePagination(5, 10, 100);
    expect(result.hasNextPage).toBe(true);
    expect(result.hasPrevPage).toBe(true);
  });

  it('page=1, perPage=10, total=0 → totalPages=0, hasNextPage=false, hasPrevPage=false', () => {
    const result = calculatePagination(1, 10, 0);
    expect(result.totalPages).toBe(0);
    expect(result.hasNextPage).toBe(false);
    expect(result.hasPrevPage).toBe(false);
  });

  it('page=1, perPage=10, total=5 → totalPages=1, hasNextPage=false', () => {
    const result = calculatePagination(1, 10, 5);
    expect(result.totalPages).toBe(1);
    expect(result.hasNextPage).toBe(false);
  });

  it('page=1, perPage=10, total=15 → totalPages=2, hasNextPage=true', () => {
    const result = calculatePagination(1, 10, 15);
    expect(result.totalPages).toBe(2);
    expect(result.hasNextPage).toBe(true);
  });

  it('page=1, perPage=3, total=10 → totalPages=4', () => {
    const result = calculatePagination(1, 3, 10);
    expect(result.totalPages).toBe(4);
  });
});

describe('ErrorCodes', () => {
  it('all values are unique strings', () => {
    const values = Object.values(ErrorCodes);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
    values.forEach(v => expect(typeof v).toBe('string'));
  });

  it('authentication codes start with AUTH_', () => {
    expect(ErrorCodes.UNAUTHORIZED).toMatch(/^AUTH_/);
    expect(ErrorCodes.INVALID_TOKEN).toMatch(/^AUTH_/);
    expect(ErrorCodes.TOKEN_EXPIRED).toMatch(/^AUTH_/);
  });

  it('validation codes start with VALID_', () => {
    expect(ErrorCodes.VALIDATION_ERROR).toMatch(/^VALID_/);
    expect(ErrorCodes.INVALID_INPUT).toMatch(/^VALID_/);
  });

  it('resource codes start with RES_', () => {
    expect(ErrorCodes.RESOURCE_NOT_FOUND).toMatch(/^RES_/);
    expect(ErrorCodes.RESOURCE_ALREADY_EXISTS).toMatch(/^RES_/);
  });

  it('database codes start with DB_', () => {
    expect(ErrorCodes.DATABASE_ERROR).toMatch(/^DB_/);
    expect(ErrorCodes.QUERY_TIMEOUT).toMatch(/^DB_/);
  });

  it('server codes start with SERVER_', () => {
    expect(ErrorCodes.INTERNAL_SERVER_ERROR).toMatch(/^SERVER_/);
    expect(ErrorCodes.SERVICE_UNAVAILABLE).toMatch(/^SERVER_/);
  });
});
