/**
 * Centralized Permission System Types
 * Defines all roles and permissions across the application for better scalability
 */

// Group Roles
export enum GroupRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member'
}

// Tournament Roles
export enum TournamentRole {
  ORGANIZER = 'organizer',
  CO_ORGANIZER = 'co_organizer',
  TEAM_CAPTAIN = 'team_captain',
  PLAYER = 'player',
  REFEREE = 'referee',
  VIEWER = 'viewer'
}

// TeamUp Roles
export enum TeamUpRole {
  CREATOR = 'creator',
  PARTICIPANT = 'participant',
  VIEWER = 'viewer'
}

// Permission Actions
export enum Permission {
  // Group Permissions
  GROUP_CREATE = 'group:create',
  GROUP_UPDATE = 'group:update',
  GROUP_DELETE = 'group:delete',
  GROUP_VIEW = 'group:view',
  GROUP_INVITE_MEMBERS = 'group:invite_members',
  GROUP_REMOVE_MEMBERS = 'group:remove_members',
  GROUP_MANAGE_ROLES = 'group:manage_roles',
  GROUP_MANAGE_EVENTS = 'group:manage_events',
  
  // Event Permissions
  EVENT_CREATE = 'event:create',
  EVENT_UPDATE = 'event:update',
  EVENT_DELETE = 'event:delete',
  EVENT_VIEW = 'event:view',
  EVENT_MANAGE_PARTICIPANTS = 'event:manage_participants',
  
  // Tournament Permissions
  TOURNAMENT_CREATE = 'tournament:create',
  TOURNAMENT_UPDATE = 'tournament:update',
  TOURNAMENT_DELETE = 'tournament:delete',
  TOURNAMENT_VIEW = 'tournament:view',
  TOURNAMENT_MANAGE_TEAMS = 'tournament:manage_teams',
  TOURNAMENT_MANAGE_MATCHES = 'tournament:manage_matches',
  TOURNAMENT_MANAGE_BRACKETS = 'tournament:manage_brackets',
  TOURNAMENT_SUBMIT_SCORES = 'tournament:submit_scores',
  TOURNAMENT_MANAGE_PLAYERS = 'tournament:manage_players',
  TOURNAMENT_ASSIGN_REFEREES = 'tournament:assign_referees',
  TOURNAMENT_MANAGE_POOLS = 'tournament:manage_pools',
  TOURNAMENT_VIEW_ADMIN_PANEL = 'tournament:view_admin_panel',
  
  // Team Permissions (within tournament)
  TEAM_CREATE = 'team:create',
  TEAM_UPDATE = 'team:update',
  TEAM_DELETE = 'team:delete',
  TEAM_VIEW = 'team:view',
  TEAM_MANAGE_PLAYERS = 'team:manage_players',
  TEAM_REGISTER_TO_POOL = 'team:register_to_pool',
  
  // TeamUp Permissions
  TEAMUP_CREATE = 'teamup:create',
  TEAMUP_UPDATE = 'teamup:update',
  TEAMUP_DELETE = 'teamup:delete',
  TEAMUP_VIEW = 'teamup:view',
  TEAMUP_RESPOND = 'teamup:respond',
  TEAMUP_MANAGE_RESPONSES = 'teamup:manage_responses',
  TEAMUP_COMMENT = 'teamup:comment'
}

// Role to Permission Mapping
export const GroupRolePermissions: Record<GroupRole, Permission[]> = {
  [GroupRole.ADMIN]: [
    Permission.GROUP_UPDATE,
    Permission.GROUP_DELETE,
    Permission.GROUP_VIEW,
    Permission.GROUP_INVITE_MEMBERS,
    Permission.GROUP_REMOVE_MEMBERS,
    Permission.GROUP_MANAGE_ROLES,
    Permission.GROUP_MANAGE_EVENTS,
    Permission.EVENT_CREATE,
    Permission.EVENT_UPDATE,
    Permission.EVENT_DELETE,
    Permission.EVENT_VIEW,
    Permission.EVENT_MANAGE_PARTICIPANTS,
    Permission.TOURNAMENT_CREATE,
    Permission.TOURNAMENT_UPDATE,
    Permission.TOURNAMENT_DELETE,
    Permission.TOURNAMENT_VIEW,
    Permission.TOURNAMENT_MANAGE_TEAMS,
    Permission.TOURNAMENT_MANAGE_MATCHES,
    Permission.TOURNAMENT_MANAGE_BRACKETS,
    Permission.TOURNAMENT_SUBMIT_SCORES,
    Permission.TOURNAMENT_MANAGE_PLAYERS,
    Permission.TOURNAMENT_ASSIGN_REFEREES,
    Permission.TOURNAMENT_MANAGE_POOLS,
    Permission.TOURNAMENT_VIEW_ADMIN_PANEL
  ],
  [GroupRole.MODERATOR]: [
    Permission.GROUP_VIEW,
    Permission.GROUP_INVITE_MEMBERS,
    Permission.EVENT_CREATE,
    Permission.EVENT_UPDATE,
    Permission.EVENT_VIEW,
    Permission.EVENT_MANAGE_PARTICIPANTS,
    Permission.TOURNAMENT_CREATE,
    Permission.TOURNAMENT_VIEW,
    Permission.TOURNAMENT_MANAGE_TEAMS,
    Permission.TOURNAMENT_SUBMIT_SCORES
  ],
  [GroupRole.MEMBER]: [
    Permission.GROUP_VIEW,
    Permission.EVENT_CREATE,
    Permission.EVENT_VIEW,
    Permission.TOURNAMENT_VIEW,
    Permission.TOURNAMENT_SUBMIT_SCORES
  ]
};

