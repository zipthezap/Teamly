# Teamly — Roadmap

**Date:** 2026-07-29
**Status:** Supplements `PROJECT_OVERVIEW.md` § Priority Roadmap with the verified current state as of this date. `PROJECT_OVERVIEW.md` remains the long-form source of truth for architecture/tech-stack/feature-set; this file tracks what's done vs. still open.

---

## Status Snapshot (verified 2026-07-29)

| Check | Result |
|---|---|
| `npx vitest run` (backend) | 2363 passed, 117 files, 0 failing |
| `npm run lint` | 0 errors |
| `npm run build` | Clean |
| `flutter test` (mobile) | 95 passed, 1 pre-existing unrelated failure |
| Migration baseline | Single clean squashed migration, `prisma migrate status` verified up to date |
| Historical bug backlog (`to-dos-updated.md`, `TODOS_INCOMPLETE.md`) | All CRITICAL/HIGH items re-verified fixed in code — see `BUG_REFACTOR_REPORT.md` |

---

## P0 — Stabilise (mostly complete)

- [x] Fix uncommitted risky in-place migration edit — baseline is now a single clean squashed migration folder.
- [x] Merge previously-uncommitted security/bug fixes (OAuth token exposure, refresh-token revocation on logout, waitlist self-confirm bypass, email XSS) — all confirmed present and committed in current code.
- [x] Integration test coverage for tournament controllers/routes — `tournamentController.test.ts` (~5,986 lines), `tournamentRoutes.test.ts`, `tournamentRaceConditions.test.ts`.
- [x] Flutter test baseline — grew from 0 real coverage to 95 tests across auth, sessions, groups, notifications, reminders, teamup, session requests, and dashboard state/model layers.
- [ ] Widen Flutter coverage to the still-untested areas: comments, discover, profile, push_notifications, two_factor, chat_model, attendance_model, extended_models (participants/guests/analytics).
- [ ] Confirm concurrency test coverage specifically for waitlist promotion and match-start races (race-condition suites exist for league/session/tournament/auth — verify these two scenarios are explicitly covered, not just adjacent ones).

## P1 — Tournament domain refactor & mobile debt (ongoing)

1. **Split tournament backend by subdomain** per `docs/TOURNAMENT_DOMAIN_REFACTOR_MAP.md` (controllers/services: `lifecycle`, `registration`, `pool`, `bracket`, `matchOps`, `incident`, `analytics`). Not started.
2. **Standardise tournament API responses** to `{ data, pagination? }` across all endpoints. Not started.
3. **Split `tournament_detail_page.dart`** (still 3,756 lines) into `presentation/detail/` sub-widgets (`overview_section`, `teams_section`, `matches_section`, `operations_section`, `status_components`). Not started — the single largest source of untested/unmaintainable mobile UI logic.
4. **Centralise mobile status presentation** — remove duplicated switch statements for tournament status labels/colours/icons into one shared helper. Not started.
5. **Fix the pre-existing failing mobile test** — `test/features/tournaments/presentation/bracket_visualization_page_test.dart` has 3 failing assertions expecting text "Projected Playoffs" that isn't found; reproduces in isolation, needs a dedicated investigation (see `BUG_REFACTOR_REPORT.md` § Known Test Issues).

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
