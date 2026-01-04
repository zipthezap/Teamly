# New Features Implementation Guide

This document describes the newly implemented features in Teamly.

## Table of Contents

1. [Public Group Discovery and Join Requests](#public-group-discovery-and-join-requests)
2. [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
3. [Event Request with Voting](#event-request-with-voting)

---

## Public Group Discovery and Join Requests

### Overview
Groups can now be marked as "public", allowing any user to discover them and request to join. Admins can approve or reject join requests.

### Backend Implementation

#### Schema Changes
- `Group.isPublic`: Boolean field to mark groups as public
- `GroupJoinRequest`: Model to track join requests with status (pending, approved, rejected)

#### API Endpoints

1. **GET /api/groups/public** - List all public groups (no auth required)
2. **POST /api/groups/:id/join-request** - Submit a join request
3. **GET /api/groups/:id/join-requests** - Get pending join requests (admin only)
4. **POST /api/groups/:id/join-requests/:requestId** - Approve/reject join request (admin only)

### Usage

#### Creating a Public Group
```bash
POST /api/groups
{
  "name": "Open Soccer League",
  "description": "Join us for weekly soccer matches",
  "isPublic": true
}
```

#### Discovering Public Groups
```bash
GET /api/groups/public
```

#### Requesting to Join
```bash
POST /api/groups/{groupId}/join-request
# No body required, uses authenticated user
```

#### Managing Join Requests (Admin)
```bash
# Get pending requests
GET /api/groups/{groupId}/join-requests

# Approve or reject
POST /api/groups/{groupId}/join-requests/{requestId}
{
  "action": "approve"  // or "reject"
}
```

---

## Two-Factor Authentication (2FA)

### Overview
Users can enable 2FA using TOTP (Time-based One-Time Password) for enhanced account security. Supports authenticator apps like Google Authenticator, Authy, etc.

### Backend Implementation

#### Schema Changes
- `User.twoFactorEnabled`: Boolean to indicate if 2FA is enabled
- `User.twoFactorSecret`: Encrypted secret for TOTP generation
- `User.twoFactorBackupCodes`: Array of backup codes for account recovery

#### Dependencies
- `speakeasy`: TOTP generation and verification
- `qrcode`: QR code generation for easy setup

#### API Endpoints

1. **GET /api/2fa/status** - Get 2FA status
2. **POST /api/2fa/setup** - Generate secret and QR code
3. **POST /api/2fa/verify** - Verify and enable 2FA
4. **POST /api/2fa/disable** - Disable 2FA (requires password)

### Usage

#### Setting Up 2FA

1. **Get Setup Information**
```bash
POST /api/2fa/setup
```

Response includes:
- `secret`: Base32 encoded secret (for manual entry)
- `qrCode`: Data URL of QR code image
- `backupCodes`: 10 backup codes for account recovery

2. **Verify and Enable**
```bash
POST /api/2fa/verify
{
  "token": "123456"  // From authenticator app
}
```

#### Using 2FA During Login

1. **First Login Attempt**
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}
```

If 2FA is enabled, response will be:
```json
{
  "requires2FA": true,
  "userId": "uuid"
}
```

2. **Second Login with 2FA Token**
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password",
  "twoFactorToken": "123456"
}
```

#### Disabling 2FA
```bash
POST /api/2fa/disable
{
  "password": "your-password"
}
```

### Security Features

- **Backup Codes**: 10 single-use backup codes generated during setup
- **Time Window**: 2-step tolerance for clock drift
- **Password Required**: Disabling 2FA requires password confirmation

---

## Event Request with Voting

### Overview
Admins can create event requests that require member approval through voting before becoming actual events. This democratic approach ensures events have sufficient interest.

### Backend Implementation

#### Schema Changes
- `EventRequest`: Model for proposed events with voting status
- `EventVote`: Model to track individual votes (yes/no)

#### API Endpoints

1. **POST /api/event-requests** - Create event request (admin only)
2. **GET /api/event-requests/group/:groupId** - Get event requests for a group
3. **GET /api/event-requests/:id** - Get specific event request
4. **POST /api/event-requests/:id/vote** - Vote on event request
5. **POST /api/event-requests/:id/finalize** - Finalize and create event (admin only)
6. **POST /api/event-requests/:id/cancel** - Cancel event request (admin only)

### Usage

#### Creating an Event Request (Admin)
```bash
POST /api/event-requests
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

#### Viewing Event Requests
```bash
# Get all requests for a group
GET /api/event-requests/group/{groupId}

# Get specific request with vote details
GET /api/event-requests/{requestId}
```

#### Voting on Event Request
```bash
POST /api/event-requests/{requestId}/vote
{
  "vote": "yes"  // or "no"
}
```

Members can:
- Vote "yes" or "no"
- Change their vote before finalization
- View current vote counts

#### Finalizing Event Request (Admin)
```bash
POST /api/event-requests/{requestId}/finalize
```

The system will:
1. Count yes vs no votes
2. If yes votes > no votes: Create the actual event
3. If no votes >= yes votes: Mark as cancelled
4. Return the created event or cancellation message

#### Canceling Event Request (Admin)
```bash
POST /api/event-requests/{requestId}/cancel
```

### Workflow

1. **Admin creates event request** → Status: "voting"
2. **Members vote** → Each member votes yes/no
3. **Admin finalizes** → 
   - If majority yes: Status → "finalized", Event created
   - If not enough support: Status → "cancelled"

### Vote Counting Rules

- Event is created if: `yesVotes > noVotes`
- Event is cancelled if: `noVotes >= yesVotes`
- Only finalized events appear in the regular event list

---

## Database Migration

Run the following to apply all schema changes:

```bash
# Using Prisma
npx prisma migrate deploy

# Or using npm script
npm run prisma:migrate
```

The migration includes:
- 2FA fields on User model
- EventRequest and EventVote models
- All necessary foreign keys and constraints

---

## Testing the Features

### Local Testing

1. Start the backend:
```bash
npm start
```

2. Use the provided test scripts or API client (Postman, curl, etc.)

### Example Test Flow

#### Public Groups
```bash
# Create a public group
curl -X POST http://localhost:3000/api/groups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Public Soccer","isPublic":true}'

# Discover public groups (no auth)
curl http://localhost:3000/api/groups/public

# Request to join
curl -X POST http://localhost:3000/api/groups/$GROUP_ID/join-request \
  -H "Authorization: Bearer $TOKEN"
```

#### 2FA
```bash
# Setup 2FA
curl -X POST http://localhost:3000/api/2fa/setup \
  -H "Authorization: Bearer $TOKEN"

# Verify with token from authenticator app
curl -X POST http://localhost:3000/api/2fa/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token":"123456"}'

# Login with 2FA
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass","twoFactorToken":"123456"}'
```

#### Event Voting
```bash
# Create event request (admin)
curl -X POST http://localhost:3000/api/event-requests \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"groupId":"uuid","title":"Soccer Match","eventType":"soccer","startTime":"2024-01-15T14:00:00Z"}'

# Vote on request
curl -X POST http://localhost:3000/api/event-requests/$REQUEST_ID/vote \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vote":"yes"}'

# Finalize (admin)
curl -X POST http://localhost:3000/api/event-requests/$REQUEST_ID/finalize \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Security Considerations

### 2FA Implementation
- Secrets are stored securely in the database
- Backup codes are single-use only
- Time-based tokens expire quickly
- Password required to disable 2FA

### Join Requests
- Admin-only approval prevents unauthorized access
- Requests are linked to specific users (no anonymous requests)
- Status tracking prevents duplicate processing

### Event Voting
- Only group members can vote
- One vote per user (can be updated)
- Admin-only finalization prevents abuse
- Vote counts are transparent to all members

---

## Frontend Integration (TODO)

The backend is complete. Frontend implementation should include:

### Public Groups
- Browse page for public groups
- Join request submission UI
- Admin panel for managing join requests
- Notifications for approved/rejected requests

### 2FA
- Setup wizard with QR code display
- Backup code download/print option
- Login flow with 2FA token input
- Account settings page for enabling/disabling

### Event Voting
- Event request creation form (admin)
- Voting interface for members
- Vote results visualization
- Finalization button (admin)

---

## Known Limitations

1. **Email Notifications**: Not yet implemented. Users won't receive emails for:
   - Join request updates
   - Event request notifications
   - 2FA setup/changes

2. **Real-time Updates**: No WebSocket implementation yet
   - Vote counts update on page refresh
   - Join request status updates on refresh

3. **Mobile App**: Features are backend-only
   - QR code scanning may need native implementation
   - Push notifications not available

---

## Future Enhancements

1. **Email Integration**
   - SendGrid/AWS SES for notifications
   - Email templates for all events

2. **Real-time Updates**
   - Socket.io for live vote counts
   - Instant join request notifications

3. **Advanced Voting**
   - Voting deadlines
   - Minimum vote requirements
   - Vote delegation

4. **2FA Enhancements**
   - SMS-based 2FA option
   - Biometric support (mobile)
   - Remember trusted devices

---

## Support and Contribution

For issues or questions, please refer to:
- API Documentation: `API_DOCUMENTATION.md`
- Main README: `README.md`
- Feature Roadmap: `FEATURE_ROADMAP.md`
