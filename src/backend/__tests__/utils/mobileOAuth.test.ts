import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

vi.mock('https', () => ({
  get: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  default: { verify: vi.fn() },
}));

import * as https from 'https';
import jwt from 'jsonwebtoken';
import { verifyGoogleToken, verifyFacebookToken, verifyAppleToken } from '../../utils/mobileOAuth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockHttpsGet(responseBody: string, statusCode = 200) {
  vi.mocked(https.get).mockImplementation((url: any, callback: any) => {
    const res = new EventEmitter() as any;
    res.statusCode = statusCode;
    process.nextTick(() => {
      callback(res);
      res.emit('data', responseBody);
      res.emit('end');
    });
    const req = new EventEmitter() as any;
    req.setTimeout = vi.fn();
    req.destroy = vi.fn();
    return req as any;
  });
}

function mockHttpsGetNetworkError(err: Error) {
  vi.mocked(https.get).mockImplementation((_url: any, _callback: any) => {
    const req = new EventEmitter() as any;
    req.setTimeout = vi.fn();
    req.destroy = vi.fn();
    process.nextTick(() => req.emit('error', err));
    return req as any;
  });
}

// ---------------------------------------------------------------------------
// RSA key material for Apple tests (generated once, reused)
// ---------------------------------------------------------------------------

let testJwkN: string;
let testJwkE: string;
const TEST_KID = 'test-apple-kid';

beforeAll(() => {
  const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }) as { n: string; e: string };
  testJwkN = jwk.n;
  testJwkE = jwk.e;
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// verifyGoogleToken
// ---------------------------------------------------------------------------

describe('verifyGoogleToken', () => {
  it('returns OAuthProfile on a valid token response', async () => {
    mockHttpsGet(
      JSON.stringify({
        sub: 'google-uid-123',
        email: 'user@example.com',
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
      }),
    );

    const profile = await verifyGoogleToken('valid-id-token');
    expect(profile.providerId).toBe('google-uid-123');
    expect(profile.email).toBe('user@example.com');
    expect(profile.name).toBe('Test User');
    expect(profile.picture).toBe('https://example.com/photo.jpg');
  });

  it('throws when the response contains an error field', async () => {
    mockHttpsGet(JSON.stringify({ error: 'invalid_token', error_description: 'Token expired' }));
    await expect(verifyGoogleToken('bad-token')).rejects.toThrow('Google token invalid');
  });

  it('throws when sub is missing', async () => {
    mockHttpsGet(JSON.stringify({ email: 'user@example.com', name: 'Test User' }));
    await expect(verifyGoogleToken('no-sub-token')).rejects.toThrow('missing sub claim');
  });

  it('throws when email is missing', async () => {
    mockHttpsGet(JSON.stringify({ sub: 'google-uid-123', name: 'Test User' }));
    await expect(verifyGoogleToken('no-email-token')).rejects.toThrow('missing email claim');
  });

  it('throws on audience mismatch when GOOGLE_CLIENT_ID is set', async () => {
    process.env.GOOGLE_CLIENT_ID = 'expected-client-id';
    mockHttpsGet(
      JSON.stringify({ sub: 'google-uid', email: 'u@example.com', aud: 'wrong-client-id' }),
    );
    await expect(verifyGoogleToken('token')).rejects.toThrow('audience mismatch');
    delete process.env.GOOGLE_CLIENT_ID;
  });

  it('throws on network error', async () => {
    mockHttpsGetNetworkError(new Error('ECONNREFUSED'));
    await expect(verifyGoogleToken('token')).rejects.toThrow('network error');
  });
});

// ---------------------------------------------------------------------------
// verifyFacebookToken
// ---------------------------------------------------------------------------

