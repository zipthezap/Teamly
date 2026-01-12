/**
 * Centralized Permission Service
 * Handles all permission checks across the application for consistency and scalability
 */

import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CacheService } from './cacheService';
import {
  Permission,
  GroupRole,
  TournamentRole,
  TeamUpRole,
  GroupRolePermissions,
  TournamentRolePermissions,
  TeamUpRolePermissions,
  PermissionContext
} from '../../shared/types/permissions.types';

/**
 * Cache TTL for permission checks (1 minute)
 */
const PERMISSION_CACHE_TTL = 60;

/**
 * Generate cache key for permission check
 */
function getCacheKey(userId: string, permission: Permission, resourceType: string, resourceId: string): string {
  return `permission:${userId}:${permission}:${resourceType}:${resourceId}`;
}

/**
 * Check if user has permission for a group action
 */
export async function hasGroupPermission(
  userId: string,
  groupId: string,
  permission: Permission
): Promise<boolean> {
  const cacheKey = getCacheKey(userId, permission, 'group', groupId);
  
  // Use distributed cache service with wrap
  return await CacheService.wrap(cacheKey, PERMISSION_CACHE_TTL, async () => {
    try {
      // Get user's role in the group
      const membership = await prisma.groupMember.findUnique({
        where: {
          userId_groupId: {
            userId,
            groupId
          }
        },
        select: { role: true }
      });

      if (!membership) {
        return false;
      }

      // Check if role has permission
      const rolePermissions = GroupRolePermissions[membership.role as GroupRole] || [];
      return rolePermissions.includes(permission);
    } catch (error) {
      logger.error('Error checking group permission', 'PermissionService', { error, userId, groupId, permission });
      return false;
    }
  });
}

/**
 * Internal helper to check group admin permission without caching (avoids recursion issues)
 */
async function checkGroupAdminDirect(userId: string, groupId: string): Promise<boolean> {
  try {
    const membership = await prisma.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId
        }
      },
      select: { role: true }
    });

    if (!membership) return false;

    // Check if role has manage_events permission (admin or moderator)
    const rolePermissions = GroupRolePermissions[membership.role as GroupRole] || [];
    return rolePermissions.includes(Permission.GROUP_MANAGE_EVENTS);
  } catch (error) {
    logger.error('Error checking group admin direct', 'PermissionService', { error, userId, groupId });
    return false;
  }
}

/**
 * Check if user has permission for a tournament action
 */
export async function hasTournamentPermission(
  userId: string,
  tournamentId: string,
  permission: Permission
): Promise<boolean> {
  const cacheKey = getCacheKey(userId, permission, 'tournament', tournamentId);
  
  // Use distributed cache service with wrap
  return await CacheService.wrap(cacheKey, PERMISSION_CACHE_TTL, async () => {
    try {
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { 
          organizerId: true,
          groupId: true
        }
      });

      if (!tournament) {
        return false;
      }

      // Organizer has all permissions
      if (tournament.organizerId === userId) {
        const rolePermissions = TournamentRolePermissions[TournamentRole.ORGANIZER];
        return rolePermissions.includes(permission);
      }

      // If tournament is associated with a group, check group admin permissions
      // Note: We use checkGroupAdminDirect here to prevent cache key conflicts, 
      // as hasGroupPermission might be called from within this cache wrapper
      if (tournament.groupId) {
        const isGroupAdmin = await checkGroupAdminDirect(userId, tournament.groupId);
        if (isGroupAdmin) {
          const rolePermissions = TournamentRolePermissions[TournamentRole.CO_ORGANIZER];
          return rolePermissions.includes(permission);
        }
      }

      // Check if user is a team captain
      const captainTeam = await prisma.tournamentTeam.findFirst({
        where: {
          tournamentId,
          captainUserId: userId
        }
      });

      if (captainTeam) {
        const rolePermissions = TournamentRolePermissions[TournamentRole.TEAM_CAPTAIN];
        return rolePermissions.includes(permission);
      }

      // Check if user is a registered player
      const playerRecord = await prisma.tournamentPlayer.findFirst({
        where: {
          userId,
          team: {
            tournamentId
          }
        }
      });

      if (playerRecord) {
        const rolePermissions = TournamentRolePermissions[TournamentRole.PLAYER];
        return rolePermissions.includes(permission);
      }

      // Check if user is a referee (team assigned as referee)
      const refereeMatch = await prisma.tournamentMatch.findFirst({
        where: {
          tournamentId,
          refereeTeam: {
            OR: [
              { captainUserId: userId },
              { players: { some: { userId } } }
            ]
          }
        }
      });

      if (refereeMatch) {
        const rolePermissions = TournamentRolePermissions[TournamentRole.REFEREE];
        return rolePermissions.includes(permission);
      }

      // Default: viewer role (can only view public info)
      const rolePermissions = TournamentRolePermissions[TournamentRole.VIEWER];
      return rolePermissions.includes(permission);
    } catch (error) {
      logger.error('Error checking tournament permission', 'PermissionService', { error, userId, tournamentId, permission });
      return false;
    }
  });
}

