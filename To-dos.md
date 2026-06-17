# Deep Analysis — Bugs & Issues in Teamly (Refactored)

## Summary
- **Scope:** consolidated issue list grouped by feature and priority.
- **Actionable sections:** `Tournaments`, `Sessions`, `TeamUps`, `Groups`, `Schema`
- **Priority counts:** P0: 10, P1: 15, P2: 8, P3: 21


## Tournaments

### Critical — Data integrity & race conditions
1. updateStandings() not transactional (tournamentService.ts) — two separate upserts for home/away can leave standings inconsistent if one fails. — [x]
2. Concurrent score submissions trigger duplicate bracket generation (tournamentService.ts, scheduledJobs.ts) — multiple runners can all pass completion checks and each call bracket generation. — [x]
3. Standings not initialized for teams without played matches — teams with no recorded standing are skipped by playoff logic. — [x]
4. goalsFor/goalsAgainst can go negative (revertStandings()) — decrement without floor check corrupts tiebreaker math. — [x]
5. No rollback for partial bracket generation failures — orphaned matches when later steps throw. — [x]
6. Registration idempotency missing — captain can register multiple teams if requests race before DB constraint enforcement. — [x]

### Critical — State machine & lifecycle
7. Score submissions allowed when tournament is `DRAFT` or `COMPLETED` — no guard on tournament.status. — [x]
8. Tournament can become `IN_PROGRESS` with only `CANCELLED` matches — lifecycle checks don't filter cancelled matches. — [x]
9. Format mutable mid-tournament — changing `format` after `IN_PROGRESS` breaks downstream assumptions. — [x]
10. Cancellation has no refund execution path (tournamentLifecyclePolicy.ts) — flag checked but no refund processing implemented. — [x]

### Critical — Bracket & group logic
11. Head-to-head tiebreaker effectively a no-op — metric never computed from matches. — [x]
12. Bye matches set scores but remain `SCHEDULED` — advance logic expects `COMPLETED`. — [x]
13. Second grand final created prematurely in double-elimination — missing completion check for first final. — [x]
14. Group stage matches missing `roundNumber` — advancement filters by roundNumber and fails. — [x]
15. `loserGoesToMatchId` not validated — destinations can be missing or cross-tournament. — [x]
16. Third-place match created with no valid loser on a draw — semifinal draw leads to invalid third-place match. — [x]
17. No overtime/penalty mechanism for knockout draws — tied knockout matches block advancement. — [x]

### High — Registration & payment
18. `autoPromoteRegistrationWaitlist` flag unused — waitlist never auto-promotes. — [x]
19. Waitlist endpoints inconsistent (`DELETE /:id/registration-waitlist/me` vs `/:teamId`) — legacy route bypasses ownership checks. — [x]
20. `paymentStatus` not reconciled with payment transactions — no sync job. — [x]
21. Bracket generation ignores unpaid teams — no payment check during seeding. — [x]
22. Payment deadline reminder query uses `lte` instead of `lt` (scheduledJobs.ts) — causes duplicate reminders on exact tick. — [x]

### Medium — Scheduled jobs & lifecycle sync
23. Manual cancellation doesn't clear `lastSyncedAt` cache (scheduledJobs.ts) — subsequent runs reprocess cancelled tournaments. — [x]
24. Failed scheduled tasks silently swallowed — Promise.allSettled results not retried. — [x]
25. `normalizePlayoffSize()` silently defaults invalid values to 8 without logging. — [x]

---

## Sessions

### Critical
26. `joinEventViaInvite` skips group membership check (sessionParticipationController.ts) — invite flow allows joining private sessions without membership. — [x]
27. Concurrent waitlist promotions double-promote the same user — race in promotion logic. — [x]
28. `exceptionDates` parsed without error handling (sessionRecurringController.ts) — malformed data can crash the endpoint. — [x]
29. Session `status` never auto-updates — background job missing, stale analytics. — [x]

### High
30. Guest management bypasses `permissionService` (sessionGuestController.ts) — only creator check used; admins can't delegate. — [x]
31. Guest list readable by group members but writable only by creator — inconsistent access model. — [x]
32. No unique constraint on `(sessionId, name)` for guest participants — duplicates possible under concurrency.

### Medium
33. Attendance pre-event logic inconsistent (attendanceController.ts) — guards allow unintended states.
34. Recurring sessions propagate `endTime: null` when original has no `endTime` — duration calc returns null.
35. Cache invalidation pattern causes thundering herd for sessions.

