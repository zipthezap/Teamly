# Sports Addition Implementation Summary

## Overview
This document describes the implementation of 10 sports types across the Teamly application, including support for sport-specific scoring mechanisms.

## Sports Added

The following sports have been added to the application with their respective emojis:

1. ⚽ **Soccer (Football)** - `football` (existing, updated with emoji)
2. 🏀 **Basketball** - `basketball` (existing, updated with emoji)
3. 🏏 **Cricket** - `cricket` (NEW)
4. 🏈 **American Football** - `americanFootball` (NEW)
5. 🏒 **Ice Hockey** - `iceHockey` (NEW)
6. ⚾ **Baseball** - `baseball` (NEW)
7. 🏐 **Volleyball** - `volleyball` (existing, updated with emoji)
8. 🏉 **Rugby** - `rugby` (NEW)
9. 🤾 **Handball** - `handball` (NEW)
10. 🏑 **Field Hockey** - `fieldHockey` (NEW)

## Database Changes

### SportType Enum
Updated the `SportType` enum in the Prisma schema to include all new sports:

```prisma
enum SportType {
  football
  basketball
  tennis
  volleyball
  running
  cycling
  swimming
  cricket
  americanFootball
  iceHockey
  baseball
  rugby
  handball
  fieldHockey
  other
}
```

### TournamentMatch Model Enhancement
Added a `detailedScore` JSON field to support sports with set-based or period-based scoring:

```prisma
model TournamentMatch {
  // ... existing fields
  homeScore    Int?
  awayScore    Int?
  
  // NEW: Detailed scoring for sports with sets/periods
  detailedScore Json?
  // ... other fields
}
```

### Migrations
Two migrations were created:
1. `20260112135950_add_new_sports`: Adds new sports to the SportType enum
2. `20260112140357_add_detailed_score`: Adds detailedScore field to TournamentMatch

## Sport-Specific Features

### Set-Based Scoring (Volleyball, Tennis)
The `detailedScore` field supports storing set-by-set scores for sports like volleyball and tennis.

**TypeScript Interface:**
```typescript
interface SetScore {
  home: number;
  away: number;
}

interface DetailedScore {
  sets?: SetScore[];      // For volleyball, tennis
  periods?: SetScore[];   // For ice hockey, American football
  innings?: SetScore[];   // For baseball, cricket
}
```

**Example format:**
```json
{
  "sets": [
    {"home": 25, "away": 23},
    {"home": 23, "away": 25},
    {"home": 15, "away": 12}
  ]
}
```

This allows:
- **Volleyball**: Track individual set scores (typically best of 3 or 5 sets)
- **Tennis**: Track individual set scores and tiebreaks
- **Ice Hockey & American Football**: Track period/quarter scores
- **Baseball & Cricket**: Track inning-by-inning scores

The simple `homeScore` and `awayScore` fields continue to work for final scores or aggregate results, maintaining backward compatibility.

## Frontend Updates

### Translation Files
Both English and French translation files have been updated with:
- Emojis for better visual identification
- Proper localized names for all sports

**English (`en/translation.json`):**
```json
"types": {
  "football": "⚽ Soccer (Football)",
  "basketball": "🏀 Basketball",
  "cricket": "🏏 Cricket",
  "americanFootball": "🏈 American Football",
  "iceHockey": "🏒 Ice Hockey",
  "baseball": "⚾ Baseball",
  "volleyball": "🏐 Volleyball",
  "rugby": "🏉 Rugby",
  "handball": "🤾 Handball",
  "fieldHockey": "🏑 Field Hockey"
}
```

### Component Updates
The following components were updated to include all sports:

1. **TeamUp Components**
   - `NeedPlayersTab.tsx`
   - `BrowseRequestsTab.tsx`
   - `LookingForPlayTab.tsx`
   - `SubmitRequestTab.tsx`

2. **Event Components**
   - `EventRequests.tsx`
   - `EditEvent.tsx`
   - `CreateTournament.tsx`