/**
 * Check if user has permission for a TeamUp action
 */
export async function hasTeamUpPermission(
  userId: string,
  teamUpId: string,
  permission: Permission
): Promise<boolean> {
  const cacheKey = getCacheKey(userId, permission, 'teamup', teamUpId);
  
  // Use distributed cache service with wrap
  return await CacheService.wrap(cacheKey, PERMISSION_CACHE_TTL, async () => {
    try {
      const teamUpRequest = await prisma.teamUpRequest.findUnique({
        where: { id: teamUpId },
        select: { 
          creatorId: true
        }
      });

      if (!teamUpRequest) {
        return false;
      }

      // Creator has all creator permissions
      if (teamUpRequest.creatorId === userId) {
        const rolePermissions = TeamUpRolePermissions[TeamUpRole.CREATOR];
        return rolePermissions.includes(permission);
      }

      // Check if user is a participant (has responded)
      const response = await prisma.teamUpResponse.findFirst({
        where: {
          teamUpRequestId: teamUpId,
          userId
        }
      });

      if (response) {
        const rolePermissions = TeamUpRolePermissions[TeamUpRole.PARTICIPANT];
        return rolePermissions.includes(permission);
      }

      // Default: viewer role
      const rolePermissions = TeamUpRolePermissions[TeamUpRole.VIEWER];
      return rolePermissions.includes(permission);
    } catch (error) {
      logger.error('Error checking TeamUp permission', 'PermissionService', { error, userId, teamUpId, permission });
      return false;
    }
  });
}

/**
 * Check if user has permission for a team action (within tournament)
 */
export async function hasTeamPermission(
  userId: string,
  teamId: string,
  permission: Permission
): Promise<boolean> {
  try {
    const team = await prisma.tournamentTeam.findUnique({
      where: { id: teamId },
      select: { 
        captainUserId: true,
        tournamentId: true,
        tournament: {
          select: { organizerId: true }
        }
      }
    });

    if (!team) {
      return false;
    }

    // Tournament organizer has all team permissions
    if (team.tournament.organizerId === userId) {
      const rolePermissions = TournamentRolePermissions[TournamentRole.ORGANIZER];
      return rolePermissions.includes(permission);
    }

    // Team captain has captain permissions
    if (team.captainUserId === userId) {
      const rolePermissions = TournamentRolePermissions[TournamentRole.TEAM_CAPTAIN];
      return rolePermissions.includes(permission);
    }

    // Registered player has player permissions
    const playerRecord = await prisma.tournamentPlayer.findFirst({
      where: {
        teamId,
        userId
      }
    });

    if (playerRecord) {
      const rolePermissions = TournamentRolePermissions[TournamentRole.PLAYER];
      return rolePermissions.includes(permission);
    }

    return false;
  } catch (error) {
    logger.error('Error checking team permission', 'PermissionService', { error, userId, teamId, permission });
    return false;
  }
}

/**
 * Generic permission checker that routes to the appropriate handler
 */
export async function hasPermission(context: PermissionContext): Promise<boolean> {
  const { userId, resourceType, resourceId, action } = context;

  switch (resourceType) {
    case 'group':
      return hasGroupPermission(userId, resourceId, action);
    case 'tournament':
      return hasTournamentPermission(userId, resourceId, action);
    case 'teamup':
      return hasTeamUpPermission(userId, resourceId, action);
    case 'team':
      return hasTeamPermission(userId, resourceId, action);
    default:
      logger.warn('Unknown resource type in permission check', 'PermissionService', { resourceType });
      return false;
  }
}

/**
 * Batch permission check for multiple resources (for scalability)
 * Uses concurrency limiting to avoid overwhelming the database
 * Processes in batches of 10 for optimal performance without overloading connection pool
 */
