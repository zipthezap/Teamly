import { Request, Response, NextFunction } from 'express';
import { verifyToken, isTokenRevoked } from '../utils/jwt';
import prisma from '../config/database';
import { logger } from '../utils/logger';

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        city: string | null;
        country: string | null;
      };
      token?: string; // Store token for potential revocation
    }
  }
}

const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    
    // Check if token is revoked
    const revoked = await isTokenRevoked(token);
    if (revoked) {
      res.status(401).json({ error: 'Token has been revoked' });
      return;
    }
    
    const decoded = verifyToken(token);

    if (!decoded) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, city: true, country: true }
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = user;
    req.token = token; // Store for potential logout/revocation
    next();
  } catch (error) {
    logger.error('Authentication failed', 'AuthMiddleware', { error });
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Optional auth middleware - attaches user if token is valid, but doesn't fail if no token
export const optionalAuthMiddleware = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    // If no auth header, just continue without setting user
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    
    // Check if token is revoked
    const revoked = await isTokenRevoked(token);
    if (revoked) {
      // Token is revoked, continue without user
      next();
      return;
    }
    
    const decoded = verifyToken(token);

    // If token is invalid, continue without user
    if (!decoded) {
      next();
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, city: true, country: true }
    });

    // If user is found, attach to request
    if (user) {
      req.user = user;
      req.token = token;
    }
    
    next();
  } catch (error) {
    logger.error('Optional authentication failed', 'OptionalAuthMiddleware', { error });
    // On error, just continue without user
    next();
  }
};

export default authMiddleware;
