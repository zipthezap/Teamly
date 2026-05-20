# Tournament API Documentation

This document describes the Tournament hosting API endpoints available in Teamly.

## Base URL

All tournament endpoints are prefixed with `/api/tournaments`

## Authentication

All tournament endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Create Tournament

Create a new tournament.

**Endpoint:** `POST /api/tournaments`

**Request Body:**
```json
{
  "name": "Summer Football Tournament",
  "description": "Annual summer tournament for football enthusiasts",
  "sportType": "football",
  "format": "single_elimination",
  "startDate": "2024-07-01T10:00:00Z",
  "endDate": "2024-07-03T18:00:00Z",
  "maxTeams": 16,
  "location": "City Sports Complex",
  "locationName": "Main Stadium",
  "city": "San Francisco",
  "country": "USA",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "groupId": "optional-group-id"
}
```

**Format Options:**
- `single_elimination` - Standard knockout tournament
- `double_elimination` - Teams get two chances
- `round_robin` - Every team plays every other team
- `groups_knockout` - Group stage followed by knockout rounds

**Response:** `201 Created`
```json
{
  "id": "tournament-uuid",
  "name": "Summer Football Tournament",
  "status": "draft",
  "organizerId": "user-uuid",
  "organizer": {
    "id": "user-uuid",
    "name": "John Doe",
    "email": "john@example.com"
  },
  ...
}
```

### 2. Get Tournaments

Retrieve all tournaments (with optional filters).

**Endpoint:** `GET /api/tournaments`

**Query Parameters:**
- `groupId` (optional) - Filter by group
- `status` (optional) - Filter by status (draft, registration, in_progress, completed, cancelled)
- `sportType` (optional) - Filter by sport type

**Example:** `GET /api/tournaments?status=in_progress&sportType=football`

**Response:** `200 OK`
```json
[
  {
    "id": "tournament-uuid",
    "name": "Summer Football Tournament",
    "status": "in_progress",
    "startDate": "2024-07-01T10:00:00Z",
    "sportType": "football",
    "format": "single_elimination",
    "_count": {
      "teams": 16,
      "matches": 15
    },
    ...
  }
]
```

### 3. Get Tournament Details

Retrieve detailed information about a specific tournament.

**Endpoint:** `GET /api/tournaments/:id`

**Response:** `200 OK`
```json
{
  "id": "tournament-uuid",
  "name": "Summer Football Tournament",
  "description": "Annual summer tournament",
  "status": "in_progress",
  "format": "single_elimination",
  "teams": [
    {
      "id": "team-uuid",
      "name": "Team Alpha",
      "captainName": "Jane Smith",
      "captainEmail": "jane@example.com",
      "captainUserId": "user-uuid"
    }
  ],
  "matches": [
    {
      "id": "match-uuid",
      "homeTeamId": "team1-uuid",
      "awayTeamId": "team2-uuid",
      "homeScore": 3,
      "awayScore": 2,
      "stage": "quarter_finals",
      "status": "completed",
      "homeTeam": { ... },
      "awayTeam": { ... }
    }
  ],
  "standings": [
    {
      "id": "standing-uuid",
      "teamId": "team-uuid",
      "points": 9,
      "wins": 3,
      "draws": 0,
      "losses": 0,
      "goalsFor": 12,
      "goalsAgainst": 4,
      "team": { ... }
    }
  ]
}
```

### 4. Update Tournament

Update tournament details (organizer only).

**Endpoint:** `PUT /api/tournaments/:id`

**Request Body:**
```json
{
  "name": "Updated Tournament Name",
  "description": "Updated description",
  "status": "registration",
  "startDate": "2024-07-01T10:00:00Z",
  "maxTeams": 20
}
```

**Response:** `200 OK` (Updated tournament object)

### 5. Delete Tournament

Delete a tournament (organizer only).

**Endpoint:** `DELETE /api/tournaments/:id`

**Response:** `200 OK`
```json
{
  "message": "Tournament deleted successfully"
}
```

### 6. Add Team

Add a team to the tournament.

**Endpoint:** `POST /api/tournaments/:id/teams`

**Request Body:**
```json
{
  "name": "Team Alpha",
  "captainName": "Jane Smith",
  "captainEmail": "jane@example.com",
  "captainUserId": "user-uuid"
}
```

