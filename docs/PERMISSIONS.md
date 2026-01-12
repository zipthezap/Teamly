# Permissions and Roles System

## Overview

Teamly uses a comprehensive Role-Based Access Control (RBAC) system to manage permissions across Groups, Tournaments, and TeamUp requests. This document describes the roles, permissions, and how to use the permission system.

## Architecture

The permission system consists of:
- **Centralized Permission Types**: Defined in `src/shared/types/permissions.types.ts`
- **Permission Service**: Centralized permission checking in `src/backend/services/permissionService.ts`
- **Authorization Middleware**: Reusable middleware in `src/backend/middleware/authorization.ts`
- **In-Memory Caching**: Permission results are cached for 60 seconds to improve performance

## Group Roles

### Admin
Full control over the group:
- Update and delete group
- Invite and remove members
- Manage member roles
- Create, update, and delete events
- Create and manage tournaments
- All moderator and member permissions

### Moderator (New)
Limited administrative capabilities:
- View group details
- Invite new members
- Create events
- Update events
- Manage event participants
- Create tournaments
- Manage tournament teams
- Submit tournament scores

### Member
Basic group participation:
- View group details
- Create events
- View events
- View tournaments
- Submit tournament scores (if participant)

## Tournament Roles

Roles are determined by user's relationship to the tournament:

### Organizer
The tournament creator with full control:
- All tournament management permissions
- Update and delete tournament
- Manage teams, players, and matches
- Generate and modify brackets
- Assign referees
- Manage pools
- Submit scores

### Co-Organizer
Group admins automatically get co-organizer permissions:
- View tournament
- Manage teams and players
- Manage matches
- Submit scores
- Assign referees
- Create and update teams

### Team Captain
User assigned as team captain:
- View tournament
- Submit scores for their team's matches
- Update team details
- Manage team players (add/remove)
- Register team to pools

### Player
Registered player on a team:
- View tournament
- Submit scores for their team's matches
- View team details

### Referee
Member of a team assigned as referee for matches:
- View tournament
- Submit scores for matches they are refereeing

### Viewer
Default role for authenticated users:
- View public tournament information

## TeamUp Roles

### Creator
User who created the TeamUp request:
- Update TeamUp details
- Delete TeamUp request
- Manage responses (accept/decline)
- Comment on TeamUp request

### Participant
User who has responded to the request:
- View TeamUp request
- Comment on TeamUp request

### Viewer
Default role for authenticated users:
- View TeamUp request

## Using the Permission System

### In Controllers

```typescript
import { Permission } from '../../shared/types/permissions.types';
import * as permissionService from '../services/permissionService';

// Check single permission
const canUpdate = await permissionService.hasTournamentPermission(
  userId,
  tournamentId,
  Permission.TOURNAMENT_UPDATE
);

if (!canUpdate) {
  return res.status(403).json({ error: 'Permission denied' });
}
```

### In Routes

```typescript
import { requireTournamentPermission } from '../middleware/authorization';
import { Permission } from '../../shared/types/permissions.types';

// Protect route with permission check
router.put(
  '/:id',
  authMiddleware,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.updateTournament)
);
```

### Available Middleware Functions

1. **requirePermission(permission, resourceType, getResourceId)**
   - Generic permission checker

2. **requireTournamentPermission(permission)**
   - Check tournament permissions (expects tournamentId in req.params.id)

3. **requireTeamUpPermission(permission)**
   - Check TeamUp permissions (expects teamUpId in req.params.id)

4. **requireTeamPermission(permission)**
   - Check team permissions (expects teamId in req.params.teamId)

5. **requireGroupPermission(permission)**
   - Check group permissions (expects groupId in req.params.id)

6. **requireGroupAdmin**
   - Legacy: Check if user is group admin

7. **requireGroupRole(allowedRoles)**
   - Legacy: Check if user has specific group role

8. **requireGroupMembership**
   - Legacy: Check if user is group member

## Performance and Scalability

### Caching
- Permission checks are cached in memory for 60 seconds
- Cache is automatically cleaned when entries expire
- Cache can be manually cleared after role changes:
  ```typescript
  import * as permissionService from '../services/permissionService';
  
  // Clear cache for specific user
  permissionService.clearUserPermissionCache(userId);
  
  // Clear entire cache
  permissionService.clearAllPermissionCache();
  ```

### Database Indexes
Composite indexes have been added for efficient permission queries:
- `GroupMember`: `[groupId, role]`
- `TournamentTeam`: `[tournamentId, captainUserId]`
- `TournamentPlayer`: `[userId, teamId]`
- `TeamUpResponse`: `[userId, teamUpRequestId]`

### Bulk Permission Checks
For checking multiple permissions at once:
```typescript
const contexts = [
  { userId, resourceType: 'tournament', resourceId: id1, action: Permission.TOURNAMENT_VIEW },
  { userId, resourceType: 'tournament', resourceId: id2, action: Permission.TOURNAMENT_VIEW }
];

const results = await permissionService.hasBulkPermissions(contexts);
```

**Note**: Bulk checks process in batches of 10 to avoid overwhelming the database connection pool. Within each batch, checks run in parallel.

### Future Scalability: Redis Integration
For large-scale deployments, the in-memory cache can be replaced with Redis:
1. Install Redis client: `npm install redis`
2. Replace `permissionCache` Map with Redis client
3. Use Redis TTL for automatic expiration
4. Enable distributed caching across multiple servers

