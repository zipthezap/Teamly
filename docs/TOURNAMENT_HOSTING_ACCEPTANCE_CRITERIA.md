# Tournament Hosting Acceptance Criteria

This document defines acceptance criteria for:
- Lifecycle seeding scenarios (`groups_knockout`)
- End-to-end tournament hosting flows (pre-game, game-day, post-game)

## Seed Scenarios (Canonical)

All scenarios are seeded via:

```bash
npm run tournaments:seed-lifecycle-scenarios
```

### 1) Registration Open (`registration`)
- Tournament format is `groups_knockout`
- No matches exist yet
- Status resolves to `registration`
- Valid next action: team registration

### 2) Registration Closed (`registration_closed`)
- Tournament format is `groups_knockout`
- Teams are registered
- Registration deadline has passed, start date has not
- Status resolves to `registration_closed`
- Valid next action: generate group matches

### 3) In Progress (`in_progress`) — Group Games Underway
- Group-stage matches exist
- At least one group match is `in_progress`
- Tournament status resolves to `in_progress`
- Valid next actions: start matches, submit scores, report incidents

### 4) Forming Brackets
- All group-stage matches are completed
- No knockout matches exist yet
- Status label in client should show “Forming Brackets” while backend remains active
- Valid next action: generate knockout bracket from standings

### 5) Complete (`completed`)
- Knockout bracket has been generated from standings
- Tournament reaches terminal lifecycle via end-date pass or all matches completed
- Status resolves to `completed`
- Valid next actions are read-only operations (analytics, history, exports)

## Hosting Flow Acceptance Criteria

## Pre-Game
- Organizer can manage pools/categories
- Courts and availability can be configured
- Payment/waiver requirements can gate bracket generation
- Registration controls are enforced by lifecycle status and dates

## Game-Day
- Team check-in supports manual and QR-token flows
- Referee assignment is supported and validated against:
  - Team not participating in the same match
  - Scheduling overlap conflicts
  - Rest window minimum between assignments
- Scorekeeper can be assigned to matches
- Match can be started (`scheduled` → `in_progress`)
- Scores can be submitted and admin-overridden
- Incident reporting/resolution and dispute handling are available

## Post-Game
- Standings are updated from completed group matches
- Knockout bracket can be generated from standings
- Tournament analytics can be retrieved for organizer operations

## Permissions & Next Actions by Stage

For each stage, verify:
- Correct lifecycle label/status
- Expected match set exists (none / group only / group+knockout)
- Required permissions are enforced for organizer/admin/captain/scorekeeper
- At least one valid next action is available to the proper role

