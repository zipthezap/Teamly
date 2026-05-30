# Teamly Microservices Migration Plan

## Goals

- Decompose the current backend modular monolith into independently deployable services.
- Preserve production stability while migrating in small, reversible steps.
- Keep mobile and web clients stable by preserving API contracts during transition.
- Improve scaling by allowing high-load domains (tournaments, notifications) to scale independently.

## Current State (Baseline)

- One backend process and one backend container currently serve all domains.
- Shared PostgreSQL and Redis are already in place and can be reused in the first migration phase.
- Domain separation exists at code level (routes/controllers/services), which makes strangler migration feasible.

## Target Architecture

## Edge and Platform

- API Gateway/BFF: single public entrypoint, auth verification, rate limiting, request routing.
- Service discovery/routing: explicit upstream mapping by domain path prefix.
- Observability: centralized logs, metrics, tracing, service health endpoints.

## Initial Service Set

- Auth Service: identity, OAuth, token/session lifecycle.
- Tournament Service: tournaments, matches, brackets, standings, invitations.
- Session/Group Service: groups, sessions, requests, comments.
- Notification Service: in-app notifications, push dispatch, email orchestration.

## Data Strategy

- Phase 1: shared PostgreSQL instance, separate schemas per service.
- Phase 2: service-owned databases where needed (starting with Tournament Service).
- No direct table access across service boundaries; communicate via HTTP/events.

## Integration Strategy

- Synchronous: internal HTTP for query-style use cases.
- Asynchronous: domain events for workflow chaining and side effects.
- Event naming convention: domain.entity.action (example: tournament.match.scheduled).

## Migration Principles

- Strangler pattern only: route-by-route extraction behind gateway.
- No big-bang rewrite.
- Backward compatibility first: preserve response shapes while clients transition.
- Every extracted endpoint must have tests, metrics, and rollback path.

## Phased Execution Plan

### Phase 0: Foundations (1-2 weeks)

- Add service template conventions (health, config, logging, error middleware).
- Define gateway routing rules and internal service auth strategy.
- Add baseline SLIs/SLOs for latency, error rate, and availability.
- Establish CI pipeline templates for per-service build/test/deploy.

Exit criteria:

- New service can be scaffolded and deployed independently.
- End-to-end request tracing works from gateway to service.

### Phase 1: Tournament Service Extraction (2-4 weeks)

- Start with read endpoints (low-risk):
  - get tournament summary/details
  - get matches list
  - get standings
- Then move write endpoints in slices:
  - invitations
  - admin roles
  - announcements
  - categories/pools
  - match operations and dispute flows
