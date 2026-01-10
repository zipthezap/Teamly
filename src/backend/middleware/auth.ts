import { Request, Response, NextFunction } from 'express';
import { verifyToken, isTokenRevoked } from '../utils/jwt';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { PublicUser } from '../../shared/types';

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
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

export default authMiddleware;
