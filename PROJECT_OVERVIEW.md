# Teamly — Project Overview

> **This is the single source of truth for the project.** For contributor quick-start see the section below; for operations see `docs/TOURNAMENT_OPERATIONS_RUNBOOK.md`.

---

## Table of Contents

1. [What Is Teamly?](#what-is-teamly)
2. [Mission & Goal](#mission--goal)
3. [Architecture](#architecture)
4. [Tech Stack](#tech-stack)
5. [Current Feature Set](#current-feature-set)
6. [What Is Tested](#what-is-tested)
7. [What Is NOT Tested](#what-is-not-tested)
8. [Priority Roadmap](#priority-roadmap)
9. [Work Left To Do](#work-left-to-do)
10. [Development Quick-Start](#development-quick-start)
11. [Key File Map](#key-file-map)
12. [Deployment](#deployment)
13. [Environment Variables](#environment-variables)

---

## What Is Teamly?

Teamly is a sports event organisation platform. Think of it as "Tricount for sports" — you invite your friends, create groups, and coordinate matches or full tournaments without needing a club management subscription. It is aimed at recreational and semi-professional players who want a simple, mobile-first tool to run their weekly pickup games **and** full multi-format tournaments.

---

## Mission & Goal

**Mission:** Make it dead-simple for any group of friends to organise, run, and remember their sports activity — from a casual Sunday kickabout to a 64-team knockout bracket.

**Product goal:** A single mobile/web app (Flutter) backed by a single Node/Express API that covers the full lifecycle of a sporting event:

```
Group creation → Event scheduling → Tournament hosting → Standings → History
```

We explicitly target **no payment-gateway complexity** in the first releases (registration fees are tracked manually) so that the core scheduling and bracket logic can be polished before adding financial rails.

---

## Architecture

```
Teamly/
├── src/
│   ├── backend/              # Node.js + Express REST API  (TypeScript)
│   │   ├── config/           # DB, Redis, env config
│   │   ├── controllers/      # Route handlers (thin orchestration layer)
│   │   │   └── tournament/   # Sub-domain controllers (index, _legacyController, _constants, _helpers)
│   │   ├── middleware/       # Auth, rate-limit, error, upload, metrics
│   │   ├── routes/           # Express routers (thin, only wires controllers)
│   │   ├── services/         # Business logic
│   │   │   ├── tournamentLifecyclePolicy.ts   # Canonical lifecycle/action rules
│   │   │   ├── tournamentService.ts            # Brackets, standings, pool ops
│   │   │   ├── scheduledJobs.ts               # 5-min cron: lifecycle sync, SLA, payment reminders
│   │   │   └── ...
│   │   ├── scripts/          # One-off backfill / seed scripts
│   │   ├── utils/            # Validation, logger, helpers
│   │   └── __tests__/        # Vitest test suite (see Testing section)
│   ├── mobile/               # Flutter/Dart app (iOS, Android, Web)
│   │   └── lib/features/tournaments/  # Full tournament UI feature
│   └── shared/               # TypeScript types shared between backend and client
├── prisma/
│   ├── schema.prisma         # Database schema (PostgreSQL via Prisma v7)
│   ├── seed.js               # Seed with realistic tournament scenarios
│   └── migrations/           # Squashed to single baseline (20260520114500)
├── docs/                     # Reference docs (API, deployment, architecture)
│   ├── TOURNAMENT_PRODUCTION_READINESS.md   ← release gates
│   ├── TOURNAMENT_OPERATIONS_RUNBOOK.md     ← ops runbook
│   └── TOURNAMENT_DOMAIN_REFACTOR_MAP.md   ← refactor ownership map
├── archive/                  # Archived React frontend (no longer active)
└── PROJECT_OVERVIEW.md       ← you are here
```

**Two main runtimes:**
- **Backend** — Express/Prisma on Node 20, talking to PostgreSQL 16. Optional Redis for caching, rate-limiting, and job queues.
- **Mobile/Web** — Flutter app (state: Riverpod) that consumes the REST API. Targets iOS, Android, and Web from a single codebase.

The old React frontend has been archived under `archive/frontend/`. Do not add new features there.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Node.js 20 + Express 5 + TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma v7 (config via `prisma.config.ts`, not schema `datasource`) |
| Auth | JWT (bcryptjs) + OAuth2 (Google, Facebook via Passport) |
| Caching / queues | Redis (optional; falls back to in-memory) |
| Mobile / Web app | Flutter / Dart — Riverpod state management |
| Testing | Vitest (backend) |
| Containerisation | Docker Compose (dev), Docker + Nginx (prod) |
| CI/CD | GitHub Actions |
| Observability | prom-client (Prometheus metrics), structured logger |
| Process manager | PM2 (production, cluster mode) |
| Push notifications | Firebase Admin SDK |
| Email | Nodemailer |

---

## Current Feature Set

### Core (stable)

- **User accounts** — register, login (JWT), OAuth (Google / Facebook), password reset via email token, account lockout after 5 failed attempts
- **Groups** — create, invite by email or share-link, role-based access (admin/member), capacity limits, group picture upload
- **Events** — create sports events (20+ sport types), join/leave, max-player enforcement, RSVP status, recurring events (RRULE), comments & @mentions, event export (CSV/iCal/JSON)
- **Notifications** — in-app notification centre with history, filtering, full-text search, priority indicators, real-time auto-refresh, SSE push channel
- **Dashboard** — `GET /api/auth/me/dashboard` aggregates upcoming sessions, teamups, and tournaments in a single call

### Tournament Hosting (main focus — largely implemented, actively refined)

**Lifecycle** (`draft → registration → registration_closed → in_progress → completed`, + `cancelled`)
- Auto lifecycle sync runs every 5 minutes via `scheduledJobs.ts`
- Lifecycle/action rules are centralised in `tournamentLifecyclePolicy.ts`

**Formats supported:**
- Single Elimination
- Round Robin
- Groups + Knockout (with explicit bye matches, playoff-size control, optional double-elimination routing via `bracketSide`/`loserGoesToMatchId`)

**Registration:**
- Team self-registration (captain invites players by email)
- Registration fields (custom per-tournament)
- Waitlist with captain-triggered promotion
- Payment status tracking (manual; no live gateway)
- Batch payment updates (`PUT /api/tournaments/:id/teams/payment/batch`)

**Game-day operations:**
- QR check-in tokens (`generateCheckInQrToken`, `checkInViaQrToken`)
- Scorekeeper assignment per match
- Match start gating
- Court management
- Self-ref mode (`selfRefEnabled`): auto-assigns teams on break as referees, fairness-weighted
- Match incident tracking with SLA deadlines; organiser notified on breach

**Standings & brackets:**
- Head-to-head tiebreaker with deterministic fallback (wins → GD → GF → GA → team id)
- Manual bracket management (create/edit/delete matches)
- Auto or manual knockout generation from group standings

**Organiser tools:**
- Tournament admin delegation (scoped permissions)
- Score dispute create/review/resolve
- Analytics endpoint (`GET /api/tournaments/:id/analytics`): registration funnel, match throughput, disputes, SLA, payment revenue
- Public portal (`GET /api/tournaments/portal/:shareToken`) — no auth required

**Teamup sessions** — ad-hoc open-invite sport sessions (separate from tournaments and group events)

---

## What Is Tested

> Run: `npm test` (backend, Vitest) from the repo root.

### Backend — ~620 tests (Vitest, all passing)

| Area | File(s) | Coverage |
|---|---|---|
| Tournament lifecycle policy | `tournamentLifecyclePolicy.test.ts` | Policy rules, all status transitions |
| Tournament service | `tournamentService.test.ts` | Brackets, standings, tiebreakers, group-knockout completion guard |
| Scheduled jobs | `scheduledJobs.test.ts` | Auto lifecycle sync, SLA checks, payment reminders |
| Auth service | `authService.test.ts` | Register, login, tokens, lockout |
| Group service | `groupService.test.ts` + `.extended` | ~98.9% coverage; permissions, invites, capacity |
| Event service | `eventService.test.ts` + `.extended` | ~95.6% coverage; CRUD, participants, activity |
| Notification service | `notificationService.test.ts` + `.extended` | ~93.8% coverage; filtering, bulk ops, cross-type |
| Invite service | `inviteService.test.ts` | Token validation, expiry, self-invite prevention, capacity |
| Permission service | `permissionService.test.ts` | Role checks, cache invalidation |
| Session service | `sessionService.test.ts` + `.extended` + `sessionValidation.test.ts` | Sessions, validation |
| TeamUp service | `teamUpService.test.ts` | Teamup CRUD, notifications |
| Cache / query opt | `cacheService.test.ts`, `queryCache.test.ts`, `queryOptimizationService.test.ts` | Cache hit/miss, DataLoader patterns |
| Push / email / SSE | `pushNotificationService.test.ts`, `emailQueueService.test.ts`, `sseService.test.ts` | Notification delivery paths |
| Bulk notifications | `bulkNotificationService.test.ts` | Batch insert performance path |
| Metrics / jobs | `metricsService.test.ts`, `jobQueueService.test.ts` | Prometheus, queue ops |
| Utilities | `src/backend/__tests__/utils/` | Validation helpers |
| Middleware | `src/backend/__tests__/middleware/` | Auth middleware, rate-limit |

### Archived frontend tests (React — no longer active)

Previously 128 tests (9 component + 119 responsive). The React frontend is archived; these tests are not maintained.

---

## What Is NOT Tested

The following areas have **no automated test coverage** and represent known gaps:

| Area | Risk | Notes |
|---|---|---|
| Express route layer | Medium | Route tests exist as stubs but are `skipped` (integration tests requiring live DB). No supertest integration suite. |
| Tournament controller handlers | High | Only the service layer is unit-tested; controller logic (auth checks, input coercion, response shaping) is untested. |
| Mobile / Flutter | High | No automated tests for any Flutter screens, repositories, or use-cases. Only manual testing has been done. |
| OAuth flow (end-to-end) | Medium | OAuth callback routes and Passport strategies have no test coverage. |
| Email delivery | Medium | `emailQueueService` is unit-tested with mocks; actual Nodemailer delivery is not integration-tested. |
| Redis fallback paths | Low-Medium | Code paths when Redis is unavailable fall back to in-memory; the fallback itself is not tested. |
| Concurrent/idempotency mutations | High | Race conditions in registration, waitlist promotion, and match start are documented risks with no concurrency tests. |
| Tournament analytics aggregation | Medium | The analytics endpoint is not unit-tested. |
| Public portal (shareToken) | Low | Happy-path integration test missing. |
| Double-elimination bracket routing | Medium | `bracketSide`/`loserGoesToMatchId` logic is not specifically covered by tests. |
| Payment reminder deduplication | Low | `paymentReminderKey` logic is exercised in scheduledJobs tests at a high level only. |

---

## Priority Roadmap

### P0 — Stabilise (do first, blocks everything else)

1. **Integration test skeleton** — Set up a Vitest integration suite with a test database (or Prisma mock) so route-level and controller-level logic can be covered. Specifically target the tournament controller handlers.
2. **Flutter test baseline** — Add `flutter test` to CI with at least widget smoke tests for the 3 most critical screens: tournament detail, bracket visualisation, and registration flow.
3. **Concurrency / idempotency tests** — Cover high-risk mutations: team registration, waitlist promotion, match start, and score submission under concurrent requests.

### P1 — Tournament domain refactor (ongoing)

4. **Split tournament backend by subdomain** — Follow `docs/TOURNAMENT_DOMAIN_REFACTOR_MAP.md`:
   - Controllers: `lifecycle`, `registration`, `pool`, `bracket`, `matchOps`, `incident`, `analytics`
   - Services: same split
   - Routes file stays thin (orchestration only)
5. **Standardise tournament API responses** — All tournament endpoints return `{ data, pagination? }`.
6. **Mobile: break up `tournament_detail_page.dart`** — Extract into section widgets under `presentation/detail/` (`overview_section`, `teams_section`, `matches_section`, `operations_section`, `status_components`).
7. **Centralise mobile status presentation** — Remove duplicated switch logic for status labels/colours/icons; centralise in one Dart helper.

### P2 — Product completeness

8. **Live payment gateway** — Integrate Stripe (or similar) to replace manual payment-status tracking.
9. **Real-time updates in the Flutter app** — Wire up the existing SSE endpoint to the Flutter app so bracket updates and score changes push without polling.
10. **Tournament public portal UI** — Build the Flutter screens that consume the `shareToken` portal endpoint (spectator view: schedule, standings, bracket).
11. **Private group invite tokens** — Fully implement private group joining via invite tokens (currently limited to public groups).
12. **E2E tests** — Consider Playwright for API E2E and/or Flutter integration tests for the full registration → tournament → results journey.

### P3 — Nice to have / future

13. **Gamification** — Achievements, seasonal stats, leaderboards across groups.
14. **Maps / venue discovery** — Google Maps integration for finding courts, stadiums, pitches near a location.
15. **Microservices split** — `tournament-service`, `community-service`, `notification-service` stubs exist in `package.json` scripts; the actual split is a long-term concern once the monolith is stable.
16. **iOS / Android deployment pipeline** — CI builds for Flutter native targets (currently only web is in CI).

---

## Work Left To Do

### Immediate (sprint-level)

- [ ] Add `supertest`-based integration tests for at minimum: `POST /api/tournaments`, `POST /api/tournaments/:id/register`, `PUT /api/tournaments/:id/status`, `POST /api/tournaments/:id/matches/:matchId/score`.
- [ ] Add Flutter widget tests for `tournament_detail_page.dart`, `bracket_visualization_page.dart`, and `registration_flow`.
- [ ] Resolve the `tournament_detail_page.dart` god-file: it is the single largest source of untested UI logic.
- [ ] Privacy audit of public tournament endpoints — confirm no PII leaks on `GET /api/tournaments/portal/:shareToken`.
- [ ] Document all deprecated routes in `tournamentRoutes.ts` with planned removal dates.

### Medium term

- [ ] Complete tournament domain split per `docs/TOURNAMENT_DOMAIN_REFACTOR_MAP.md`.
- [ ] Add `invitedBy` field to `EventParticipant` model for invite audit trail.
- [ ] Email verification gate on invites (prevent inviting unverified accounts).
- [ ] Bulk invite rollback on partial failures.
- [ ] Prometheus alerts for: lifecycle sync failures, incident SLA breaches, payment deadline reminder failures.

### Long term / open questions

- [ ] Payment gateway selection and integration (Stripe vs regional alternatives).
- [ ] iOS/Android distribution (App Store / Play Store pipeline).
- [ ] Decide microservices split timeline (currently all logic lives in one Express app).
- [ ] Internationalisation (i18n) — translation system scaffold exists (`docs/guides/setup/TRANSLATIONS.md`) but is not complete.

---

## Development Quick-Start

### Prerequisites

- Node.js ≥ 20
- Docker + Docker Compose
- PostgreSQL 16 (or use Docker)
- Flutter SDK (for mobile work)

### Backend

```bash
# Install dependencies
npm ci

# Generate Prisma client (required before build or tests)
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database
node prisma/seed.js

# Start dev server (auto-reload)
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint
npm run lint:fix
```

### Docker (recommended for local)

```bash
docker-compose up -d       # starts postgres + backend
docker-compose logs -f     # tail logs
docker-compose down        # stop
```

Backend available at `http://localhost:3000`.

### Mobile / Web

```bash
cd src/mobile
flutter pub get
flutter analyze

# Run web
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000/api

# Run mobile (emulator/device)
flutter run
```

---

## Key File Map

| What you want to change | Where to look |
|---|---|
| Lifecycle / status transition rules | `src/backend/services/tournamentLifecyclePolicy.ts` |
| Tournament brackets, standings, pool ops | `src/backend/services/tournamentService.ts` |
| Tournament route handlers | `src/backend/controllers/tournament/_legacyController.ts` (+ `index.ts`) |
| Tournament routes (endpoint wiring) | `src/backend/routes/tournamentRoutes.ts` |
| Scheduled jobs (lifecycle sync, SLA, payment reminders) | `src/backend/services/scheduledJobs.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Shared TypeScript types | `src/shared/types/` |
| Tournament detail UI (Flutter) | `src/mobile/lib/features/tournaments/presentation/tournament_detail_page.dart` |
| Bracket UI (Flutter) | `src/mobile/lib/features/tournaments/presentation/bracket_visualization_page.dart` |
| Tournament repository (mobile) | `src/mobile/lib/features/tournaments/data/tournament_repository_impl.dart` |
| Environment config | `.env` (copy from `.env.example`) |
| Production readiness gates | `docs/TOURNAMENT_PRODUCTION_READINESS.md` |
| Operations runbook | `docs/TOURNAMENT_OPERATIONS_RUNBOOK.md` |
| Domain refactor ownership map | `docs/TOURNAMENT_DOMAIN_REFACTOR_MAP.md` |

---

## Deployment

### Local Docker

```bash
docker-compose up -d
```

### Azure (recommended production path)

```bash
chmod +x scripts/deployment/deploy-azure.sh
./scripts/deployment/deploy-azure.sh
```

Full guide: `docs/AZURE_DEPLOYMENT.md`

Estimated Azure cost: ~$30–40/month (Basic tier). Free tier available for testing.

### PM2 (bare-metal / VM)

```bash
npm run build
npm run pm2:start     # cluster mode, production env
npm run pm2:logs      # tail logs
npm run pm2:monit     # process monitor
```

Prisma migration baseline note: migrations are squashed into `prisma/migrations/20260520114500_initial_schema`. New environments run normally; existing pre-squash databases need history alignment or a reset.

---

## Environment Variables

```env
# Required
DATABASE_URL="******localhost:5432/teamly?schema=public"
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production

# Optional — OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=

# Optional — Redis (caching, rate-limiting, job queue)
REDIS_URL=redis://localhost:6379

# Optional — Email
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=

# Optional — Firebase (push notifications)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
```

Copy `.env.example` as your starting point. Never commit a populated `.env` file.

---

*Last updated: June 2026*
