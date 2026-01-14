# Tournament Team Invitations Feature

## Overview

The Tournament Team Invitations feature makes it easy for team captains to invite players to join their tournament teams. Invitees can accept invitations after creating a Teamly account, streamlining the team registration process.

## Key Features

1. **Easy Team Building**: Team captains can invite players via email
2. **Account Creation Flow**: Invitees must create an account before joining
3. **Secure Invite Links**: Each invitation has a unique, secure token
4. **Email Notifications**: Automatic email notifications with invite instructions
5. **Invitation Management**: View, cancel, and track invitation status
6. **Expiration Handling**: Invitations automatically expire after 7 days

## User Flow

### For Team Captains

1. **Create or Join a Tournament Team**
   - Register your team for a tournament
   - You become the team captain

2. **Invite Players**
   - Send invitation emails to potential team members
   - Include an optional personal message
   - Track invitation status (pending, accepted, declined, expired)

3. **Manage Invitations**
   - View all sent invitations
   - Cancel pending invitations if needed
   - Automatically added as team members once accepted

### For Players (Invitees)

1. **Receive Invitation Email**
   - Get an email with tournament and team details
   - See personal message from the captain (if included)

2. **Create Account or Login**
   - If you don't have a Teamly account, create one
   - Use the same email address that received the invitation
   - If you already have an account, just log in

3. **Accept or Decline Invitation**
   - Click the link in the email to accept
   - Or decline if you don't want to join
   - Once accepted, you're automatically added to the team

## API Endpoints

### Send Team Invitation

Invite a player to join your tournament team.

**Endpoint:** `POST /api/tournaments/:id/teams/:teamId/invitations`

**Authorization:** Team captain or tournament organizer

**Request Body:**
```json
{
  "inviteeEmail": "player@example.com",
  "inviteeName": "John Doe",
  "message": "Would love to have you on our team!"
}
```

**Response:** `201 Created`
```json
{
  "id": "invitation-uuid",
  "teamId": "team-uuid",
  "inviteeEmail": "player@example.com",
  "inviteeName": "John Doe",
  "inviterId": "captain-uuid",
  "inviteToken": "secure-token-hex",
  "status": "pending",
  "message": "Would love to have you on our team!",
  "expiresAt": "2024-01-21T10:00:00Z",
  "createdAt": "2024-01-14T10:00:00Z",
  "team": {
    "id": "team-uuid",
    "name": "Team Warriors",
    "tournament": {
      "id": "tournament-uuid",
      "name": "Summer Championship"
    }
  },
  "inviter": {
    "id": "captain-uuid",
    "name": "Captain Name",
    "email": "captain@example.com"
  }
}
```

### Get Team Invitations

View all invitations for a specific team.

**Endpoint:** `GET /api/tournaments/:id/teams/:teamId/invitations`

**Authorization:** Team captain or tournament organizer

**Response:** `200 OK`
```json
[
  {
    "id": "invitation-uuid",
    "teamId": "team-uuid",
    "inviteeEmail": "player@example.com",
    "inviteeName": "John Doe",
    "status": "pending",
    "expiresAt": "2024-01-21T10:00:00Z",
    "createdAt": "2024-01-14T10:00:00Z",
    "inviter": {
      "id": "captain-uuid",
      "name": "Captain Name",
      "email": "captain@example.com"
    }
  }
]
```

### Get User's Pending Invitations

View all pending invitations for the logged-in user.

**Endpoint:** `GET /api/tournaments/invitations/my`

**Authorization:** Authenticated user

**Response:** `200 OK`
```json
[
  {
    "id": "invitation-uuid",
    "teamId": "team-uuid",
    "inviteeEmail": "user@example.com",
    "status": "pending",
    "message": "Would love to have you on our team!",
    "expiresAt": "2024-01-21T10:00:00Z",
    "createdAt": "2024-01-14T10:00:00Z",
    "team": {
      "id": "team-uuid",
      "name": "Team Warriors",
      "tournament": {
        "id": "tournament-uuid",
        "name": "Summer Championship",
        "startDate": "2024-02-01T10:00:00Z"
      }
    },
    "inviter": {
      "id": "captain-uuid",
      "name": "Captain Name",
      "email": "captain@example.com"
    }
  }
]
```

