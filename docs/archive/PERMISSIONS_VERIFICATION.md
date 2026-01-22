# Group Roles and Permissions Verification Guide

## Changes Summary

This document describes the changes made to ensure group roles and permissions are correct and consistent across frontend and backend.

### Updated Components

1. **Frontend Type Definitions** (`src/shared/types/group.types.ts`)
   - Updated `GroupMember` interface to include `moderator` role
   - Now supports three roles: `member`, `moderator`, `admin`

2. **Backend Group Controller** (`src/backend/controllers/groupController.ts`)
   - Updated all permission checks to use the centralized `permissionService`
   - Replaced inline admin checks with proper permission checks using `Permission` enum

3. **Frontend Group Details Page** (`src/frontend/src/pages/GroupDetailsPage.tsx`)
   - Added `canEdit` variable to check for admin or moderator permissions
   - Group settings button now shown to both admins and moderators
   - Event creation button now shown to all members

## Permission Matrix

### Group Operations

| Operation | Member | Moderator | Admin |
|-----------|--------|-----------|-------|
| View Group | ✅ | ✅ | ✅ |
| Edit Group Settings | ❌ | ✅ | ✅ |
| Delete Group | ❌ | ❌ | ✅ |
| Invite Members | ❌ | ✅ | ✅ |
| Remove Members | ❌ | ❌ | ✅ |
| Manage Roles | ❌ | ❌ | ✅ |
| Handle Join Requests | ❌ | ❌ | ✅ |

### Event Operations

| Operation | Member | Moderator | Admin |
|-----------|--------|-----------|-------|
| View Events | ✅ | ✅ | ✅ |
| Create Events | ✅ | ✅ | ✅ |
| Edit Events | ❌ | ✅ | ✅ |
| Delete Events | ❌ | ❌ | ✅ |
| Manage Participants | ❌ | ✅ | ✅ |

### Event Request Operations

| Operation | Member | Moderator | Admin |
|-----------|--------|-----------|-------|
| Create Event Request | ✅ | ✅ | ✅ |
| Vote on Request | ✅ | ✅ | ✅ |
| Finalize Request | ❌ | ❌ | ✅ |
| Cancel Request | ❌ | ❌ | ✅ |

## Testing Checklist

### Backend API Tests

Use the following curl commands to verify backend permissions (replace tokens and IDs with actual values):

#### 1. Test Admin Can Edit Group
```bash
# As admin
curl -X PUT http://localhost:3000/api/groups/{groupId} \
  -H "Authorization: Bearer {adminToken}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Group Name"}'
# Expected: 200 OK with updated group
```

#### 2. Test Admin Can Delete Group
```bash
# As admin
curl -X DELETE http://localhost:3000/api/groups/{groupId} \
  -H "Authorization: Bearer {adminToken}"
# Expected: 200 OK with success message
```

#### 3. Test Moderator Can Invite Members
```bash
# As moderator
curl -X POST http://localhost:3000/api/groups/{groupId}/invite \
  -H "Authorization: Bearer {moderatorToken}" \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com"}'
# Expected: 201 Created with new member
```

#### 4. Test Regular Member Can Create Event Request
```bash
# As regular member
curl -X POST http://localhost:3000/api/event-requests \
  -H "Authorization: Bearer {memberToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId": "{groupId}",
    "title": "Test Event",
    "eventType": "football",
    "startTime": "2024-12-31T18:00:00.000Z"
  }'
# Expected: 201 Created with event request
```

#### 5. Test Member Cannot Edit Group
```bash
# As regular member
curl -X PUT http://localhost:3000/api/groups/{groupId} \
  -H "Authorization: Bearer {memberToken}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Should Fail"}'
# Expected: 403 Forbidden
```

#### 6. Test Member Cannot Delete Group
```bash
# As regular member
curl -X DELETE http://localhost:3000/api/groups/{groupId} \
  -H "Authorization: Bearer {memberToken}"
# Expected: 403 Forbidden
```

### Frontend UI Tests

#### 1. Test Admin UI
- [ ] Login as admin
- [ ] Navigate to group details page
- [ ] Verify "Edit" button is visible
- [ ] Verify "Delete" button is visible
- [ ] Verify "Create Event" button is visible
- [ ] Click "Edit" and verify settings modal opens
- [ ] Verify group can be updated

#### 2. Test Moderator UI
- [ ] Login as moderator (or promote a user to moderator in database)
- [ ] Navigate to group details page
- [ ] Verify "Edit" button is visible
- [ ] Verify "Delete" button is NOT visible
- [ ] Verify "Create Event" button is visible
- [ ] Click "Edit" and verify settings modal opens

#### 3. Test Regular Member UI
- [ ] Login as regular member
- [ ] Navigate to group details page
- [ ] Verify "Edit" button is NOT visible
- [ ] Verify "Delete" button is NOT visible
- [ ] Verify "Create Event" button is visible
- [ ] Navigate to Event Requests page
- [ ] Verify "Create Request" button is visible
- [ ] Create an event request and verify it appears

## Database Setup for Testing

To test moderator permissions, you need to create a moderator user:

```sql
-- Connect to your database and run:
UPDATE "GroupMember"
SET role = 'moderator'
WHERE "userId" = '{userId}' AND "groupId" = '{groupId}';
```

Or use Prisma Studio:
```bash
npm run prisma:studio
# Navigate to GroupMember table
# Find the member you want to make moderator
# Change role field to 'moderator'
```

## Verification Results

### Backend Tests
- [ ] Admin can edit group ✅
- [ ] Admin can delete group ✅
- [ ] Moderator can invite members ✅
- [ ] Regular member can create event request ✅
- [ ] Member cannot edit group ✅
- [ ] Member cannot delete group ✅

### Frontend Tests
- [ ] Admin sees edit and delete buttons ✅
- [ ] Moderator sees edit button but not delete ✅
- [ ] Member sees only create event button ✅
- [ ] Event requests work for all members ✅

## Notes

- The permission system is centralized in `src/backend/services/permissionService.ts`
- All permission checks use the `Permission` enum from `src/shared/types/permissions.types.ts`
- The frontend checks are based on user's role in the group
- Backend always validates permissions regardless of frontend checks
- Cache invalidation happens automatically when roles are updated

## Related Documentation

- [PERMISSIONS.md](./PERMISSIONS.md) - Complete permission system documentation
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API endpoints documentation
