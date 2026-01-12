# Tournament Player Registration Feature

## Overview

This feature allows team captains to register players for their tournament teams. Only registered players (along with captains and referees) can submit match scores, ensuring accountability and proper authorization.

## Key Features

1. **Flexible Registration**: Team captains don't need to register all players upfront
2. **Player Management**: Captains can add, update, and remove players at any time
3. **Score Submission Control**: Only authorized users can submit match scores
4. **User Linking**: Players can be linked to registered users or added as guest players

## Database Schema

### TournamentPlayer Model

```prisma
model TournamentPlayer {
  id          String   @id @default(uuid())
  teamId      String
  team        TournamentTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)
  userId      String?
  user        User?    @relation("TournamentPlayer", fields: [userId], references: [id], onDelete: SetNull)
  playerName  String   // Required even if userId is set
  playerEmail String?  // Optional
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([teamId, userId]) // User can only be registered once per team
  @@index([teamId])
  @@index([userId])
}
```

## API Endpoints

### Player Management

#### 1. Add Player to Team
```
POST /api/tournaments/:id/teams/:teamId/players
Authorization: Bearer <token>
Content-Type: application/json

{
  "playerName": "John Doe",
  "playerEmail": "john@example.com",  // optional
  "userId": "user-id"                  // optional - link to registered user
}
```

**Authorization**: Only tournament organizer or team captain

**Response**: 201 Created
```json
{
  "id": "player-id",
  "teamId": "team-id",
  "userId": "user-id",
  "playerName": "John Doe",
  "playerEmail": "john@example.com",
  "createdAt": "2024-01-12T10:00:00Z",
  "updatedAt": "2024-01-12T10:00:00Z",
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### 2. Get Team Players
```
GET /api/tournaments/:id/teams/:teamId/players
Authorization: Bearer <token>
```

**Authorization**: Any authenticated user

**Response**: 200 OK
```json
[
  {
    "id": "player-id",
    "teamId": "team-id",
    "userId": "user-id",
    "playerName": "John Doe",
    "playerEmail": "john@example.com",
    "createdAt": "2024-01-12T10:00:00Z",
    "updatedAt": "2024-01-12T10:00:00Z",
    "user": {
      "id": "user-id",
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
]
```

#### 3. Update Player
```
PUT /api/tournaments/:id/teams/:teamId/players/:playerId
Authorization: Bearer <token>
Content-Type: application/json

{
  "playerName": "John Smith",        // optional
  "playerEmail": "john.smith@example.com",  // optional
  "userId": "new-user-id"            // optional
}
```

**Authorization**: Only tournament organizer or team captain

#### 4. Remove Player
```
DELETE /api/tournaments/:id/teams/:teamId/players/:playerId
Authorization: Bearer <token>
```

**Authorization**: Only tournament organizer or team captain

**Response**: 200 OK
```json
{
  "message": "Player removed successfully"
}
```

## Score Submission Authorization

The `submitScore` endpoint has been updated to check player registration.

### Who Can Submit Scores?

A user can submit a match score if they are:
1. **Tournament Organizer** - Full control over all matches
2. **Team Captain** - For matches involving their team
3. **Registered Player** - On either playing team
4. **Referee Team Member** - Registered player or captain of the referee team

### Updated Endpoint
```
POST /api/tournaments/:id/matches/:matchId/score
Authorization: Bearer <token>
Content-Type: application/json

{
  "homeScore": 3,
  "awayScore": 2
}
```

**Authorization Check Logic**:
```typescript
// Service function: canSubmitScore
1. Check if user is tournament organizer
2. Check if user is captain of home or away team
3. Check if user is registered player on home or away team
4. If referee team assigned, check if user is captain or player on referee team
```

## Usage Flow

### 1. Team Captain Registration Flow
```
1. Captain creates/joins tournament team
   POST /api/tournaments/:id/teams
   {
     "name": "Team Warriors",
     "captainName": "Captain Name",
     "captainUserId": "captain-user-id"
   }

2. Captain adds players (can be done later)
   POST /api/tournaments/:id/teams/:teamId/players
   {
     "playerName": "Player 1"
   }

3. Captain adds more players over time
   POST /api/tournaments/:id/teams/:teamId/players
   {
     "playerName": "Player 2",
     "userId": "player-2-user-id"
   }
```

### 2. Score Submission Flow
```
1. Match is created/scheduled
2. Match is played
3. Registered player (or captain/ref) submits score
   POST /api/tournaments/:id/matches/:matchId/score
   {
     "homeScore": 3,
     "awayScore": 2
   }
   
4. System validates:
   - User is authenticated
   - User is authorized (organizer, captain, or registered player)
   - Scores are valid (non-negative)
   
5. Match is marked as completed
6. Tournament standings are updated
```

## Error Handling

### Common Error Responses

**403 Forbidden - Not Authorized to Add Player**
```json
{
  "error": "Only the organizer or team captain can add players"
}
```

**403 Forbidden - Not Authorized to Submit Score**
```json
{
  "error": "Only the organizer, team captains, registered players, or referee team members can submit scores"
}
```

**400 Bad Request - Duplicate Player**
```json
{
  "error": "This player is already registered on this team"
}
```

**400 Bad Request - User Not Found**
```json
{
  "error": "User not found"
}
```

**404 Not Found - Team Not Found**
```json
{
  "error": "Team not found"
}
```

## Security Considerations

1. **Unique Constraint**: Each user can only be registered once per team (enforced at database level)
2. **Authorization Checks**: All player management operations require proper authorization
3. **Cascade Deletion**: When a team is deleted, all its players are automatically removed
4. **Null Handling**: If a linked user is deleted, the player record remains but userId becomes null

## TypeScript Types

```typescript
export interface TournamentPlayer {
  id: string;
  teamId: string;
  userId?: string;
  playerName: string;
  playerEmail?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AddPlayerDto {
  playerName: string;
  playerEmail?: string;
  userId?: string;
}

export interface UpdatePlayerDto {
  playerName?: string;
  playerEmail?: string;
  userId?: string;
}
```

## Migration

The database migration creates the `TournamentPlayer` table with:
- Foreign key to TournamentTeam (CASCADE delete)
- Foreign key to User (SET NULL on delete)
- Unique constraint on (teamId, userId)
- Indexes on teamId and userId for performance

To apply the migration:
```bash
npx prisma migrate dev
```

## Future Enhancements

1. **Player Statistics**: Track individual player performance
2. **Player Invitations**: Allow players to accept/decline team invitations
3. **Player Verification**: Require players to verify their participation
4. **Position/Role Assignment**: Allow captains to assign positions to players
5. **Availability Tracking**: Track which players are available for specific matches
