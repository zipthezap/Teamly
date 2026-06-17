/**
 * Authentication Controller
 * 
 * This controller handles all authentication and user management operations including:
 * - User registration and login (with 2FA support)
 * - Password management (update, reset, recovery)
 * - Email verification
 * - Token management (access, refresh, logout)
 * - Session management
 * - Profile management (view, update)
 * - Profile picture management (upload, delete, restore)
 * - OAuth integration (Google, Facebook, Apple)
 * - Mobile OAuth token exchange (Google, Facebook, Apple)
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateTokenPair } from '../utils/jwt';
import { logger } from '../utils/logger';
import { BadRequestError, NotFoundError, UnauthorizedError, ConflictError } from '../utils/errors';
import { verifyGoogleToken, verifyFacebookToken, verifyAppleToken, OAuthProfile } from '../utils/mobileOAuth';
import crypto from 'crypto';
import { CacheService } from '../services/cacheService';

async function handleMobileOAuth(
  req: Request,
  res: Response,
  provider: 'google' | 'facebook' | 'apple',
  profile: OAuthProfile,
): Promise<void> {
  const idField = `${provider}Id` as 'googleId' | 'facebookId' | 'appleId';
  let user = await prisma.user.findUnique({ where: { [idField]: profile.providerId } as never });

  if (!user) {
    // If there is an existing account with the same email, DO NOT auto-link the OAuth provider.
    // Auto-linking by email can silently take over accounts. Require explicit user consent
    // from the account settings or a dedicated linking flow.
    const existingByEmail = await prisma.user.findUnique({ where: { email: profile.email } });
    if (existingByEmail) {
      // Surface a clear conflict so the client can prompt the user to sign in and link providers.
      throw new ConflictError('An account already exists with this email. Please sign in and link your OAuth provider via account settings.');
    }

    // No existing user — create a new user for this OAuth profile
    user = await prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        [idField]: profile.providerId,
        authProvider: provider,
        emailVerified: true,
        password: null,
        oauthProfilePicture: profile.picture ?? null,
        lastOAuthSync: new Date(),
      } as never,
    });
    logger.info(`New user registered via mobile ${provider} OAuth`, 'AuthController', {
      userId: user.id,
    });
  }

  const deviceInfo = req.headers['user-agent'];
  const ipAddress = req.ip;
  const tokens = await generateTokenPair(user.id, deviceInfo, ipAddress);

  res.json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      profilePicture: user.profilePicture ?? user.oauthProfilePicture,
      emailVerified: user.emailVerified,
    },
  });
}

export const oauthCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication failed' });
      return;
    }

    const user = req.user!;

    // Generate token pair with session tracking
    const deviceInfo = req.headers['user-agent'];
    const ipAddress = req.ip;
    const tokens = await generateTokenPair(user.id, deviceInfo, ipAddress);

    // Get the invite group ID from session if it exists
    const inviteGroupId = req.session?.inviteGroupId;
    
    // Clear the session data
    if (inviteGroupId && req.session) {
      delete req.session.inviteGroupId;
    }

    // Build redirect URL with tokens
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const redirectUrl = new URL('/auth/callback', frontendUrl);
    redirectUrl.searchParams.set('token', tokens.accessToken);
    redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);
    
    if (inviteGroupId) {
      redirectUrl.searchParams.set('inviteGroupId', inviteGroupId);
    }

    res.redirect(redirectUrl.toString());
  } catch (error) {
    logger.error('OAuth callback error', 'AuthController', { error });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
};

/**
 * Get OAuth account connection status
 */
export const getOAuthStatus = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!?.id;
  
  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleId: true,
      facebookId: true,
      authProvider: true,
      password: true,
      lastOAuthSync: true,
      oauthProfilePicture: true
    }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json({
    connections: {
      google: !!user.googleId,
      facebook: !!user.facebookId,
      local: !!user.password
    },
    primaryProvider: user.authProvider,
    lastOAuthSync: user.lastOAuthSync,
    hasOAuthProfilePicture: !!user.oauthProfilePicture
  });
};

/**
 * Unlink OAuth account
 */