3. **Dashboard Components**
   - `UpcomingEventsCalendar.tsx` - Updated with color coding for all sports

### Color Scheme
Each sport has been assigned a distinct and unique color in the calendar view:
- **Football**: Green (#4CAF50)
- **Basketball**: Orange (#FF9800)
- **Cricket**: Amber (#FFB300)
- **American Football**: Brown (#795548)
- **Ice Hockey**: Cyan Dark (#00ACC1)
- **Baseball**: Red (#F44336)
- **Volleyball**: Purple (#9C27B0)
- **Rugby**: Light Green (#689F38)
- **Handball**: Pink (#E91E63)
- **Field Hockey**: Teal (#009688)
- **Tennis**: Blue (#2196F3)
- **Running**: Deep Orange (#FF5722)
- **Cycling**: Cyan (#00BCD4)
- **Swimming**: Indigo (#3F51B5)
- **Other**: Blue Grey (#607D8B)

## Usage Across Features

### Regular Events
All sports are available when creating or editing events:
1. Navigate to "Create Event"
2. Select sport type from dropdown
3. Sport-specific emoji and name will display

### TeamUp Requests
All sports are available in TeamUp feature:
1. Create a TeamUp request
2. Select sport type
3. Filter and search by sport type

### Tournaments
All sports are available for tournaments:
1. Create a tournament
2. Select sport type
3. Matches can use simple scores or detailed scores (for set-based sports)

## Backend Support

### Event Service
The event service automatically handles all sport types through the SportType enum validation.

### Tournament Service
The tournament service supports:
- Simple scoring for most sports (homeScore/awayScore)
- Detailed scoring for set-based sports (detailedScore JSON field)

### Validation
All sport types are validated at the database level through the enum constraint, ensuring data integrity.

## Developer Notes

### Adding Future Sports
To add a new sport:
1. Update the `SportType` enum in `prisma/schema.prisma`
2. Create a Prisma migration
3. Update `event.types.ts` with the new sport
4. Add translations in `en/translation.json` and `fr/translation.json`
5. Update hardcoded sport lists in UI components if any
6. Add color mapping in `UpcomingEventsCalendar.tsx`

### Using Detailed Scores
When implementing UI for set-based scoring:
1. Check the tournament's sport type
2. If volleyball, tennis, or other set-based sport, use the `detailedScore` field
3. Parse the DetailedScore object to display individual sets/periods/innings
4. Update `homeScore`/`awayScore` with the total sets/periods/innings won

Example:
```typescript
import { DetailedScore, SetScore } from '@/shared/types/tournament.types';

if (tournament.sportType === 'volleyball') {
  // Show set-by-set input
  const detailedScore: DetailedScore = {
    sets: [
      { home: 25, away: 23 },
      { home: 21, away: 25 },
      { home: 15, away: 12 }
    ]
  };
  // homeScore = 2, awayScore = 1 (sets won)
}
```

## Testing Checklist

- [x] Sports appear in event creation dropdown
- [x] Sports appear in event editing dropdown
- [x] Sports appear in TeamUp request creation
- [x] Sports appear in tournament creation
- [x] Translations display correctly in English
- [x] Translations display correctly in French
- [x] Emojis render properly in all browsers
- [x] Color coding works in calendar view
- [ ] Database migration runs successfully
- [ ] Set-based scoring works for volleyball
- [ ] Set-based scoring works for tennis

## Breaking Changes

None. All changes are backward compatible:
- Existing events, tournaments, and TeamUp requests continue to work
- New `detailedScore` field is optional
- Simple scoring mechanism remains unchanged

## Performance Considerations

- JSON field storage is efficient for PostgreSQL
- Indexes remain optimized for existing queries
- No additional database queries required
- Frontend filtering and sorting work as before

## Future Enhancements

Potential improvements for future releases:
1. UI components for set-by-set score entry
2. Detailed match statistics per sport type
3. Sport-specific rule displays
4. Period/quarter scoring for American Football
5. Innings tracking for Baseball and Cricket
6. Custom scoring templates per sport
