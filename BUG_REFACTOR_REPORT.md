# Teamly — Bug & Refactoring Report

**Date:** 2026-07-29
**Purpose:** `to-dos-updated.md` and `TODOS_INCOMPLETE.md` are historical working notes (per `PROJECT_OVERVIEW.md`, superseded by that file). This report re-audits their bug backlog directly against the current codebase — every item below was individually re-verified by reading the relevant source on 2026-07-29, not assumed from the old docs. It also lists genuinely open refactoring work.

---

## Section 1 — Previously Reported Bugs Re-Verified as FIXED

| ID | Severity | Summary | Verified evidence |
|---|---|---|---|
| — | Critical | Uncommitted in-place edit to an already-applied migration (data-drift risk) | Only one migration folder exists (`20260617120000_initial_all`); `git diff` against it is empty |
| A | Critical (OWASP A02) | OAuth callback exposed access+refresh tokens in URL query params | `authOAuthController.ts` uses `redirectUrl.hash = fragment` (URL fragment, not query string) |
| B | High (OWASP A03/XSS) | Email templates interpolated user strings without HTML-escaping | `scheduledJobs.ts` imports and calls `escapeHtml()` around every user-controlled interpolation (recipient name, session/tournament title, location) |
| C | High (OWASP A07) | Single-device logout didn't revoke the refresh token | `jwt.ts` `revokeToken()` deletes the associated refresh token(s), not just the access-token blacklist entry |
| D | High | Waitlisted users could self-confirm, bypassing capacity | `sessionParticipationController.ts` `updateParticipationStatus()` explicitly throws `ForbiddenError` when a waitlisted participant tries to self-set `confirmed` |
| E / Item 48 | Medium-High | `GroupJoinRequest` had no DB unique constraint (race → duplicate pending requests) | `schema.prisma` has `@@unique([groupId, userId])` on `GroupJoinRequest` |
| F / Item 4 | Medium | `revertStandings()` could drive standings negative | Read-modify-write clamp implemented: decrements run, then a follow-up `updateMany` with `{ lt: 0 }` guards clamps `goalsFor`/`goalsAgainst` back to 0 |
| G | Medium | `syncAllSessionStatuses` used dynamic `require()` instead of a static import | `scheduledJobs.ts` uses `import { determineSessionStatus } from './sessionService'` |
| H | Medium | Session invite-token expiry wasn't checked on token-based endpoints | Both `getEventByInviteToken()` and `joinEventAsGuest()` in `sessionGuestController.ts` check `inviteTokenExpiresAt` and throw/reject when expired |
| I | Medium | Payment deadline reminder fired only *after* the deadline passed | `scheduledJobs.ts` now queries `paymentDeadline: { gte: now, lte: cutoff }` (forward-looking window) |
| J | Medium | `requirePaymentForBrackets` used hardcoded `'paid'/'waived'` string literals | `tournamentCoreController.ts` uses `TournamentPaymentStatus.PAID` / `.WAIVED` enum members |
| K | Medium | Score dispute resolution didn't recompute standings after a corrected score | `resolveScoreDispute()` calls `tournamentService.revertStandings()` then `updateStandings()` inside the same transaction when a correction is applied |
| L | Low | `confirmOAuthLink` could crash on a non-string in-memory cache value | `authOAuthController.ts`: `typeof raw === 'string' ? JSON.parse(raw) : raw` guard present |
| M | Low | `syncTeamPaymentStatuses` loaded all payment transactions with no pagination | `scheduledJobs.ts` paginates with `take: pageSize` in a cursor loop |
| N / Item 49 | Low | `GroupMessage.userId` FK had no `onDelete` clause and no index | `schema.prisma`: `onDelete: SetNull` on the FK, plus `@@index([userId])` |
| Item 50 | — | No message edit/delete in group chat | `groupChatRoutes.ts` has `PATCH /message/:id` and `DELETE /message/:id` wired to `chat.updateMessage`/`chat.deleteMessage` |
| Item 51 | — | No rate limiter on group chat messages | `groupChatRoutes.ts` applies `groupMessageLimiter` to `POST /message` |
| Item 55 | — | No composite index covering standings sort queries | `TournamentStanding` has `@@index([tournamentId, groupName, points, goalsFor, goalsAgainst, wins, losses])` |
| Item 56 | — | `poolNumber` (legacy) and `poolId` (new) coexisted with no cross-validation | `tournamentCoreController.ts` explicitly throws `BadRequestError` when both are provided together |
| Item 57 | — | `loserGoesToMatchId` had no FK enforcement | `schema.prisma`: `loserGoesToMatch TournamentMatch? @relation("LoserMatchRouting", fields: [loserGoesToMatchId], ...)` |

**Conclusion:** every CRITICAL/HIGH item and all but three lower-priority items from the historical backlog are fixed in the current codebase. The security-sensitive items (A, B, C, D) are the most important confirmations here since they involve auth/session integrity.

---

## Section 2 — Items Not Re-Verified This Pass (Recommend Follow-Up Audit)

These were marked `OPEN` in `to-dos-updated.md` and were **not** specifically re-checked in this session (time-boxed); they are low/medium severity and should get a dedicated look rather than being assumed fixed or broken:

| Item | Summary |
|---|---|
| 33 | Attendance pre-event logic — guards exist but edge-case state transitions weren't explicitly re-traced. |
| 34 | Recurring sessions may propagate `endTime: null` downstream into duration calculations. |
| 35 | No cache-stampede ("thundering herd") protection around session cache reads under concurrent load. |

---

## Section 3 — Open Refactoring Work

1. **`tournament_detail_page.dart` god file** — still 3,756 lines, unsplit. Highest-value mobile refactor (see `ROADMAP.md` P1).
2. **Tournament domain split** per `docs/TOURNAMENT_DOMAIN_REFACTOR_MAP.md` — controllers/services not yet separated by subdomain (`lifecycle`/`registration`/`pool`/`bracket`/`matchOps`/`incident`/`analytics`).
3. **Standardise tournament API response shape** — not all endpoints return `{ data, pagination? }` consistently.
4. **Centralise mobile tournament status presentation** — status label/colour/icon switch logic is duplicated across widgets instead of one shared helper.
5. **Mobile test coverage gaps** — comments, discover, profile, push_notifications, two_factor, `chat_model`, `attendance_model`, and `extended_models` (participants/guests/analytics) still have no dedicated unit tests.

---

## Section 4 — Known Test Issues

- **`test/features/tournaments/presentation/bracket_visualization_page_test.dart`** — 3 assertions fail expecting text `"Projected Playoffs"` that isn't rendered. Confirmed pre-existing (reproduces in isolation with no other changes present) and unrelated to any work done this session. Needs investigation — likely a widget-timing issue or a stale expectation vs. actual UI copy.

---

## Section 5 — Uncommitted Work As Of This Report

- `git status` shows `src/backend/__tests__/routes/authRoutes.test.ts` modified (test now exercises real `jwt`/`authService` implementations instead of over-mocking them, for genuine integration coverage).
- New untracked mobile test directories: `test/features/{auth,dashboard,groups,notifications,reminders,session_requests,sessions,teamup/state}` — 95 new mobile tests added this session, not yet committed.

**Recommendation:** review and commit both before starting the P1 refactor work above, so the new safety net is preserved in version control.
