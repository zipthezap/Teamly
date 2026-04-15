# Tournament Lifecycle Rollout Playbook

## Scope

This playbook covers rollout of system-managed tournament lifecycle transitions, match-driven completion, and lifecycle reconciliation after tournament mutations.

## Pre-Deployment Checklist

- [ ] Deploy backend code that removes manual status endpoint and enables lifecycle reconciliation.
- [ ] Run one-time lifecycle status backfill in dry-run mode:
  - `npm run tournaments:backfill-lifecycle-statuses -- --dry-run`
- [ ] Review dry-run output and validate expected transition counts.
- [ ] Execute real backfill:
  - `npm run tournaments:backfill-lifecycle-statuses`
- [ ] Confirm no unexpected status regressions in sampled tournaments.

## Monitoring and Alerts

Monitor these metrics:

- `tournament_lifecycle_transitions_total{from_status,to_status,trigger}`
- `tournament_lifecycle_transition_failures_total{from_status,to_status,trigger}`

Recommended alerts:

1. **Lifecycle failures spike**
   - Condition: any non-zero increase in `tournament_lifecycle_transition_failures_total` for 5 minutes.
2. **No transitions during expected activity window**
   - Condition: zero increase in `tournament_lifecycle_transitions_total` during tournament-heavy hours.
3. **Unexpected transition shape**
   - Condition: sudden increase in rare/unexpected transition combinations.

## Rollout Steps (Staging → Production)

1. Deploy to staging.
2. Backfill on staging, verify output.
3. Run smoke tests (below) on staging.
4. Deploy to production.
5. Run dry-run then actual backfill on production.
6. Run production smoke tests.
7. Monitor lifecycle transition/failure metrics for at least one tournament cycle.

## Rollback Plan

1. Roll back backend deployment to previous release.
2. Disable any lifecycle failure alerts specific to this release while rollback stabilizes.
3. If needed, manually correct tournament statuses for critical events.
4. Re-run staging validation before next rollout attempt.

## Smoke Test Checklist

- [ ] Create tournament with future registration and start dates (`draft` expected).
- [ ] Wait/simulate registration open window (`registration` expected).
- [ ] Generate brackets or reach start date (`in_progress` expected).
- [ ] Submit/complete all matches (`completed` expected).
- [ ] Edit registration window dates and verify status re-evaluates.
- [ ] Create/update/delete a match and verify status re-evaluates.
- [ ] Verify matches admin page reflects live tournament detail immediately after mutation.
- [ ] Confirm no manual status mutation route exists (`PUT /api/tournaments/:id/status` returns 404).
