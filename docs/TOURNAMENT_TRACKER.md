# Tournament Tracker

This document is a consolidated tracker for the currently implemented tournament capabilities, operational touchpoints, and supporting docs in Teamly. Use it as a quick index before diving into the deeper API, readiness, and user guides.

## Canonical tournament docs

- [TOURNAMENT_API.md](./TOURNAMENT_API.md) — endpoint reference
- [TOURNAMENT_PRODUCTION_READINESS.md](./TOURNAMENT_PRODUCTION_READINESS.md) — lifecycle, permissions, release gates
- [TOURNAMENT_OPERATIONS_RUNBOOK.md](./TOURNAMENT_OPERATIONS_RUNBOOK.md) — operational monitoring and response steps
- [guides/TOURNAMENT_USER_GUIDE.md](./guides/TOURNAMENT_USER_GUIDE.md) — end-user workflow
- [features/TOURNAMENT_LIFECYCLE_ROLLOUT.md](./features/TOURNAMENT_LIFECYCLE_ROLLOUT.md) — rollout/backfill playbook

## Current implementation snapshot

### Lifecycle and automation

- Tournament lifecycle statuses are `draft → registration → registration_closed → in_progress → completed`, with `cancelled` as a terminal override.
- Allowed transitions and lifecycle actions are centralized in `src/backend/services/tournamentLifecyclePolicy.ts`.
- Scheduled lifecycle reconciliation runs through `syncAllTournamentStatuses` in `src/backend/services/scheduledJobs.ts`.
- Shared lifecycle types live in `src/shared/types/tournament.types.ts`.
- Groups + knockout tournaments are guarded from auto-completing until knockout-stage matches exist and all tournament matches are complete.
- Seeded lifecycle scenarios are available in `src/backend/scripts/seedTournamentLifecycleScenarios.ts`.

### Public and organizer-facing surfaces

| Capability | Route / Surface | Notes |
|---|---|---|
| Public tournament listing | `GET /api/tournaments/public` | No auth required |
| Public tournament portal | `GET /api/tournaments/portal/:shareToken` | Uses `Tournament.shareToken` for a shareable portal |
| Share token generation | `POST /api/tournaments/:id/share-token` | Organizer/admin mutation |
| Organizer analytics | `GET /api/tournaments/:id/analytics` | Organizer/admin-only analytics dashboard |
| Dashboard aggregation | `GET /api/auth/me/dashboard` | `upcomingEvents` now combines sessions, teamups, and tournaments |

### Registration, payments, and admin operations

- Tournament mutation routes enforce JSON content type and apply `tournamentMutationLimiter` in `src/backend/routes/tournamentRoutes.ts`.
- Batch payment status updates are supported with `PUT /api/tournaments/:id/teams/payment/batch`.
- Registration waitlist flows currently include:
  - `GET /api/tournaments/:id/registration-waitlist`
  - `POST /api/tournaments/:id/registration-waitlist`
  - `DELETE /api/tournaments/:id/registration-waitlist`
  - `DELETE /api/tournaments/:id/registration-waitlist/me`
  - `POST /api/tournaments/:id/registration-waitlist/:teamId/promote`
  - legacy `DELETE /api/tournaments/:id/registration-waitlist/:teamId`
- Tournament admin role changes clear cached permissions immediately through `clearUserPermissionCache(...)`.

### Brackets, standings, and match operations

- Bracket generation supports `playoffSize` with supported options `2`, `4`, `8`, and `16`.
- Bracket records support `bracketSide` and `loserGoesToMatchId`, enabling explicit loser routing for double-elimination flows.
- Self-ref mode is controlled by `Tournament.selfRefEnabled`.
- Self-ref helpers are exposed through:
  - `POST /api/tournaments/:id/matches/auto-assign-referees`
  - `GET /api/tournaments/:id/referee-duties`
- Standings sorting supports `head_to_head` when metrics exist, then falls back deterministically through wins, goal difference, goals for, goals against, and stable identity comparison.
- Score dispute resolution can optionally correct scores and returns `correctedMatch` when a completed match is rewritten.

### Mobile and client integration points

- The mobile tournament repository is split into focused interfaces in `src/mobile/lib/features/tournaments/domain/tournament_repository.dart`.
- The concrete mobile implementation lives in `src/mobile/lib/features/tournaments/data/tournament_repository_impl.dart`.
- Mobile tournament create/edit flows include `selfRefEnabled`, and tournament match management surfaces self-ref workflows.
- The mobile dashboard model consumes the shared `upcomingEvents` aggregation from the authenticated dashboard response.

### Seed and sample data

- `prisma/seed.js` includes the Montreal Winter Hockey Championship sample tournament data.
- `src/backend/scripts/seedTournamentLifecycleScenarios.ts` creates draft, registration, registration_closed, in-progress, and completed lifecycle scenarios for validation.

## Source anchors

- Schema: `prisma/schema.prisma`
- Backend routes: `src/backend/routes/tournamentRoutes.ts`
- Tournament service routes/controllers: `src/backend/tournament-service/routes/tournamentRoutes.ts`, `src/backend/tournament-service/controllers/tournament/`
- Lifecycle logic: `src/backend/services/tournamentLifecyclePolicy.ts`, `src/backend/services/tournamentService.ts`, `src/backend/services/scheduledJobs.ts`
- Mobile integration: `src/mobile/lib/features/tournaments/`, `src/mobile/lib/core/models/dashboard_model.dart`

## Maintenance guidance

- Update this tracker when tournament routes, lifecycle rules, operational jobs, seed scenarios, or mobile/backend integration points materially change.
- Keep detailed behavioral changes in the canonical docs above, and use this file as the top-level “what exists now” inventory.
