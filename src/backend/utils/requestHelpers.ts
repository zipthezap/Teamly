/**
 * Helper utilities for controllers
 */

import { Request } from 'express';
import { AuthenticatedUser } from '../types/express';

/**
 * Get authenticated user from request
 * Throws error if user is not authenticated
 */
export const getAuthenticatedUser = (req: Request): AuthenticatedUser => {
  if (!req.user) {
    throw new Error('User not authenticated');
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
