import { describe, it, expect } from 'vitest';
import {
  isPrismaUniqueError,
  isPrismaNotFoundError,
  hasErrorCode,
  hasId,
  isUserWithEmail,
  hasEmailNotifications,
  hasExpiration,
  hasGroupId,
  isPrismaQueryEvent,
  hasLocation,
} from '../../utils/typeGuards';

describe('isPrismaUniqueError', () => {
  it('returns true for object with code P2002', () => {
    expect(isPrismaUniqueError({ code: 'P2002' })).toBe(true);
  });

  it('returns true with optional meta', () => {
    expect(isPrismaUniqueError({ code: 'P2002', meta: { target: ['email'] } })).toBe(true);
  });

  it('returns false for wrong code', () => {
    expect(isPrismaUniqueError({ code: 'P2025' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isPrismaUniqueError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPrismaUniqueError(undefined)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isPrismaUniqueError({})).toBe(false);
  });

  it('returns false when code is a number', () => {
    expect(isPrismaUniqueError({ code: 2002 })).toBe(false);
  });
});

describe('isPrismaNotFoundError', () => {
  it('returns true for object with code P2025', () => {
    expect(isPrismaNotFoundError({ code: 'P2025' })).toBe(true);
  });

  it('returns false for wrong code', () => {
    expect(isPrismaNotFoundError({ code: 'P2002' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isPrismaNotFoundError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPrismaNotFoundError(undefined)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isPrismaNotFoundError({})).toBe(false);
  });

  it('returns false when code is a number', () => {
    expect(isPrismaNotFoundError({ code: 2025 })).toBe(false);
  });
});

describe('hasErrorCode', () => {
  it('returns true for object with string code', () => {
    expect(hasErrorCode({ code: 'SOME_ERROR' })).toBe(true);
  });

  it('returns false for null', () => {
    expect(hasErrorCode(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasErrorCode(undefined)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(hasErrorCode({})).toBe(false);
  });

  it('returns false when code is a number', () => {
    expect(hasErrorCode({ code: 42 })).toBe(false);
  });

  it('returns false when code is boolean', () => {
    expect(hasErrorCode({ code: true })).toBe(false);
  });
});

describe('hasId', () => {
  it('returns true for object with string id', () => {
    expect(hasId({ id: 'abc123' })).toBe(true);
  });

  it('returns false for null', () => {
    expect(hasId(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasId(undefined)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(hasId({})).toBe(false);
  });

  it('returns false when id is a number', () => {
    expect(hasId({ id: 123 })).toBe(false);
  });
});

describe('isUserWithEmail', () => {
  it('returns true for valid user object', () => {
    expect(isUserWithEmail({ id: 'u1', email: 'a@b.com', name: 'Alice' })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isUserWithEmail(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isUserWithEmail(undefined)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isUserWithEmail({})).toBe(false);
  });

  it('returns false when id is missing', () => {
    expect(isUserWithEmail({ email: 'a@b.com', name: 'Alice' })).toBe(false);
  });

  it('returns false when email is missing', () => {
    expect(isUserWithEmail({ id: 'u1', name: 'Alice' })).toBe(false);
  });

  it('returns false when name is missing', () => {
    expect(isUserWithEmail({ id: 'u1', email: 'a@b.com' })).toBe(false);
  });

  it('returns false when fields have wrong types', () => {
    expect(isUserWithEmail({ id: 1, email: 2, name: 3 })).toBe(false);
  });
});

describe('hasEmailNotifications', () => {
  it('returns true when emailNotifications is true', () => {
    expect(hasEmailNotifications({ emailNotifications: true })).toBe(true);
  });

  it('returns true when emailNotifications is false', () => {
    expect(hasEmailNotifications({ emailNotifications: false })).toBe(true);
  });

  it('returns false for null', () => {
    expect(hasEmailNotifications(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasEmailNotifications(undefined)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(hasEmailNotifications({})).toBe(false);
  });

  it('returns false when emailNotifications is a string', () => {
    expect(hasEmailNotifications({ emailNotifications: 'true' })).toBe(false);
  });
});

describe('hasExpiration', () => {
  it('returns true for object with numeric exp', () => {
    expect(hasExpiration({ exp: 1700000000 })).toBe(true);
  });

  it('returns false for null', () => {
    expect(hasExpiration(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasExpiration(undefined)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(hasExpiration({})).toBe(false);
  });

  it('returns false when exp is a string', () => {
    expect(hasExpiration({ exp: '1700000000' })).toBe(false);
  });
});

describe('hasGroupId', () => {
  it('returns true for object with string groupId', () => {
    expect(hasGroupId({ groupId: 'group-123' })).toBe(true);
  });

  it('returns false for null', () => {
    expect(hasGroupId(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasGroupId(undefined)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(hasGroupId({})).toBe(false);
  });

  it('returns false when groupId is a number', () => {
    expect(hasGroupId({ groupId: 123 })).toBe(false);
  });
});

describe('isPrismaQueryEvent', () => {
  it('returns true for valid query event', () => {
    expect(isPrismaQueryEvent({ duration: 5, query: 'SELECT 1', params: '[]' })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isPrismaQueryEvent(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPrismaQueryEvent(undefined)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isPrismaQueryEvent({})).toBe(false);
  });

  it('returns false when duration is a string', () => {
    expect(isPrismaQueryEvent({ duration: '5', query: 'SELECT 1', params: '[]' })).toBe(false);
  });

  it('returns false when query is missing', () => {
    expect(isPrismaQueryEvent({ duration: 5, params: '[]' })).toBe(false);
  });

  it('returns false when params is a number', () => {
    expect(isPrismaQueryEvent({ duration: 5, query: 'SELECT 1', params: 123 })).toBe(false);
  });
});

describe('hasLocation', () => {
  it('returns true for object with numeric lat/lng', () => {
    expect(hasLocation({ latitude: 51.5, longitude: -0.1 })).toBe(true);
  });

  it('returns true when both latitude and longitude are null', () => {
    expect(hasLocation({ latitude: null, longitude: null })).toBe(true);
  });

  it('returns true with optional extra fields', () => {
    expect(hasLocation({ latitude: 10, longitude: 20, locationName: 'HQ', city: 'London', country: 'GB' })).toBe(true);
  });

  it('returns false for null', () => {
    expect(hasLocation(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasLocation(undefined)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(hasLocation({})).toBe(false);
  });

  it('returns false when latitude is a string', () => {
    expect(hasLocation({ latitude: '51.5', longitude: -0.1 })).toBe(false);
  });

  it('returns false when longitude is missing', () => {
    expect(hasLocation({ latitude: 51.5 })).toBe(false);
  });
});
