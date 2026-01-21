# Enhanced Roles and Permissions

This document describes the enhanced roles and permissions system for groups, events, and invitations in Teamly.

## Overview

The enhanced system provides:
- **Fine-grained permissions** for moderators and admins
- **Invite management** with expiration, revocation, and analytics
- **Time-limited invite tokens** for better security
- **Comprehensive invite auditing** with detailed logs
- **Event-level permissions** for invite management

## Table of Contents

1. [Role Permissions](#role-permissions)
2. [Group Permissions](#group-permissions)
3. [Event Permissions](#event-permissions)
4. [Invite Management](#invite-management)
5. [API Endpoints](#api-endpoints)
6. [Migration Guide](#migration-guide)

---

## Role Permissions

### Group Roles

| Role | Permissions |
|------|-------------|
| **Admin** | All permissions including group deletion, role management, event management |
| **Moderator** | Invite members, remove members, manage roles, create/update events, invite to events, revoke invites |
| **Member** | View group, create events, view events |

### Permission Matrix

| Permission | Admin | Moderator | Member |
|------------|-------|-----------|--------|
| GROUP_UPDATE | ✅ | ❌ | ❌ |
| GROUP_DELETE | ✅ | ❌ | ❌ |
| GROUP_VIEW | ✅ | ✅ | ✅ |
| GROUP_INVITE_MEMBERS | ✅ | ✅ | ❌* |
| GROUP_REMOVE_MEMBERS | ✅ | ✅ | ❌ |
| GROUP_MANAGE_ROLES | ✅ | ✅ | ❌ |
| GROUP_MANAGE_EVENTS | ✅ | ❌ | ❌ |
| GROUP_REVOKE_INVITES | ✅ | ✅ | ❌ |
| GROUP_VIEW_INVITE_ANALYTICS | ✅ | ❌ | ❌ |
| EVENT_CREATE | ✅ | ✅ | ✅ |
| EVENT_UPDATE | ✅ | ✅ | ❌** |
| EVENT_DELETE | ✅ | ❌ | ❌ |
| EVENT_VIEW | ✅ | ✅ | ✅ |
| EVENT_MANAGE_PARTICIPANTS | ✅ | ✅ | ❌** |
| EVENT_INVITE_MEMBERS | ✅ | ✅ | ❌** |
| EVENT_REVOKE_INVITES | ✅ | ✅ | ❌** |
| EVENT_VIEW_INVITE_ANALYTICS | ✅ | ❌ | ❌ |

\* Members can invite if `group.allowMemberInvites = true`  
\** Event creator always has these permissions for their own events

---

## Group Permissions

### Enhanced Moderator Capabilities

Moderators now have the following additional permissions:

1. **Remove Members** - Can remove members from the group (except admins)
2. **Manage Roles** - Can promote members to moderator or demote moderators to member
3. **Revoke Invites** - Can revoke pending invitations

### Permission Examples

```typescript
// Check if user can invite members
const canInvite = await permissionService.hasGroupPermission(
  userId, 
  groupId, 
  Permission.GROUP_INVITE_MEMBERS
);

// Check if user can remove members
const canRemove = await permissionService.hasGroupPermission(
  userId, 
  groupId, 
  Permission.GROUP_REMOVE_MEMBERS
);

// Check if user can manage roles
const canManageRoles = await permissionService.hasGroupPermission(
  userId, 
  groupId, 
  Permission.GROUP_MANAGE_ROLES
);
```

---

## Event Permissions

### Event-Level Invite Management

Events now support the same invite management capabilities as groups:

1. **Invite Members** - Send invitations to users
2. **Revoke Invites** - Cancel pending invitations
3. **View Analytics** - Track invitation statistics

### Permission Hierarchy

1. **Event Creator** - Has all permissions for their event
2. **Group Admin** - Has all permissions for group events
3. **Group Moderator** - Can invite members and revoke invites for group events

---

## Invite Management

### Features

#### 1. Invite Expiration

Invitations can now have expiration dates:

```typescript
// Create invite with 7-day expiration
await InviteService.inviteUserToGroup(
  groupId, 
  userId, 
  inviterId,
  { expiresInDays: 7 }
);
```

#### 2. Custom Messages

Add personalized messages to invitations:

```typescript
await InviteService.inviteUserToGroup(
  groupId, 
  userId, 
  inviterId,
  { 
    customMessage: "Join us for weekly football matches!",
    expiresInDays: 14
  }
);
```

#### 3. Time-Limited Invite Tokens

Generate invite links that expire automatically:

```typescript
// Generate token that expires in 30 days
const result = await InviteService.generateInviteToken(
  'group', 
  groupId, 
  30
);

// Validate token before use
const validation = await InviteService.validateInviteToken(
  'group', 
  token
);

if (!validation.valid) {
  console.log(validation.error); // "Token expired" or "Invalid token"
}
```

#### 4. Invite Revocation

Revoke pending invitations:

```typescript
const result = await InviteService.revokeInvitation(
  'group', 
  groupId, 
  'user@example.com', 
  revokerId
);
```

#### 5. Invite Analytics

Track invitation statistics:

```typescript
const analytics = await InviteService.getInviteAnalytics('group', groupId);

console.log(analytics);
// {
//   total: 10,
//   sent: 3,
//   accepted: 5,
//   declined: 1,
//   expired: 1,
//   revoked: 0,
//   pending: 3
// }
```

#### 6. Invite Logging

All invitation activity is logged in the `InviteLog` table:

- Who sent the invite
- Who received the invite
- When it was sent
- Current status (sent, accepted, declined, expired, revoked)
- Who revoked it (if applicable)
- Custom message (if provided)
- Expiration date (if set)

---

## API Endpoints

### Group Invite Endpoints

#### Invite a Member

```http
POST /api/groups/:id/invite
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "user@example.com",
  "customMessage": "Join our group!",
  "expiresInDays": 7
}
```

**Response:**
```json
{
  "message": "Invitation sent successfully"
}
```

#### Revoke an Invitation

```http
POST /api/groups/:id/invitations/revoke
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "Invitation revoked successfully"
}
```

**Permissions Required:** `GROUP_REVOKE_INVITES` (Admin or Moderator)

#### Get Invite Analytics

```http
GET /api/groups/:id/invitations/analytics
Authorization: Bearer <token>
```

**Response:**
```json
{
  "analytics": {
    "total": 10,
    "sent": 3,
    "accepted": 5,
    "declined": 1,
    "expired": 1,
    "revoked": 0,
    "pending": 3
  }
}
```

**Permissions Required:** `GROUP_VIEW_INVITE_ANALYTICS` (Admin only)

#### Generate Invite Token

```http
POST /api/groups/:id/invitations/generate-token
Authorization: Bearer <token>
Content-Type: application/json

{
  "expiresInDays": 30
}
```

**Response:**
```json
{
  "message": "Invite token generated successfully",
  "token": "abc123def456",
  "expiresAt": "2026-02-20T23:00:00.000Z"
}
```

**Permissions Required:** `GROUP_INVITE_MEMBERS` (Admin or Moderator)

### Event Invite Endpoints

#### Invite to Event

```http
POST /api/events/:id/invite
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "user@example.com",
  "customMessage": "Join our football match!",
  "expiresInDays": 3
}
```

**Response:**
```json
{
  "message": "Invitation sent successfully"
}
```

**Permissions Required:** `EVENT_INVITE_MEMBERS` (Event creator, Group admin, or Moderator)

#### Revoke Event Invitation

```http
POST /api/events/:id/invitations/revoke
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Permissions Required:** `EVENT_REVOKE_INVITES` (Event creator, Group admin, or Moderator)

#### Get Event Invite Analytics

```http
GET /api/events/:id/invitations/analytics
Authorization: Bearer <token>
```

**Permissions Required:** `EVENT_VIEW_INVITE_ANALYTICS` (Event creator or Group admin)

#### Generate Event Invite Token

```http
POST /api/events/:id/invitations/generate-token
Authorization: Bearer <token>
Content-Type: application/json

{
  "expiresInDays": 7
}
```

**Permissions Required:** `EVENT_INVITE_MEMBERS` (Event creator, Group admin, or Moderator)

---

## Migration Guide

### Database Migration

The database schema has been updated with new fields and tables. Run the migration:

```bash
npm run prisma:migrate
```

This will:
1. Add `expiresAt` and `invitedBy` to `GroupJoinRequest`
2. Add `inviteTokenExpiresAt` to `Group` and `Event`
3. Create the `InviteLog` table for auditing

### Code Migration

#### Update Permission Checks

If you have custom permission checks, update them to use the new permission system:

**Before:**
```typescript
// Check if user is admin
const membership = await prisma.groupMember.findUnique({
  where: { userId_groupId: { userId, groupId } }
});

if (membership?.role !== 'admin') {
  throw new Error('Unauthorized');
}
```

**After:**
```typescript
// Use permission service
const hasPermission = await permissionService.hasGroupPermission(
  userId,
  groupId,
  Permission.GROUP_REMOVE_MEMBERS
);

if (!hasPermission) {
  throw new ForbiddenError('Insufficient permissions');
}
```

#### Update Invite Calls

Existing invite functionality continues to work, but you can now add optional parameters:

**Before:**
```typescript
await InviteService.inviteUserToGroup(groupId, userId, inviterId);
```

**After (with new features):**
```typescript
await InviteService.inviteUserToGroup(groupId, userId, inviterId, {
  customMessage: "Welcome to our group!",
  expiresInDays: 7
});
```

### Cleanup Old Invitations

You can set up a cron job to automatically expire old invitations:

```typescript
import { InviteService } from './services/inviteService';

// Run daily
setInterval(async () => {
  const expired = await InviteService.expireOldInvitations();
  console.log(`Expired ${expired} old invitations`);
}, 24 * 60 * 60 * 1000);
```

---

## Best Practices

### 1. Set Reasonable Expiration Times

- **Group Invites:** 7-30 days
- **Event Invites:** 3-7 days (shorter for time-sensitive events)
- **Invite Tokens:** 14-30 days for groups, 7-14 days for events

### 2. Use Custom Messages

Add context to invitations to improve acceptance rates:

```typescript
await InviteService.inviteUserToGroup(groupId, userId, inviterId, {
  customMessage: "We play football every Sunday at 3 PM. Beginners welcome!",
  expiresInDays: 14
});
```

### 3. Monitor Invite Analytics

Regularly check invite analytics to understand acceptance patterns:

```typescript
const analytics = await InviteService.getInviteAnalytics('group', groupId);

// If decline rate is high, adjust your invitation strategy
const declineRate = analytics.declined / analytics.total;
if (declineRate > 0.3) {
  console.log("High decline rate - consider reviewing invitation approach");
}
```

### 4. Revoke Unused Invitations

If plans change, revoke invitations promptly:

```typescript
// Event cancelled - revoke all pending invites
await InviteService.revokeInvitation('event', eventId, userEmail, adminId);
```

### 5. Cache Permission Checks

The permission service automatically caches results for 60 seconds. After role changes, clear the cache:

```typescript
import { permissionService } from './services/permissionService';

// After updating a user's role
await permissionService.clearUserPermissionCache(userId);
```

---

## Security Considerations

1. **Invite Token Security:** Tokens are random strings and expire automatically
2. **Permission Caching:** Cached for 60 seconds - manual cache clearing after role changes recommended
3. **Audit Trail:** All invite actions are logged in `InviteLog` for accountability
4. **Rate Limiting:** Invite endpoints are rate-limited to prevent abuse
5. **Email Validation:** All email addresses are validated before processing

---

## Troubleshooting

### Invitation Not Received

1. Check email preferences: `await shouldSendEmailNotification(userId, 'groupInvites')`
2. Verify invite was created: Check `GroupJoinRequest` table
3. Check invite log: Query `InviteLog` for status

### Permission Denied

1. Verify user's role: `await permissionService.getUserGroupRole(userId, groupId)`
2. Check permission mapping: Review `permissions.types.ts`
3. Clear permission cache: `await permissionService.clearUserPermissionCache(userId)`

### Token Expired

1. Check token expiration: `await InviteService.validateInviteToken('group', token)`
2. Generate new token: Use `/invitations/generate-token` endpoint
3. Set longer expiration: Increase `expiresInDays` parameter

---

## Examples

### Complete Group Invitation Flow

```typescript
// 1. Admin invites user
const result = await InviteService.inviteUserToGroup(
  'group-123',
  'user-456',
  'admin-789',
  {
    customMessage: "Join our weekly basketball games!",
    expiresInDays: 14
  }
);

// 2. User receives email and accepts

// 3. Admin checks analytics
const analytics = await InviteService.getInviteAnalytics('group', 'group-123');
console.log(`${analytics.accepted}/${analytics.total} invitations accepted`);

// 4. If needed, admin revokes pending invitation
await InviteService.revokeInvitation(
  'group',
  'group-123',
  'user@example.com',
  'admin-789'
);
```

### Event Invitation with Auto-Expiring Token

```typescript
// 1. Event creator generates shareable link
const { token, expiresAt } = await InviteService.generateInviteToken(
  'event',
  'event-456',
  7 // expires in 7 days
);

const inviteUrl = `https://teamly.app/events/invite/${token}`;

// 2. Share URL with friends

// 3. Before joining, validate token
const validation = await InviteService.validateInviteToken('event', token);

if (validation.valid) {
  // Allow user to join
} else {
  console.log(validation.error); // "Token expired"
}
```

---

## Additional Resources

- [Permission Types Reference](../src/shared/types/permissions.types.ts)
- [Invite Service API](../src/backend/services/inviteService.ts)
- [Permission Service API](../src/backend/services/permissionService.ts)
- [API Documentation](./API_DOCUMENTATION.md)
- [Database Schema](../prisma/schema.prisma)
