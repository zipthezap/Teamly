/**
 * Authorization Middleware
 * Provides reusable authorization checks to reduce code duplication
 */

import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, BadRequestError } from '../utils/errors';
import * as groupService from '../services/groupService';

/**
 * Middleware to check if the authenticated user is an admin of the specified group
 * Expects groupId in either req.params.id or req.body.groupId
 */
export const requireGroupAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)?.id;
    const groupId = req.params.id || req.body.groupId;

    if (!groupId) {
      throw new BadRequestError('Group ID is required');
    }

    if (!userId) {
      throw new ForbiddenError('User not authenticated');
    }

    const isAdmin = await groupService.checkGroupAdmin(groupId, userId);
    
    if (!isAdmin) {
      throw new ForbiddenError('Only group admins can perform this action');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Creates a middleware that checks if user has a specific role in a group
 * @param allowedRoles - Array of roles that are allowed
 */
export const requireGroupRole = (allowedRoles: string[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req.user as any)?.id;
      const groupId = req.params.id || req.body.groupId;

      if (!groupId) {
        throw new BadRequestError('Group ID is required');
      }

      if (!userId) {
        throw new ForbiddenError('User not authenticated');
      }

      const member = await groupService.getGroupMember(groupId, userId);
      
      if (!member || !allowedRoles.includes(member.role)) {
        throw new ForbiddenError(`Only ${allowedRoles.join(' or ')} can perform this action`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if user is a member of the specified group
 */
export const requireGroupMembership = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)?.id;
    const groupId = req.params.id || req.body.groupId;

    if (!groupId) {
      throw new BadRequestError('Group ID is required');
    }

    if (!userId) {
      throw new ForbiddenError('User not authenticated');
    }

    const isMember = await groupService.isGroupMember(groupId, userId);
    
    if (!isMember) {
      throw new ForbiddenError('Only group members can perform this action');
    }

    next();
  } catch (error) {
    next(error);
  }
};