**Response:** `201 Created`
```json
{
  "id": "team-uuid",
  "name": "Team Alpha",
  "captainName": "Jane Smith",
  "captainEmail": "jane@example.com",
  "captainUserId": "user-uuid",
  "tournamentId": "tournament-uuid"
}
```

### 7. Update Team

Update team information (organizer or team captain).

**Endpoint:** `PUT /api/tournaments/:id/teams/:teamId`

**Request Body:**
```json
{
  "name": "Team Alpha Updated",
  "captainName": "Jane Doe",
  "captainEmail": "jane.doe@example.com"
}
```

**Response:** `200 OK` (Updated team object)

### 8. Delete Team

Remove a team from the tournament (organizer only, only before tournament starts).

**Endpoint:** `DELETE /api/tournaments/:id/teams/:teamId`

**Response:** `200 OK`
```json
{
  "message": "Team deleted successfully"
}
```

### 9. Generate Brackets

Generate tournament brackets and matches (organizer only).

**Endpoint:** `POST /api/tournaments/:id/generate-brackets`

**Request Body (optional):**
```json
{
  "numberOfGroups": 4
}
```

### Operations & Commerce Extensions

#### Waiver Acceptance
- `PUT /api/tournaments/:id/teams/:teamId/waiver`
- Body: `{ "accepted": true }`
- Used to store team waiver acceptance (`waiverAcceptedAt`, `waiverAcceptedByUserId`).

#### Payment Intents & Transaction Lifecycle
- `POST /api/tournaments/:id/teams/:teamId/payments/intent`
- `GET /api/tournaments/:id/teams/:teamId/payments`
- `PUT /api/tournaments/:id/payments/:paymentId/status`

Transaction statuses: `initiated`, `pending`, `paid`, `failed`, `refunded`, `cancelled`.

#### Venue/Court Scheduling
- `GET /api/tournaments/:id/courts`
- `POST /api/tournaments/:id/courts`
- `POST /api/tournaments/:id/courts/:courtId/availability`
- `PUT /api/tournaments/:id/matches/:matchId/schedule`

Scheduling endpoint enforces court conflict checks against existing scheduled matches.

Note: `numberOfGroups` is only used for `groups_knockout` format.

**Response:** `200 OK`
```json
{
  "message": "Brackets generated successfully",
  "matchesCreated": 15
}
```

**Important:** This action cannot be undone. Once brackets are generated, the tournament status changes to `in_progress`.

### 10. Submit Match Score

Submit or update the score for a match (organizer or team captains).

**Endpoint:** `POST /api/tournaments/:id/matches/:matchId/score`

**Request Body:**
```json
{
  "homeScore": 3,
  "awayScore": 2
}
```

**Response:** `200 OK`
```json
{
  "id": "match-uuid",
  "homeTeamId": "team1-uuid",
  "awayTeamId": "team2-uuid",
  "homeScore": 3,
  "awayScore": 2,
  "status": "completed",
  "completedAt": "2024-07-01T15:30:00Z",
  "homeTeam": { ... },
  "awayTeam": { ... }
}
```

**Side Effects:**
- Match status changes to `completed`
- Tournament standings are automatically updated
- For knockout tournaments, winners automatically advance to the next round

### 11. Get Standings

Retrieve tournament standings/leaderboard.

**Endpoint:** `GET /api/tournaments/:id/standings`

**Query Parameters:**
- `groupName` (optional) - Filter standings by group (for group stage tournaments)

**Example:** `GET /api/tournaments/:id/standings?groupName=A`

**Response:** `200 OK`
```json
[
  {
    "id": "standing-uuid",
    "teamId": "team-uuid",
    "points": 9,
    "wins": 3,
    "draws": 0,
    "losses": 0,
    "goalsFor": 12,
    "goalsAgainst": 4,
    "groupName": "A",
    "team": {
      "id": "team-uuid",
      "name": "Team Alpha"
    }
  }
]
```

## Tournament Status Flow

1. **draft** - Initial state, teams can be added
2. **registration** - Teams can still be added
3. **in_progress** - Brackets generated, matches being played
4. **completed** - All matches finished
5. **cancelled** - Tournament cancelled

