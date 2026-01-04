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
