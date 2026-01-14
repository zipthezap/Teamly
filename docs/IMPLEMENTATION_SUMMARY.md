# Implementation Summary: Sport-Specific Tournament Scoring Configurations

## Overview
This implementation adds sport-specific scoring configurations to tournaments, allowing tournament organizers to define custom rules for different sports. The initial implementation supports volleyball with full set-based scoring validation.

## Problem Statement
> "Each tournament sport type will be slightly different on how the wins will be evaluated. For instance, volleyball is played with 2 sets of 25 points and 15 points if it's 1-1."

## Solution
A flexible configuration system that allows tournament organizers to:
1. Choose whether to use sport-specific scoring rules
2. Configure sport-specific parameters (e.g., set points, best-of-sets for volleyball)
3. Submit detailed scores that are validated against the configured rules
4. Have standings automatically calculated based on sport-specific logic

## Implementation Details

### 1. Database Changes
- Added `sportConfig` JSON field to the `Tournament` table
- Created migration: `20260114135732_add_sport_config_to_tournament`
- Supports storing any sport configuration as JSON

### 2. Type System
**New Types:**
- `SportScoringConfig` - Union type of all sport configs
- `VolleyballConfig` - Configuration for volleyball scoring
- `TennisConfig` - Placeholder for future tennis support
- `DefaultScoringConfig` - Standard win/draw/loss points

**Updated Types:**
- `Tournament` - Added `sportConfig` field
- `CreateTournamentDto` - Added `sportConfig` field
- `UpdateTournamentDto` - Added `sportConfig` field
- `SubmitScoreDto` - Added `detailedScore` field for set/period scores

### 3. Backend Logic

#### Volleyball Validation (`calculateVolleyballWinner`)
Validates:
- Each set has a winner (no ties)
- Winning team reached required points (25 for regular, 15 for deciding set)
- Winner won by minimum point difference (typically 2)
- Final score matches number of sets won
- Deciding set rules apply when teams are tied

#### Standings Update (`updateStandings`)
- Uses sport-specific point configurations for standings
- Falls back to default scoring (3-1-0 for win-draw-loss) if no config
- Properly handles custom point systems

#### Score Submission
- Validates detailed scores against sport configuration
- Ensures consistency between overall score and detailed score
- Returns clear error messages for validation failures

### 4. Frontend Changes
**CreateTournament Form:**
- New accordion section: "Sport-Specific Scoring Configuration"
- Checkbox to enable/disable sport-specific rules
- Dynamic fields based on selected sport type
- Pre-filled default values based on standard rules
- Helpful tooltips and validation

**Volleyball Configuration Fields:**
- Regular Set Points (default: 25)
- Deciding Set Points (default: 15)
- Best of Sets (default: 3)
- Minimum Point Difference (default: 2)

### 5. API Examples

**Creating a Tournament:**
```bash
POST /api/tournaments
Content-Type: application/json

{
  "name": "Summer Volleyball Championship",
  "sportType": "volleyball",
  "format": "round_robin",
  "startDate": "2024-06-01T10:00:00Z",
  "sportConfig": {
    "type": "volleyball",
    "regularSetPoints": 25,
    "decidingSetPoints": 15,
    "bestOfSets": 3,
    "minimumPointDifference": 2
  }
}
```

**Submitting Match Score:**
```bash
POST /api/tournaments/{tournamentId}/matches/{matchId}/score
Content-Type: application/json

{
  "homeScore": 2,
  "awayScore": 1,
  "detailedScore": {
    "sets": [
      { "home": 25, "away": 23 },
      { "home": 23, "away": 25 },
      { "home": 15, "away": 13 }
    ]
  }
}
```

## Validation Examples

### Valid Volleyball Score
```json
{
  "homeScore": 2,
  "awayScore": 0,
  "detailedScore": {
    "sets": [
      { "home": 25, "away": 20 },
      { "home": 25, "away": 23 }
    ]
  }
}
```
✅ Valid: Home team won both sets with required points and minimum difference

