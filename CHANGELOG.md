# Changelog

## Unreleased

### Fixed
- Tournament: Make `updateStandings` atomic to prevent partial-upsert data corruption.
- Tournament: Make knockout/bracket generation idempotent to avoid duplicate bracket creation under race conditions.
- Tournament: Prevent negative `goalsFor`/`goalsAgainst` when reverting standings.
- Tournament: Make team registration idempotent to avoid duplicate teams on race conditions.
- Tournament: Block score submissions for `DRAFT`, `CANCELLED`, and `COMPLETED` tournaments.
- Tournament: Ignore `CANCELLED` matches in lifecycle calculations.
- Tournament: Prevent changing `format` after tournament start.
- Tournament: Implement cancellation refund execution path and DB-side marking of refunds.
- Tournament: Implement head-to-head tiebreaker and attach to tiebreaker sort.
- Tournament: Handle bye/overtime/third-place draw edge-cases; accept `detailedScore` winner resolution for knockouts.

### Tests
- Added refund + edge-case unit tests for cancellation and payment transactions.
- Fixed cancel-related tests and added idempotency/transaction-failure tests.
- Added `submitScore` detailedScore edge-case tests (penalties/overtime and third-place handling).
- Full test suite run: all tests passing locally (2335 passed, 15 skipped).

### Notes
- Resolved a duplicate `status` key in test fixtures to remove dev-time warnings.
- Next: prepare PR, squash commits as appropriate, and include migration notes if deploying DB changes.
