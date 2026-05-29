import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  sendSuccess,
  getUserId,
  validateRequiredFields,
  requireFields,
  ensureResourceExists,
  ensureAuthenticated,
  ensurePermission,
  parseIntSafe,
  parseFloatSafe,
  calculatePagination,
} from '../../utils/controllerHelpers';
import { BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError } from '../../utils/errors';
import type { Response } from 'express';

function makeMockRes() {
  const json = vi.fn();
  const statusChain = { json };
  const res = { status: vi.fn().mockReturnValue(statusChain) } as unknown as Response;
  return { res, json };
}

describe('sendSuccess', () => {
  let res: Response;
  let json: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ({ res, json } = makeMockRes());
  });

  it('defaults to status 200 with success: true', () => {
    sendSuccess(res, { id: '1' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: { id: '1' } }));
  });

  it('uses custom statusCode', () => {
    sendSuccess(res, {}, { statusCode: 201 });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('sets message when provided', () => {
    sendSuccess(res, {}, { message: 'OK' });
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'OK' }));
  });

  it('includes pagination in meta', () => {
    const pagination = { page: 1, perPage: 10, total: 50, totalPages: 5, hasNextPage: true, hasPrevPage: false };
    sendSuccess(res, [], { pagination });
    const body = json.mock.calls[0][0];
    expect(body.meta.pagination).toEqual(pagination);
  });
});

describe('getUserId', () => {
  it('returns user id from request', () => {
    expect(getUserId({ user: { id: 'u123' } })).toBe('u123');
  });

  it('returns empty string when user is absent', () => {
    expect(getUserId({})).toBe('');
  });

  it('returns empty string when id is undefined', () => {
    expect(getUserId({ user: {} })).toBe('');
  });
});

describe('validateRequiredFields', () => {
  it('returns { valid: true } when all fields present', () => {
    const result = validateRequiredFields({ name: 'Alice', email: 'a@b.com' }, ['name', 'email']);
    expect(result).toEqual({ valid: true });
  });

  it('returns { valid: false, missing } when some fields absent', () => {
    const result = validateRequiredFields({ name: 'Alice' }, ['name', 'email']);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('email');
  });

  it('returns all missing fields', () => {
    const result = validateRequiredFields({}, ['name', 'email', 'age']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['name', 'email', 'age']);
  });

  it('returns { valid: true } for empty required fields array', () => {
    const result = validateRequiredFields({ name: 'Alice' }, []);
    expect(result).toEqual({ valid: true });
  });
});

describe('requireFields', () => {
  it('does not throw when all fields are present', () => {
    expect(() => requireFields({ name: 'Alice', email: 'a@b.com' }, ['name', 'email'])).not.toThrow();
  });

  it('throws BadRequestError when a field is missing', () => {
    expect(() => requireFields({ name: 'Alice' }, ['name', 'email'])).toThrow(BadRequestError);
  });

  it('throws BadRequestError mentioning the missing field', () => {
    expect(() => requireFields({}, ['name'])).toThrow(/name/);
  });
});

describe('ensureResourceExists', () => {
  it('returns the resource when it is non-null', () => {
    const resource = { id: '1' };
    expect(ensureResourceExists(resource)).toBe(resource);
  });

  it('throws NotFoundError for null', () => {
    expect(() => ensureResourceExists(null)).toThrow(NotFoundError);
  });

  it('throws NotFoundError for undefined', () => {
    expect(() => ensureResourceExists(undefined)).toThrow(NotFoundError);
  });

  it('includes resourceName in error message', () => {
    expect(() => ensureResourceExists(null, 'User')).toThrow(/User/);
  });
});

describe('ensureAuthenticated', () => {
  it('does not throw for a valid userId', () => {
    expect(() => ensureAuthenticated('user-123')).not.toThrow();
  });

  it('throws UnauthorizedError for empty string', () => {
    expect(() => ensureAuthenticated('')).toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError for undefined', () => {
    expect(() => ensureAuthenticated(undefined)).toThrow(UnauthorizedError);
  });
});

describe('ensurePermission', () => {
  it('does not throw when hasPermission is true', () => {
    expect(() => ensurePermission(true)).not.toThrow();
  });

  it('throws ForbiddenError when hasPermission is false', () => {
    expect(() => ensurePermission(false)).toThrow(ForbiddenError);
  });

  it('includes custom message in the error', () => {
    expect(() => ensurePermission(false, 'Cannot delete')).toThrow(/Cannot delete/);
  });
});

describe('parseIntSafe', () => {
  it("parses '42' to 42", () => {
    expect(parseIntSafe('42')).toBe(42);
  });

  it("returns default 0 for 'abc'", () => {
    expect(parseIntSafe('abc')).toBe(0);
  });

  it('returns custom default for invalid input', () => {
    expect(parseIntSafe('abc', 99)).toBe(99);
  });

  it('returns default for undefined', () => {
    expect(parseIntSafe(undefined)).toBe(0);
  });

  it('handles negative numbers', () => {
    expect(parseIntSafe('-5')).toBe(-5);
  });
});

describe('parseFloatSafe', () => {
  it("parses '3.14' to 3.14", () => {
    expect(parseFloatSafe('3.14')).toBe(3.14);
  });

  it("returns default 0 for 'abc'", () => {
    expect(parseFloatSafe('abc')).toBe(0);
  });

  it('returns custom default for invalid input', () => {
    expect(parseFloatSafe('abc', 1.5)).toBe(1.5);
  });

  it('returns default for undefined', () => {
    expect(parseFloatSafe(undefined)).toBe(0);
  });
});

describe('calculatePagination', () => {
  it('page=1, perPage=10, total=100 → totalPages=10, hasNextPage=true, hasPrevPage=false', () => {
    const result = calculatePagination(1, 10, 100);
    expect(result.totalPages).toBe(10);
    expect(result.hasNextPage).toBe(true);
    expect(result.hasPrevPage).toBe(false);
  });

  it('page=10, perPage=10, total=100 → hasNextPage=false, hasPrevPage=true', () => {
    const result = calculatePagination(10, 10, 100);
    expect(result.hasNextPage).toBe(false);
    expect(result.hasPrevPage).toBe(true);
  });

  it('page=5, perPage=10, total=100 → both true', () => {
    const result = calculatePagination(5, 10, 100);
    expect(result.hasNextPage).toBe(true);
    expect(result.hasPrevPage).toBe(true);
  });

  it('page=1, perPage=10, total=0 → totalPages=0, hasNextPage=false', () => {
    const result = calculatePagination(1, 10, 0);
    expect(result.totalPages).toBe(0);
    expect(result.hasNextPage).toBe(false);
    expect(result.hasPrevPage).toBe(false);
  });

  it('page=1, perPage=3, total=10 → totalPages=4', () => {
    expect(calculatePagination(1, 3, 10).totalPages).toBe(4);
  });
});
