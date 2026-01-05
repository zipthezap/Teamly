# Teamly API Documentation

## Overview

Teamly is a RESTful API for organizing small sports matches. Users can create groups, invite friends, and organize sports events.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

## API Endpoints

### Authentication Endpoints

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "token": "jwt-token"
}
```

#### POST /auth/login
Login to an existing account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt-token"
}
```

#### GET /auth/profile
Get the current user's profile. Requires authentication.

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

---

### Group Endpoints

#### POST /groups
Create a new group. Requires authentication.

**Request Body:**
```json
{
  "name": "Sunday Football League",
  "description": "Weekly football matches"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Sunday Football League",
  "description": "Weekly football matches",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "creatorId": "uuid",
  "creator": {
    "id": "uuid",
    "name": "John Doe",
    "email": "user@example.com"
  },
  "members": [
    {
      "id": "uuid",
      "role": "admin",
      "joinedAt": "2024-01-01T00:00:00Z",
      "user": {
        "id": "uuid",
        "name": "John Doe",
        "email": "user@example.com"
      }
    }
  ]
}
```

#### GET /groups
Get all groups the user is a member of. Requires authentication.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Sunday Football League",
    "description": "Weekly football matches",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "creator": { ... },
    "members": [ ... ],
    "events": [ ... ]
  }
]
```

#### GET /groups/:id
Get details of a specific group. Requires authentication and group membership.

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Sunday Football League",
  "description": "Weekly football matches",
  "creator": { ... },
  "members": [ ... ],
  "events": [ ... ]
}
```

#### PUT /groups/:id
Update a group. Requires authentication and admin role.

**Request Body:**
```json
{
  "name": "Updated Group Name",
  "description": "Updated description"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Updated Group Name",
  "description": "Updated description",
  "updatedAt": "2024-01-01T00:00:00Z",
  ...
}
```

#### POST /groups/:id/invite
Invite a user to the group by email. Requires authentication and group membership.

**Request Body:**
```json
{
  "email": "friend@example.com"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "role": "member",
  "joinedAt": "2024-01-01T00:00:00Z",
  "user": {
    "id": "uuid",
    "name": "Friend Name",
    "email": "friend@example.com"
  }
}
```

#### DELETE /groups/:id/members/:memberId
Remove a member from the group. Requires authentication and admin role.

**Response (200):**
```json
{
  "message": "Member removed successfully"
}
```

---

### Event Endpoints

#### POST /events
Create a new event. Requires authentication and group membership.

**Request Body:**
```json
{
  "groupId": "uuid",
  "title": "Weekend Football Match",
  "description": "Casual game at the park",
  "eventType": "football",
  "location": "Central Park",
  "startTime": "2024-01-20T10:00:00Z",
  "endTime": "2024-01-20T12:00:00Z",
  "maxPlayers": 10
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "title": "Weekend Football Match",
  "description": "Casual game at the park",
  "eventType": "football",
  "location": "Central Park",
  "startTime": "2024-01-20T10:00:00Z",
  "endTime": "2024-01-20T12:00:00Z",
  "maxPlayers": 10,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "creator": { ... },
  "group": { ... },
  "participants": [ ... ]
}
```

#### GET /events
Get all events from groups the user is a member of. Requires authentication.

**Query Parameters:**
- `groupId` (optional): Filter events by group ID

**Response (200):**
```json
[
  {
    "id": "uuid",
    "title": "Weekend Football Match",
    "eventType": "football",
    "startTime": "2024-01-20T10:00:00Z",
    "creator": { ... },
    "group": { ... },
    "participants": [ ... ]
  }
]
```

#### GET /events/:id
Get details of a specific event. Requires authentication and group membership.

**Response (200):**
```json
{
  "id": "uuid",
  "title": "Weekend Football Match",
  "description": "Casual game at the park",
  "eventType": "football",
  "location": "Central Park",
  "startTime": "2024-01-20T10:00:00Z",
  "endTime": "2024-01-20T12:00:00Z",
  "maxPlayers": 10,
  "creator": { ... },
  "group": { ... },
  "participants": [ ... ]
}
```

#### PUT /events/:id
Update an event. Requires authentication and must be the event creator.

**Request Body:**
```json
{
  "title": "Updated Event Title",
  "maxPlayers": 12
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "title": "Updated Event Title",
  "maxPlayers": 12,
  "updatedAt": "2024-01-01T00:00:00Z",
  ...
}
```

#### DELETE /events/:id
Delete an event. Requires authentication and must be the event creator.

