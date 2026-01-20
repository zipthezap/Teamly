/**
 * usePermissions Hook
 * Provides utilities for checking user permissions and roles
 */

import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Permission,
  GroupRole,
  TournamentRole,
  TeamUpRole,
  GroupRolePermissions,
  TournamentRolePermissions,
  TeamUpRolePermissions,
} from '../../../shared/types/permissions.types';

interface GroupMember {
  userId: string;
  role: GroupRole | string;
}

interface TournamentParticipant {
  userId: string;
  role: TournamentRole | string;
}

interface TeamUpParticipant {
  userId: string;
  role: TeamUpRole | string;
}

export interface UsePermissionsOptions {
  /** Resource type */
  resourceType?: 'group' | 'tournament' | 'teamup';
  /** Resource creator/organizer ID */
  creatorId?: string;
  /** Current user's role in the resource */
  userRole?: GroupRole | TournamentRole | TeamUpRole | string;
  /** Group members (for group permissions) */
  groupMembers?: GroupMember[];
  /** Tournament participants (for tournament permissions) */
  tournamentParticipants?: TournamentParticipant[];
  /** TeamUp participants (for teamup permissions) */
  teamUpParticipants?: TeamUpParticipant[];
}

export const usePermissions = (options: UsePermissionsOptions = {}) => {
  const { user } = useAuth();
  const {
    resourceType,
    creatorId,
    userRole,
    groupMembers = [],
    tournamentParticipants = [],
    teamUpParticipants = [],
  } = options;

  // Check if current user is the creator/organizer
  const isCreator = useMemo(
    () => !!user && !!creatorId && user.id === creatorId,
    [user, creatorId]
  );

  // Get user's role in the resource
  const currentRole = useMemo(() => {
    if (!user) return null;
    
    if (userRole) return userRole;
    
    // Try to find role from members/participants
    if (resourceType === 'group' && groupMembers.length > 0) {
      const member = groupMembers.find(m => m.userId === user.id);
      return member?.role || null;
    }
    
    if (resourceType === 'tournament' && tournamentParticipants.length > 0) {
      const participant = tournamentParticipants.find(p => p.userId === user.id);
      return participant?.role || null;
    }
    
    if (resourceType === 'teamup' && teamUpParticipants.length > 0) {
      const participant = teamUpParticipants.find(p => p.userId === user.id);
      return participant?.role || null;
    }
    
    return null;
  }, [user, userRole, resourceType, groupMembers, tournamentParticipants, teamUpParticipants]);

  // Get permissions for the current role
  const rolePermissions = useMemo(() => {
    if (!currentRole) return [];
    
    if (resourceType === 'group' && currentRole in GroupRolePermissions) {
      return GroupRolePermissions[currentRole as GroupRole];
    }
    
    if (resourceType === 'tournament' && currentRole in TournamentRolePermissions) {
      return TournamentRolePermissions[currentRole as TournamentRole];
    }
    
    if (resourceType === 'teamup' && currentRole in TeamUpRolePermissions) {
      return TeamUpRolePermissions[currentRole as TeamUpRole];
    }
    
    return [];
  }, [currentRole, resourceType]);

  // Check if user has a specific permission
  const hasPermission = useMemo(
    () => (permission: Permission) => {
      if (!user) return false;
      if (isCreator) return true; // Creators have all permissions
      return rolePermissions.includes(permission);
    },
    [user, isCreator, rolePermissions]
  );

  // Role checks
  const isAdmin = useMemo(
    () => resourceType === 'group' && currentRole === GroupRole.ADMIN,
    [resourceType, currentRole]
  );

  const isModerator = useMemo(
    () => resourceType === 'group' && (currentRole === GroupRole.MODERATOR || currentRole === GroupRole.ADMIN),
    [resourceType, currentRole]
  );

  const isMember = useMemo(
    () => !!currentRole,
    [currentRole]
  );

  const isOrganizer = useMemo(
    () => resourceType === 'tournament' && currentRole === TournamentRole.ORGANIZER,
    [resourceType, currentRole]
  );

  const canEdit = useMemo(
    () => isCreator || isAdmin || isOrganizer,
    [isCreator, isAdmin, isOrganizer]
  );

  const canDelete = useMemo(
    () => isCreator || isAdmin || isOrganizer,
    [isCreator, isAdmin, isOrganizer]
  );

  const canManageMembers = useMemo(
    () => {
      if (resourceType === 'group') {
        return hasPermission(Permission.GROUP_REMOVE_MEMBERS) || 
               hasPermission(Permission.GROUP_INVITE_MEMBERS);
      }
      if (resourceType === 'tournament') {
        return hasPermission(Permission.TOURNAMENT_MANAGE_TEAMS);
      }
      return false;
    },
    [resourceType, hasPermission]
  );

  return {
    // User info
    user,
    isLoggedIn: !!user,
    
    // Role info
    currentRole,
    isCreator,
    isAdmin,
    isModerator,
    isMember,
    isOrganizer,
    
    // Permission checks
    hasPermission,
    canEdit,
    canDelete,
    canManageMembers,
    
    // Raw data
    rolePermissions,
  };
};

export default usePermissions;