## Permission List

### Group Permissions
- `GROUP_CREATE` - Create new groups
- `GROUP_UPDATE` - Update group details
- `GROUP_DELETE` - Delete groups
- `GROUP_VIEW` - View group details
- `GROUP_INVITE_MEMBERS` - Invite new members
- `GROUP_REMOVE_MEMBERS` - Remove members
- `GROUP_MANAGE_ROLES` - Change member roles
- `GROUP_MANAGE_EVENTS` - Manage group events

### Event Permissions
- `EVENT_CREATE` - Create events
- `EVENT_UPDATE` - Update events
- `EVENT_DELETE` - Delete events
- `EVENT_VIEW` - View events
- `EVENT_MANAGE_PARTICIPANTS` - Manage event participants

### Tournament Permissions
- `TOURNAMENT_CREATE` - Create tournaments
- `TOURNAMENT_UPDATE` - Update tournament details
- `TOURNAMENT_DELETE` - Delete tournaments
- `TOURNAMENT_VIEW` - View tournament information
- `TOURNAMENT_MANAGE_TEAMS` - Add/remove/update teams
- `TOURNAMENT_MANAGE_MATCHES` - Create/update/delete matches
- `TOURNAMENT_MANAGE_BRACKETS` - Generate and manage brackets
- `TOURNAMENT_SUBMIT_SCORES` - Submit match scores
- `TOURNAMENT_MANAGE_PLAYERS` - Add/remove players from teams
- `TOURNAMENT_ASSIGN_REFEREES` - Assign referee teams to matches
- `TOURNAMENT_MANAGE_POOLS` - Create and manage tournament pools
- `TOURNAMENT_VIEW_ADMIN_PANEL` - Access admin-only tournament views

### Team Permissions
- `TEAM_CREATE` - Create tournament teams
- `TEAM_UPDATE` - Update team details
- `TEAM_DELETE` - Delete teams
- `TEAM_VIEW` - View team information
- `TEAM_MANAGE_PLAYERS` - Manage team roster
- `TEAM_REGISTER_TO_POOL` - Register team to tournament pools

### TeamUp Permissions
- `TEAMUP_CREATE` - Create TeamUp requests
- `TEAMUP_UPDATE` - Update TeamUp details
- `TEAMUP_DELETE` - Delete TeamUp requests
- `TEAMUP_VIEW` - View TeamUp requests
- `TEAMUP_RESPOND` - Respond to TeamUp requests
- `TEAMUP_MANAGE_RESPONSES` - Accept/decline responses
- `TEAMUP_COMMENT` - Comment on TeamUp requests

## Migration Guide

### For Existing Code

1. **Controllers**: Replace inline permission checks with permission service calls
   ```typescript
   // Before
   if (tournament.organizerId !== userId) {
     return res.status(403).json({ error: 'Only organizer can update' });
   }
   
   // After
   const canUpdate = await permissionService.hasTournamentPermission(
     userId,
     tournamentId,
     Permission.TOURNAMENT_UPDATE
   );
   if (!canUpdate) {
     return res.status(403).json({ error: 'Permission denied' });
   }
   ```

2. **Routes**: Add permission middleware
   ```typescript
   // Before
   router.put('/:id', authMiddleware, tournamentController.updateTournament);
   
   // After
   router.put(
     '/:id',
     authMiddleware,
     requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
     tournamentController.updateTournament
   );
   ```

3. **Database**: Run migration to add moderator role and new indexes
   ```bash
   npm run prisma:migrate
   ```

## Best Practices

1. **Always use middleware for routes**: Don't rely only on controller-level checks
2. **Clear cache after role changes**: Call `clearUserPermissionCache` when updating roles
3. **Use bulk checks for lists**: When checking permissions for multiple items, use `hasBulkPermissions`
4. **Log permission denials**: The system automatically logs permission denials with context
5. **Don't expose internal errors**: Return generic "Permission denied" messages to users

## Security Considerations

1. **All checks are server-side**: Never rely on client-side permission checks
2. **Permissions are additive**: Higher roles include lower role permissions
3. **Cache is secure**: Cache keys include userId to prevent cross-user cache poisoning
4. **Audit trail**: Permission checks are logged for security monitoring
5. **Rate limiting**: Consider adding rate limits per role type for sensitive operations

## Examples

### Example 1: Protecting Tournament Update Route
```typescript
router.put(
  '/:id',
  authMiddleware,
  requireTournamentPermission(Permission.TOURNAMENT_UPDATE),
  asyncHandler(tournamentController.updateTournament)
);
```

### Example 2: Checking Multiple Permissions
```typescript
const canManageTeams = await permissionService.hasTournamentPermission(
  userId,
  tournamentId,
  Permission.TOURNAMENT_MANAGE_TEAMS
);

const canManagePlayers = await permissionService.hasTournamentPermission(
  userId,
  tournamentId,
  Permission.TOURNAMENT_MANAGE_PLAYERS
);
```

### Example 3: Getting User's Role
```typescript
const role = await permissionService.getUserTournamentRole(userId, tournamentId);
// Returns: TournamentRole.ORGANIZER | TournamentRole.TEAM_CAPTAIN | etc.
```

### Example 4: Using Generic Permission Checker
```typescript
const hasPermission = await permissionService.hasPermission({
  userId: 'user-123',
  resourceType: 'tournament',
  resourceId: 'tournament-456',
  action: Permission.TOURNAMENT_VIEW
});
```
