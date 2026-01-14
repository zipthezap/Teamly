# Sport-Specific Scoring Configuration

This document explains how to configure sport-specific scoring rules for tournaments.

## Overview

Tournaments can now be configured with sport-specific scoring rules. This allows tournament organizers to define how winners are determined based on the specific rules of each sport.

## Supported Sports

### Volleyball

Volleyball scoring is based on sets, where each set has specific point requirements.

#### Configuration Options

- **regularSetPoints**: Points needed to win regular sets (typically 25)
- **decidingSetPoints**: Points needed to win the deciding set when teams are tied (typically 15)
- **bestOfSets**: Total number of sets in a match (typically 3 or 5)
- **minimumPointDifference**: Minimum point difference required to win a set (typically 2)

#### Example Configuration

For a best-of-3 volleyball match with standard FIVB rules:

```json
{
  "type": "volleyball",
  "regularSetPoints": 25,
  "decidingSetPoints": 15,
  "bestOfSets": 3,
  "minimumPointDifference": 2
}
```

#### Match Example

A typical match following these rules:
- **Set 1**: Home 25 - 23 Away (Home wins)
- **Set 2**: Home 23 - 25 Away (Away wins)
- **Set 3**: Home 15 - 13 Away (Home wins)
- **Final Score**: Home 2 - 1 Away (Home wins the match)

### Default Scoring

For sports without specific configurations, the default point-based system is used:

```json
{
  "type": "default",
  "winPoints": 3,
  "drawPoints": 1,
  "lossPoints": 0
}
```

## API Usage

### Creating a Tournament with Sport Configuration

**POST** `/api/tournaments`

```json
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

### Submitting Match Scores

When submitting scores for volleyball matches, include both the overall score (sets won) and detailed set scores:

**POST** `/api/tournaments/{tournamentId}/matches/{matchId}/score`

```json
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

## Validation Rules

### Volleyball

1. **Set Scores**: Each set must have a winner (no ties)
2. **Point Requirements**: The winning team must reach at least the required points for that set
3. **Minimum Difference**: The winning team must win by at least the configured minimum point difference
4. **Deciding Set**: If teams are tied 1-1 in sets, the third set uses the decidingSetPoints value
5. **Score Consistency**: The homeScore and awayScore must match the number of sets won by each team

### Validation Error Examples

**Invalid**: Set is tied
```json
{ "home": 25, "away": 25 }  // Error: Sets cannot be tied
```

**Invalid**: Insufficient point difference
```json
{ "home": 25, "away": 24 }  // Error: Must win by at least 2 points
```

**Invalid**: Score mismatch
```json
{
  "homeScore": 3,  // Claims 3 sets won
  "awayScore": 0,
  "detailedScore": {
    "sets": [
      { "home": 25, "away": 23 },  // Only 2 sets provided
      { "home": 25, "away": 20 }
    ]
  }
}
// Error: Score mismatch - Based on sets, score should be 2-0
```

## Frontend Usage

When creating a tournament in the UI:

1. Select the sport type (e.g., "Volleyball")
2. Expand the "Sport-Specific Scoring Configuration" section
3. Enable sport-specific rules by checking the checkbox
4. Configure the scoring parameters for that sport
5. Default values are pre-filled based on standard rules

## Future Extensions

The system is designed to support additional sports in the future:

- **Tennis**: Games, sets, tiebreaks
- **Ice Hockey**: Periods, overtime rules
- **Baseball**: Innings, extra innings

To add a new sport configuration, define a new config type in `tournament.types.ts` and add the validation logic in `tournamentService.ts`.
