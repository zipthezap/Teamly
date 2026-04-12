import { Request, Response, NextFunction } from 'express';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import authMiddleware, { optionalAuthMiddleware } from '../../middleware/auth';
import * as jwt from '../../utils/jwt';
import prisma from '../../config/database';

// Mock dependencies
vi.mock('../../config/database', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../utils/jwt', () => ({
  verifyToken: vi.fn(),
  isTokenRevoked: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('authMiddleware', () => {
    it('should return 401 when no authorization header is provided', async () => {
      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header does not start with Bearer', async () => {
      mockRequest.headers = { authorization: 'InvalidToken' };

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is revoked', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (jwt.isTokenRevoked as any).mockResolvedValue(true);

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jwt.isTokenRevoked).toHaveBeenCalledWith('valid-token');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Token has been revoked' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      (jwt.isTokenRevoked as any).mockResolvedValue(false);
      (jwt.verifyToken as any).mockReturnValue(null);

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jwt.verifyToken).toHaveBeenCalledWith('invalid-token');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not found', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (jwt.isTokenRevoked as any).mockResolvedValue(false);
      (jwt.verifyToken as any).mockReturnValue({ userId: 'user-123' });
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { id: true, email: true, name: true, city: true, country: true }
      });
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'User not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should attach user to request and call next when token is valid', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        city: 'Test City',
        country: 'Test Country'
      };

      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (jwt.isTokenRevoked as any).mockResolvedValue(false);
      (jwt.verifyToken as any).mockReturnValue({ userId: 'user-123' });
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual(mockUser);
      expect(mockRequest.token).toBe('valid-token');
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 when an error occurs', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (jwt.isTokenRevoked as any).mockRejectedValue(new Error('Database error'));

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authentication failed' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization uses wrong case prefix (bearer vs Bearer)', async () => {
      mockRequest.headers = { authorization: 'bearer valid-token' };

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when Bearer token is empty string after prefix', async () => {
      mockRequest.headers = { authorization: 'Bearer ' };
      (jwt.isTokenRevoked as any).mockResolvedValue(false);
      (jwt.verifyToken as any).mockReturnValue(null);

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should set req.token to the extracted token value', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        city: 'Test City',
        country: 'Test Country'
      };

      mockRequest.headers = { authorization: 'Bearer my-token-value' };
      (jwt.isTokenRevoked as any).mockResolvedValue(false);
      (jwt.verifyToken as any).mockReturnValue({ userId: 'user-123' });
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.token).toBe('my-token-value');
    });
  });

  describe('optionalAuthMiddleware', () => {
    it('should call next without setting user when no authorization header is provided', async () => {
      await optionalAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next without setting user when authorization header is invalid', async () => {
      mockRequest.headers = { authorization: 'InvalidToken' };

      await optionalAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next without setting user when token is revoked', async () => {
      mockRequest.headers = { authorization: 'Bearer revoked-token' };
      (jwt.isTokenRevoked as any).mockResolvedValue(true);

      await optionalAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next without setting user when token is invalid', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      (jwt.isTokenRevoked as any).mockResolvedValue(false);
      (jwt.verifyToken as any).mockReturnValue(null);

      await optionalAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next without setting user when user is not found', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (jwt.isTokenRevoked as any).mockResolvedValue(false);
      (jwt.verifyToken as any).mockReturnValue({ userId: 'user-123' });
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await optionalAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should attach user to request and call next when token is valid', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        city: 'Test City',
        country: 'Test Country'
      };

      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (jwt.isTokenRevoked as any).mockResolvedValue(false);
      (jwt.verifyToken as any).mockReturnValue({ userId: 'user-123' });
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      await optionalAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual(mockUser);
      expect(mockRequest.token).toBe('valid-token');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next without setting user when an error occurs', async () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (jwt.isTokenRevoked as any).mockRejectedValue(new Error('Database error'));

      await optionalAuthMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
