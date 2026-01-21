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
      (jwt.isTokenRevoked as jest.Mock).mockResolvedValue(true);

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
      (jwt.isTokenRevoked as jest.Mock).mockResolvedValue(false);
      (jwt.verifyToken as jest.Mock).mockReturnValue(null);

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
      (jwt.isTokenRevoked as jest.Mock).mockResolvedValue(false);
      (jwt.verifyToken as jest.Mock).mockReturnValue({ userId: 'user-123' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

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
      (jwt.isTokenRevoked as jest.Mock).mockResolvedValue(false);
      (jwt.verifyToken as jest.Mock).mockReturnValue({ userId: 'user-123' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

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
      (jwt.isTokenRevoked as jest.Mock).mockRejectedValue(new Error('Database error'));

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authentication failed' });
      expect(mockNext).not.toHaveBeenCalled();
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
      (jwt.isTokenRevoked as jest.Mock).mockResolvedValue(true);

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
      (jwt.isTokenRevoked as jest.Mock).mockResolvedValue(false);
      (jwt.verifyToken as jest.Mock).mockReturnValue(null);

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
      (jwt.isTokenRevoked as jest.Mock).mockResolvedValue(false);
      (jwt.verifyToken as jest.Mock).mockReturnValue({ userId: 'user-123' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

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
      (jwt.isTokenRevoked as jest.Mock).mockResolvedValue(false);
      (jwt.verifyToken as jest.Mock).mockReturnValue({ userId: 'user-123' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

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
      (jwt.isTokenRevoked as jest.Mock).mockRejectedValue(new Error('Database error'));

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
