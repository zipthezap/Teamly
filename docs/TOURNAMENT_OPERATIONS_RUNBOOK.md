# Tournament Operations Runbook

## Lifecycle sync

- Job: `syncAllTournamentStatuses`
- Schedule: every 5 minutes (plus initial run on startup)
- Source: `src/backend/services/scheduledJobs.ts`

### What to monitor

- Lifecycle transition success/failure counters
- Sudden spikes in transition failures
- Stuck tournaments that should transition but do not

### Immediate actions on failure

1. Inspect application logs for `Tournament lifecycle status auto-updated` and failure warnings.
2. Validate tournament date fields (`registrationStartDate`, `registrationDeadline`, `startDate`, `endDate`).
3. Re-run lifecycle reconciliation by reading details or triggering an allowed lifecycle mutation.

## Incident SLA checks

- Job: `checkIncidentSlas`
- Schedule: every 5 minutes
- Behavior: creates organizer notification when open incidents breach `slaDeadline`.

### What to monitor

- Count of overdue incidents
- Notification creation failures
- Repeated overdue incidents without resolution

### Immediate actions on failure

1. Validate open incident records with `slaDeadline < now`.
2. Confirm notification records are being created once per incident.
3. Escalate unresolved incidents to tournament organizers.

## Payment deadline reminders

- Job: `sendTournamentPaymentDeadlineReminders`
- Schedule: every 5 minutes
- Behavior: sends reminder notifications to unpaid/pending team captains.

### What to monitor

- Reminder creation volume
- Duplicate reminder suppression (`paymentReminderKey`)
- Teams remaining unpaid past deadline

### Immediate actions on failure

1. Verify `paymentDeadline` and `paymentStatus` values on affected tournaments/teams.
2. Check for notification creation errors and dedupe metadata collisions.
3. Validate captain account linkage (`captainUserId`) for missing reminders.

## Legacy and deprecated tournament route handling

- Keep existing deprecated pool move route (`POST /:id/pools/:poolId/admin/teams/:teamId/move/:targetPoolId`) operational for old clients.
- Prefer new canonical route (`PUT /:id/teams/:teamId/pool-move`) for all current clients.
- Do not remove legacy route until mobile/client compatibility telemetry confirms zero usage.