### Accept Team Invitation

Accept an invitation to join a tournament team.

**Endpoint:** `POST /api/tournaments/invitations/:inviteToken/accept`

**Authorization:** Authenticated user (email must match invitation)

**Response:** `200 OK`
```json
{
  "message": "Invitation accepted successfully",
  "team": {
    "id": "team-uuid",
    "name": "Team Warriors",
    "tournament": {
      "id": "tournament-uuid",
      "name": "Summer Championship"
    }
  }
}
```

### Decline Team Invitation

Decline an invitation to join a tournament team.

**Endpoint:** `POST /api/tournaments/invitations/:inviteToken/decline`

**Authorization:** Authenticated user (email must match invitation)

**Response:** `200 OK`
```json
{
  "message": "Invitation declined"
}
```

### Cancel Team Invitation

Cancel a pending invitation (captain/organizer only).

**Endpoint:** `DELETE /api/tournaments/:id/teams/:teamId/invitations/:invitationId`

**Authorization:** Team captain or tournament organizer

**Response:** `200 OK`
```json
{
  "message": "Invitation cancelled successfully"
}
```

## Email Template

When an invitation is sent, the invitee receives an email with:

- **Subject:** "You're invited to join [Team Name] in [Tournament Name]"
- **Content:**
  - Greeting with invitee's name
  - Inviter's name and team details
  - Tournament information
  - Personal message (if provided)
  - Instructions to create account and accept
  - Direct link to accept invitation
  - Expiration notice (7 days)

## Invitation Status Flow

```
pending → accepted   (user accepts invitation)
        → declined   (user declines invitation)
        → expired    (7 days pass without action)
        → cancelled  (captain cancels invitation)
```

## Security Features

1. **Unique Tokens**: Each invitation has a cryptographically secure token
2. **Email Verification**: User's email must match the invitation
3. **Authorization Checks**: Only captains and organizers can send invitations
4. **Expiration**: Invitations automatically expire after 7 days
5. **Duplicate Prevention**: Can't send multiple pending invitations to same email
6. **Player Verification**: Checks if user is already on the team

## Error Handling

### Common Error Responses

**400 Bad Request - Invalid Email Format**
```json
{
  "error": "Invalid email format"
}
```

**400 Bad Request - Duplicate Invitation**
```json
{
  "error": "An invitation has already been sent to this email"
}
```

**400 Bad Request - Already a Player**
```json
{
  "error": "This user is already a player on this team"
}
```

**400 Bad Request - Expired Invitation**
```json
{
  "error": "Invitation has expired"
}
```

**400 Bad Request - Wrong Email**
```json
{
  "error": "This invitation is for a different email address"
}
```

**403 Forbidden - Not Authorized**
```json
{
  "error": "Only the organizer or team captain can send invitations"
}
```

**404 Not Found - Invalid Token**
```json
{
  "error": "Invitation not found"
}
```

## Database Schema

### TournamentTeamInvitation Model

```prisma
enum InvitationStatus {
  pending
  accepted
  declined
  expired
  cancelled
}

model TournamentTeamInvitation {
  id            String           @id @default(uuid())
  teamId        String
  team          TournamentTeam   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  inviteeEmail  String
  inviteeName   String?
  inviteeUserId String?
  inviteeUser   User?            @relation("TeamInvitations", fields: [inviteeUserId], references: [id], onDelete: SetNull)
  inviterId     String
  inviter       User             @relation("SentTeamInvitations", fields: [inviterId], references: [id])
  inviteToken   String           @unique
  status        InvitationStatus @default(pending)
  message       String?
  expiresAt     DateTime
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  
  @@index([teamId])
  @@index([inviteeEmail])
  @@index([inviteeUserId])
  @@index([inviteToken])
  @@index([status])
  @@index([expiresAt])
  @@index([teamId, inviteeEmail, status]) // Composite index for efficient duplicate checking
}
```

