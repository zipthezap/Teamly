# Incomplete Todos — Comprehensive Action List

**Last Updated:** 2026-07-07  
**Total Outstanding Items:** 1 (10 original open)

---

## 🚨 CRITICAL — Block Merge (Hotfix Required)

### Bug A: OAuth Tokens Exposed in URL Query Parameters
- **Severity:** CRITICAL (OWASP A02)
- **File:** `src/backend/controllers/authOAuthController.ts` — `oauthCallback()`
- **Problem:** Access and refresh tokens in URL query parameters → logged in server logs, stored in browser history, leaked in Referer headers
- **Fix Options:**
  - Option 1: Use URL fragment instead of query params: `redirectUrl.hash = 'token=...'`
  - Option 2: Implement server-side state code exchange with one-time token delivery
- **Complexity:** Medium
- **Status:** Completed

### Bug C: Single-Device Logout Bypass — Refresh Token Not Revoked
- **Severity:** CRITICAL (OWASP A07)
- **File:** `src/backend/utils/jwt.ts` — `revokeToken()`
- **Problem:** `revokeToken()` adds access token to blacklist and deletes UserSession, but **does not delete the RefreshToken**. User can still call `POST /auth/refresh` after logout to get new access token.
- **Fix:**
  ```typescript
  await prisma.refreshToken.deleteMany({
    where: {
      userId,
      ...(deviceId ? { deviceId } : {}),
    },
  });
  ```
- **Complexity:** Trivial (low-risk change)
- **Status:** Completed

### Bug D: Waitlisted Users Can Self-Confirm, Bypassing Capacity
- **Severity:** HIGH (data integrity exploit)
- **File:** `src/backend/controllers/sessionParticipationController.ts` — `updateParticipationStatus()`
- **Problem:** Hardcoded `selfAssignableStatuses = ['confirmed', 'declined', 'pending']` allows waitlisted users to self-set status to `confirmed` without capacity check
- **Fix:** Remove `'confirmed'` from self-assignable list OR add guard:
  ```typescript
  if (newStatus === 'confirmed' && currentParticipation.status === 'waitlisted') {
    throw new ForbiddenError('Cannot self-confirm from waitlisted status');
  }
  ```
- **Complexity:** Trivial
- **Status:** Completed — added guard preventing waitlisted users from self-confirming in `src/backend/controllers/sessionParticipationController.ts`

---

## ⚠️ HIGH PRIORITY — Next Sprint

### Bug B: Email Templates Vulnerable to XSS — No HTML Escaping
- **Severity:** HIGH (OWASP A03)
- **Files:** `src/backend/services/scheduledJobs.ts` and any email template construction
- **Problem:** User-controlled strings (names, titles, group names) interpolated into HTML email without `escapeHtml()`. Attackers can inject script via usernames.
- **Current:** `sanitizeString()` only trims whitespace; `escapeHtml()` utility exists but unused
- **Fix:** Wrap all user strings in email templates with `escapeHtml()`:
  ```typescript
  import { escapeHtml } from '../utils/validation';
  const emailBody = `<p>Hello ${escapeHtml(user.name)},</p>`;
  ```
- **Complexity:** Low (mechanical audit + search/replace)
- **Status:** Completed

### Item 4: `revertStandings()` Floor Guard — Data Corruption
- **Severity:** HIGH (data correctness)
- **File:** `src/backend/services/tournamentService.ts` — `revertStandings()`
- **Problem:** ~~Marked [x] in original todos but~~ Prisma's `{ decrement: N }` has no floor. Stats can go negative under data inconsistency, corrupting tiebreaker sort order.
- **Fix Options:**
  - Option A: Read-modify-write with `Math.max(0, ...)`
  - Option B: Add DB `CHECK` constraint via migration
- **Complexity:** Medium
- **Status:** Completed — implemented read-modify-write with non-negative clamps in `src/backend/services/tournamentService.ts`

### Bug K: Score Dispute Resolution Doesn't Recompute Standings
- **Severity:** MEDIUM-HIGH (standings inconsistency)
- **File:** `src/backend/tournament-service/controllers/tournament/tournamentCoreController.ts` — `resolveScoreDispute()`
- **Problem:** When organizer corrects a disputed score, the match updates but standings remain frozen at original disputed score
- **Fix:** After updating match score, call:
  ```typescript
  await tournamentService.revertStandings(match.id, tx);
  await tournamentService.updateStandings(match.id, tournament, tx);
  ```
- **Complexity:** Medium
- **Status:** Completed — recomputes standings after score correction using `correctedMatch.id` in `src/backend/tournament-service/controllers/tournament/tournamentCoreController.ts`

