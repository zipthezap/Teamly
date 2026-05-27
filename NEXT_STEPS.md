# Teamly Next Steps

**Last Updated:** May 27, 2026

This repository currently consists of:
- **Node/Express + Prisma backend** (`/src/backend`)
- **Flutter mobile app** (`/src/mobile`)
- **Shared TypeScript types** (`/src/shared`)

## Current Priority Focus (Tournament Domain)

### P0 — Stabilize and define boundaries
- [ ] Keep tournament lifecycle, pool movement, waitlist promotion, and match start flows covered by regression tests.
- [ ] Use `docs/TOURNAMENT_DOMAIN_REFACTOR_MAP.md` as the source map for module boundaries and ownership.

### P1 — Backend API and module cleanup
- [ ] Split tournament backend logic by domain (lifecycle, registration, pools, brackets, match ops, incidents, analytics).
- [ ] Keep `tournamentRoutes.ts` thin and remove deprecated proxy-style flows after migration windows.
- [ ] Standardize tournament API responses toward `{ data, pagination? }`.
- [ ] Continue privacy review of public tournament endpoints and limit exposed user fields.

### P2 — Mobile maintainability
- [ ] Centralize tournament status label/color/icon presentation and remove duplicated per-page switch logic.
- [ ] Break `tournament_detail_page.dart` into smaller section widgets under `presentation/detail/`.
- [ ] Replace dynamic parsing where backend contracts have been standardized.

## Validation and Quality Expectations

- [ ] Before major refactors, lock behavior with tests for high-risk flows.
- [ ] Run backend test suite (`npm test`) for tournament-impacting backend changes.
- [ ] Run backend lint/build checks and track pre-existing failures separately from new regressions.
- [ ] Run relevant Flutter analysis/tests when mobile tournament presentation logic changes.

## Contributor Quick Start

```bash
cd /tmp/workspace/zipthezap/Teamly
npm ci
npm run prisma:generate
npm test
```

For mobile work:

```bash
cd /tmp/workspace/zipthezap/Teamly/src/mobile
flutter pub get
flutter analyze
```

## Key References

- Tournament refactor map: `docs/TOURNAMENT_DOMAIN_REFACTOR_MAP.md`
- Tournament production baseline: `docs/TOURNAMENT_PRODUCTION_READINESS.md`
- Tournament operations runbook: `docs/TOURNAMENT_OPERATIONS_RUNBOOK.md`
