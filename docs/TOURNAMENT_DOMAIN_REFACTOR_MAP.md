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