### Bug E: `GroupJoinRequest` Missing DB Unique Constraint
- **Severity:** MEDIUM-HIGH (concurrent request race condition)
- **File:** `prisma/schema.prisma` — `GroupJoinRequest` model
- **Problem:** No `@@unique([groupId, userId])`. Concurrent requests can bypass code-level check and create duplicate pending requests.
- **Fix:** Add to schema:
  ```prisma
  @@unique([groupId, userId])
  ```
  Or partial index (pending only):
  ```sql
  CREATE UNIQUE INDEX "group_join_request_pending_unique"
    ON "GroupJoinRequest"("groupId", "userId")
    WHERE status = 'PENDING';
  ```
-- **Complexity:** Low (migration only)
-- **Status:** Completed — added `@@unique([groupId, userId])` to `prisma/schema.prisma` (prisma client generated; run `npm run prisma:migrate` to apply)

---

## 📋 MEDIUM PRIORITY — This Sprint/Next

### Bug G: `syncAllSessionStatuses` Uses Dynamic `require()` Instead of Static Import
- **Severity:** MEDIUM (code quality)
- **File:** `src/backend/services/scheduledJobs.ts` — `syncAllSessionStatuses()`
- **Problem:** CommonJS `require()` inside async function bypasses type-checking, not tree-shaken, crashes silently if path changes
- **Fix:** Replace with ES6 import at top of file:
  ```typescript
  import { determineSessionStatus } from './sessionService';
  ```
- **Complexity:** Trivial
- **Status:** Completed — replaced dynamic `require()` with static import in `src/backend/services/scheduledJobs.ts`

### Bug H: Session Invite Token Expiry Never Checked
- **Severity:** MEDIUM (expired links still work)
- **File:** `src/backend/controllers/sessionParticipationController.ts` — `getEventByInviteToken()` and `joinEventAsGuest()`
- **Problem:** Group invite tokens validated for expiry but session invite tokens (`Session.inviteTokenExpiresAt`) are never checked. Expired session links still return data and allow joins.
- **Fix:** Add expiry check in both endpoints:
  ```typescript
  if (session.inviteTokenExpiresAt && new Date() > new Date(session.inviteTokenExpiresAt)) {
    throw new ForbiddenError('This invite link has expired');
  }
  ```
- **Complexity:** Low
- **Status:** Completed — added expiry checks in `getEventByInviteToken()` and `joinEventAsGuest()` in `src/backend/controllers/sessionGuestController.ts`

### Bug I: Payment Deadline Reminder Fires AFTER Deadline Passes
- **Severity:** MEDIUM (useless notifications)
- **File:** `src/backend/services/scheduledJobs.ts` — `sendTournamentPaymentDeadlineReminders()`
- **Problem:** Query uses `paymentDeadline: { lt: now }` — selects **past** deadlines. Teams get reminder only after deadline elapsed.
- **Fix:** Send advance notice (e.g., 24h before):
  ```typescript
  const lookAheadHours = 24;
  const cutoff = new Date(now.getTime() + lookAheadHours * 60 * 60 * 1000);
  paymentDeadline: { gte: now, lte: cutoff }
  ```
- **Complexity:** Low
- **Status:** Completed

### Bug J: `requirePaymentForBrackets` Uses Hardcoded Strings Instead of Enums
- **Severity:** MEDIUM (maintainability / silent failure risk)
- **File:** `src/backend/tournament-service/controllers/tournament/tournamentCoreController.ts` — `generateGroupMatches()` and `generateBrackets()`
- **Problem:** Hardcoded `['paid', 'waived']` strings instead of enum values. Enum rename silently breaks payment gate.
- **Fix:** Use enum constants:
  ```typescript
  import { TournamentPaymentStatus } from '@prisma/client';
  paymentStatus: { notIn: [TournamentPaymentStatus.PAID, TournamentPaymentStatus.WAIVED] }
  ```
- **Complexity:** Trivial
- **Status:** Completed

### Bug L: `confirmOAuthLink` Crashes with In-Memory Cache
- **Severity:** LOW-MEDIUM (crash in non-Redis deployments)
- **File:** `src/backend/controllers/authOAuthController.ts` — `confirmOAuthLink()`
- **Problem:** `CacheService.get()` returns object directly (not JSON string) in in-memory mode. `JSON.parse()` on object throws error.
- **Fix:**
  ```typescript
  const raw = await CacheService.get(cacheKey);
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  ```
- **Complexity:** Trivial
- **Status:** Completed

### Bug M: `syncTeamPaymentStatuses` Loads All Transactions Without Pagination
- **Severity:** LOW (performance at scale)
- **File:** `src/backend/services/scheduledJobs.ts` — `syncTeamPaymentStatuses()`
- **Problem:** No pagination limit on `findMany({ where: { tournamentId: id } })`. Large tournaments load all rows into memory.
- **Fix:** Implement cursor-based pagination with `take: 500` batches
- **Complexity:** Low
- **Status:** Completed

