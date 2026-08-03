# Tournament Domain Refactor Map

This map defines target bounded contexts for tournament features and the current implementation hotspots to split over time.

## Domain Boundaries

1. **Lifecycle**
   - **Owns:** status transitions, auto-status sync, action gating.
   - **Current files:**  
     - `src/backend/services/tournamentLifecyclePolicy.ts`  
     - `src/backend/services/tournamentService.ts` (lifecycle sections)  
     - `src/mobile/lib/features/tournaments/presentation/tournament_status_policy.dart`

2. **Registration**
   - **Owns:** team self-registration, registration waitlist, registration fields, roster lock checks.
   - **Current files:**  
     - `src/backend/controllers/tournamentController.ts`  
     - `src/backend/routes/tournamentRoutes.ts`  
     - `src/mobile/lib/features/tournaments/data/tournament_repository_impl.dart`

3. **Pools**
   - **Owns:** pool CRUD, pool assignment/move, pool waitlists, standings-by-pool.
   - **Current files:**  
     - `src/backend/controllers/tournamentController.ts`  
     - `src/backend/services/tournamentService.ts`  
     - `src/mobile/lib/features/tournaments/presentation/pools_management_page.dart`

4. **Brackets**
   - **Owns:** bracket generation/regeneration, knockout progression, third-place generation.
   - **Current files:**  
     - `src/backend/services/tournamentService.ts`  
     - `src/backend/controllers/tournamentController.ts`  
     - `src/mobile/lib/features/tournaments/presentation/bracket_visualization_page.dart`

5. **Match Operations**
   - **Owns:** match start, score submission, scheduling/courts, check-in, scorekeeper assignment.
   - **Current files:**  
     - `src/backend/controllers/tournamentController.ts`  
     - `src/backend/routes/tournamentRoutes.ts`  
     - `src/mobile/lib/features/tournaments/presentation/matches_management_page.dart`

6. **Incidents & Disputes**
   - **Owns:** match incident lifecycle, score dispute create/review/resolve.
   - **Current files:**  
     - `src/backend/controllers/tournamentController.ts`  
     - `src/mobile/lib/features/tournaments/presentation/tournament_operations_page.dart`

7. **Analytics**
   - **Owns:** organizer analytics aggregation and UI rendering.
   - **Current files:**  
     - `src/backend/controllers/tournamentController.ts`  
     - `src/mobile/lib/features/tournaments/presentation/tournament_analytics_page.dart`

## Refactor Target Structure (Backend)

- `src/backend/controllers/tournament/`
  - `lifecycleController.ts`
  - `registrationController.ts`
  - `poolController.ts`
  - `bracketController.ts`
  - `matchOpsController.ts`
  - `incidentController.ts`
  - `analyticsController.ts`
- `src/backend/services/tournament/`
  - `lifecycleService.ts`
  - `registrationService.ts`
  - `poolService.ts`
  - `bracketService.ts`
  - `matchOpsService.ts`
  - `incidentService.ts`
  - `analyticsService.ts`

## Refactor Target Structure (Mobile)

- `src/mobile/lib/features/tournaments/presentation/detail/`
  - `overview_section.dart`
  - `teams_section.dart`
  - `matches_section.dart`
  - `operations_section.dart`
  - `status_components.dart`
- Keep route pages as composition shells; move logic-heavy rendering into section widgets.

## Immediate Ownership Rules

- Lifecycle/status rules must be edited in lifecycle policy files first (backend + mobile adapters), not inline in pages/controllers.
- Route handlers stay orchestration-only; domain validation and transitions move to domain services.
- New tournament endpoints should follow `{ data, pagination? }` response shape for consistency.

## Migration Status (updated 2026-08-03)

The `src/backend/tournament-service/controllers/tournament/*Controller.ts` files already exist as the target file layout, but most were still thin re-export shims pointing back into the monolithic `tournamentCoreController.ts`. Migration proceeds by moving real implementations into each domain file (not just renaming), verified via the full tournament test suite (route tests exercise the HTTP layer via supertest, so moving code between files is behavior-invisible as long as `index.ts` still re-exports the same names).

Done:
- **Analytics** — `getTournamentAnalytics` now lives in `tournamentAnalyticsController.ts`, with the aggregation query/computation extracted into `services/tournament/analyticsService.ts` (`computeTournamentAnalytics`). `getPublicTournaments`, `getTournamentNotifications`, `getPlayerStats`, `upsertPlayerStat` remain shimmed from Core (they don't belong to the analytics domain and weren't moved in this pass).
- **Score Disputes** — `createScoreDispute`, `getMatchDisputes`, `resolveScoreDispute` fully moved into `tournamentDisputeController.ts`. `notifyMatchResultToCaptains` and `maybeAutoGenerateGroupsKnockoutBrackets` were exported from `tournamentCoreController.ts` (still shared with match-ops `submitScore`/`adminUpdateScore`) rather than duplicated.

Still shimmed from `tournamentCoreController.ts` (not yet moved) — `tournamentTeamController.ts`, `tournamentPlayerController.ts`, `tournamentMatchController.ts`, `tournamentPoolController.ts`, `tournamentRegistrationController.ts`, `tournamentGameDayController.ts`, `tournamentAdminController.ts` (partially — some already implemented directly), `tournamentCategoryController.ts`, `tournamentInvitationController.ts`, `tournamentPortalController.ts`, `tournamentCloneController.ts`. `tournamentCoreController.ts` itself shrank from 6,068 → 4,845 lines after this pass; remaining domains are larger and more entangled with shared helpers (`assertCanViewTournament`, `assertTournamentSetupEditable`, schedule-overlap helpers, lifecycle reconciliation) and should be extracted incrementally following the same pattern: export shared helpers from Core first, then move the domain's functions verbatim, then re-run the full tournament test suite + `npm run build` + `npm run lint` before moving to the next domain.

### Mobile status (updated 2026-08-03)

- **Status presentation (item 4)** — already centralized before this pass: `tournament_status_policy.dart` (labels/lifecycle rules) + `tournament_status_presentation.dart` (`getTournamentStatusPresentation` → label/icon/color/backgroundColor) are the single source of truth and are used consistently; no further action needed.
- **`tournament_detail_page.dart` split (item 3)** — in progress. Extracted the purely-presentational leaf widgets (`PaymentStatusBadge`, `StandingStatChip`, `StatusChip`, `InfoCard`, `InfoRow`, `SectionCard`, `RadioOption<T>`, `TeamCardStatChip`) into `presentation/detail/status_components.dart` (3,948 → 3,656 lines). Remaining candidates for `teams_section.dart`, `matches_section.dart`, and `overview_section.dart` are identified but not yet moved (see repo memory notes) — they're larger and reference Riverpod providers/parent callbacks, so need more careful dependency tracing than the leaf-widget slice.


