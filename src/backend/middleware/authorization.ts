/**
 * Authorization Middleware
 * Provides reusable authorization checks to reduce code duplication
 * Enhanced with centralized permission service for better scalability
 */

import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, BadRequestError } from '../utils/errors';
import * as groupService from '../services/groupService';
import * as permissionService from '../services/permissionService';
import { Permission, GroupRole } from '../../shared/types/permissions.types';
import { AuthenticatedUser } from '../../shared/types/auth.types';
import { logger } from '../utils/logger';

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
    const userId = req.user?.id;
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
      const userId = req.user?.id;
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
    const userId = req.user?.id;
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

/**
 * Generic permission checker middleware
 * @param permission - The permission to check
 * @param resourceType - Type of resource (group, tournament, teamup, team)
 * @param getResourceId - Function to extract resource ID from request
 */
export const requirePermission = (
  permission: Permission,
  resourceType: 'group' | 'tournament' | 'teamup' | 'team',
  getResourceId: (req: Request) => string
) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const resourceId = getResourceId(req);

      if (!resourceId) {
        throw new BadRequestError(`${resourceType} ID is required`);
      }

      if (!userId) {
        throw new ForbiddenError('User not authenticated');
      }

      const hasPermission = await permissionService.hasPermission({
        userId,
        resourceType,
        resourceId,
        action: permission
      });

      if (!hasPermission) {
        logger.warn('Permission denied', 'AuthorizationMiddleware', {
          userId,
          resourceType,
          resourceId,
          permission
        });
        throw new ForbiddenError(`You don't have permission to perform this action`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check tournament permissions
 * Expects tournamentId in req.params.id
 */
export const requireTournamentPermission = (permission: Permission) => {
  return requirePermission(permission, 'tournament', (req) => req.params.id);
};

/**
 * Middleware to check TeamUp permissions
 * Expects teamUpId in req.params.id
 */
export const requireTeamUpPermission = (permission: Permission) => {
  return requirePermission(permission, 'teamup', (req) => req.params.id);
};

/**
 * Middleware to check team permissions
 * Expects teamId in req.params.teamId
 */
export const requireTeamPermission = (permission: Permission) => {
  return requirePermission(permission, 'team', (req) => req.params.teamId);
};

/**
 * Middleware to check group permissions
 * Expects groupId in req.params.id
 */
export const requireGroupPermission = (permission: Permission) => {
  return requirePermission(permission, 'group', (req) => req.params.id);
};