---

## TeamUps

### Critical
36. Reapply eligibility checks are contradictory (teamUpApplicationController.ts) — conflicting guards produce unpredictable behavior. — [x]
37. Slot availability checked outside transaction — slot claim race window before DB transaction. — [x]

---

## Groups

### Critical
38. Group capacity exceeded under concurrency (groupService.ts) — check then insert separated by transactions. — [x]
39. Join request approval has same race condition (groupJoinController.ts). — [x]
40. Invite token expiration never validated — invite links effectively permanent. — [x]

### High
41. [x] OAuth linking can silently take over accounts (authOAuthController.ts) — implemented dedicated linking flow and routes.
42. [x] Revoked refresh tokens still produce access tokens (jwt.ts) — added revoked-token blacklist check during refresh.
43. [x] Refresh tokens rotated on use — refresh flow now issues a new refresh token and updates DB on use.
44. [x] Email verification tokens expire — `emailVerificationExpires` added and validation enforced.
45. [x] 2FA and password failures now have separate counters (authCredentialsController.ts).
46. [x] 2FA failure increments and lockout made atomic (authService.ts + controllers).
47. [x] Permission cache invalidated on group role changes (groupMemberController.ts).

### Medium
48. No unique constraint on pending join requests `(groupId, userId)`.
49. `GroupMessage` missing index on `userId` — deletes by user cause full scans.
50. No message edit/delete endpoints in group chat — can't retract content.
51. No rate limiter on group messages — spam risk.
52. `sanitizeGroupData()` unclear if HTML escaped — potential stored XSS.
53. Coordinate range not validated — invalid lat/lon accepted.
54. No cascade delete for `RefreshToken` on user deletion — orphaned tokens.

---

## Schema & Cross-feature

55. Missing composite index on `(tournamentId, teamId, groupName)` for standings upserts — performance/full-scan risk.
56. `poolNumber` (legacy) and `poolId` (new) can both be set — conflicting authoritative fields.
57. `loserGoesToMatchId` stored without FK validation — stale/cross-tournament references possible.

---

## Next steps / Suggested prioritization
- P0 (data corruption/security): block PRs, write tests & migration for critical schema constraints, add transactions and idempotency guards.
- P1 (core flows): add state checks, compute missing metrics (H2H), implement bye/overtime handling.
- P2 (race conditions): add DB transactions, unique constraints, and stronger transaction isolation where needed.
- P3 (features/ops): add missing features (message deletion, refresh rotation) and improve logging/alerts.

- **Tests & PR:** added tests for refund/idempotency/detailedScore, fixed fixtures, ran full test suite (2335 passed), and drafted `CHANGELOG.md` and `PR_DRAFT.md`.
 - **Scheduled jobs:** added retry for failed session reminders to avoid silent drops and improved logging for reminder retries.
 - **Backfill script:** `backfillTournamentLifecycleStatuses.ts` now invalidates the in-memory lifecycle sync cache after manual status updates.
 - **Playoff sizing:** `normalizePlayoffSize()` logs and defaults to 8 when an unsupported value is provided.
 - **Sessions:** `joinEventViaInvite` now enforces membership/access, waitlist promotions use serializable transactions to avoid double-promote, `exceptionDates` parsing is validated with clear errors, and `syncAllSessionStatuses()` added to scheduled jobs.
 - **Sessions (guest management):** guest list write permissions now honor session management permissions (creator OR group admins). We recommend adding a DB unique constraint on `(sessionId, name)` for `guestParticipant` to fully eliminate duplicate-name races (mitigated with serializable transactions in code).
 - **TeamUps:** fixed reapply eligibility checks and moved slot-claiming/bulk-accept logic into serializable transactions (`teamUpApplicationController.ts`, todos 36-37).
 - **Groups:** fixed group capacity checks, made join-approval atomic, and added invite token expiry validation (`groupService.ts`, `groupJoinController.ts`).
 - **Groups:** fixed group capacity checks, made join-approval atomic, and added invite token expiry validation (`groupService.ts`, `groupJoinController.ts`).
 - **Auth:** added OAuth link start/confirm endpoints and tests; refresh flow now rejects revoked refresh tokens (`auth-service`, `utils/jwt.ts`).


If you want, I can: create a condensed JIRA/issue tracker export, split these into individual issues, or open PR templates for the highest-priority fixes.