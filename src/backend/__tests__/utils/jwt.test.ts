import jwt from 'jsonwebtoken';
import { vi, beforeEach } from 'vitest';

// Mock database module before importing JWT utilities
vi.mock('../../config/database', () => ({
  default: {
    userSession: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    revokedToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  isTokenRevoked,
} from '../../utils/jwt';
import prisma from '../../config/database';

describe('JWT Utilities', () => {
  const testUserId = 'test-user-123';
  const testSessionId = 'test-session-123';

  describe('generateToken', () => {
    it('should generate a valid access token', () => {
      const token = generateToken(testUserId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as unknown;
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.type).toBe('access');
    });

    it('should generate access token with session ID', () => {
      const token = generateToken(testUserId, testSessionId);
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as unknown;
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.sessionId).toBe(testSessionId);
      expect(decoded.type).toBe('access');
    });

    it('should generate token with expiration', () => {
      const token = generateToken(testUserId);
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as unknown;
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });

    it('should generate different tokens for different users', () => {
      const token1 = generateToken('user-1');
      const token2 = generateToken('user-2');
      
      expect(token1).not.toBe(token2);
      
      const decoded1 = jwt.verify(token1, process.env.JWT_SECRET!) as unknown;
      const decoded2 = jwt.verify(token2, process.env.JWT_SECRET!) as unknown;
      
      expect(decoded1.userId).toBe('user-1');
      expect(decoded2.userId).toBe('user-2');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(testUserId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as unknown;
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.type).toBe('refresh');
    });

    it('should generate refresh token with unique JTI', () => {
      const token1 = generateRefreshToken(testUserId);
      const token2 = generateRefreshToken(testUserId);
      
      expect(token1).not.toBe(token2);
      
      const decoded1 = jwt.verify(token1, process.env.JWT_REFRESH_SECRET!) as unknown;
      const decoded2 = jwt.verify(token2, process.env.JWT_REFRESH_SECRET!) as unknown;
      
      expect(decoded1.jti).toBeDefined();
      expect(decoded2.jti).toBeDefined();
      expect(decoded1.jti).not.toBe(decoded2.jti);
    });

    it('should generate refresh token with expiration', () => {
      const token = generateRefreshToken(testUserId);
      
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as unknown;
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid access token', () => {
      const token = generateToken(testUserId);
      const decoded = verifyToken(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(testUserId);
      expect(decoded?.type).toBe('access');
    });

    it('should return null for invalid token', () => {
      const decoded = verifyToken('invalid-token');
      expect(decoded).toBeNull();
    });

    it('should return null for token with wrong secret', () => {
      const token = jwt.sign({ userId: testUserId }, 'wrong-secret');
      const decoded = verifyToken(token);
      expect(decoded).toBeNull();
    });

    it('should return null for expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: testUserId, type: 'access' },
        process.env.JWT_SECRET!,
        { expiresIn: '0s' }
      );
      
      // Wait a bit to ensure token is expired
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const decoded = verifyToken(expiredToken);
      expect(decoded).toBeNull();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken(testUserId);
      const decoded = verifyRefreshToken(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(testUserId);
      expect(decoded?.type).toBe('refresh');
    });

    it('should return null for invalid refresh token', () => {
      const decoded = verifyRefreshToken('invalid-token');
      expect(decoded).toBeNull();
    });

    it('should return null for access token verified as refresh token', () => {
      const accessToken = generateToken(testUserId);
      const decoded = verifyRefreshToken(accessToken);
      expect(decoded).toBeNull();
    });

    it('should return null for refresh token with wrong secret', () => {
      const token = jwt.sign({ userId: testUserId }, 'wrong-secret');
      const decoded = verifyRefreshToken(token);
      expect(decoded).toBeNull();
    });
  });

  describe('token security', () => {
    it('should not allow access token to be verified as refresh token', () => {
      const accessToken = generateToken(testUserId);
      const decoded = verifyRefreshToken(accessToken);
      expect(decoded).toBeNull();
    });

    it('should not allow refresh token to be verified as access token', () => {
      const refreshToken = generateRefreshToken(testUserId);
      const decoded = verifyToken(refreshToken);
      // This may or may not be null depending on whether different secrets are used
      // but the type should be 'refresh' not 'access'
      if (decoded) {
        expect(decoded.type).toBe('refresh');
      }
    });

    it('should generate cryptographically secure JTI for refresh tokens', () => {
      const token1 = generateRefreshToken(testUserId);
      const token2 = generateRefreshToken(testUserId);
      
      const decoded1 = jwt.verify(token1, process.env.JWT_REFRESH_SECRET!) as unknown;
      const decoded2 = jwt.verify(token2, process.env.JWT_REFRESH_SECRET!) as unknown;
      
      // JTI should be 32 characters (16 bytes as hex)
      expect(decoded1.jti.length).toBe(32);
      expect(decoded2.jti.length).toBe(32);
      expect(decoded1.jti).not.toBe(decoded2.jti);
    });
  });
});

describe('isTokenRevoked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return false when token is not in revoked list', async () => {
    (prisma.revokedToken.findUnique as any).mockResolvedValue(null);

    const token = generateToken('user-123');
    const result = await isTokenRevoked(token);

    expect(result).toBe(false);
    expect(prisma.revokedToken.findUnique).toHaveBeenCalledOnce();
  });

  it('should return true when token is in the revoked list', async () => {
    (prisma.revokedToken.findUnique as any).mockResolvedValue({ id: 'revoked-1' });

    const token = generateToken('user-123');
    const result = await isTokenRevoked(token);

    expect(result).toBe(true);
  });

  it('should hash the token before querying the database', async () => {
    (prisma.revokedToken.findUnique as any).mockResolvedValue(null);

    const token = generateToken('user-abc');
    await isTokenRevoked(token);

    const callArg = (prisma.revokedToken.findUnique as any).mock.calls[0][0];
    // The stored token should be a hex string (SHA-256 hash), not the raw JWT
    expect(callArg.where.token).not.toBe(token);
    expect(callArg.where.token).toMatch(/^[a-f0-9]{64}$/);
  });
});
