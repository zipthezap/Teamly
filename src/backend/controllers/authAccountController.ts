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
import { revokeAllUserTokens } from '../utils/jwt';
import { logger } from '../utils/logger';

export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  // Revoke all tokens before soft-deleting so the current session is
  // immediately invalidated even before the client clears its local state.
  await revokeAllUserTokens(userId, 'account_deletion');

  // Remove push device tokens so the deleted account no longer receives
  // push notifications.
  await prisma.pushDeviceToken.deleteMany({ where: { userId } });

  // Soft-delete the user record.
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });

  logger.info('User account deleted', 'AuthController', { userId });
  res.json({ message: 'Your account has been deleted.' });
};