## Migration

To apply the database changes:

```bash
npx prisma migrate dev
```

This will create the `TournamentTeamInvitation` table and add necessary relations.

## TypeScript Types

```typescript
export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export interface TournamentTeamInvitation {
  id: string;
  teamId: string;
  inviteeEmail: string;
  inviteeName?: string;
  inviteeUserId?: string;
  inviterId: string;
  inviteToken: string;
  status: InvitationStatus;
  message?: string;
  expiresAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  team?: TournamentTeam;
  inviter?: {
    id: string;
    name: string;
    email: string;
  };
  inviteeUser?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface SendTeamInvitationDto {
  inviteeEmail: string;
  inviteeName?: string;
  message?: string;
}

export interface AcceptTeamInvitationDto {
  inviteToken: string;
}
```

## Best Practices

1. **Always Validate Emails**: Use proper email validation before sending invitations
2. **Clear Communication**: Include helpful messages in invitation emails
3. **Monitor Expiration**: Regularly clean up expired invitations
4. **Handle Duplicates**: Check for existing players before sending invitations
5. **Provide Feedback**: Show clear status updates in the UI

## Frontend Integration

### Example Usage in React

```typescript
// Send invitation
const sendInvitation = async (teamId: string, email: string, name?: string, message?: string) => {
  try {
    const response = await fetch(
      `/api/tournaments/${tournamentId}/teams/${teamId}/invitations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          inviteeEmail: email,
          inviteeName: name,
          message
        })
      }
    );
    
    if (!response.ok) throw new Error('Failed to send invitation');
    
    const invitation = await response.json();
    console.log('Invitation sent:', invitation);
  } catch (error) {
    console.error('Error sending invitation:', error);
  }
};

// Accept invitation
const acceptInvitation = async (inviteToken: string) => {
  try {
    const response = await fetch(
      `/api/tournaments/invitations/${inviteToken}/accept`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!response.ok) throw new Error('Failed to accept invitation');
    
    const result = await response.json();
    console.log('Invitation accepted:', result);
  } catch (error) {
    console.error('Error accepting invitation:', error);
  }
};

// Get user's pending invitations
const getMyInvitations = async () => {
  try {
    const response = await fetch('/api/tournaments/invitations/my', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) throw new Error('Failed to fetch invitations');
    
    const invitations = await response.json();
    return invitations;
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return [];
  }
};
```

## Maintenance

### Cleanup Expired Invitations

A background job should periodically run to mark expired invitations:

```typescript
import { expireOldInvitations } from '../services/tournamentService';

// Run this periodically (e.g., daily)
async function cleanupExpiredInvitations() {
  try {
    const result = await expireOldInvitations();
    console.log(`Expired ${result.count} old invitations`);
  } catch (error) {
    console.error('Error expiring invitations:', error);
  }
}
```

## Troubleshooting

### Invitation Email Not Received

1. Check spam/junk folder
2. Verify email configuration in `.env`
3. Check server logs for email sending errors
4. Ensure SMTP settings are correct

### Can't Accept Invitation

1. Verify user is logged in
2. Check email matches invitation
3. Ensure invitation hasn't expired
4. Verify invitation status is 'pending'

### Already a Player Error

1. Check if user is already on the team
2. Remove player and resend invitation
3. Or user can join directly without invitation

## Future Enhancements

1. **Bulk Invitations**: Send invitations to multiple emails at once
2. **Invitation Templates**: Save and reuse invitation messages
3. **Reminder Emails**: Send reminders for pending invitations
4. **Player Limits**: Restrict number of players per team
5. **Social Sharing**: Share invitation links on social media
6. **Team Roles**: Assign specific roles to invited players
