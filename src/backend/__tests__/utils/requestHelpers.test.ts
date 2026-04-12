import { describe, it, expect } from 'vitest';
import {
  getAuthenticatedUser,
  getAuthenticatedUserId,
  getAuthenticatedUserName,
} from '../../utils/requestHelpers';
import type { Request } from 'express';

function makeReq(user?: { id: string; email: string; name: string }): Request {
  return { user } as unknown as Request;
}

describe('getAuthenticatedUser', () => {
  it('returns req.user when present', () => {
    const user = { id: 'u1', email: 'a@b.com', name: 'Alice' };
    expect(getAuthenticatedUser(makeReq(user))).toBe(user);
  });

  it('throws a plain Error (not ApiError) when req.user is undefined', () => {
    const req = makeReq(undefined);
    expect(() => getAuthenticatedUser(req)).toThrow(Error);
    expect(() => getAuthenticatedUser(req)).toThrow(/internal error/i);
  });
});

describe('getAuthenticatedUserId', () => {
  it('returns the user id from the request', () => {
    const req = makeReq({ id: 'u42', email: 'x@y.com', name: 'Bob' });
    expect(getAuthenticatedUserId(req)).toBe('u42');
  });

  it('throws when req.user is absent', () => {
    expect(() => getAuthenticatedUserId(makeReq(undefined))).toThrow(Error);
  });
});

describe('getAuthenticatedUserName', () => {
  it('returns the user name from the request', () => {
    const req = makeReq({ id: 'u1', email: 'a@b.com', name: 'Charlie' });
    expect(getAuthenticatedUserName(req)).toBe('Charlie');
  });

  it('throws when req.user is absent', () => {
    expect(() => getAuthenticatedUserName(makeReq(undefined))).toThrow(Error);
  });
});