### Lifecycle Contract (System-Managed)

- Tournament status is **not manually writable** through API or mobile app.
- `PUT /api/tournaments/:id/status` is removed.
- `PUT /api/tournaments/:id` rejects `status` in request body.
- Status transitions are computed automatically from:
  - date windows (`draft` → `registration` → `in_progress`)
  - match completion state (`in_progress` → `completed` when all matches are completed)
  - lifecycle-changing actions (bracket generation, score submission, match create/update/delete, registration window updates)

## Match Status

- **scheduled** - Match scheduled but not started
- **in_progress** - Match currently being played
- **completed** - Match finished with final score
- **cancelled** - Match cancelled

## Bracket Stages

For knockout tournaments:
- `round_of_32` - 32 teams
- `round_of_16` - 16 teams
- `quarter_finals` - 8 teams
- `semi_finals` - 4 teams
- `third_place` - Consolation match
- `finals` - Championship match

For group stages:
- `group_stage` - Round-robin within groups

## Permissions

- **Tournament Organizer**: Can do everything (create, update, delete tournament, add/remove teams, generate brackets, submit scores)
- **Team Captain**: Can update their team information and submit scores for their matches
- **Other Users**: Can view tournament details, teams, matches, and standings

## Error Responses

All endpoints may return the following error responses:

**400 Bad Request**
```json
{
  "error": "Error message describing what went wrong"
}
```

**401 Unauthorized**
```json
{
  "error": "Authentication required"
}
```

**403 Forbidden**
```json
{
  "error": "Only the organizer can perform this action"
}
```

**404 Not Found**
```json
{
  "error": "Tournament not found"
}
```

**500 Internal Server Error**
```json
{
  "error": "Failed to process request"
}
```

## Example Workflow

1. **Create Tournament**
   ```
   POST /api/tournaments
   ```

2. **Add Teams**
   ```
   POST /api/tournaments/:id/teams (multiple times)
   ```

3. **Generate Brackets**
   ```
   POST /api/tournaments/:id/generate-brackets
   ```

4. **Submit Match Scores**
   ```
   POST /api/tournaments/:id/matches/:matchId/score (for each match)
   ```

5. **View Standings**
   ```
   GET /api/tournaments/:id/standings
   ```

6. **Complete Tournament**
   - After all matches are played, update tournament status to `completed`
   ```
   PUT /api/tournaments/:id
   { "status": "completed" }
   ```

## Team Invitations

The Tournament Team Invitations feature allows team captains to invite players to join their tournament teams. See [TOURNAMENT_TEAM_INVITATIONS.md](guides/TOURNAMENT_TEAM_INVITATIONS.md) for detailed documentation.

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

**Response:** `201 Created` - Returns the created invitation object

### Get Team Invitations

View all invitations for a specific team.

**Endpoint:** `GET /api/tournaments/:id/teams/:teamId/invitations`

**Authorization:** Team captain or tournament organizer

**Response:** `200 OK` - Returns array of invitation objects

### Get User's Pending Invitations

View all pending invitations for the logged-in user.

**Endpoint:** `GET /api/tournaments/invitations/my`

**Authorization:** Authenticated user

**Response:** `200 OK` - Returns array of pending invitations

### Accept Team Invitation

Accept an invitation to join a tournament team.

**Endpoint:** `POST /api/tournaments/invitations/:inviteToken/accept`

**Authorization:** Authenticated user (email must match invitation)

