# Teamly — Deep Project Analysis

**Date:** 2026-07-22

## Health Check Summary

| Check | Result |
|---|---|
| `npx vitest run` | 2348 passed, 15 skipped, 0 failing |
| `npm run lint` | 0 errors |
| `npm run build` | Clean |

Backend is in good shape and is a solid foundation to build on.

---

## 🔴 Highest Priority — Fix Before Anything Else

### 1. Uncommitted, risky edit to an already-applied migration

`git status` shows `prisma/migrations/20260617120000_initial_all/migration.sql` modified with **+1990 lines** — new enums (`BracketSide`, `TournamentSeedingPolicy`, etc.), new columns (`emailVerificationExpires`, `failedTwoFactorAttempts`, ...), and entire new tables were added *directly into the baseline migration file* rather than as a new migration.

This is dangerous: Prisma tracks applied migrations by name in `_prisma_migrations`, so editing the SQL of a migration that's already been applied anywhere (staging, prod, teammates' local DBs) means it will **never re-run** there — causing permanent schema drift between fresh installs and existing databases. The repo's own history shows the correct pattern is "repair migrations" (e.g. `20260406134500_repair_missing_enum_types`), so this looks like a slip from a recent session.

**Action:** Before committing, split this diff into a proper additive migration (`npx prisma migrate dev --name repair_baseline_drift` after diffing) instead of editing the baseline file, then verify with `npx prisma migrate status`.

### 2. Uncommitted bug-fix work not yet merged

`to-dos-updated.md` / `TODOS_INCOMPLETE.md` document ~25 real bugs (several CRITICAL/HIGH — OAuth tokens in URL, refresh-token not revoked on logout, waitlisted users self-confirming, XSS via unescaped email templates) all marked "Completed" in the docs, and `git status` confirms the corresponding files (`scheduledJobs.ts`, `sessionGuestController.ts`, `teamUpApplicationController.ts`, `seed.js`) are modified but **not committed**. Get this merged — it's real security/data-integrity value sitting idle.

---

## 🟠 Next Focus (per `PROJECT_OVERVIEW.md`, the current source of truth)

3. **Integration test gap (P0 in the roadmap):** Tournament controller handlers, Express routes, and concurrency-sensitive mutations (registration, waitlist promotion, match start) have **zero test coverage** — only the service layer is unit-tested. This is the biggest risk given how central tournaments are.
4. **`tournament_detail_page.dart` god-file:** confirmed **3,756 lines**. Splitting it into `presentation/detail/` sub-widgets (already planned) would meaningfully improve mobile maintainability and unblock adding tests.
5. **Mobile has no automated tests at all** — high risk for a Flutter-first product.
6. **Remaining smaller open items** from the todo docs: `poolNumber`/`poolId` dual-field validation (Item 56), `loserGoesToMatchId` not FK-enforced (Item 57) — low urgency, cleanup-tier.

---

## 🟢 Lower Priority / Later

- Tournament domain split by subdomain (lifecycle/registration/pools/brackets) — ongoing refactor, not urgent given tests are green.
- Payment gateway integration, SSE-to-Flutter real-time, public portal UI — product features, sequence after stabilization.

---

## Recommendation

Given everything is green but there's an **uncommitted risky migration edit** plus **uncommitted completed security fixes**, the immediate next step should be maintenance, not new features:

1. Fix the migration file issue (convert to proper additive migration).
2. Commit/PR the pending bug fixes.
3. Then pivot to the P0 from `PROJECT_OVERVIEW.md`: stand up integration tests for tournament controllers before doing any more feature/refactor work, since that's what currently has the least safety net for a domain being actively iterated on.

---

## Reference Docs

- `PROJECT_OVERVIEW.md` — single source of truth for roadmap/priorities (supersedes `NEXT_STEPS.md`, `To-dos.md`, `to-dos-updated.md`, `TODOS_INCOMPLETE.md`, `PR_DRAFT.md`, which are mostly historical/completed working notes).
- `docs/TOURNAMENT_DOMAIN_REFACTOR_MAP.md` — module boundaries for the tournament domain split.
- `docs/TOURNAMENT_OPERATIONS_RUNBOOK.md` — operations reference.