export const unlinkOAuthAccount = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!?.id;
  const { provider } = req.body;

  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }

  if (!provider || !['google', 'facebook'].includes(provider)) {
    throw new BadRequestError('Invalid provider. Must be "google" or "facebook"');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleId: true,
      facebookId: true,
      password: true,
      authProvider: true
    }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Check if user has another authentication method
  const hasGoogle = !!user.googleId;
  const hasFacebook = !!user.facebookId;
  const hasPassword = !!user.password;

  if (provider === 'google' && hasGoogle && !hasFacebook && !hasPassword) {
    throw new BadRequestError('Cannot unlink Google account. You must have at least one authentication method. Please set a password first.');
  }

  if (provider === 'facebook' && hasFacebook && !hasGoogle && !hasPassword) {
    throw new BadRequestError('Cannot unlink Facebook account. You must have at least one authentication method. Please set a password first.');
  }

  // Unlink the account
  const updateData: Record<string, unknown> = {};
  if (provider === 'google') {
    updateData.googleId = null;
    // Update authProvider if Google was the primary
    if (user.authProvider === 'google') {
      if (hasFacebook) {
        updateData.authProvider = 'facebook';
      } else if (hasPassword) {
        updateData.authProvider = 'local';
      }
    }
  } else if (provider === 'facebook') {
    updateData.facebookId = null;
    // Update authProvider if Facebook was the primary
    if (user.authProvider === 'facebook') {
      if (hasGoogle) {
        updateData.authProvider = 'google';
      } else if (hasPassword) {
        updateData.authProvider = 'local';
      }
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData
  });

  logger.info(`${provider} account unlinked`, 'AuthController', { userId });
  res.json({ message: `${provider} account unlinked successfully` });
};

/**
 * Sync OAuth profile picture
 */
export const syncOAuthProfilePicture = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!?.id;

  if (!userId) {
    throw new UnauthorizedError('Unauthorized');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      oauthProfilePicture: true,
      profilePicture: true
    }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (!user.oauthProfilePicture) {
    throw new BadRequestError('No OAuth profile picture available');
  }

  // Update user's profile picture to OAuth picture
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { 
      profilePicture: user.oauthProfilePicture,
      lastOAuthSync: new Date()
    },
    select: {
      id: true,
      email: true,
      name: true,
      profilePicture: true,
      city: true,
      country: true,
      address: true,
      postalCode: true,
      discoveryRadius: true,
      createdAt: true
    }
  });

  logger.info('OAuth profile picture synced', 'AuthController', { userId });
  res.json({ user: updatedUser, message: 'Profile picture synced from OAuth provider' });
};

// ==================== DASHBOARD AGGREGATE ENDPOINT ====================

/**
 * Get dashboard summary data for the authenticated user.
 *
 * Returns a single aggregate payload that combines:
 *   - upcoming sessions the user is participating in (max 5)
 *   - the user's groups (max 5, most recently created first)
 *   - unread notification count
 *   - lightweight stats (totalSessions, upcomingCount, groupCount)
 *
 * This replaces the 2–3 separate API round-trips previously required by
 * the mobile dashboard page.
 *
 * GET /api/auth/me/dashboard
 */
export const mobileGoogleLogin = async (req: Request, res: Response): Promise<void> => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) throw new BadRequestError('idToken is required');

  const profile = await verifyGoogleToken(idToken);
  await handleMobileOAuth(req, res, 'google', profile);
};

/**
 * POST /auth/facebook/mobile
 * Body: { accessToken: string }
 */
export const mobileFacebookLogin = async (req: Request, res: Response): Promise<void> => {
  const { accessToken } = req.body as { accessToken?: string };
  if (!accessToken) throw new BadRequestError('accessToken is required');

  const profile = await verifyFacebookToken(accessToken);
  await handleMobileOAuth(req, res, 'facebook', profile);
};

/**
 * POST /auth/apple/mobile
 * Body: { identityToken: string, givenName?: string, familyName?: string, email?: string }
 *
 * Apple only returns name/email in the very first authorisation response.
 * The mobile app must forward them here when present.
 */
export const mobileAppleLogin = async (req: Request, res: Response): Promise<void> => {
  const { identityToken, givenName, familyName, email } =
    req.body as {
      identityToken?: string;
      givenName?: string;
      familyName?: string;
      email?: string;
    };
  if (!identityToken) throw new BadRequestError('identityToken is required');

  const profile = await verifyAppleToken(identityToken, givenName, familyName, email);
  await handleMobileOAuth(req, res, 'apple', profile);
};

