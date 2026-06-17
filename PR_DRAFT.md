PR Draft: P0 data-integrity and tournament fixes

Summary:
- Implements a set of P0 fixes for tournament service: atomic standings updates, idempotent bracket generation, lifecycle protections, payment/cancellation refund flow, and knockout edge-case handling.
- Adds tests covering refund flows, idempotency, and detailed score tie-break resolution.

Files changed (high level):
- src/backend/tournament-service/controllers/tournament/* (score submission, cancellation, payment handling)
- src/backend/tournament-service/services/tournamentService.ts (head-to-head, winner resolution)
- src/backend/__tests__/controllers/tournamentController.test.ts (new/updated tests)
- To-dos.md, CHANGELOG.md

Tests:
- Ran full test suite locally: `npx vitest` → 2335 passed, 15 skipped.

Migration notes:
- No schema migrations applied in this branch; if you add DB schema changes (indexes / constraints) include a migration and coordinate deploy.

Suggested reviewers:
- @backend-team, @db-admin

How to test locally:
```bash
# install deps
npm ci
# run tests
npx vitest
```

Notes:
- I removed a duplicate `status` key in a test fixture to avoid a Vite warning.
- If you'd like, I can squash the commits and open the PR on your behalf.
