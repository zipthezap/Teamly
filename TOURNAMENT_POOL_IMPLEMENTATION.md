# Tournament Pool Registration and Waitlist Feature

## Overview
This feature allows tournaments to have multiple pools with different team capacities. Team captains can register their teams to any pool, and if a pool is full, teams are automatically added to a waitlist. When a spot opens up, the first team on the waitlist is automatically promoted.

## Database Schema Changes

### New Models

#### TournamentPool
Represents a pool within a tournament (e.g., "Beginners Pool", "Advanced Division")
- `id`: Unique identifier
- `name`: Pool name (must be unique within tournament)
- `description`: Optional pool description
- `maxTeams`: Required - maximum number of teams allowed
- `tournamentId`: Reference to Tournament
- `teams`: Related teams in this pool
- `waitlist`: Related waitlist entries

#### TournamentPoolWaitlist
Represents teams waiting for a spot in a full pool
- `id`: Unique identifier
- `poolId`: Reference to TournamentPool
- `teamId`: Reference to TournamentTeam
- `position`: Position in the waitlist (lower = higher priority)
- Unique constraint on (poolId, teamId) - team can only be on waitlist once per pool

### Updated Models

#### TournamentTeam
Added fields:
- `poolId`: Reference to TournamentPool (nullable)
- `registrationOrder`: Order in which team registered to pool
- `waitlistEntries`: Related waitlist entries

## API Endpoints

### Get All Pools
```
GET /api/tournaments/:id/pools
```
Returns all pools for a tournament with team and waitlist counts.

**Response:**
```json
[
  {
    "id": "pool-id",
    "name": "Pool A - Beginners",
    "description": "For teams new to competitive football",
    "maxTeams": 8,
    "_count": {
      "teams": 7,
      "waitlist": 0
    }
  }
]
```

### Get Pool Details
```
GET /api/tournaments/:id/pools/:poolId
```
Returns detailed pool information including all teams and waitlist.

**Response:**
```json
{
  "id": "pool-id",
  "name": "Pool B - Intermediate",
  "maxTeams": 10,
  "teams": [
    {
      "id": "team-id",
      "name": "Team Name",
      "captainName": "Captain Name",
      "registrationOrder": 1,
      "players": [...]
    }
  ],
  "waitlist": [
    {
      "id": "waitlist-id",
      "position": 1,
      "team": {
        "id": "team-id",
        "name": "Waiting Team",
        "captainName": "Captain"
      }
    }
  ]
}
```

### Create Pool (Organizer Only)
```
POST /api/tournaments/:id/pools
```

**Request Body:**
```json
{
  "name": "Pool C - Advanced",
  "description": "For experienced teams",
  "maxTeams": 6
}
```

**Validation:**
- Pool name must be unique within tournament
- maxTeams must be at least 2

### Register Team to Pool (Captain or Organizer)
```
POST /api/tournaments/:id/pools/:poolId/teams/:teamId
```

**Behavior:**
- If pool has available spots: Team is added to pool
- If pool is full: Team is added to waitlist automatically

**Response (Pool has space):**
```json
{
  "id": "team-id",
  "name": "Team Name",
  "poolId": "pool-id",
  "poolName": "Pool A",
  "registrationOrder": 8
}
```

**Response (Pool is full):**
```json
{
  "message": "Pool is full. Team added to waitlist",
  "waitlist": {
    "id": "waitlist-id",
    "poolId": "pool-id",
    "teamId": "team-id",
    "position": 1
  }
}
```

**Validation:**
- Tournament must be in 'draft' or 'registration' status
- Team must not already be in a pool
- Team must not already be on a waitlist
- User must be team captain or tournament organizer

### Remove Team from Pool (Captain or Organizer)
```
DELETE /api/tournaments/:id/pools/:poolId/teams/:teamId
```

**Behavior:**
1. Team is removed from pool
2. If waitlist exists, first team is automatically promoted
3. Remaining waitlist positions are updated

**Response (No waitlist):**
```json
{
  "message": "Team removed from pool successfully"
}
```