**Response:** `200 OK`
```json
{
  "message": "Invitation accepted successfully",
  "team": { ... }
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

## Invitation Status

Invitations can have one of the following statuses:
- `pending` - Awaiting response from invitee
- `accepted` - Invitee has accepted and joined the team
- `declined` - Invitee has declined the invitation
- `expired` - Invitation expired after 7 days
- `cancelled` - Captain/organizer cancelled the invitation

---

## Phase 3: Game-Day Operations

### Generate QR Check-In Token

Generates a unique token for a team that can be encoded into a QR code for day-of check-in scanning.

**Endpoint:** `POST /api/tournaments/:id/teams/:teamId/check-in/token`

**Authorization:** Organizer, admin, or team captain

**Response:** `200 OK` – `{ id, name, checkInToken }`

---

### Check In via QR Token

Checks in a team by verifying their QR token. No authentication required.

**Endpoint:** `POST /api/tournaments/:id/check-in/qr`

**Body:** `{ "token": "<qr_token>" }`

**Response:** `200 OK` – `{ id, name, checkedIn, checkedInAt }`

---

### Assign Scorekeeper

Assigns an individual user as the live scorekeeper for a match.

**Endpoint:** `PUT /api/tournaments/:id/matches/:matchId/scorekeeper`

**Authorization:** Organizer or admin

**Body:** `{ "scorekeeperUserId": "<userId>" }` (set to `null` to remove)

**Response:** `200 OK` – Updated match with scorekeeper details

---

### Start Match

Marks a match as `in_progress` and records the actual start time.

**Endpoint:** `PUT /api/tournaments/:id/matches/:matchId/start`

**Authorization:** Organizer, admin, or assigned scorekeeper

**Response:** `200 OK` – Updated match

---

### Get Match Incidents

Returns all incidents reported for a match, ordered newest first.

**Endpoint:** `GET /api/tournaments/:id/matches/:matchId/incidents`

**Response:** `200 OK` – Array of incidents with resolver info

---

### Report Match Incident

Reports a game-day incident with an SLA deadline for resolution.

**Endpoint:** `POST /api/tournaments/:id/matches/:matchId/incidents`

**Authorization:** Organizer, admin, or assigned scorekeeper

**Body:**
```json
{
  "incidentType": "late_start | injury | dispute | technical | other",
  "description": "Player dispute over out-of-bounds call",
  "slaMinutes": 15
}
```

`slaMinutes` defaults to 30 if omitted.

**Response:** `201 Created` – Created incident

---

### Resolve Match Incident

Resolves or dismisses an open incident.

**Endpoint:** `PUT /api/tournaments/:id/incidents/:incidentId/resolve`

**Authorization:** Organizer or admin

**Body:**
```json
{
  "status": "resolved | dismissed",
  "resolution": "Optional explanation"
}
```

**Response:** `200 OK` – Updated incident

---

## Phase 4: Public Tournament Portal

### Generate Share Token

Generates a public share token for a tournament. The token can be used to build a shareable or embeddable URL.

**Endpoint:** `POST /api/tournaments/:id/share-token`

**Authorization:** Organizer or admin

**Response:** `200 OK` – `{ id, name, shareToken }`

---

### Public Tournament Portal

Returns the full bracket, standings, teams, courts, and pinned announcements for embedding or public viewing. No authentication required.

**Endpoint:** `GET /api/tournaments/portal/:shareToken`

**Notes:**
- `:shareToken` can be the opaque token (from `POST /share-token`) or the tournament ID (for public tournaments).
- Only works for tournaments with `isPublic: true`.

**Response:** `200 OK`
```json
{
  "tournament": { ... },
  "teams": [ { "id": "...", "name": "...", "checkedIn": true, "paymentStatus": "paid" } ],
  "matches": [ ... ],
  "standings": [ ... ],
  "courts": [ ... ],
  "announcements": [ ... ]
}
```

---

## Phase 5: Organizer Analytics Dashboard

### Get Tournament Analytics

Returns an analytics snapshot for the organizer dashboard.

**Endpoint:** `GET /api/tournaments/:id/analytics`

**Authorization:** Organizer or admin

**Response:** `200 OK`
```json
{
  "registration": {
    "totalTeams": 16,
    "checkedIn": 14,
    "noShows": 2,
    "paid": 14,
    "unpaid": 1,
    "pending": 1,
    "waived": 0,
    "waiverAccepted": 15
  },
  "matches": {
    "total": 15,
    "scheduled": 3,
    "inProgress": 1,
    "completed": 10,
    "cancelled": 1,
    "lateStarts": 2,
    "avgDurationMinutes": 47
  },
  "disputes": {
    "total": 2,
    "open": 0,
    "resolved": 2,
    "dismissed": 0
  },
  "incidents": {
    "total": 3,
    "open": 1,
    "resolved": 2,
    "pastSla": 0
  },
  "payments": {
    "totalRevenue": 2100.00,
    "transactionsPaid": 14,
    "transactionsRefunded": 0
  }
}
```
