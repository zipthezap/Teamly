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
import { UnauthorizedError } from '../utils/errors';

export const getSessions = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  const sessions = await prisma.userSession.findMany({
    where: { 
      userId: req.user!.id,
      expiresAt: { gt: new Date() }
    },
    select: {
      id: true,
      deviceInfo: true,
      ipAddress: true,
      lastActive: true,
      createdAt: true,
      expiresAt: true
    },
    orderBy: { lastActive: 'desc' }
  });

  res.json({ sessions });
};

/**
 * Upload or update profile picture
 */

// Upload or update profile picture with history, soft delete, and audit fields