**Response (200):**
```json
{
  "message": "Event deleted successfully"
}
```

#### POST /events/:id/join
Join an event. Requires authentication and group membership.

**Response (201):**
```json
{
  "id": "uuid",
  "eventId": "uuid",
  "userId": "uuid",
  "status": "confirmed",
  "joinedAt": "2024-01-01T00:00:00Z"
}
```

#### DELETE /events/:id/leave
Leave an event. Requires authentication and participation in the event.

**Response (200):**
```json
{
  "message": "Left event successfully"
}
```

#### PUT /events/:id/status
Update participation status for an event. Requires authentication and participation.

**Request Body:**
```json
{
  "status": "confirmed"
}
```

Valid status values: `pending`, `confirmed`, `declined`

**Response (200):**
```json
{
  "id": "uuid",
  "status": "confirmed",
  "eventId": "uuid",
  "userId": "uuid",
  "joinedAt": "2024-01-01T00:00:00Z"
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Error message describing what went wrong"
}
```

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```
or
```json
{
  "error": "Invalid token"
}
```

### 403 Forbidden
```json
{
  "error": "Permission denied message"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## Event Types

Common event types include:
- `football`
- `basketball`
- `tennis`
- `volleyball`
- `badminton`
- `cricket`
- `rugby`
- `hockey`
- `baseball`
- Custom types are also supported

---

## Group Roles

- `admin`: Can update group settings, invite members, and remove members
- `member`: Can view group, create events, and invite members

---

## Participation Status

- `pending`: Invited but not confirmed
- `confirmed`: Confirmed participation
- `declined`: Declined participation

---

## Public Group Discovery Endpoints

### GET /groups/public
Get all public groups for discovery (no authentication required).

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Public Soccer Group",
    "description": "Open to all soccer enthusiasts",
    "isPublic": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "creator": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "_count": {
      "members": 15,
      "events": 8
    }
  }
]
```

### POST /groups/:id/join-request
Request to join a public group (authenticated).

**Response (201):**
```json
{
  "id": "uuid",
  "groupId": "uuid",
  "userId": "uuid",
  "status": "pending",
  "createdAt": "2024-01-01T00:00:00Z",
  "user": {
    "id": "uuid",
    "name": "Jane Smith",
    "email": "jane@example.com"
  }
}
```

### GET /groups/:id/join-requests
Get all pending join requests for a group (admin only).

**Response (200):**
```json
[
  {
    "id": "uuid",
    "groupId": "uuid",
    "userId": "uuid",
    "status": "pending",
    "createdAt": "2024-01-01T00:00:00Z",
    "user": {
      "id": "uuid",
      "name": "Jane Smith",
      "email": "jane@example.com"
    }
  }
]
```

### POST /groups/:id/join-requests/:requestId
Approve or reject a join request (admin only).

**Request Body:**
```json
{
  "action": "approve"  // or "reject"
}
```

**Response (200):**
```json
{
  "message": "Join request approved successfully",
  "request": {
    "id": "uuid",
    "status": "approved"
  }
}
```

---

## Two-Factor Authentication Endpoints

### GET /2fa/status
Get 2FA status for the current user.

**Response (200):**
```json
{
  "enabled": true,
  "backupCodesRemaining": 8
}
```

### POST /2fa/setup
Setup 2FA - generate secret and QR code.

**Response (200):**
```json
{
  "secret": "BASE32_SECRET",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": [
    "ABCD1234",
    "EFGH5678",
    ...
  ]
}
```

### POST /2fa/verify
Verify and enable 2FA.

**Request Body:**
```json
{
  "token": "123456"
}
```

**Response (200):**
```json
{
  "message": "2FA enabled successfully"
}
```

### POST /2fa/disable
Disable 2FA (requires password).

**Request Body:**
```json
{
  "password": "your-password"
}
```

**Response (200):**
```json
{
  "message": "2FA disabled successfully"
}
```

### POST /auth/login (with 2FA)
Login with 2FA token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password",
  "twoFactorToken": "123456"  // Optional, required if 2FA is enabled
}
```

**Response (200) - 2FA Required:**
```json
{
  "requires2FA": true,
  "tempAuth": "user@example.com"
}
}
```

