# Manual Tournament Bracket Management API

This document describes the API endpoints for manual tournament bracket and pool management.

## Overview

Tournament administrators can now have full control over tournament brackets, pools, and match schedules. This includes:
- Creating custom pools and assigning teams
- Manually creating, editing, and deleting matches
- Assigning referee teams to matches
- Full control over match scheduling and bracket stages

## Prerequisites

- All endpoints require authentication (Bearer token)
- All endpoints require the user to be the tournament organizer
- Tournament must have `useManualBrackets` enabled for manual management

## API Endpoints

### Enable/Disable Manual Bracket Management

**Update Tournament**
```
PUT /api/tournaments/:id
```

Request Body:
```json
{
  "useManualBrackets": true
}
```

Response: Updated tournament object

---

### Pool Management

#### Assign Team to Pool

Assign a team to a specific pool for group stage play.

```
PUT /api/tournaments/:id/teams/:teamId/pool
```

Request Body:
```json
{
  "poolNumber": 1,
  "poolName": "Pool A"
}
```

**Parameters:**
- `poolNumber` (optional): Numeric pool identifier (1, 2, 3, etc.)
- `poolName` (optional): Human-readable pool name (e.g., "Pool A", "Group 1")

**Response:** Updated team object with pool assignments

**Notes:**
- Both fields are optional
- Leave both empty to remove pool assignment
- Teams in the same pool can be used for group stage match generation

---

### Manual Match Management

#### Create Match

Create a custom match between two teams.

```
POST /api/tournaments/:id/matches
```

Request Body:
```json
{
  "homeTeamId": "team-uuid-1",
  "awayTeamId": "team-uuid-2",
  "refereeTeamId": "team-uuid-3",
  "stage": "quarter_finals",
  "groupName": "A",
  "scheduledAt": "2024-06-15T14:00:00Z",
  "matchOrder": 1
}
```

**Parameters:**
- `homeTeamId` (required): ID of the home team
- `awayTeamId` (required): ID of the away team
- `refereeTeamId` (optional): ID of the team assigned to referee this match
- `stage` (optional): Bracket stage - one of:
  - `group_stage`
  - `round_of_32`
  - `round_of_16`
  - `quarter_finals`
  - `semi_finals`
  - `third_place`
  - `finals`
- `groupName` (optional): Group/pool identifier for group stage matches
- `scheduledAt` (optional): ISO 8601 datetime for match schedule
- `matchOrder` (optional): Custom ordering for display

**Response:** Created match object

**Validation:**
- Home and away teams must be different
- Both teams must belong to the tournament
- Referee team (if provided) must not be one of the playing teams
- Referee team must belong to the tournament

---

#### Update Match

Update an existing match's details.

```
PUT /api/tournaments/:id/matches/:matchId
```

Request Body: Same as Create Match (all fields optional)

**Response:** Updated match object

**Notes:**
- Can update teams, stage, schedule, and other match details
- Cannot update matches that have completed with scores
- Same validation rules as Create Match apply

---

#### Delete Match

Delete a match from the tournament.

```
DELETE /api/tournaments/:id/matches/:matchId
```

**Response:**
```json
{
  "message": "Match deleted successfully"
}
```

**Restrictions:**
- Cannot delete completed matches with scores
- Must remove scores first if needed

---

#### Assign Referee

Assign or remove a referee team for a match.

```
PUT /api/tournaments/:id/matches/:matchId/referee
```

Request Body:
```json
{
  "refereeTeamId": "team-uuid" // or null to remove referee
}
```

**Response:** Updated match object with referee assignment

**Use Case:**
When a team is not playing in a particular round, they can be assigned to referee another match. This is useful for:
- Tournament fairness and impartiality
- Keeping teams engaged during breaks
- Rotating referee duties among all teams

**Validation:**
- Referee team cannot be one of the playing teams in that match
- Referee team must belong to the tournament

---

### Example Workflows

#### Workflow 1: Manual Pool Setup

1. Enable manual brackets:
```bash
curl -X PUT /api/tournaments/{id} \
  -H "Authorization: Bearer {token}" \
  -d '{"useManualBrackets": true}'
```

2. Add teams to the tournament (standard team creation)

3. Assign teams to pools:
```bash
# Pool A
curl -X PUT /api/tournaments/{id}/teams/{team1}/pool \
  -H "Authorization: Bearer {token}" \
  -d '{"poolNumber": 1, "poolName": "Pool A"}'

curl -X PUT /api/tournaments/{id}/teams/{team2}/pool \
  -H "Authorization: Bearer {token}" \
  -d '{"poolNumber": 1, "poolName": "Pool A"}'

# Pool B
curl -X PUT /api/tournaments/{id}/teams/{team3}/pool \
  -H "Authorization: Bearer {token}" \
  -d '{"poolNumber": 2, "poolName": "Pool B"}'
```

#### Workflow 2: Manual Bracket Creation

1. Create quarter final matches:
```bash
curl -X POST /api/tournaments/{id}/matches \
  -H "Authorization: Bearer {token}" \
  -d '{
    "homeTeamId": "team1",
    "awayTeamId": "team2",
    "stage": "quarter_finals",
    "scheduledAt": "2024-06-15T14:00:00Z"
  }'
```

2. Assign referee team:
```bash
curl -X PUT /api/tournaments/{id}/matches/{matchId}/referee \
  -H "Authorization: Bearer {token}" \
  -d '{"refereeTeamId": "team3"}'
```

#### Workflow 3: Dynamic Match Management

1. Create a match between specific teams
2. Submit score when match is played
3. If needed, edit the match to change teams or schedule
4. Create next round matches based on results

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Home and away teams must be different"
}
```

### 403 Forbidden
```json
{
  "error": "Only the organizer can create matches"
}
```

### 404 Not Found
```json
{
  "error": "Tournament not found"
}
```

---

## Frontend Integration

The frontend provides:
- **Toggle Switch**: Enable/disable manual bracket management in tournament settings
- **Pool Manager**: Visual interface to assign teams to pools
- **Bracket Manager**: Interface to create, edit, and delete matches
- **Referee Assignment**: Dropdown to assign available teams as referees

See the TournamentDetails page components:
- `ManualBracketManager.tsx`
- `PoolManager.tsx`

---

## Best Practices

1. **Pool Assignment**
   - Assign teams to pools before creating matches
   - Use consistent pool naming (Pool A, Pool B, etc.)
   - Ensure balanced pool sizes

2. **Match Creation**
   - Set logical match orders for better display
   - Schedule matches with adequate time between them
   - Assign stages appropriately for bracket visualization

3. **Referee Assignment**
   - Rotate referee duties fairly among teams
   - Assign teams that are on break to referee
   - Don't assign playing teams as referees for their own matches

4. **Match Management**
   - Don't delete matches that have been played
   - Update match details before matches are completed
   - Keep match schedules realistic and achievable

---

## Migration from Auto-Generated Brackets

To migrate an existing tournament from auto-generated to manual brackets:

1. Enable manual brackets: `PUT /tournaments/:id` with `{"useManualBrackets": true}`
2. Existing matches remain but can now be edited
3. New matches can be created manually
4. Pool assignments can be added to existing teams

**Note:** You cannot switch back to auto-generated brackets after enabling manual management without deleting existing matches.