export const TournamentRolePermissions: Record<TournamentRole, Permission[]> = {
  [TournamentRole.ORGANIZER]: [
    Permission.TOURNAMENT_UPDATE,
    Permission.TOURNAMENT_DELETE,
    Permission.TOURNAMENT_VIEW,
    Permission.TOURNAMENT_MANAGE_TEAMS,
    Permission.TOURNAMENT_MANAGE_MATCHES,
    Permission.TOURNAMENT_MANAGE_BRACKETS,
    Permission.TOURNAMENT_SUBMIT_SCORES,
    Permission.TOURNAMENT_MANAGE_PLAYERS,
    Permission.TOURNAMENT_ASSIGN_REFEREES,
    Permission.TOURNAMENT_MANAGE_POOLS,
    Permission.TOURNAMENT_VIEW_ADMIN_PANEL,
    Permission.TEAM_CREATE,
    Permission.TEAM_UPDATE,
    Permission.TEAM_DELETE,
    Permission.TEAM_VIEW,
    Permission.TEAM_MANAGE_PLAYERS
  ],
  [TournamentRole.CO_ORGANIZER]: [
    Permission.TOURNAMENT_VIEW,
    Permission.TOURNAMENT_MANAGE_TEAMS,
    Permission.TOURNAMENT_MANAGE_MATCHES,
    Permission.TOURNAMENT_SUBMIT_SCORES,
    Permission.TOURNAMENT_ASSIGN_REFEREES,
    Permission.TOURNAMENT_VIEW_ADMIN_PANEL,
    Permission.TEAM_CREATE,
    Permission.TEAM_UPDATE,
    Permission.TEAM_VIEW,
    Permission.TEAM_MANAGE_PLAYERS
  ],
  [TournamentRole.TEAM_CAPTAIN]: [
    Permission.TOURNAMENT_VIEW,
    Permission.TOURNAMENT_SUBMIT_SCORES,
    Permission.TEAM_UPDATE,
    Permission.TEAM_VIEW,
    Permission.TEAM_MANAGE_PLAYERS,
    Permission.TEAM_REGISTER_TO_POOL
  ],
  [TournamentRole.PLAYER]: [
    Permission.TOURNAMENT_VIEW,
    Permission.TOURNAMENT_SUBMIT_SCORES,
    Permission.TEAM_VIEW
  ],
  [TournamentRole.REFEREE]: [
    Permission.TOURNAMENT_VIEW,
    Permission.TOURNAMENT_SUBMIT_SCORES
  ],
  [TournamentRole.VIEWER]: [
    Permission.TOURNAMENT_VIEW
  ]
};

export const TeamUpRolePermissions: Record<TeamUpRole, Permission[]> = {
  [TeamUpRole.CREATOR]: [
    Permission.TEAMUP_UPDATE,
    Permission.TEAMUP_DELETE,
    Permission.TEAMUP_VIEW,
    Permission.TEAMUP_MANAGE_RESPONSES,
    Permission.TEAMUP_COMMENT
  ],
  [TeamUpRole.PARTICIPANT]: [
    Permission.TEAMUP_VIEW,
    Permission.TEAMUP_COMMENT
  ],
  [TeamUpRole.VIEWER]: [
    Permission.TEAMUP_VIEW
  ]
};

// Helper type for checking permissions
export interface PermissionContext {
  userId: string;
  resourceType: 'group' | 'tournament' | 'teamup' | 'team';
  resourceId: string;
  action: Permission;
}

// Helper type for role assignment
export interface RoleAssignment {
  userId: string;
  role: GroupRole | TournamentRole | TeamUpRole;
  resourceType: 'group' | 'tournament' | 'teamup';
  resourceId: string;
  grantedBy: string;
  grantedAt: Date;
}
