/**
 * Authorization Middleware
 * Provides reusable authorization checks to reduce code duplication
 */

import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, BadRequestError, NotFoundError } from '../utils/errors';
import * as groupService from '../services/groupService';
import * as tournamentService from '../services/tournamentService';
import prisma from '../config/database';

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

/**
 * Middleware to check if user is the tournament organizer
 * Expects tournament id in req.params.id
 */
export const requireTournamentOrganizer = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)?.id;
    const tournamentId = req.params.id;

    if (!tournamentId) {
      throw new BadRequestError('Tournament ID is required');
    }

    if (!userId) {
      throw new ForbiddenError('User not authenticated');
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { organizerId: true }
    });

    if (!tournament) {
      throw new NotFoundError('Tournament not found');
    }

    if (!tournamentService.isOrganizer(tournament, userId)) {
      throw new ForbiddenError('Only the tournament organizer can perform this action');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user is tournament organizer OR group admin (if tournament belongs to a group)
 * Expects tournament id in req.params.id
 */
export const requireTournamentOrganizerOrGroupAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)?.id;
    const tournamentId = req.params.id;

    if (!tournamentId) {
      throw new BadRequestError('Tournament ID is required');
    }

    if (!userId) {
      throw new ForbiddenError('User not authenticated');
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { 
        organizerId: true,
        groupId: true
      }
    });

    if (!tournament) {
      throw new NotFoundError('Tournament not found');
    }

    // Check if user is organizer
    if (tournamentService.isOrganizer(tournament, userId)) {
      return next();
    }

    // Check if tournament belongs to a group and user is group admin
    if (tournament.groupId) {
      const isGroupAdmin = await groupService.checkGroupAdmin(tournament.groupId, userId);
      if (isGroupAdmin) {
        return next();
      }
    }

    throw new ForbiddenError('Only the tournament organizer or group admin can perform this action');
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user can manage a tournament team (organizer or team captain)
 * Expects tournament id in req.params.id and team id in req.params.teamId
 */
export const requireTeamManagementPermission = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)?.id;
    const tournamentId = req.params.id;
    const teamId = req.params.teamId;

    if (!tournamentId || !teamId) {
      throw new BadRequestError('Tournament ID and Team ID are required');
    }

    if (!userId) {
      throw new ForbiddenError('User not authenticated');
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { 
        organizerId: true,
        groupId: true
      }
    });

    if (!tournament) {
      throw new NotFoundError('Tournament not found');
    }

    // Check if user is organizer
    if (tournamentService.isOrganizer(tournament, userId)) {
      return next();
    }

    // Check if tournament belongs to a group and user is group admin
    if (tournament.groupId) {
      const isGroupAdmin = await groupService.checkGroupAdmin(tournament.groupId, userId);
      if (isGroupAdmin) {
        return next();
      }
    }

    // Check if user is team captain
    const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);
    if (isCaptain) {
      return next();
    }

    throw new ForbiddenError('Only the tournament organizer, group admin, or team captain can perform this action');
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user is the TeamUp request creator or group admin (if associated with group)
 * Expects teamup id in req.params.id
 */
export const requireTeamUpCreatorOrGroupAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.user as any)?.id;
    const teamUpId = req.params.id;

    if (!teamUpId) {
      throw new BadRequestError('TeamUp request ID is required');
    }

    if (!userId) {
      throw new ForbiddenError('User not authenticated');
    }

    const teamUpRequest = await prisma.teamUpRequest.findUnique({
      where: { id: teamUpId },
      select: { 
        creatorId: true,
        city: true,
        country: true
      }
    });

    if (!teamUpRequest) {
      throw new NotFoundError('TeamUp request not found');
    }

    // Check if user is creator
    if (teamUpRequest.creatorId === userId) {
      return next();
    }

    // Check if user is admin of any group in the same location
    // This allows group admins to moderate TeamUp requests in their community
    if (teamUpRequest.city && teamUpRequest.country) {
      const userGroups = await prisma.groupMember.findMany({
        where: {
          userId,
          role: 'admin',
          group: {
            city: teamUpRequest.city,
            country: teamUpRequest.country
          }
        },
        select: { groupId: true }
      });

      if (userGroups.length > 0) {
        return next();
      }
    }

    throw new ForbiddenError('Only the creator or community admins can perform this action');
  } catch (error) {
    next(error);
  }
};