### Bug N: `GroupMessage.userId` FK Missing `onDelete: SetNull`
- **Severity:** LOW (schema correctness)
- **File:** `prisma/schema.prisma` — `GroupMessage` model
- **Problem:** FK has no `onDelete` clause (defaults to RESTRICT). Hard user delete fails with FK violation if user has messages.
- **Fix:** Add to schema:
  ```prisma
  user  User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  ```
- **Complexity:** Trivial (migration)
- **Status:** Completed

---

## 📌 ORIGINAL OPEN ITEMS (Still Not Done)

### Item 33: Attendance Pre-Event Logic Inconsistent
- **Severity:** MEDIUM
- **Status:** OPEN
- **Issue:** Guards exist but may allow edge-case state transitions
- **Acceptance Criteria:** Verify and document valid state transitions for attendance

**Action taken:** Reviewed `src/backend/controllers/attendanceController.ts` and tightened state transition rules.
- **Changes:**
  - Disallow `waitlisted` participants from being marked as attending in any status.
  - Require `confirmed` participant status for marking `late`, unless the session creator marks attendance.
  - Preserve existing behaviour allowing invited participants to mark `on-time` before the event start.
- **Files modified:** `src/backend/controllers/attendanceController.ts`
- **Status:** Completed — validated code-level guards added.

### Item 34: Recurring Sessions Propagate `endTime: null`
- **Severity:** MEDIUM
- **Status:** OPEN
- **Issue:** Duration calculation downstream may return null for recurring sessions with no end time
- **Acceptance Criteria:** Ensure recurring sessions handle null end times correctly in all downstream callers

**Action taken:** Prevented null `endTime` propagation for generated recurring instances by applying a default duration when parent session lacks an `endTime`.
- **Changes:**
  - Defaulted recurring-instance duration to 1 hour when parent session `endTime` is null.
  - This avoids null `endTime` values in exported iCal/CSV and frontend instance rendering.
- **Files modified:** `src/backend/controllers/sessionRecurringController.ts`
- **Status:** Completed — instances now include computed `endTime`.

### Item 35: Cache Thundering Herd on Sessions
- **Severity:** MEDIUM
- **Status:** OPEN
- **Issue:** No cache stampede protection (singleflight/mutex) around session cache reads
- **Solution:** Implement singleflight pattern or mutex to prevent multiple simultaneous cache refreshes
- **Complexity:** Medium

**Action taken:** Implemented singleflight protection in `CacheService.wrap()` to prevent thundering herd.
- **Changes:**
  - Added an `inflight` promise map so concurrent cache-miss callers wait on a single computation.
  - Ensures only one backend hit occurs per cache key on miss, then caches the result.
- **Files modified:** `src/backend/services/cacheService.ts`
- **Status:** Completed — cache stampede risk mitigated at service layer.

### Item 48: `GroupJoinRequest` Missing `@@unique([groupId, userId])` (see Bug E above)
**Action taken:** `@@unique([groupId, userId])` already present in `prisma/schema.prisma`.
- **Files modified:** `prisma/schema.prisma`
- **Status:** Prisma client generated locally (`npm run prisma:generate`) — run `npm run prisma:migrate` to apply to the DB.

### Item 49: `GroupMessage` Missing `@@index([userId])`
- **Severity:** LOW
- **Status:** OPEN
- **Issue:** No explicit index on userId. Full table scans on user-scoped message deletes.
- **Fix:** Add migration:
  ```sql
  CREATE INDEX "GroupMessage_userId_idx" ON "GroupMessage"("userId");
  ```
- **Complexity:** Trivial

**Action taken:** Added `@@index([userId])` to `GroupMessage` model to improve user-scoped queries.
 - **Files modified:** `prisma/schema.prisma`
 - **Status:** Prisma client generated locally (`npm run prisma:generate`) — run `npm run prisma:migrate` to apply the index to the database.

### Item 50: No Message Edit/Delete in Group Chat
- **Severity:** LOW
- **Status:** OPEN
- **Issue:** `groupChatController.ts` has no PATCH/DELETE endpoints
- **Acceptance Criteria:** Implement message edit + delete with proper authorization checks
- **Complexity:** Low-Medium

**Action taken:** Implemented `PATCH /message/:id` and `DELETE /message/:id` with authorization rules.
- **Rules:** message owner OR `moderator`/`admin` can edit/delete messages.
- **Files modified:** `src/backend/controllers/groupChatController.ts`, `src/backend/routes/groupChatRoutes.ts`
- **Status:** Completed

### Item 51: No Rate Limiter on Group Messages
- **Severity:** MEDIUM
- **Status:** OPEN
- **Issue:** No rate limiting middleware on `POST /groups/:id/messages`
- **Solution:** Add rate limiter (e.g., 20 messages/minute per user per group)
- **Complexity:** Low

