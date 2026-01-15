import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { SESSION } from '../config/security';
import prisma from '../config/database';
import { logger } from './logger';

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-here';

// Require separate refresh secret in production for security
const REFRESH_SECRET_KEY = (() => {
  if (process.env.JWT_REFRESH_SECRET) {
    return process.env.JWT_REFRESH_SECRET;
  }
  
  // In production, require a separate refresh secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_REFRESH_SECRET must be set in production for security');
  }
  
  // In development, allow fallback but log warning
  if (process.env.NODE_ENV === 'development') {
    logger.warn('Using JWT_SECRET for refresh tokens. Set JWT_REFRESH_SECRET in production.', 'JWT');
  }
  
  return process.env.JWT_SECRET || 'your-refresh-secret-key-here';
})();

interface TokenPayload {
  userId: string;
  type?: 'access' | 'refresh';
  sessionId?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

/**
 * Generate access token (short-lived)
 */
export const generateToken = (userId: string, sessionId?: string): string => {
  return jwt.sign(
    { 
      userId, 
      type: 'access',
      sessionId 
    }, 
    SECRET_KEY, 
    { expiresIn: `${SESSION.JWT_EXPIRY_DAYS}d` }
  );
};

/**
 * Generate refresh token (long-lived)
 */
export const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    { 
      userId, 
      type: 'refresh',
      jti: crypto.randomBytes(16).toString('hex') // Unique token ID
    }, 
    REFRESH_SECRET_KEY, 
    { expiresIn: '30d' } // Refresh tokens last 30 days
  );
};

/**
 * Generate both access and refresh tokens
 */
export const generateTokenPair = async (userId: string, deviceInfo?: string, ipAddress?: string): Promise<TokenPair> => {
  const accessToken = generateToken(userId);
  const refreshToken = generateRefreshToken(userId);
  
  // Store refresh token in database
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt
    }
  });

  // Create session record
  const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
  const sessionExpiresAt = new Date(Date.now() + SESSION.JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  
  await prisma.userSession.create({
    data: {
      userId,
      token: tokenHash,
      deviceInfo,
      ipAddress,
      expiresAt: sessionExpiresAt
    }
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: SESSION.JWT_EXPIRY_DAYS * 24 * 60 * 60, // seconds
    refreshExpiresIn: 30 * 24 * 60 * 60 // 30 days in seconds
  };
};

/**
 * Verify access token
 */
export const verifyToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, SECRET_KEY) as TokenPayload;
  } catch {
    return null;
  }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, REFRESH_SECRET_KEY) as TokenPayload;
  } catch {
    return null;
  }
};

/**
 * Check if token is revoked
 */
export const isTokenRevoked = async (token: string): Promise<boolean> => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  const revokedToken = await prisma.revokedToken.findUnique({
    where: { token: tokenHash }
  });
  
  return !!revokedToken;
};

/**
 * Revoke a token (add to blacklist)
 */
export const revokeToken = async (token: string, userId: string, reason: string = 'logout'): Promise<void> => {
  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      return; // Invalid token, nothing to revoke
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Calculate when token would naturally expire
    const decoded2 = jwt.decode(token) as { exp: number } | null;
    const expiresAt = decoded2 ? new Date(decoded2.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.revokedToken.create({
      data: {
        token: tokenHash,
        userId,
        expiresAt,
        reason
      }
    });

    // Remove associated session
    await prisma.userSession.deleteMany({
      where: { 
        userId,
        token: tokenHash 
      }
    });

    logger.info('Token revoked', 'JWTUtil', { userId, reason });
  } catch (error) {
    logger.error('Error revoking token', 'JWTUtil', { error });
  }
};

/**
 * Revoke all tokens for a user (e.g., password change, security breach)
 */
export const revokeAllUserTokens = async (userId: string, reason: string = 'security'): Promise<void> => {
  try {
    // Get all active sessions for the user
    const sessions = await prisma.userSession.findMany({
      where: { userId }
    });

    // Revoke each token
    const now = new Date();
    const revokedTokens = sessions.map(session => ({
      token: session.token,
      userId,
      expiresAt: session.expiresAt,
      revokedAt: now,
      reason
    }));

    if (revokedTokens.length > 0) {
      await prisma.revokedToken.createMany({
        data: revokedTokens,
        skipDuplicates: true
      });
    }

    // Delete all sessions
    await prisma.userSession.deleteMany({
      where: { userId }
    });

    // Delete all refresh tokens
    await prisma.refreshToken.deleteMany({
      where: { userId }
    });

    logger.info('All tokens revoked for user', 'JWTUtil', { userId, reason, count: sessions.length });
  } catch (error) {
    logger.error('Error revoking all user tokens', 'JWTUtil', { error });
  }
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (refreshToken: string): Promise<{ accessToken: string; expiresIn: number } | null> => {
  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return null;
    }

    // Check if refresh token exists and is valid in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken }
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return null;
    }

    // Generate new access token
    const accessToken = generateToken(decoded.userId);
    
    // Update last active time for tracking
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
    
    // Create new session
    const sessionExpiresAt = new Date(Date.now() + SESSION.JWT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await prisma.userSession.create({
      data: {
        userId: decoded.userId,
        token: tokenHash,
        expiresAt: sessionExpiresAt
      }
    });

    return {
      accessToken,
      expiresIn: SESSION.JWT_EXPIRY_DAYS * 24 * 60 * 60
    };
  } catch (error) {
    logger.error('Error refreshing access token', 'JWTUtil', { error });
    return null;
  }
};

/**
 * Cleanup expired tokens and sessions (should be run periodically)
 */
export const cleanupExpiredTokens = async (): Promise<void> => {
  try {
    const now = new Date();
    
    // Delete expired revoked tokens (they're no longer needed after natural expiry)
    const revokedResult = await prisma.revokedToken.deleteMany({
      where: {
        expiresAt: { lt: now }
      }
    });

    // Delete expired sessions
    const sessionsResult = await prisma.userSession.deleteMany({
      where: {
        expiresAt: { lt: now }
      }
    });

    // Delete expired refresh tokens
    const refreshResult = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: now }
      }
    });

    logger.info('Cleaned up expired tokens', 'JWTUtil', {
      revokedTokens: revokedResult.count,
      sessions: sessionsResult.count,
      refreshTokens: refreshResult.count
    });
  } catch (error) {
    logger.error('Error cleaning up expired tokens', 'JWTUtil', { error });
  }
};