- Keep gateway contract stable at /api/tournaments/*.

Exit criteria:

- 60-80% of tournament API traffic served by Tournament Service.
- Rollback for each route is proven in staging.

### Phase 2: Notifications Service (2-3 weeks)

- Extract notification creation and delivery orchestration.
- Move email queue and push dispatch behind service APIs/events.
- Introduce idempotency keys for event-driven notifications.

Exit criteria:

- Tournament and session domains no longer write notification tables directly.

### Phase 3: Session/Group Service (3-5 weeks)

- Extract session/group routes and related workflows.
- Replace direct cross-domain DB reads with service calls/events.

Exit criteria:

- Session/group APIs owned and deployed independently.

### Phase 4: Auth Service Finalization (2-4 weeks)

- Move auth/session internals to dedicated service.
- Keep gateway token verification and policy checks lightweight.

Exit criteria:

- Identity lifecycle fully isolated from feature domains.

## API Gateway Routing Plan (Initial)

- /api/tournaments/* -> Tournament Service
- /api/auth/* -> Monolith (initial), then Auth Service
- /api/groups/* and /api/sessions/* -> Monolith (initial), then Session/Group Service
- /api/notifications/* -> Monolith (initial), then Notification Service

## Tournament Service - Detailed Start Plan

### Step A: Bootstrap Service

- Create standalone service runtime under src/backend/tournament-service.
- Add health and readiness endpoints.
- Add minimal read endpoints and contracts.

### Step B: Extract First Endpoints

- Move read-only endpoints first:
  - GET /api/tournaments/:id/summary
  - GET /api/tournaments/:id/matches
- Add contract tests to ensure response compatibility.

### Step C: Add Internal Security and Resilience

- Internal service auth for gateway-to-service calls.
- Request IDs, timeout/retry policy, structured errors.
- Circuit breaker/fallback route to monolith during migration.

### Step D: Switch Traffic Incrementally

- Canary traffic percentages by endpoint.
- Compare latency/errors against baseline.
- Gradually increase traffic while monitoring.

## Risks and Mitigations

- Risk: distributed transaction complexity.
  - Mitigation: use event choreography and compensating actions.
- Risk: data coupling from shared schema.
  - Mitigation: enforce service-owned tables and anti-corruption adapters.
- Risk: operational overhead.
  - Mitigation: standard templates, shared observability, automated CI/CD.
- Risk: contract regressions.
  - Mitigation: consumer-driven contract tests and shadow traffic.

## Definition of Done (Per Endpoint Extraction)

- Endpoint served by target service in staging and production canary.
- Tests cover success/failure/authorization paths.
- Logs, metrics, and traces present with endpoint labels.
- Rollback verified and documented.
- Legacy implementation removed or hard-deprecated after stabilization period.

## Immediate Next 14 Days (Execution Kickoff)

1. Notification Service canary rollout (Days 1-3)
  - Enable NotificationFactory remote path in staging for a small slice of traffic.
2. Notification idempotency hardening (Days 2-5)
  - Introduce idempotency key generation for all notification create requests (group/session/teamup/tournament).
  - Persist idempotency key handling in Notification Service create endpoints.
  - Add tests for retry safety and duplicate prevention under concurrent calls.
3. Controlled fallback policy (Days 4-6)
  - Record fallback reason codes for each remote failure path.
  - Add a runbook section for temporary fail-open vs fail-closed behavior decisions.
4. Tournament write cutover planning (Days 5-10)
  - Inventory remaining tournament write endpoints still served by monolith.
  - Select the next two high-write slices for extraction and canary.
  - Add contract parity checks for those slices before traffic switch.
5. Cutover gates and deprecation prep (Days 10-14)
  - Define and enforce cutover exit criteria: stable error budget, fallback rate under target, no duplicate-notification anomalies.
- Completed: Tournament Service scaffold is running as an independent runtime.
- Completed: Read endpoints extracted to Tournament Service:
  - GET /api/tournaments/public
  - GET /api/tournaments/portal/:shareToken
  - GET /api/tournaments/:id/standings
  - GET /api/tournaments/:id/summary
  - GET /api/tournaments/:id/match-count
- Completed: Invitation endpoints extracted to Tournament Service (read + write):
  - GET /api/tournaments/invitations/preview/:inviteToken
  - GET /api/tournaments/invitations/my
  - GET /api/tournaments/invitations/:inviteToken
  - POST /api/tournaments/invitations/:inviteToken/accept
  - POST /api/tournaments/:id/teams/:teamId/invitations
  - GET /api/tournaments/:id/teams/:teamId/invitations
  - DELETE /api/tournaments/:id/teams/:teamId/invitations/:invitationId
- Completed: Monolith tournament routes now proxy to Tournament Service as the primary execution path.
- Completed: Tournament route-level migration to service proxy facade:
  - All monolith `/api/tournaments/*` route handlers now route through `proxyTournamentHandler(...)`.
  - Existing auth/permission/rate-limit middleware ordering in monolith routes is preserved.
  - Focused validation passed after cutover (`tournamentRoutes`, `tournamentController`, and `tournament-service/analyticsController` test suites: 418 passing + `npm run build`).
- Completed: Tournament-service endpoint parity wiring for full monolith tournament surface:
  - `tournament-service` router now mirrors the complete `/api/tournaments/*` endpoint map (104 routes) and executes tournament controller handlers with proxied user context.
  - Proxy is now fail-closed for tournament traffic: no legacy monolith fallback on service status/network failures; clients receive service responses (or `503` when service is unavailable).
  - Tournament-service now imports its own local tournament controller package (`src/backend/tournament-service/controllers/tournament/*`) instead of monolith controller paths, reducing cross-runtime coupling.
- Completed: Legacy monolith tournament controller package removed from `src/backend/controllers/tournament*`; monolith routes now reference service-local tournament controllers only.
- Completed: Transitional `tournament-service/controllers/{tournamentController,invitationController,matchGameDayController}.ts` compatibility files removed; tournament tests now target service-local controller package entrypoints.
- Completed: Residual internal self-proxy wrappers removed from tournament-service controllers (`tournamentAnalyticsController`, `tournamentMatchController`, `tournamentGameDayController`, `tournamentInvitationController`); handlers now execute locally without service-to-self fallback scaffolding.
- Completed: `_legacyController` extraction kickoff (CRUD slice): `deleteTournament` and `cancelTournament` now live directly in `tournamentCrudController.ts`; remaining CRUD handlers continue to delegate during incremental extraction.
- Completed: `_legacyController` extraction continuation (CRUD slice): `getTournament` now lives directly in `tournamentCrudController.ts` with local visibility checks and standings normalization; regression tests/build remain green.
- Completed: `_legacyController` extraction continuation (CRUD slice): `getTournaments` now lives directly in `tournamentCrudController.ts` with pagination/filtering + sync status logic preserved; regression tests/build remain green.
- Completed: Final tournament legacy-file cutover: `_legacyController.ts` removed and remaining controller imports repointed to `tournamentCoreController.ts`; no `_legacyController` references remain in `src/backend/**`.
- Completed: Tournament-service controller decoupling cleanup: local request validators now live under `tournament-service/controllers/tournament/_requestValidators.ts`, and CRUD write exports route through `tournamentWriteController.ts`.
- Completed: Tournament internals relocation slice 1: `updateTournament` now lives in `tournamentWriteController.ts`; focused tournament regressions (418 tests) and `npm run build` pass after extraction.
- Completed: Tournament internals relocation slice 2: `createTournament` now lives in `tournamentWriteController.ts`; focused tournament regressions (418 tests) and `npm run build` pass after extraction.
- Completed: Docker compose includes optional tournament-service and environment variable wiring for TOURNAMENT_SERVICE_URL.
- Completed: Community Service scaffold is running as an independent runtime.
- Completed: Initial high-importance community endpoints extracted to Community Service:
  - GET /api/groups/public
  - GET /api/sessions
  - GET /api/teamup
- Completed: Group invite and join-request workflow slice extracted to Community Service:
  - POST /api/groups/:id/invitations/generate-token
  - POST /api/groups/:id/invite-token
  - POST /api/groups/join-by-token/:token
  - POST /api/groups/:id/join-request
  - GET /api/groups/:id/join-requests
  - POST /api/groups/:id/join-requests/:requestId
  - DELETE /api/groups/:id/join-requests/:requestId
- Completed: Group member-management write slice extracted to Community Service:
  - DELETE /api/groups/:id/members/user/:userId
  - PUT /api/groups/:id/members/:memberId/role
  - POST /api/groups/:id/transfer-admin
- Completed: Group core write slice extracted to Community Service:
  - POST /api/groups
  - PUT /api/groups/:id
  - POST /api/groups/:id/invite
  - POST /api/groups/:id/invitations/bulk
  - POST /api/groups/:id/invitations/revoke
  - DELETE /api/groups/:id/leave
  - POST /api/groups/:id/invitations/:requestId/respond
- Completed: Group invitation analytics and inbox read slice extracted to Community Service:
  - GET /api/groups/:id/invitations/analytics
  - GET /api/groups/my-join-requests
  - GET /api/groups/:id/members
  - GET /api/groups/:id
  - GET /api/groups
  - GET /api/groups/nearby
- Completed: Session participation write slice extracted to Community Service:
  - POST /api/sessions/:id/join
  - PUT /api/sessions/:id/status
  - PUT /api/sessions/:id/guests/:guestId
  - PUT /api/sessions/:id/guests/:guestId/status
  - DELETE /api/sessions/:id/guests/:guestId
- Completed: Session admin/state write slice extracted to Community Service:
  - POST /api/sessions/:id/invitations/revoke
  - POST /api/sessions/:id/invitations/generate-token
  - POST /api/sessions/:id/generate-invite
  - PUT /api/sessions/:id/session-status
  - POST /api/sessions/:id/archive
- Completed: TeamUp response lifecycle write slice extracted to Community Service:
  - POST /api/teamup/:id/respond
  - DELETE /api/teamup/:id/respond
  - POST /api/teamup/:id/responses/:responseId
  - PUT /api/teamup/:id/responses/:responseId/attendance
  - POST /api/teamup/:id/reminders
- Completed: TeamUp moderation/comment/report write slice extracted to Community Service:
  - GET /api/teamup/moderation/reports
  - POST /api/teamup/:id/comments
  - DELETE /api/teamup/:id/comments/:commentId
  - POST /api/teamup/:id/report
  - POST /api/teamup
  - PUT /api/teamup/:id
  - DELETE /api/teamup/:id
  - POST /api/teamup/saved-searches
  - DELETE /api/teamup/saved-searches/:searchId
- Completed: TeamUp read/analytics/discovery slice proxy cutover to Community Service:
  - Monolith `teamUpRoutes` now proxy nearby/my-requests/my-applications/attendance-history/saved-searches/analytics/my-responses/read-detail/replacement-suggestions/comments endpoints through `teamUpProxyController` with fallback.
  - Community Service now owns the full TeamUp route surface, with monolith remaining only as a thin proxy facade.
- Completed: Reminder management proxy cutover to Community Service:
  - Monolith `reminderRoutes` now proxy list/update/delete reminder endpoints through `reminderProxyController` with fallback.
  - Community Service now owns `/api/reminders/*` directly.
- Completed: Session request workflow proxy cutover to Community Service:
  - Monolith `sessionRequestRoutes` now proxy create/group lookup/detail/statistics/vote/finalize/cancel endpoints through `sessionRequestProxyController` with fallback.
  - Community Service now owns `/api/session-requests/*` directly.
- Completed: Admin teamup utility proxy cutover to Community Service:
  - Monolith `adminRoutes` now proxy invite-resend/teamup delete/teamup status endpoints through `adminProxyController` with fallback.
  - Community Service now owns `/api/admin/*` for these TeamUp maintenance utilities.
- Completed: Service-to-service hardening for Community Service:
  - Internal service token header validation added on Community Service /api/* routes.
  - Monolith proxy calls now include internal service token when configured.
  - Community Service proxy calls now use timeout-based cancellation via COMMUNITY_SERVICE_TIMEOUT_MS.
- Completed: Notification Service scaffold is running as an independent runtime.
- Completed: First notification flow migrated to Notification Service with fallback:
  - NotificationFactory.createGroupNotifications now calls Notification Service when NOTIFICATION_SERVICE_URL is set.
  - NotificationFactory.createSessionNotifications now calls Notification Service when NOTIFICATION_SERVICE_URL is set.
  - NotificationFactory.createTeamUpNotifications now calls Notification Service when NOTIFICATION_SERVICE_URL is set.
  - NotificationFactory.createTournamentNotifications now calls Notification Service when NOTIFICATION_SERVICE_URL is set.
  - Fallback to local monolith notification creation remains in place when service is unavailable.
- Completed: Notification Service test coverage added for key protections and behavior:
 - Completed: Session nearby-discovery read endpoint migrated to Community Service:
   - GET /api/sessions/nearby
 - Completed: Session route cleanup for migrated analytics endpoints:
   - Removed duplicate monolith declarations for `GET /api/sessions/statistics` and `GET /api/sessions/:id/activity` in the monolith router.
   - Kept proxy-backed handlers and ensured `GET /api/sessions/statistics` is ordered before `GET /api/sessions/:id` to avoid dynamic-route shadowing.
  - Payload validation on required notification creation fields.
  - Deduplication behavior for notification creation windows.
- Completed: High-priority monolith notification-write normalization to NotificationFactory (service-backed with fallback):
  - Group joins/membership flows migrated in Group controllers (join request, acceptance, member removal).
  - TeamUp response, RSVP/reminder, and comment flows migrated in TeamUp controllers.
  - Session attendance/late flows migrated in attendance and group-chat controllers.
  - Session service batch notification helpers migrated (session created, session updated, session cancelled).
  - Session notification service helper writes migrated (batch activity creation now delegates to NotificationFactory).
  - Group service helper writes migrated (join-request, invitation, and member-added notifications now delegate to NotificationFactory).
  - Tournament announcement controller notification fan-out migrated (captain notifications now delegate to NotificationFactory).
  - Tournament admin controller notification writes migrated (co-organizer add/remove notifications now delegate to NotificationFactory).
  - Bulk notification service migrated (session/group/teamup batch creation now delegates to NotificationFactory).
  - TeamUp notification service migrated for nearby discovery notifications (in-app fan-out now delegates to NotificationFactory).
  - Scheduled jobs notification writes migrated (incident SLA breach and payment-deadline reminders now delegate to NotificationFactory).
  - Tournament service completion fan-out migrated (auto-complete captain notifications now delegate to NotificationFactory).
  - Group CRUD nearby-public-group fan-out migrated (nearby user notifications now delegate to NotificationFactory).
  - Auth registration invite-link tournament notification migrated (team-invited notification now delegates to NotificationFactory).
  - Tournament legacy helper slice migrated: scorekeeper assignment, score-submission captain fan-out, and knockout-ready fan-out now delegate to NotificationFactory.
  - Tournament legacy controller fully normalized: remaining team registration, score dispute, dispute resolution, incident report, and incident resolution notification writes now delegate to NotificationFactory.
  - Tournament analytics/player-stat slice migrated to Tournament Service: notifications, player stats, and organizer analytics now live behind service handlers with monolith proxy fallback.
  - Session analytics slice migrated to Community Service: user statistics and activity feed now live behind service handlers, with monolith proxy fallback for rollout stability.
  - Direct `prisma.*Notification.create/createMany` calls removed from high-traffic app controllers/services; remaining direct writes are isolated to dedicated `notification-service` controllers by design.
- Completed: Notification canary and reliability kickoff wiring:
  - NotificationFactory now supports canary percentages for service routing via env flags (`NOTIFICATION_SERVICE_CANARY_PERCENT` and per-kind overrides).
  - NotificationFactory fallback logs now include normalized fallback reason codes (timeout/http status/unknown) for observability and alerting.
  - Tournament notification creation now carries idempotency keys end-to-end (factory + notification-service controller) to prevent duplicate writes on retries.
- Completed: Monolith routes for the above community endpoints now proxy to Community Service with automatic fallback when COMMUNITY_SERVICE_URL is not set or service is unavailable.
- Completed: Docker compose includes optional community-service and environment variable wiring for COMMUNITY_SERVICE_URL.
- Completed: Session core CRUD + recurring/read slice proxy cutover to Community Service:
  - Monolith `sessionRoutes` now proxy invite preview/join, create/get/update/delete, participants/guests, invite analytics, and recurring instance/exception endpoints via `sessionProxyController` with fallback.
  - Community Service now exposes matching `/api/sessions/*` handlers for those routes so monolith endpoints can operate as thin proxy facades.
- Completed: Session reminders/attendance slice proxy cutover to Community Service:
  - Monolith `sessionRoutes` now proxy reminder and attendance endpoints (`/:sessionId/reminders`, `/:sessionId/attendance`, `/:sessionId/attendance/stats`, `/:sessionId/attendance/:userId`) via `sessionProxyController` with fallback.
  - Community Service now exposes matching reminder/attendance handlers for those `/api/sessions/*` routes.
- Completed: Session export endpoint slice proxy cutover to Community Service:
  - Monolith `sessionRoutes` now proxy `GET /api/sessions/export` via `sessionProxyController` with fallback.
  - Community Service now exposes matching `GET /api/sessions/export` handler.
- Completed: Notification read/manage proxy slice:
  - Monolith `notificationRoutes` now proxy list/read/stats/unread-count/delete operations via `notificationProxyController` with fallback.
  - Notification Service now exposes corresponding read/manage `/api/notifications` endpoints using internal token + user header auth.
- Completed: Notification SSE stream proxy slice:
  - Monolith `GET /api/notifications/stream` now routes through `notificationProxyController.streamNotifications` with fallback to local stream handling.
  - Notification Service now exposes `GET /api/notifications/stream` with internal token + user header auth context.
- Completed: Notification idempotency hardening expansion:
  - Idempotency-key deduplication now applies to session/group/teamup/tournament notification create flows in Notification Service.
  - NotificationFactory now propagates or derives idempotency keys for all notification kinds when calling Notification Service and when executing local fallback paths.
  - Added notification-service route tests validating idempotent retry behavior for session, group, and tournament create endpoints.
- Completed: Auth migration kickoff slice:
  - Added dedicated Auth Service runtime scaffold under `src/backend/auth-service`.
  - Monolith `authRoutes` now proxy read-only dashboard/profile/session-status endpoints (`/me/dashboard`, `/profile`, `/sessions`, `/oauth/status`) via `authProxyController` with fallback.
- Completed: Auth migration continuation slice:
  - Monolith `authRoutes` now proxy core auth write/read operations via `authProxyController` with fallback, including register/login/logout/logout-all/refresh-token, email verification flows, mobile OAuth token exchange, profile/password/account updates, OAuth account management, and password reset endpoints.
  - Auth Service now exposes matching `/api/auth/*` route handlers for those proxied endpoints.
- Completed: Auth profile-picture lifecycle (non-upload) proxy slice:
  - Monolith `authRoutes` now proxy profile picture delete/history/restore/hard-delete endpoints via `authProxyController` with fallback.
  - Auth Service now exposes matching `/api/auth/profile/picture*` handlers for those non-upload endpoints.
  - Multipart profile picture upload endpoint is now streamed through monolith proxy passthrough to Auth Service upload handling.
- Completed: Auth browser OAuth callback flow cutover:
  - Monolith `/api/auth/google`, `/api/auth/google/callback`, `/api/auth/facebook`, and `/api/auth/facebook/callback` now route via Auth proxy passthrough to Auth Service.
  - Auth Service now owns browser OAuth start/callback handlers with Passport/session middleware in-service, preserving inviteGroupId session propagation and frontend redirect behavior.
- Completed: Auth 2FA proxy cutover:
  - Monolith `twoFactorRoutes` now proxy 2FA status/setup/verify/disable through `twoFactorProxyController` with fallback.
  - Auth Service now owns `/api/two-factor/*` directly.
- Completed: League route proxy cutover to Tournament Service:
  - Monolith `leagueRoutes` now proxy league CRUD/team/standings/session-link/match update endpoints through `leagueProxyController` with fallback.
  - Tournament Service now owns `/api/leagues/*` directly.
- Completed: Group/community legacy deprecation closure + observability hardening:
  - Remaining monolith invite/join preview routes now proxy to Community Service (`GET /api/groups/join/:token`, `GET /api/groups/invite/:groupId`, `POST /api/groups/join/:groupId`).
  - Group picture endpoints now proxy to Community Service, with multipart upload passthrough for `POST /api/groups/:id/picture` and service-owned handler parity.
  - `groupProxyController` fallback logs now include normalized reason classification (`service_url_missing`, `timeout`, `network`, `unknown`) to support rollout observability and deprecation readiness.
- Next: Continue rollout monitoring for the newly proxied TeamUp, reminder, session-request, admin, 2FA, and league routes, then keep the remaining monolith controller files as thin proxy facades while the service becomes the primary implementation.
- Completed: Proxy observability baseline for microservice cutovers:
  - Added centralized proxy outcome metrics via `service_proxy_outcomes_total` with labels (`proxy`, `service`, `outcome`, `reason`).
  - Instrumented Community/Session/Notification/Auth/Group/TeamUp/Tournament proxy controllers plus shared `ServiceProxy` helper for remote-success, fallback, and fail-closed outcomes.
  - Normalized fallback reasons (`service_url_missing`, `timeout`, `network`, `unknown`) for dashboarding and alerting.
- Completed: First low-risk fail-closed fallback removals:
  - Shared `ServiceProxy` now supports configurable fail-closed execution (`failClosed`, status, and message) with explicit fail-closed metric emission.
  - Admin utility endpoints (`/api/admin/*`) now fail closed when Community Service is unavailable (legacy monolith execution removed from runtime path).
  - Two-factor endpoints (`/api/two-factor/*`) now fail closed when Auth Service is unavailable (legacy monolith execution removed from runtime path).
  - League endpoints (`/api/leagues/*`) now fail closed when Tournament Service is unavailable (legacy monolith execution removed from runtime path).
- Completed: Second low-risk fail-closed fallback removals:
  - Reminder endpoints (`/api/reminders/*`) now fail closed when Community Service is unavailable (legacy monolith execution removed from runtime path).
  - Session request endpoints (`/api/session-requests/*`) now fail closed when Community Service is unavailable (legacy monolith execution removed from runtime path).
- Completed: Third low-risk fail-closed fallback removals:
  - TeamUp proxy-backed endpoints now fail closed when Community Service is unavailable (legacy monolith execution removed from runtime path for TeamUp proxy handlers).
- Completed: Fourth low-risk fail-closed fallback removals:
  - Session proxy-backed endpoints now fail closed when Community Service is unavailable (legacy monolith execution removed from runtime path for Session proxy handlers).
- Next (Tournament): continue operational hardening for service-only mode (SLO dashboards, alerting, and incident runbook verification for tournament-service `503` scenarios).
- Next (Groups): Monitor fallback-rate/error-budget SLOs for the newly proxied invite/join/picture endpoints and remove remaining legacy fallback paths after stabilization.