**Action taken:** Added `groupMessageLimiter` (20 messages/minute per user per group) and applied to `POST /message`.
- **Files modified:** `src/backend/middleware/rateLimiter.ts`, `src/backend/routes/groupChatRoutes.ts`
- **Status:** Completed

### Item 52: `sanitizeGroupData()` Only Trims, No HTML Escape (see Bug B above)

**Action taken:** Updated `sanitizeGroupData()` to HTML-escape `name`, `description`, `locationName`, and `tags` after trimming.
- **Files modified:** `src/backend/services/groupService.ts`
- **Status:** Completed

### Item 55: Missing Composite Index on Standings Upserts
- **Severity:** LOW
- **Status:** OPEN
- **Issue:** `TournamentStanding` has unique constraint on `(tournamentId, teamId, groupName)` but no covering index for sorted queries
- **Fix:** Add migration for composite index on fields used in `ORDER BY` clauses
- **Complexity:** Low

**Action taken:** Added a composite index on `TournamentStanding` for `(tournamentId, groupName, points, goalsFor, goalsAgainst, wins, losses)` to cover common ordering patterns and improve query performance.
 - **Files modified:** `prisma/schema.prisma`
 - **Status:** Prisma client generated locally (`npm run prisma:generate`) — run `npm run prisma:migrate` to apply the index to the DB.

### Item 56: `poolNumber` (Legacy) and `poolId` (New) Coexist Without Cross-Validation
- **Severity:** MEDIUM
- **Status:** OPEN
- **Issue:** Both fields exist on `TournamentTeam`; no constraint prevents conflicting values
- **Solution:** Add guard logic or migration to deprecate `poolNumber`
- **Complexity:** Medium

**Action taken:** Added input guards to prevent conflicting `poolId`/`poolNumber` usage:
- In `addTeam`: reject requests that provide both `poolId` and `poolNumber`.
- In `updateTeam`: prevent setting `poolNumber` when the team already has a `poolId`; require using the `pool-move` endpoint for pool assignments.
- **Files modified:** `src/backend/tournament-service/controllers/tournament/tournamentCoreController.ts`
- **Status:** Completed — runtime guards applied. Consider a schema migration to deprecate `poolNumber` in a follow-up.

### Item 57: `loserGoesToMatchId` Not FK-Validated
- **Severity:** MEDIUM
- **Status:** OPEN
- **Issue:** Stored as plain string field with no FK relationship enforced
- **Fix:** Add FK constraint to `TournamentMatch` or implement validation logic
- **Complexity:** Low

**Action taken:** Added runtime validation in loser-routing logic to ensure destination match ids exist before writing `loserGoesToMatchId`. The Prisma schema already defines a relation with `onDelete: SetNull`; this change prevents invalid cross-references at runtime.
- **Files modified:** `src/backend/services/tournamentService.ts`, `prisma/schema.prisma` (already had relation)
- **Status:** Completed

---

## 📊 Priority Matrix

| Priority | Count | Action |
|---|---|---|
| 🚨 CRITICAL (hotfix) | 3 | Fix Bugs A, C, D — deploy immediately |
| ⚠️ HIGH (next sprint) | 5 | Fix Bugs B, E, F, K + decide on Item 4 approach |
| 📋 MEDIUM (this sprint) | 6 | Fix Bugs G, H, I, J, L, M |
| 📌 LOW | 10 | Items 33, 34, 35, 49, 50, 51, 55, 56, 57 + Bug N |

---

## ✅ Completion Checklist

- [x] **Bug A** — OAuth token URL exposure
- [x] **Bug C** — Refresh token logout bypass
- [x] **Bug D** — Waitlist self-confirm bypass
- [x] **Bug B** — Email template XSS
- [x] **Item 4** — revertStandings floor guard
- [x] **Bug K** — Dispute standings recompute
- [x] **Bug E** — GroupJoinRequest unique constraint
  - [x] **Bug G** — Dynamic require fix
  - [x] **Bug H** — Session invite expiry check
- [x] **Bug I** — Payment reminder timing
- [x] **Bug J** — Enum hardcoding
- [x] **Bug L** — Cache JSON parse crash
- [x] **Bug M** — Payment transaction pagination
- [x] **Bug N** — GroupMessage FK cascade
- [x] **Item 33** — Attendance logic
- [x] **Item 34** — Recurring sessions null handling
- [x] **Item 35** — Cache thundering herd
- [x] **Item 48** — GroupJoinRequest unique constraint (schema updated)
- [x] **Item 49** — GroupMessage userId index (schema updated)
- [x] **Item 50** — Message edit/delete endpoints
- [x] **Item 51** — Rate limiter
- [x] **Item 55** — Composite index
- [x] **Item 56** — Pool ID migration
- [x] **Item 57** — loserGoesToMatchId FK
