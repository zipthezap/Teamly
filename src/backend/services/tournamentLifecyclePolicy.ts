import { TournamentStatus } from '../../shared/types/tournament.types';

export const TOURNAMENT_LIFECYCLE_ORDER: TournamentStatus[] = [
  TournamentStatus.DRAFT,
  TournamentStatus.REGISTRATION,
  TournamentStatus.REGISTRATION_CLOSED,
  TournamentStatus.IN_PROGRESS,
  TournamentStatus.COMPLETED,
];

export const TOURNAMENT_ALLOWED_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  [TournamentStatus.DRAFT]: [
    TournamentStatus.REGISTRATION,
    TournamentStatus.REGISTRATION_CLOSED,
    TournamentStatus.IN_PROGRESS,
    TournamentStatus.CANCELLED,
  ],
  [TournamentStatus.REGISTRATION]: [
    TournamentStatus.REGISTRATION_CLOSED,
    TournamentStatus.IN_PROGRESS,
    TournamentStatus.CANCELLED,
  ],
  [TournamentStatus.REGISTRATION_CLOSED]: [
    TournamentStatus.IN_PROGRESS,
    TournamentStatus.CANCELLED,
  ],
  [TournamentStatus.IN_PROGRESS]: [
    TournamentStatus.COMPLETED,
    TournamentStatus.CANCELLED,
  ],
  [TournamentStatus.COMPLETED]: [],
  [TournamentStatus.CANCELLED]: [],
};

export type TournamentLifecycleAction =
  | 'register_team'
  | 'edit_tournament'
  | 'generate_group_matches'
  | 'generate_brackets'
  | 'start_match';

export const isTerminalTournamentStatus = (status: string): boolean =>
  status === TournamentStatus.COMPLETED || status === TournamentStatus.CANCELLED;

export const canTransitionTournamentStatus = (
  fromStatus: TournamentStatus,
  toStatus: TournamentStatus,
  context?: {
    hasMatches?: boolean;
    hasIncompleteMatches?: boolean;
    hasConfirmedPayments?: boolean;
    hasRefundPolicy?: boolean;
  }
): boolean => {
  if (fromStatus === toStatus) return true;
  const isAllowedByMatrix = TOURNAMENT_ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
  if (!isAllowedByMatrix) return false;
  if (toStatus === TournamentStatus.IN_PROGRESS && context?.hasMatches === false) {
    return false;
  }
  if (toStatus === TournamentStatus.COMPLETED && context?.hasIncompleteMatches === true) {
    return false;
  }
  if (
    toStatus === TournamentStatus.CANCELLED &&
    context?.hasConfirmedPayments === true &&
    context?.hasRefundPolicy === false
  ) {
    return false;
  }
  return true;
};

export const canPerformTournamentLifecycleAction = (
  action: TournamentLifecycleAction,
  status: string,
  options?: { allowEarlyStart?: boolean }
): { allowed: boolean; reason?: string } => {
  switch (action) {
    case 'register_team':
      return status === TournamentStatus.DRAFT || status === TournamentStatus.REGISTRATION
        ? { allowed: true }
        : { allowed: false, reason: 'Tournament registration is closed' };
    case 'edit_tournament':
      return status === TournamentStatus.DRAFT ||
        status === TournamentStatus.REGISTRATION ||
        status === TournamentStatus.REGISTRATION_CLOSED
        ? { allowed: true }
        : { allowed: false, reason: 'Tournament setup can no longer be edited' };
    case 'generate_group_matches':
      return status === TournamentStatus.REGISTRATION_CLOSED
        ? { allowed: true }
        : { allowed: false, reason: 'Group matches can only be generated while registration is closed' };
    case 'generate_brackets':
      return !isTerminalTournamentStatus(status)
        ? { allowed: true }
        : { allowed: false, reason: 'Brackets can only be generated or regenerated for active tournaments' };
    case 'start_match': {
      const canStartEarly =
        options?.allowEarlyStart === true && status === TournamentStatus.REGISTRATION_CLOSED;
      return status === TournamentStatus.IN_PROGRESS || canStartEarly
        ? { allowed: true }
        : { allowed: false, reason: 'Matches can only be started once the tournament is in progress' };
    }
    default:
      return { allowed: false, reason: 'Unsupported tournament lifecycle action' };
  }
};