### Invalid: Insufficient Point Difference
```json
{
  "detailedScore": {
    "sets": [
      { "home": 25, "away": 24 }
    ]
  }
}
```
❌ Error: "Set 1: Must win by at least 2 points"

### Invalid: Score Mismatch
```json
{
  "homeScore": 3,
  "awayScore": 0,
  "detailedScore": {
    "sets": [
      { "home": 25, "away": 20 },
      { "home": 25, "away": 23 }
    ]
  }
}
```
❌ Error: "Score mismatch: Based on sets, score should be 2-0"

## Testing Recommendations

### Manual Testing Checklist
1. **Create Tournament with Volleyball Config**
   - Verify UI shows volleyball configuration fields
   - Test with different set point values
   - Confirm config is saved to database

2. **Submit Valid Volleyball Scores**
   - Best of 3: 2-0, 2-1
   - Best of 5: 3-0, 3-1, 3-2
   - Verify standings are updated correctly

3. **Test Validation**
   - Submit scores with insufficient point difference
   - Submit scores where set winner didn't reach required points
   - Submit mismatched overall score vs set wins
   - Verify appropriate error messages

4. **Test Default Scoring**
   - Create tournament without sport config
   - Submit simple scores
   - Verify default point system (3-1-0) is used

### Edge Cases
- Deuce scenarios (e.g., 26-24, 27-25)
- Maximum sets (best of 7)
- Tournament update: changing sport config mid-tournament
- Mixed tournaments with some matches having detailed scores

## Future Extensions

### Tennis Support
```typescript
{
  "type": "tennis",
  "bestOfSets": 3,
  "gamesPerSet": 6,
  "tiebreakPoints": 7,
  "decidingSetType": "tiebreak"
}
```

### Ice Hockey Support
```typescript
{
  "type": "iceHockey",
  "periods": 3,
  "periodLength": 20,
  "overtimeType": "sudden_death"
}
```

### Baseball Support
```typescript
{
  "type": "baseball",
  "innings": 9,
  "allowExtraInnings": true
}
```

## Code Quality Metrics

### Type Safety
- ✅ Full TypeScript type coverage
- ✅ No `any` types in final implementation
- ✅ Proper type guards for union types
- ✅ Correct Prisma Json type handling

### Code Review Feedback Addressed
1. ✅ Fixed volleyball set validation logic
2. ✅ Removed unused `TournamentSportConfig` interface
3. ✅ Eliminated all `any` types
4. ✅ Proper type casting for Prisma Json fields

### Build Status
- ✅ TypeScript compilation successful
- ✅ ESLint passing (no new warnings)
- ⚠️ Pre-existing unused variable warnings (unrelated to changes)

## Documentation
- ✅ Comprehensive user documentation (`docs/SPORT_SCORING_CONFIGURATION.md`)
- ✅ API usage examples
- ✅ Validation rules documented
- ✅ Frontend usage instructions
- ✅ Code comments for complex logic

## Migration Path
1. Run Prisma migration to add `sportConfig` field
2. Generate Prisma client: `npm run prisma:generate`
3. Deploy backend changes
4. Deploy frontend changes
5. Existing tournaments continue to work with default scoring
6. New tournaments can opt-in to sport-specific configurations

## Performance Considerations
- JSON field in database is efficient for read/write
- Validation happens only during score submission (not frequent)
- No impact on tournament listing or browsing
- Standings calculation unchanged in complexity

## Security Considerations
- Input validation on all sport config fields
- Type checking prevents invalid configurations
- Detailed score validation prevents cheating
- Organizer-only permission for setting sport configs

## Backward Compatibility
- ✅ Existing tournaments work without modification
- ✅ `sportConfig` is optional in all DTOs
- ✅ Default scoring still supported
- ✅ No breaking changes to existing APIs

## Success Metrics
The implementation successfully addresses the original requirement:
- ✅ Tournament organizers can configure sport-specific rules
- ✅ Volleyball scoring matches FIVB standards (25-25-15 points)
- ✅ Win evaluation is sport-specific
- ✅ Extensible for future sports
- ✅ Easy to use via UI
- ✅ Well-documented and type-safe
