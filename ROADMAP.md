# Teamly — Roadmap

**Date:** 2026-07-29 (updated 2026-08-03)
**Status:** Supplements `PROJECT_OVERVIEW.md` § Priority Roadmap with the verified current state as of this date. `PROJECT_OVERVIEW.md` remains the long-form source of truth for architecture/tech-stack/feature-set; this file tracks what's done vs. still open.

---

## Status Snapshot (updated 2026-08-03)

| Check | Result |
|---|---|
| `npx vitest run` (backend) | 2367 passed, 117 files, 0 failing |
| `npm run lint` | 0 errors |
| `npm run build` | Clean |
| `flutter test` (mobile) | 115 passed, 0 failing |
| Migration baseline | Single clean squashed migration, `prisma migrate status` verified up to date |
| Historical bug backlog (`to-dos-updated.md`, `TODOS_INCOMPLETE.md`) | All CRITICAL/HIGH items re-verified fixed in code — see `BUG_REFACTOR_REPORT.md` |

---

## P0 — Stabilise (complete)

- [x] Fix uncommitted risky in-place migration edit — baseline is now a single clean squashed migration folder.
- [x] Merge previously-uncommitted security/bug fixes (OAuth token exposure, refresh-token revocation on logout, waitlist self-confirm bypass, email XSS) — all confirmed present and committed in current code.
- [x] Integration test coverage for tournament controllers/routes — `tournamentController.test.ts` (~5,986 lines), `tournamentRoutes.test.ts`, `tournamentRaceConditions.test.ts`.
- [x] Flutter test baseline — grew from 0 real coverage to 115 tests across auth, sessions, groups, notifications, reminders, teamup, session requests, dashboard, comments, chat, and attendance/participant models.
- [x] Widen Flutter coverage to the previously-untested model layers: comments, chat, attendance, and the remaining `extended_models` (participants/guests/analytics/nearby). Still open (lower priority, need heavier widget/native-plugin mocking rather than plain model tests): discover, profile, two_factor, push_notifications UI/controller layers.
- [x] Confirm concurrency test coverage specifically for waitlist promotion and match-start races. Both were previously only covered indirectly (single-request idempotency checks, not genuine concurrent races) — added explicit `Match Start` and `Pool Waitlist Promotion` describe blocks to `tournamentRaceConditions.test.ts` modelling the real `updateMany`-guard and transactional capacity-recheck logic under `Promise.all`.

## P1 — Tournament domain refactor & mobile debt (ongoing)

1. **Split tournament backend by subdomain** per `docs/TOURNAMENT_DOMAIN_REFACTOR_MAP.md`. IN PROGRESS (2026-08-03): the domain-specific controller files already existed as thin re-export shims to `tournamentCoreController.ts`; Analytics (`tournamentAnalyticsController.ts` + new `services/tournament/analyticsService.ts`) and Score Disputes (`tournamentDisputeController.ts`) are now fully extracted with real implementations. `tournamentCoreController.ts` shrank from 6,068 → 4,845 lines. Remaining domains (team/player/match/pool/registration/game-day/admin/category/invitation/portal/clone) still shimmed — same low-risk extraction pattern documented in the refactor map for follow-up sessions.
2. **Standardise tournament API responses** to `{ data, pagination? }` across all endpoints. Already the case for most list endpoints (`getTournamentMatches`, `getPools`, `getPublicTournaments`, `getTournamentNotifications`); not yet applied retroactively to non-list endpoints like `getTournamentAnalytics` (would be a breaking API change for the existing mobile client — needs a coordinated update, not done opportunistically).
3. **Split `tournament_detail_page.dart`** — IN PROGRESS (2026-08-03): extracted 8 leaf presentational widgets into `presentation/detail/status_components.dart` (3,948 → 3,656 lines). Remaining: `teams_section.dart`, `matches_section.dart`, `overview_section.dart` (larger, more entangled with Riverpod providers — follow-up work).
4. **Centralise mobile status presentation** — DONE. Verified `tournament_status_policy.dart` + `tournament_status_presentation.dart` already provide the single source of truth for tournament status labels/colours/icons; no remaining duplication found.
5. **Fix the pre-existing failing mobile test** — DONE (2026-08-03). Root cause: `_buildProjectedKnockoutMatches` was fully implemented but never wired into the widget tree. Now renders a "Projected Playoffs" preview bracket from group standings before the official knockout bracket exists. Full `flutter test`: 96 passed, 0 failing.

## P2 — Product completeness

6. **Live payment gateway** (Stripe or similar) to replace manual payment-status tracking.
7. **Real-time updates in the Flutter app** — wire the existing SSE endpoint into the mobile client so bracket/score updates push without polling.
8. **Tournament public portal UI** — Flutter screens consuming the `shareToken` portal endpoint (spectator view).
9. **Private group invite tokens** — full implementation (currently limited to public groups).
10. **E2E tests** — Playwright for API E2E and/or Flutter integration tests for the full registration → tournament → results journey.

## P3 — Nice to have / future

11. Gamification (achievements, seasonal stats, cross-group leaderboards).
12. Maps/venue discovery (Google Maps integration).
13. Microservices split (`tournament-service`, `community-service`, `notification-service` stubs already exist; full split is long-term).
14. iOS/Android deployment pipeline (CI currently only builds web).

---

## Completed This Session (2026-07-29)

- Verified and confirmed resolution of the migration-file risk and all previously-uncommitted bug fixes flagged in `PROJECT_ANALYSIS_2026-07-22.md`.
- Verified `poolNumber`/`poolId` mutual-exclusion guard and `loserGoesToMatchId` FK enforcement (former open items 56/57) are both implemented.
- Added 15 new mobile test files (95 tests) covering previously-untested state notifiers and model parsing logic across 8 feature areas.
- Full re-audit of the historical bug backlog (`to-dos-updated.md`) against current code — see `BUG_REFACTOR_REPORT.md` for the complete evidence table.

---

## Reference Docs

- `PROJECT_OVERVIEW.md` — architecture, tech stack, full feature set, dev quick-start.
- `BUG_REFACTOR_REPORT.md` — this session's bug re-audit and open refactoring items.
- `docs/TOURNAMENT_DOMAIN_REFACTOR_MAP.md` — module boundaries for the P1 tournament domain split.
- `docs/TOURNAMENT_OPERATIONS_RUNBOOK.md` — operations reference.
