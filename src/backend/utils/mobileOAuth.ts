/**
 * Mobile OAuth token verification helpers.
 *
 * The browser-redirect Passport flow cannot be used from a native mobile app.
 * Instead, the mobile app performs the OAuth dance natively (using platform
 * SDKs), then sends the resulting token/credential to one of the three
 * endpoints below.  These helpers verify those tokens server-side and return
 * a normalised profile object that the controller can use to create or look up
 * a user in the database.
 */

import * as https from 'https';
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from './logger';

export interface OAuthProfile {
  providerId: string;
  email: string;
  name: string;
  picture?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Small wrapper so we don't need axios/node-fetch in the backend. */
function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.setTimeout(10_000, () => { req.destroy(new Error('JWKS request timed out')); });
  });
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

/**
 * Verify a Google ID token using Google's tokeninfo endpoint.
 * We avoid adding google-auth-library as a dependency; the tokeninfo
 * endpoint is the simplest server-side verification path and is supported
 * long-term by Google.
 */
export async function verifyGoogleToken(idToken: string): Promise<OAuthProfile> {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  let raw: string;
  try {
    raw = await httpsGet(url);
  } catch (err) {
    logger.error('Failed to reach Google tokeninfo endpoint', 'MobileOAuth', { err });
    throw new Error('Could not verify Google token – network error');
  }

  let payload: Record<string, string>;
  try {
    payload = JSON.parse(raw) as Record<string, string>;
  } catch {
    throw new Error('Invalid response from Google tokeninfo');
  }

  if (payload.error) {
    throw new Error(`Google token invalid: ${payload.error_description ?? payload.error}`);
  }

  // Optionally enforce audience – only when GOOGLE_CLIENT_ID is set
  const expectedAud = process.env.GOOGLE_CLIENT_ID;
  if (expectedAud && payload.aud !== expectedAud) {
    throw new Error('Google token audience mismatch');
  }

  if (!payload.sub) throw new Error('Google token missing sub claim');
  if (!payload.email) throw new Error('Google token missing email claim');

  return {
    providerId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    picture: payload.picture,
  };
}

// ---------------------------------------------------------------------------
// Facebook
// ---------------------------------------------------------------------------

/**
 * Verify a Facebook user access token by hitting the Graph API.
 * Returns the user's profile data on success.
 */
export async function verifyFacebookToken(accessToken: string): Promise<OAuthProfile> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  // Validate with app-level token (appsecret_proof) when credentials are set
  let proofParam = '';
  if (appId && appSecret) {
    const proof = crypto
      .createHmac('sha256', appSecret)
      .update(accessToken)
      .digest('hex');
    proofParam = `&appsecret_proof=${proof}`;
  }

  const url =
    `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)` +
    `&access_token=${encodeURIComponent(accessToken)}${proofParam}`;

  let raw: string;
  try {
    raw = await httpsGet(url);
  } catch (err) {
    logger.error('Failed to reach Facebook Graph API', 'MobileOAuth', { err });
    throw new Error('Could not verify Facebook token – network error');
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid response from Facebook Graph API');
  }

  if ((data.error as Record<string, unknown>)?.message) {
    const fbErr = data.error as Record<string, unknown>;
    throw new Error(`Facebook token invalid: ${fbErr.message}`);
  }

  if (!data.id) throw new Error('Facebook token missing user id');
  if (!data.email) throw new Error('Facebook did not return an email address');

  const picture =
    ((data.picture as Record<string, unknown>)?.data as Record<string, unknown>)
      ?.url as string | undefined;

  return {
    providerId: data.id as string,
    email: data.email as string,
    name: (data.name as string) ?? (data.email as string),
    picture,
  };
}

// ---------------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------------

interface AppleJwksKey {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

interface AppleJwks {
  keys: AppleJwksKey[];
}

/** Cache Apple's JWKS keys for 1 hour to avoid hammering the endpoint. */
let cachedAppleKeys: AppleJwksKey[] | null = null;
let appleKeyCacheExpiry = 0;

async function getApplePublicKeys(): Promise<AppleJwksKey[]> {
  if (cachedAppleKeys && Date.now() < appleKeyCacheExpiry) {
    return cachedAppleKeys;
  }
  const raw = await httpsGet('https://appleid.apple.com/auth/keys');
  const jwks = JSON.parse(raw) as AppleJwks;
  cachedAppleKeys = jwks.keys;
  appleKeyCacheExpiry = Date.now() + 3_600_000; // 1 hour
  return cachedAppleKeys;
}

function buildRsaPublicKey(n: string, e: string): string {
  // Convert a JWK (n, e) to a PEM string using Node.js built-in crypto
  const key = crypto.createPublicKey({
    key: { kty: 'RSA', n, e },
    format: 'jwk',
  });
  return key.export({ type: 'spki', format: 'pem' }) as string;
}

/**
 * Verify an Apple identity token (JWT) returned by the Sign in with Apple flow.
 * The `fullName` and `email` from the first-time authorisation are passed
 * separately by the client because Apple only returns them once.
 */
export async function verifyAppleToken(
  identityToken: string,
  givenName?: string,
  familyName?: string,
  clientEmail?: string,
): Promise<OAuthProfile> {
  // Decode header to get kid (key ID)
  let header: { kid?: string; alg?: string };
  try {
    const headerB64 = identityToken.split('.')[0];
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      kid?: string;
      alg?: string;
    };
  } catch {
    throw new Error('Malformed Apple identity token');
  }

  const keys = await getApplePublicKeys();
  const matchingKey = keys.find((k) => k.kid === header.kid);
  if (!matchingKey) {
    throw new Error('Apple public key not found for this token');
  }

  const publicKeyPem = buildRsaPublicKey(matchingKey.n, matchingKey.e);

  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(identityToken, publicKeyPem, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
    }) as jwt.JwtPayload;
  } catch (err) {
    throw new Error(`Apple token verification failed: ${(err as Error).message}`);
  }

  // Validate audience when configured
  const expectedAud = process.env.APPLE_CLIENT_ID;
  if (expectedAud) {
    const aud = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
    if (!aud.includes(expectedAud)) {
      throw new Error('Apple token audience mismatch');
    }
  }

  const sub = decoded.sub;
  if (!sub) throw new Error('Apple token missing sub claim');

  // Apple only sends email in the first authorisation; subsequent calls omit it
  const email = (decoded.email as string | undefined) ?? clientEmail;
  if (!email) {
    throw new Error(
      'Apple did not return an email address. ' +
        'Please pass the email from the initial authorisation response.',
    );
  }

  const name =
    [givenName, familyName].filter(Boolean).join(' ').trim() || email;

  return { providerId: sub, email, name };
}
