import {
  MATCH_INCIDENT_STATUSES,
  MATCH_INCIDENT_TYPES,
  TournamentContingencyMode,
  TournamentPaymentTransactionStatus,
  TournamentSeedingPolicy,
} from '../../../shared/types/tournament.types';

export const INVITATION_EXPIRY_DAYS = 7;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_LOCATION_RADIUS_KM = 100;
export const MAX_LOCATION_FIELD_LENGTH = 100;
export const MAX_NAME_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_POOL_NAME_LENGTH = 100;
export const MAX_PLAYER_NAME_LENGTH = 100;
export const MAX_TEAMS_UPPER_BOUND = 1000;
export const MAX_BATCH_PAYMENT_TEAMS = 500;
export const DEFAULT_MATCH_DURATION_MINUTES = 60;
export const MAX_MATCH_DURATION_MINUTES = 480;
export const MILLISECONDS_PER_MINUTE = 60_000;
export const MAX_BULK_SHIFT_MINUTES = 1_440;
export const MAX_PAYMENT_METADATA_BYTES = 4096;
export const PROVIDER_REF_TEAM_ID_PREFIX_LENGTH = 8;
export const TIME_24H_HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const TOURNAMENT_PAYMENT_TRANSACTION_STATUSES = Object.values(TournamentPaymentTransactionStatus);
export const TOURNAMENT_SEEDING_POLICIES = Object.values(TournamentSeedingPolicy);
export const TOURNAMENT_CONTINGENCY_MODES = Object.values(TournamentContingencyMode);
export const SPORT_CONFIG_TYPES = ['default', 'volleyball', 'tennis'] as const;
export const DEFAULT_INCIDENT_SLA_MINUTES = 30;
export const MAX_INCIDENT_DESCRIPTION_LENGTH = 1000;
export const SHARE_TOKEN_BYTES = 24; // 48 hex chars — used for both QR check-in tokens and public share tokens
// Minimum cool-down window between referee assignments to reduce back-to-back fatigue.
export const DEFAULT_REFEREE_REST_WINDOW_MINUTES = 15;
export const OVERLAP_GAP_INDICATOR = -1;
export const DEFAULT_FORFEIT_SCORE_FOR = 1;
export const DEFAULT_FORFEIT_SCORE_AGAINST = 0;
export const MAX_MATCH_SCORE = 999;
export const TIMEZONE_IANA_LIKE_REGEX = /^(UTC|[A-Za-z_]+\/[A-Za-z0-9_\-+]+(?:\/[A-Za-z0-9_\-+]+)?)$/;
export const TOURNAMENT_INCIDENT_STATUSES = MATCH_INCIDENT_STATUSES;
export const TOURNAMENT_INCIDENT_TYPES = MATCH_INCIDENT_TYPES;