**Response (200) - Success:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt-token"
}
```

---

## Event Request (Voting) Endpoints

### POST /event-requests
Create a new event request (admin only).

**Request Body:**
```json
{
  "groupId": "uuid",
  "title": "Weekend Soccer Match",
  "description": "Let's play soccer this weekend",
  "eventType": "soccer",
  "location": "Central Park",
  "startTime": "2024-01-15T14:00:00Z",
  "endTime": "2024-01-15T16:00:00Z",
  "maxPlayers": 20
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "title": "Weekend Soccer Match",
  "status": "voting",
  "creator": {
    "id": "uuid",
    "name": "John Doe"
  },
  "votes": [],
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### GET /event-requests/group/:groupId
Get all event requests for a group.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "title": "Weekend Soccer Match",
    "status": "voting",
    "votes": [
      {
        "id": "uuid",
        "vote": "yes",
        "user": {
          "id": "uuid",
          "name": "Jane Smith"
        }
      }
    ],
    "_count": {
      "votes": 5
    }
  }
]
```

### GET /event-requests/:id
Get a specific event request.

**Response (200):**
```json
{
  "id": "uuid",
  "title": "Weekend Soccer Match",
  "description": "Let's play soccer this weekend",
  "eventType": "soccer",
  "status": "voting",
  "votes": [...],
  "_count": {
    "votes": 5
  }
}
```

### POST /event-requests/:id/vote
Vote on an event request.

**Request Body:**
```json
{
  "vote": "yes"  // or "no"
}
```

**Response (201):**
```json
{
  "message": "Vote recorded",
  "vote": {
    "id": "uuid",
    "vote": "yes",
    "user": {
      "id": "uuid",
      "name": "Jane Smith"
    }
  }
}
```

### POST /event-requests/:id/finalize
Finalize an event request and create the event (admin only).

**Response (200):**
```json
{
  "message": "Event request finalized and event created",
  "event": {
    "id": "uuid",
    "title": "Weekend Soccer Match",
    ...
  },
  "yesVotes": 12,
  "noVotes": 3
}
```

### POST /event-requests/:id/cancel
Cancel an event request (admin only).

**Response (200):**
```json
{
  "message": "Event request cancelled"
}
```

---

## Vote Status

- `yes`: Vote in favor of the event
- `no`: Vote against the event

## Event Request Status

- `voting`: Currently accepting votes
- `finalized`: Approved and event created
- `cancelled`: Cancelled by admin or insufficient votes

---

## Email Notification Endpoints

### GET /email/preferences
Get user's email notification preferences.

**Authentication Required:** Yes

**Response (200):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "eventInvites": true,
  "eventReminders": true,
  "eventUpdates": true,
  "eventCancellations": true,
  "groupInvites": true,
  "commentMentions": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### PUT /email/preferences
Update user's email notification preferences.

**Authentication Required:** Yes

**Request Body:**
```json
{
  "eventInvites": false,
  "eventReminders": true,
  "eventUpdates": true,
  "eventCancellations": true,
  "groupInvites": false,
  "commentMentions": true
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "eventInvites": false,
  "eventReminders": true,
  ...
}
```

### PUT /email/notifications/toggle
Toggle all email notifications on or off.

**Authentication Required:** Yes

**Request Body:**
```json
{
  "enabled": false
}
```

**Response (200):**
```json
{
  "emailNotifications": false
}
```

### POST /email/verify/send
Send email verification link to user's email.

**Authentication Required:** Yes

**Response (200):**
```json
{
  "message": "Verification email sent"
}
```

### GET /email/verify/:token
Verify user's email address using verification token.

**Authentication Required:** No

**Response (200):**
```json
{
  "message": "Email verified successfully"
}
```

---

## Recurring Event Endpoints

### POST /events (with recurrence)
Create a recurring event.

**Authentication Required:** Yes

**Request Body:**
```json
{
  "groupId": "uuid",
  "title": "Weekly Football Match",
  "description": "Every Sunday morning",
  "eventType": "football",
  "location": "Central Park",
  "startTime": "2024-01-20T10:00:00Z",
  "endTime": "2024-01-20T12:00:00Z",
  "maxPlayers": 10,
  "isRecurring": true,
  "recurrenceRule": "FREQ=WEEKLY;BYDAY=SU;INTERVAL=1",
  "recurrenceEnd": "2024-12-31T23:59:59Z"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "title": "Weekly Football Match",
  "isRecurring": true,
  "recurrenceRule": "FREQ=WEEKLY;BYDAY=SU;INTERVAL=1",
  "recurrenceEnd": "2024-12-31T23:59:59Z",
  ...
}
```

### GET /events/:id/instances
Get all instances of a recurring event.

**Authentication Required:** Yes

**Query Parameters:**
- `startDate` (optional): Start date for instances
- `endDate` (optional): End date for instances
- `limit` (optional): Maximum number of instances (default: 100)

**Response (200):**
```json
[
  {
    "id": "event-uuid-2024-01-20T10:00:00.000Z",
    "title": "Weekly Football Match",
    "startTime": "2024-01-20T10:00:00.000Z",
    "endTime": "2024-01-20T12:00:00.000Z",
    "isInstance": true,
    "parentEventId": "event-uuid",
    ...
  },
  {
    "id": "event-uuid-2024-01-27T10:00:00.000Z",
    "title": "Weekly Football Match",
    "startTime": "2024-01-27T10:00:00.000Z",
    ...
  }
]
```

### POST /events/:id/exceptions
Add an exception date to skip a recurring event instance.

**Authentication Required:** Yes (creator only)

**Request Body:**
```json
{
  "exceptionDate": "2024-02-10T10:00:00Z"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "exceptionDates": [
    "2024-02-10T10:00:00.000Z"
  ],
  ...
}
```

### DELETE /events/:id/exceptions
Remove an exception date from a recurring event.

**Authentication Required:** Yes (creator only)

**Request Body:**
```json
{
  "exceptionDate": "2024-02-10T10:00:00Z"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "exceptionDates": [],
  ...
}
```

---

## Comment Endpoints

### POST /comments
Create a comment on an event.

**Authentication Required:** Yes

**Request Body:**
```json
{
  "eventId": "uuid",
  "content": "Looking forward to this! @john can you bring the ball?",
  "parentId": null
}
```

**Note:** Use `parentId` to reply to an existing comment. Mentions are automatically detected using `@username` syntax.

**Response (201):**
```json
{
  "id": "uuid",
  "content": "Looking forward to this! @john can you bring the ball?",
  "eventId": "uuid",
  "userId": "uuid",
  "parentId": null,
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z",
  "user": {
    "id": "uuid",
    "name": "Jane Doe",
    "email": "jane@example.com"
  },
  "replies": []
}
```

### GET /comments/event/:eventId
Get all comments for an event (includes nested replies).

**Authentication Required:** Yes

**Response (200):**
```json
[
  {
    "id": "uuid",
    "content": "Looking forward to this!",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "user": {
      "id": "uuid",
      "name": "Jane Doe",
      "email": "jane@example.com"
    },
    "replies": [
      {
        "id": "uuid",
        "content": "Me too!",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "user": {
          "id": "uuid",
          "name": "John Smith"
        },
        "replies": []
      }
    ],
    "mentions": [
      {
        "user": {
          "id": "uuid",
          "name": "John Smith"
        }
      }
    ]
  }
]
```

### PUT /comments/:commentId
Update a comment (own comments only).

**Authentication Required:** Yes

**Request Body:**
```json
{
  "content": "Updated comment text"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "content": "Updated comment text",
  "updatedAt": "2024-01-15T11:00:00.000Z",
  ...
}
```

### DELETE /comments/:commentId
Delete a comment (own comments only).

**Authentication Required:** Yes

**Response (200):**
```json
{
  "message": "Comment deleted successfully"
}
```

---

## Recurrence Rule Format

Recurring events use the iCalendar RRULE format. Common examples:

- **Daily**: `FREQ=DAILY;INTERVAL=1`
- **Weekly (every Monday)**: `FREQ=WEEKLY;BYDAY=MO;INTERVAL=1`
- **Weekly (Mon, Wed, Fri)**: `FREQ=WEEKLY;BYDAY=MO,WE,FR;INTERVAL=1`
- **Bi-weekly**: `FREQ=WEEKLY;INTERVAL=2`
- **Monthly (15th day)**: `FREQ=MONTHLY;BYMONTHDAY=15;INTERVAL=1`
- **Monthly (2nd Tuesday)**: `FREQ=MONTHLY;BYDAY=2TU;INTERVAL=1`
- **Yearly**: `FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=15;INTERVAL=1`

**Day abbreviations:**
- MO (Monday), TU (Tuesday), WE (Wednesday), TH (Thursday), FR (Friday), SA (Saturday), SU (Sunday)

---

## Email Notification Types

When users receive email notifications, they can control which types they receive through their email preferences:

- **Event Invites**: Notifications when invited to new events
- **Event Reminders**: Reminders before events start (requires background job)
- **Event Updates**: Notifications when event details change
- **Event Cancellations**: Notifications when events are cancelled
- **Group Invites**: Notifications when invited to groups
- **Comment Mentions**: Notifications when mentioned in comments (@username)

Users can also toggle all email notifications on/off with a single setting.
