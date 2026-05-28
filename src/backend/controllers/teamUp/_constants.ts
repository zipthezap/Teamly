export const TEAMUP_AUTOFILL_CONFIRMATION_MINUTES = 45;
export const BLOCKING_APPLICATION_STATUSES = ['pending', 'accepted'] as const;
// 'declined' is intentionally excluded: a previously-declined applicant cannot re-apply.
export const REAPPLY_ELIGIBLE_STATUSES = ['cancelled', 'waitlisted'] as const;