export async function hasBulkPermissions(
  contexts: PermissionContext[]
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  const CONCURRENCY_LIMIT = 10; // Process max 10 checks in parallel per batch
  
  // Process in sequential batches to avoid overwhelming the database connection pool
  for (let i = 0; i < contexts.length; i += CONCURRENCY_LIMIT) {
    const batch = contexts.slice(i, i + CONCURRENCY_LIMIT);
    
    // Process items within each batch in parallel
    await Promise.all(
      batch.map(async (context) => {
        const key = `${context.resourceType}:${context.resourceId}:${context.action}`;
        const result = await hasPermission(context);
        results.set(key, result);
      })
    );
  }
  
  return results;
}

/**
 * Clear permission cache for a user (call after role changes)
 */
export async function clearUserPermissionCache(userId: string): Promise<void> {
  try {
    await CacheService.deletePattern(`permission:${userId}:*`);
    logger.info('Cleared permission cache for user', 'PermissionService', { userId });
  } catch (error) {
    logger.error('Error clearing user permission cache', 'PermissionService', { userId, error });
  }
}

/**
 * Clear all permission cache
 */
export async function clearAllPermissionCache(): Promise<void> {
  try {
    await CacheService.deletePattern('permission:*');
    logger.info('Cleared all permission cache', 'PermissionService');
  } catch (error) {
    logger.error('Error clearing all permission cache', 'PermissionService', { error });
  }
}

/**
 * Get user's role in a group
 */
export async function getUserGroupRole(userId: string, groupId: string): Promise<GroupRole | null> {
  try {
    const membership = await prisma.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId
        }
      },
      select: { role: true }
    });

    return membership ? (membership.role as GroupRole) : null;
  } catch (error) {
    logger.error('Error getting user group role', 'PermissionService', { error, userId, groupId });
    return null;
  }
}

/**
 * Get user's role in a tournament
 */
export async function getUserTournamentRole(userId: string, tournamentId: string): Promise<TournamentRole | null> {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { organizerId: true, groupId: true }
    });

    if (!tournament) return null;

    if (tournament.organizerId === userId) {
      return TournamentRole.ORGANIZER;
    }

    // Check if group admin (acts as co-organizer) - use direct check to avoid recursion
    if (tournament.groupId) {
      const isGroupAdmin = await checkGroupAdminDirect(userId, tournament.groupId);
      if (isGroupAdmin) {
        return TournamentRole.CO_ORGANIZER;
      }
    }

    // Check if team captain
    const captainTeam = await prisma.tournamentTeam.findFirst({
      where: {
        tournamentId,
        captainUserId: userId
      }
    });

    if (captainTeam) {
      return TournamentRole.TEAM_CAPTAIN;
    }

    // Check if player
    const playerRecord = await prisma.tournamentPlayer.findFirst({
      where: {
        userId,
        team: {
          tournamentId
        }
      }
    });

    if (playerRecord) {
      return TournamentRole.PLAYER;
    }

    // Check if referee
    const refereeMatch = await prisma.tournamentMatch.findFirst({
      where: {
        tournamentId,
        refereeTeam: {
          OR: [
            { captainUserId: userId },
            { players: { some: { userId } } }
          ]
        }
      }
    });

    if (refereeMatch) {
      return TournamentRole.REFEREE;
    }

    return TournamentRole.VIEWER;
  } catch (error) {
    logger.error('Error getting user tournament role', 'PermissionService', { error, userId, tournamentId });
    return null;
  }
}

/**
 * Get user's role in a TeamUp request
 */
export async function getUserTeamUpRole(userId: string, teamUpId: string): Promise<TeamUpRole | null> {
  try {
    const teamUpRequest = await prisma.teamUpRequest.findUnique({
      where: { id: teamUpId },
      select: { creatorId: true }
    });

    if (!teamUpRequest) return null;

    if (teamUpRequest.creatorId === userId) {
      return TeamUpRole.CREATOR;
    }

    const response = await prisma.teamUpResponse.findFirst({
      where: {
        teamUpRequestId: teamUpId,
        userId
      }
    });

    if (response) {
      return TeamUpRole.PARTICIPANT;
    }

    return TeamUpRole.VIEWER;
  } catch (error) {
    logger.error('Error getting user TeamUp role', 'PermissionService', { error, userId, teamUpId });
    return null;
  }
}
