import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EnvironmentValidationError,
  validateEnvironment,
  validateEnvironmentOrThrow,
  getEnvVar,
  getEnvNumber,
  getEnvBoolean,
} from '../../utils/envValidator';

// Save and restore process.env around every test so mutations don't leak.
let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = { ...process.env };
  // Ensure baseline valid values (JWT_SECRET from setup.ts is 31 chars; needs 32+)
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-x'; // 33 chars
  delete process.env.PORT;
  delete process.env.EMAIL_FROM;
});

afterEach(() => {
  // Remove any keys added during the test
  Object.keys(process.env).forEach((k) => {
    if (!(k in originalEnv)) delete process.env[k];
  });
  // Restore original values
  Object.assign(process.env, originalEnv);
});

// ---------------------------------------------------------------------------
// validateEnvironment
// ---------------------------------------------------------------------------

describe('validateEnvironment', () => {
  it('returns { valid: true, errors: [] } with the setup env', () => {
    const result = validateEnvironment();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports error when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    const result = validateEnvironment();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Missing required'))).toBe(true);
  });

  it('reports error when DATABASE_URL does not start with postgresql://', () => {
    process.env.DATABASE_URL = 'mysql://user:pass@localhost/db';
    const result = validateEnvironment();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('valid PostgreSQL'))).toBe(true);
  });

  it('reports error when JWT_SECRET is shorter than 32 characters', () => {
    process.env.JWT_SECRET = 'tooshort';
    const result = validateEnvironment();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('at least 32 characters'))).toBe(true);
  });

  it('reports error when PORT is not a number', () => {
    process.env.PORT = 'abc';
    const result = validateEnvironment();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('valid port number'))).toBe(true);
  });

  it('reports error when PORT is 0', () => {
    process.env.PORT = '0';
    const result = validateEnvironment();
    expect(result.valid).toBe(false);
  });

  it('reports error when PORT is above 65535', () => {
    process.env.PORT = '99999';
    const result = validateEnvironment();
    expect(result.valid).toBe(false);
  });

  it('accepts a valid PORT value', () => {
    process.env.PORT = '3000';
    const result = validateEnvironment();
    expect(result.valid).toBe(true);
  });

  it('reports error when EMAIL_FROM is an invalid email', () => {
    process.env.EMAIL_FROM = 'not-an-email';
    const result = validateEnvironment();
    expect(result.valid).toBe(false);
  });

  it('accepts a valid EMAIL_FROM value', () => {
    process.env.EMAIL_FROM = 'no-reply@example.com';
    const result = validateEnvironment();
    expect(result.valid).toBe(true);
  });

  it('sets NODE_ENV to "development" when absent', () => {
    delete process.env.NODE_ENV;
    validateEnvironment();
    expect(process.env.NODE_ENV).toBe('development');
  });
});

// ---------------------------------------------------------------------------
// validateEnvironmentOrThrow
// ---------------------------------------------------------------------------

describe('validateEnvironmentOrThrow', () => {
  it('does not throw with a valid environment', () => {
    expect(() => validateEnvironmentOrThrow()).not.toThrow();
  });

  it('throws EnvironmentValidationError when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    expect(() => validateEnvironmentOrThrow()).toThrow(EnvironmentValidationError);
  });

  it('error message contains all validation errors', () => {
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = 'short';
    try {
      validateEnvironmentOrThrow();
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvironmentValidationError);
      const msg = (err as EnvironmentValidationError).message;
      // Both DATABASE_URL and JWT_SECRET errors should appear
      expect(msg).toMatch(/DATABASE_URL/);
      expect(msg).toMatch(/JWT_SECRET/);
    }
  });

  it('EnvironmentValidationError has the correct name', () => {
    delete process.env.DATABASE_URL;
    try {
      validateEnvironmentOrThrow();
    } catch (err) {
      expect((err as Error).name).toBe('EnvironmentValidationError');
    }
  });
});

// ---------------------------------------------------------------------------
// getEnvVar
// ---------------------------------------------------------------------------

describe('getEnvVar', () => {
  it('returns the value of an existing env var', () => {
    process.env.TEST_VAR = 'hello';
    expect(getEnvVar('TEST_VAR')).toBe('hello');
  });

  it('returns the default value when the variable is missing', () => {
    delete process.env.TEST_VAR;
    expect(getEnvVar('TEST_VAR', 'default-value')).toBe('default-value');
  });

  it('throws when the variable is missing and no default is provided', () => {
    delete process.env.TEST_VAR;
    expect(() => getEnvVar('TEST_VAR')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// getEnvNumber
// ---------------------------------------------------------------------------

describe('getEnvNumber', () => {
  it('returns the numeric value of an existing var', () => {
    process.env.TEST_NUM = '42';
    expect(getEnvNumber('TEST_NUM')).toBe(42);
  });

  it('returns the default number when the variable is missing', () => {
    delete process.env.TEST_NUM;
    expect(getEnvNumber('TEST_NUM', 99)).toBe(99);
  });

  it('throws when the variable is missing and no default is provided', () => {
    delete process.env.TEST_NUM;
    expect(() => getEnvNumber('TEST_NUM')).toThrow();
  });

  it('throws with "not a valid finite number" for a non-numeric value', () => {
    process.env.TEST_NUM = 'not-a-number';
    expect(() => getEnvNumber('TEST_NUM')).toThrow('not a valid finite number');
  });
});

// ---------------------------------------------------------------------------
// getEnvBoolean
// ---------------------------------------------------------------------------

describe('getEnvBoolean', () => {
  it('returns true for "true"', () => {
    process.env.TEST_BOOL = 'true';
    expect(getEnvBoolean('TEST_BOOL')).toBe(true);
  });

  it('returns true for "1"', () => {
    process.env.TEST_BOOL = '1';
    expect(getEnvBoolean('TEST_BOOL')).toBe(true);
  });

  it('returns false for "false"', () => {
    process.env.TEST_BOOL = 'false';
    expect(getEnvBoolean('TEST_BOOL')).toBe(false);
  });

  it('returns false for "0"', () => {
    process.env.TEST_BOOL = '0';
    expect(getEnvBoolean('TEST_BOOL')).toBe(false);
  });

  it('returns false for any other string', () => {
    process.env.TEST_BOOL = 'yes';
    expect(getEnvBoolean('TEST_BOOL')).toBe(false);
  });

  it('returns the default (true) when missing', () => {
    delete process.env.TEST_BOOL;
    expect(getEnvBoolean('TEST_BOOL', true)).toBe(true);
  });

  it('returns the default (false) when missing', () => {
    delete process.env.TEST_BOOL;
    expect(getEnvBoolean('TEST_BOOL', false)).toBe(false);
  });

  it('returns false (built-in default) when missing and no default provided', () => {
    delete process.env.TEST_BOOL;
    expect(getEnvBoolean('TEST_BOOL')).toBe(false);
  });
});
