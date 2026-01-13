/**
 * Helper utilities for controllers
 */

import { Request } from 'express';
import { AuthenticatedUser } from '../types/express';

/**
 * Get authenticated user from request
 * This should only be called after authentication middleware has verified the user
 * @throws Error if user is not authenticated (indicates middleware misconfiguration)
 */
export const getAuthenticatedUser = (req: Request): AuthenticatedUser => {
  if (!req.user) {
    throw new Error('Authentication middleware did not populate req.user - this is an internal error');
  }
  return req.user;
};

/**
 * Get authenticated user ID from request
 */
export const getAuthenticatedUserId = (req: Request): string => {
  return getAuthenticatedUser(req).id;
};

/**
 * Get authenticated user name from request
 */
export const getAuthenticatedUserName = (req: Request): string => {
  return getAuthenticatedUser(req).name;
};