describe('verifyFacebookToken', () => {
  it('returns OAuthProfile on a valid response', async () => {
    mockHttpsGet(
      JSON.stringify({
        id: 'fb-uid-456',
        email: 'fb@example.com',
        name: 'FB User',
        picture: { data: { url: 'https://fb.com/photo.jpg' } },
      }),
    );

    const profile = await verifyFacebookToken('valid-access-token');
    expect(profile.providerId).toBe('fb-uid-456');
    expect(profile.email).toBe('fb@example.com');
    expect(profile.name).toBe('FB User');
    expect(profile.picture).toBe('https://fb.com/photo.jpg');
  });

  it('throws when response has error.message', async () => {
    mockHttpsGet(
      JSON.stringify({ error: { message: 'Invalid OAuth access token', code: 190 } }),
    );
    await expect(verifyFacebookToken('bad-token')).rejects.toThrow('Facebook token invalid');
  });

  it('throws when id is missing', async () => {
    mockHttpsGet(JSON.stringify({ email: 'fb@example.com', name: 'FB User' }));
    await expect(verifyFacebookToken('token')).rejects.toThrow();
  });

  it('throws with "did not return an email" when email is missing', async () => {
    mockHttpsGet(JSON.stringify({ id: 'fb-uid', name: 'FB User' }));
    await expect(verifyFacebookToken('token')).rejects.toThrow('did not return an email');
  });

  it('throws on network error', async () => {
    mockHttpsGetNetworkError(new Error('ETIMEDOUT'));
    await expect(verifyFacebookToken('token')).rejects.toThrow('network error');
  });
});

// ---------------------------------------------------------------------------
// verifyAppleToken
// ---------------------------------------------------------------------------

describe('verifyAppleToken', () => {
  function makeAppleToken(kid: string): string {
    const header = Buffer.from(JSON.stringify({ kid, alg: 'RS256' })).toString('base64url');
    return `${header}.e30.sig`;
  }

  function setupJwksMock() {
    mockHttpsGet(
      JSON.stringify({
        keys: [
          { kty: 'RSA', kid: TEST_KID, use: 'sig', alg: 'RS256', n: testJwkN, e: testJwkE },
        ],
      }),
    );
  }

  it('throws "Malformed Apple identity token" for a token with no dots', async () => {
    await expect(verifyAppleToken('notavalidtoken')).rejects.toThrow(
      'Malformed Apple identity token',
    );
  });

  it('throws "Apple public key not found" when JWKS has no matching key', async () => {
    setupJwksMock();
    const token = makeAppleToken('no-match-kid');
    await expect(verifyAppleToken(token)).rejects.toThrow('Apple public key not found');
  });

  it('rethrows as "Apple token verification failed" when jwt.verify throws', async () => {
    // Cache is now populated with TEST_KID from the previous test
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error('signature invalid');
    });

    const token = makeAppleToken(TEST_KID);
    await expect(verifyAppleToken(token)).rejects.toThrow('Apple token verification failed');
  });

  it('throws "Apple token missing sub claim" when decoded payload has no sub', async () => {
    vi.mocked(jwt.verify).mockReturnValue({ email: 'apple@example.com' } as any);

    const token = makeAppleToken(TEST_KID);
    await expect(verifyAppleToken(token)).rejects.toThrow('Apple token missing sub claim');
  });

  it('returns OAuthProfile on a fully valid Apple token', async () => {
    vi.mocked(jwt.verify).mockReturnValue({
      sub: 'apple-user-id',
      email: 'apple@example.com',
    } as any);

    const token = makeAppleToken(TEST_KID);
    const profile = await verifyAppleToken(token, 'Jane', 'Doe');
    expect(profile.providerId).toBe('apple-user-id');
    expect(profile.email).toBe('apple@example.com');
    expect(profile.name).toBe('Jane Doe');
  });

  it('uses clientEmail when decoded payload omits email', async () => {
    vi.mocked(jwt.verify).mockReturnValue({ sub: 'apple-user-id' } as any);

    const token = makeAppleToken(TEST_KID);
    const profile = await verifyAppleToken(token, undefined, undefined, 'fallback@example.com');
    expect(profile.email).toBe('fallback@example.com');
  });

  it('throws when neither decoded email nor clientEmail is provided', async () => {
    vi.mocked(jwt.verify).mockReturnValue({ sub: 'apple-user-id' } as any);

    const token = makeAppleToken(TEST_KID);
    await expect(verifyAppleToken(token)).rejects.toThrow();
  });
});