**Response (Waitlist promotion):**
```json
{
  "message": "Team removed from pool and first waitlist team promoted",
  "promotedTeam": {
    "id": "promoted-team-id",
    "name": "Promoted Team Name"
  }
}
```

### Remove Team from Waitlist (Captain or Organizer)
```
DELETE /api/tournaments/:id/pools/:poolId/waitlist/:teamId
```

**Behavior:**
1. Team is removed from waitlist
2. All teams with higher positions are moved up

## Seed Data

The seed file creates comprehensive tournament data:

### Tournament 1: Spring Football Championship
- **Format:** Round Robin
- **Status:** Registration open
- **Pools:** 3 pools with different capacities
  - Pool A - Beginners: 8 max teams, 7 registered, 1 spot available
  - Pool B - Intermediate: 10 max teams, 10 registered (FULL), 2 on waitlist
  - Pool C - Advanced: 6 max teams, 4 registered, 2 spots available

### Tournament 2: Summer Basketball League
- **Format:** Single Elimination
- **Status:** Registration open
- **Pools:** 2 pools
  - Division A: 8 max teams, 5 registered
  - Division B: 8 max teams, 6 registered

### Tournament 3: Fall Tennis Open
- **Format:** Groups + Knockout
- **Status:** Draft
- **Pools:** 4 pools with varying capacities
  - Singles - Men: 8 max teams
  - Singles - Women: 6 max teams
  - Doubles - Mixed: 4 max teams
  - Youth Category: 2 max teams, 2 registered (FULL), 3 on waitlist

## Automatic Waitlist Promotion

When a team is removed from a full pool:
1. The system checks for waitlist entries for that pool
2. The team with position 1 is automatically promoted
3. That team is:
   - Added to the pool
   - Removed from the waitlist
   - Assigned the next available registration order
4. All remaining waitlist entries have their positions decreased by 1

This ensures a seamless experience where teams don't need to manually check and re-register when spots become available.

## Permission Model

### Pool Management (Organizer Only)
- Create pools
- Modify pool settings
- Delete pools

### Team Registration (Captain or Organizer)
- Register team to pool
- Remove team from pool
- Remove team from waitlist

### Team Members (Captain or Organizer)
- Add players to team
- Remove players from team
- Update player information

## Key Features

1. **Flexible Pool Sizes**: Each pool can have a different capacity
2. **Automatic Waitlist**: Teams are automatically added to waitlist when pools are full
3. **Auto-Promotion**: First team on waitlist is automatically moved to pool when a spot opens
4. **Position Management**: Waitlist positions are automatically maintained
5. **Registration Order**: Teams are tracked in the order they registered to pools
6. **Permission Control**: Only captains and organizers can manage team registrations
7. **Validation**: Prevents duplicate registrations and ensures data integrity

## Example Use Cases

### Use Case 1: Skill-Based Divisions
A tournament organizes teams by skill level:
- Beginner Pool: 12 spots
- Intermediate Pool: 10 spots  
- Advanced Pool: 8 spots

Teams can self-select their appropriate skill level.

### Use Case 2: Age Categories
A youth tournament with age-based pools:
- Under 12: 16 spots
- Under 14: 16 spots
- Under 16: 12 spots
- Under 18: 8 spots

### Use Case 3: Geographic Divisions
Regional tournament with location-based pools:
- North Division: 10 spots
- South Division: 10 spots
- East Division: 8 spots
- West Division: 8 spots

## Testing Recommendations

1. Test pool registration when pool has available spots
2. Test automatic waitlist creation when pool is full
3. Test waitlist promotion when team is removed
4. Test multiple teams on waitlist (position management)
5. Test permission controls (captain vs non-captain)
6. Test validation (duplicate registration prevention)
7. Test with pools of different sizes (2, 4, 6, 8, 10+ teams)

## Future Enhancements

Potential improvements for future iterations:
- Pool-specific rules or settings
- Auto-assignment to pools based on criteria
- Waitlist notifications (email/push when promoted)
- Pool capacity warnings (e.g., "Only 2 spots left!")
- Team skill ratings for automatic pool assignment
- Pool merge/split functionality
- Pool-based brackets and standings