/**
 * Start OAuth linking flow for an existing account.
 * This stores a short-lived link token the client can use after authenticating.
 * POST /auth/oauth/link/start
 * Body: { provider: 'google'|'facebook'|'apple', providerId, email, name?, picture? }
 */
export const startOAuthLink = async (req: Request, res: Response): Promise<void> => {
  const { provider, providerId, email, name, picture } = req.body as any;
  if (!provider || !['google', 'facebook', 'apple'].includes(provider)) throw new BadRequestError('Invalid provider');
  if (!providerId || !email) throw new BadRequestError('providerId and email are required');
  // Abuse protection: rate limit by IP, providerId and email to avoid token spam
  const ip = (req.ip || (req.headers && (req.headers['x-forwarded-for'] as string)) || 'unknown') as string;
  const hourTTL = 60 * 60;
  const ipKey = `oauth_link:rate:ip:${ip}`;
  const providerKey = `oauth_link:rate:provider:${provider}:${providerId}`;
  const emailKey = `oauth_link:rate:email:${email}`;

  const ipCount = (await CacheService.get<number>(ipKey)) ?? 0;
  const providerCount = (await CacheService.get<number>(providerKey)) ?? 0;
  const emailCount = (await CacheService.get<number>(emailKey)) ?? 0;

  const IP_LIMIT = 20; // per hour
  const PROVIDER_LIMIT = 5; // per hour per providerId
  const EMAIL_LIMIT = 5; // per hour per email

  if (ipCount >= IP_LIMIT || providerCount >= PROVIDER_LIMIT || emailCount >= EMAIL_LIMIT) {
    throw new BadRequestError('Rate limit exceeded for creating OAuth link tokens. Try again later.');
  }

  // Increment counters (set or reset TTL)
  await CacheService.set(ipKey, ipCount + 1, hourTTL);
  await CacheService.set(providerKey, providerCount + 1, hourTTL);
  await CacheService.set(emailKey, emailCount + 1, hourTTL);

  // Create short-lived token and store in cache
  const token = crypto.randomBytes(18).toString('hex');
  const key = `oauth_link:${token}`;
  const payload = { provider, providerId, email, name: name ?? null, picture: picture ?? null, createdAt: new Date().toISOString() };

  await CacheService.set(key, payload, hourTTL); // 1 hour TTL

  res.json({ token, message: 'Link token created. Sign in to your account and confirm linking using this token.' });
};

/**
 * Confirm OAuth linking after user authenticates. Requires auth.
 * POST /auth/oauth/link/confirm
 * Body: { token }
 */
export const confirmOAuthLink = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Unauthorized');
  const { token } = req.body as any;
  if (!token) throw new BadRequestError('token is required');

  const key = `oauth_link:${token}`;
  const raw = await CacheService.get(key);
  if (!raw) throw new BadRequestError('Invalid or expired link token');

  const payload = JSON.parse(raw as string);
  if (payload.email) {
    // Ensure the linking user owns the email claimed by the OAuth profile
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new NotFoundError('User not found');
    if (user.email !== payload.email) {
      throw new BadRequestError('Authenticated user email does not match OAuth profile email');
    }
  }

  // Perform link by updating provider ID on user record
  const idField = `${payload.provider}Id`;
  const updateData: any = {};
  updateData[idField] = payload.providerId;
  updateData.emailVerified = true;
  updateData.oauthProfilePicture = payload.picture ?? undefined;
  updateData.lastOAuthSync = new Date();

  await prisma.user.update({ where: { id: userId }, data: updateData as any });

  // Remove token from cache
  await CacheService.deletePattern(key);

  res.json({ message: 'OAuth provider linked successfully' });
};

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

/**
 * DELETE /auth/account
 *
 * Soft-deletes the authenticated user's account by setting `deletedAt`.
 * All active tokens are revoked immediately so subsequent requests are
 * rejected by the auth middleware, regardless of token expiry.
 *
 * Data that is deleted / anonymised:
 *   - User record (soft-deleted via `deletedAt` timestamp)
 *   - All refresh tokens and active sessions (hard-revoked)
 *   - Push device tokens (removed from future notification delivery)
 *
 * Data that is retained for integrity:
 *   - Group messages, session records, and other relational data are
 *     preserved with their existing foreign keys so that other users'
 *     history is not broken. Personal identifiers in those records
 *     remain but the parent user row is no longer accessible.
 */
