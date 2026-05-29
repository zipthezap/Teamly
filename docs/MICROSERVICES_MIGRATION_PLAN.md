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
  - Add dashboard panels for success rate, p95 latency, fallback rate, and duplicate-send signals.
  - Define alert thresholds for fallback spikes and response-time regressions.
2. Notification idempotency hardening (Days 2-5)
  - Introduce idempotency key generation for all notification create requests (group/session/teamup/tournament).
  - Persist idempotency key handling in Notification Service create endpoints.
  - Add tests for retry safety and duplicate prevention under concurrent calls.
3. Controlled fallback policy (Days 4-6)
  - Keep monolith fallback enabled but bounded with explicit budget and alarms.
  - Record fallback reason codes for each remote failure path.
  - Add a runbook section for temporary fail-open vs fail-closed behavior decisions.
4. Tournament write cutover planning (Days 5-10)
  - Inventory remaining tournament write endpoints still served by monolith.
  - Select the next two high-write slices for extraction and canary.
  - Add contract parity checks for those slices before traffic switch.
5. Cutover gates and deprecation prep (Days 10-14)
  - Define and enforce cutover exit criteria: stable error budget, fallback rate under target, no duplicate-notification anomalies.
  - Promote Notification Service as default path in staging after criteria are met.
  - Prepare removal plan for legacy local-notification write code paths after soak period.

## Progress Update (2026-05-29)

- Completed: Tournament Service scaffold is running as an independent runtime.
- Completed: Read endpoints extracted to Tournament Service:
  - GET /api/tournaments/public
  - GET /api/tournaments/:id/matches
  - GET /api/tournaments/:id/standings
  - GET /api/tournaments/:id/summary
  - GET /api/tournaments/:id/match-count
- Completed: Invitation endpoints extracted to Tournament Service (read + write):
  - GET /api/tournaments/invitations/preview/:inviteToken
  - GET /api/tournaments/invitations/my
  - GET /api/tournaments/invitations/:inviteToken
  - POST /api/tournaments/invitations/:inviteToken/accept
  - POST /api/tournaments/invitations/:inviteToken/decline
  - POST /api/tournaments/:id/teams/:teamId/invitations
  - GET /api/tournaments/:id/teams/:teamId/invitations
  - DELETE /api/tournaments/:id/teams/:teamId/invitations/:invitationId
- Completed: Monolith controllers now support proxying for extracted read endpoints with automatic fallback to legacy implementation when Tournament Service is unavailable.
- Completed: Monolith invitation controller now supports proxying to Tournament Service with automatic fallback to legacy behavior.
- Completed: Docker compose includes optional tournament-service and environment variable wiring for TOURNAMENT_SERVICE_URL.
- Completed: Community Service scaffold is running as an independent runtime.
- Completed: Initial high-importance community endpoints extracted to Community Service:
  - GET /api/groups/public
  - GET /api/sessions
  - GET /api/teamup
- Completed: Group invite and join-request workflow slice extracted to Community Service:
  - POST /api/groups/:id/invitations/generate-token
  - GET /api/groups/:id/invite-link
  - POST /api/groups/:id/invite-token
  - POST /api/groups/join-by-token/:token
  - POST /api/groups/:id/join-request
  - GET /api/groups/:id/join-requests
  - POST /api/groups/:id/join-requests/:requestId
  - DELETE /api/groups/:id/join-requests/:requestId
- Completed: Group member-management write slice extracted to Community Service:
  - DELETE /api/groups/:id/members/:memberId
  - DELETE /api/groups/:id/members/user/:userId
  - PUT /api/groups/:id/members/:memberId/role
  - POST /api/groups/:id/transfer-admin
- Completed: Group core write slice extracted to Community Service:
  - POST /api/groups
  - PUT /api/groups/:id
  - DELETE /api/groups/:id
  - POST /api/groups/:id/invite
  - POST /api/groups/:id/invitations/bulk
  - POST /api/groups/:id/invitations/revoke
  - DELETE /api/groups/:id/leave
  - POST /api/groups/:id/invitations/:requestId/respond
- Completed: Session participation write slice extracted to Community Service:
  - POST /api/sessions/:id/join
  - DELETE /api/sessions/:id/leave
  - PUT /api/sessions/:id/status
  - PUT /api/sessions/:id/guests/:guestId
  - PUT /api/sessions/:id/guests/:guestId/status
  - DELETE /api/sessions/:id/guests/:guestId
- Completed: Session admin/state write slice extracted to Community Service:
  - POST /api/sessions/:id/invite
  - POST /api/sessions/:id/invitations/revoke
  - POST /api/sessions/:id/invitations/generate-token
  - POST /api/sessions/:id/generate-invite
  - PUT /api/sessions/:id/session-status
  - POST /api/sessions/:id/archive
  - POST /api/sessions/:id/unarchive
- Completed: TeamUp response lifecycle write slice extracted to Community Service:
  - POST /api/teamup/:id/respond
  - DELETE /api/teamup/:id/respond
  - PUT /api/teamup/:id/respond/rsvp
  - POST /api/teamup/:id/responses/bulk-handle
  - POST /api/teamup/:id/responses/:responseId
  - PUT /api/teamup/:id/responses/:responseId/attendance
  - POST /api/teamup/:id/reminders
- Completed: TeamUp moderation/comment/report write slice extracted to Community Service:
  - GET /api/teamup/moderation/reports
  - PUT /api/teamup/moderation/reports/:caseId
  - POST /api/teamup/:id/comments
  - DELETE /api/teamup/:id/comments/:commentId
  - POST /api/teamup/:id/report
- Completed: TeamUp core write slice extracted to Community Service:
  - POST /api/teamup
  - PUT /api/teamup/:id
  - DELETE /api/teamup/:id
  - POST /api/teamup/saved-searches
  - DELETE /api/teamup/saved-searches/:searchId
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
  - Internal service token enforcement on /api/notifications/*.
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
  - Direct `prisma.*Notification.create/createMany` calls removed from high-traffic app controllers/services; remaining direct writes are isolated to dedicated `notification-service` controllers by design.
- Completed: Monolith routes for the above community endpoints now proxy to Community Service with automatic fallback when COMMUNITY_SERVICE_URL is not set or service is unavailable.
- Completed: Docker compose includes optional community-service and environment variable wiring for COMMUNITY_SERVICE_URL.
- Next: Execute Notification Service canary + idempotency rollout, then continue tournament write endpoint extraction with route-level canary and contract parity gates.
