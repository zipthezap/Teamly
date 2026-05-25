// Tournament type definitions

export enum TournamentNotificationType {
  team_registered = 'team_registered',
  team_invited = 'team_invited',
  tournament_updated = 'tournament_updated',
  tournament_cancelled = 'tournament_cancelled',
  match_scheduled = 'match_scheduled',
  score_submitted = 'score_submitted',
  score_disputed = 'score_disputed',
  payment_reminder = 'payment_reminder',
  announcement = 'announcement',
}

export enum TournamentFormat {
  SINGLE_ELIMINATION = 'single_elimination',
  DOUBLE_ELIMINATION = 'double_elimination',
  ROUND_ROBIN = 'round_robin',
  GROUPS_KNOCKOUT = 'groups_knockout'
}

export enum TournamentStatus {
  DRAFT = 'draft',
  REGISTRATION = 'registration',
  REGISTRATION_CLOSED = 'registration_closed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum BracketStage {
  GROUP_STAGE = 'group_stage',
  ROUND_OF_32 = 'round_of_32',
  ROUND_OF_16 = 'round_of_16',
  QUARTER_FINALS = 'quarter_finals',
  SEMI_FINALS = 'semi_finals',
  THIRD_PLACE = 'third_place',
  FINALS = 'finals'
}

export enum TournamentPaymentStatus {
  UNPAID = 'unpaid',
  PENDING = 'pending',
  PAID = 'paid',
  WAIVED = 'waived',
}

export const TOURNAMENT_PAYMENT_STATUSES = Object.values(TournamentPaymentStatus);

export enum TournamentPaymentTransactionStatus {
  INITIATED = 'initiated',
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

// Type definitions for detailed scoring
export interface SetScore {
  home: number;
  away: number;
}

export interface DetailedScore {
  sets?: SetScore[];  // For volleyball, tennis
  periods?: SetScore[];  // For ice hockey, American football
  innings?: SetScore[];  // For baseball, cricket
}

// Sport-specific scoring configuration
export interface VolleyballConfig {
  type: 'volleyball';
  regularSetPoints: number;  // e.g., 25 points for regular sets
  decidingSetPoints: number; // e.g., 15 points for deciding set (if tied)
  bestOfSets: number;        // e.g., 3 or 5 (best of 3 means first to 2 sets wins)
  minimumPointDifference: number; // e.g., 2 points (must win by 2)
}

export interface TennisConfig {
  type: 'tennis';
  bestOfSets: number;        // e.g., 3 or 5
  gamesPerSet: number;       // e.g., 6
  tiebreakPoints: number;    // e.g., 7
  decidingSetType: 'advantage' | 'tiebreak' | 'super_tiebreak';
}

export interface DefaultScoringConfig {
  type: 'default';
  winPoints: number;         // Points awarded for a win (default: 3)
  drawPoints: number;        // Points awarded for a draw (default: 1)
  lossPoints: number;        // Points awarded for a loss (default: 0)
}

export type SportScoringConfig = VolleyballConfig | TennisConfig | DefaultScoringConfig;

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  sportType: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startDate: Date | string;
  endDate?: Date | string;
  maxTeams?: number;
  location?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
  country?: string;
  organizerId: string;
  groupId?: string;
  // Admin controls
  registrationDeadline?: Date | string;
  isPublic?: boolean;
  allowLateRegistration?: boolean;
  autoGenerateBrackets?: boolean;
  useManualBrackets?: boolean; // Enable manual bracket/pool management
  prizesDescription?: string;
  rulesDescription?: string;
  contactEmail?: string;
  // Sport-specific configuration
  sportConfig?: SportScoringConfig;
  // Recurring tournament support
  isRecurring?: boolean;
  recurrenceRule?: string;
  parentTournamentId?: string;
  // New gap-feature fields
  rosterLockDate?: Date | string;
  paymentDeadline?: Date | string;
  tiebreakerRules?: string[];
  requireWaiverForRegistration?: boolean;
  waiverText?: string;
  // Self-ref
  selfRefEnabled?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface TournamentTeam {
  id: string;
  name: string;
  captainName?: string;
  captainEmail?: string;
  captainUserId?: string;
  tournamentId: string;
  // Manual pool/bracket management
  poolNumber?: number;
  poolName?: string;
  seedNumber?: number;
  waiverAcceptedAt?: Date | string;
  waiverAcceptedByUserId?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  players?: TournamentPlayer[];
}

export interface TournamentPlayer {
  id: string;
  teamId: string;
  userId?: string;
  playerName: string;
  playerEmail?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  homeTeamId: string;
  awayTeamId: string;
  refereeTeamId?: string; // Team assigned to referee this match
  homeScore?: number;
  awayScore?: number;
  detailedScore?: DetailedScore; // Structured scoring for sports with sets/periods
  stage?: BracketStage;
  roundNumber?: number;
  groupName?: string;
  isManuallyCreated?: boolean;
  matchOrder?: number;
  status: MatchStatus;
  scheduledAt?: Date | string;
  scheduledDurationMinutes?: number;
  courtId?: string;
  startedAt?: Date | string;
  completedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  homeTeam?: TournamentTeam;
  awayTeam?: TournamentTeam;
  refereeTeam?: TournamentTeam;
}

export interface TournamentStanding {
  id: string;
  tournamentId: string;
  teamId: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  goalsFor: number;
  goalsAgainst: number;
  groupName?: string;
  updatedAt: Date | string;
  team?: TournamentTeam;
}

export interface TournamentWithDetails extends Tournament {
  organizer?: {
    id: string;
    name: string;
    email: string;
  };
  group?: {
    id: string;
    name: string;
  };
  teams?: TournamentTeam[];
  matches?: TournamentMatch[];
  standings?: TournamentStanding[];
  courts?: TournamentCourt[];
}

export interface CreateTournamentDto {
  name: string;
  description?: string;
  sportType: string;
  format: TournamentFormat;
  startDate: Date | string;
  endDate?: Date | string;
  maxTeams?: number;
  location?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
  country?: string;
  groupId?: string;
  // Admin controls
  registrationDeadline?: Date | string;
  isPublic?: boolean;
  allowLateRegistration?: boolean;
  autoGenerateBrackets?: boolean;
  useManualBrackets?: boolean;
  prizesDescription?: string;
  rulesDescription?: string;
  contactEmail?: string;
  // Sport-specific configuration
  sportConfig?: SportScoringConfig;
  // Recurring tournament support
  isRecurring?: boolean;
  recurrenceRule?: string;
  // New gap-feature fields
  rosterLockDate?: Date | string;
  paymentDeadline?: Date | string;
  tiebreakerRules?: string[];
  requireWaiverForRegistration?: boolean;
  waiverText?: string;
  // Self-ref
  selfRefEnabled?: boolean;
}

export interface UpdateTournamentDto {
  name?: string;
  description?: string;
  status?: TournamentStatus;
  startDate?: Date | string;
  endDate?: Date | string;
  maxTeams?: number;
  location?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
  country?: string;
  // Admin controls
  registrationDeadline?: Date | string;
  isPublic?: boolean;
  allowLateRegistration?: boolean;
  autoGenerateBrackets?: boolean;
  useManualBrackets?: boolean;
  prizesDescription?: string;
  rulesDescription?: string;
  contactEmail?: string;
  // Sport-specific configuration
  sportConfig?: SportScoringConfig;
  // New gap-feature fields
  rosterLockDate?: Date | string;
  paymentDeadline?: Date | string;
  tiebreakerRules?: string[];
  requireWaiverForRegistration?: boolean;
  waiverText?: string;
  // Self-ref
  selfRefEnabled?: boolean;
}

export interface CreateTeamDto {
  name: string;
  captainName?: string;
  captainEmail?: string;
  captainUserId?: string;
  poolNumber?: number;
  poolName?: string;
  seedNumber?: number;
}

export interface UpdateTeamDto {
  name?: string;
  captainName?: string;
  captainEmail?: string;
  captainUserId?: string;
  poolNumber?: number;
  poolName?: string;
  seedNumber?: number;
}

export interface SubmitScoreDto {
  homeScore: number;
  awayScore: number;
  detailedScore?: DetailedScore; // For sports with sets/periods
}

export interface GenerateBracketsDto {
  format?: TournamentFormat;
  numberOfGroups?: number; // For groups_knockout format
}

// Manual bracket management DTOs
export interface CreateMatchDto {
  homeTeamId: string;
  awayTeamId: string;
  refereeTeamId?: string;
  stage?: BracketStage;
  roundNumber?: number;
  groupName?: string;
  scheduledAt?: Date | string;
  matchOrder?: number;
}

export interface UpdateMatchDto {
  homeTeamId?: string;
  awayTeamId?: string;
  refereeTeamId?: string;
  stage?: BracketStage;
  roundNumber?: number;
  groupName?: string;
  scheduledAt?: Date | string;
  scheduledDurationMinutes?: number;
  courtId?: string;
  matchOrder?: number;
  status?: MatchStatus;
}

export interface TournamentPaymentTransaction {
  id: string;
  tournamentId: string;
  teamId: string;
  createdByUserId: string;
  provider: string;
  providerReference?: string;
  amount: number;
  currency: string;
  status: TournamentPaymentTransactionStatus;
  paidAt?: Date | string;
  refundedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface TournamentCourt {
  id: string;
  tournamentId: string;
  name: string;
  location?: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface TournamentCourtAvailability {
  id: string;
  courtId: string;
  dayOfWeek?: number;
  date?: Date | string;
  startTime: string;
  endTime: string;
  isBlocked: boolean;
  notes?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AssignRefereeDto {
  refereeTeamId: string | null; // null to remove referee assignment
}

export interface AutoAssignRefereesDto {
  roundNumber?: number;
  groupName?: string;
  stage?: BracketStage;
}

export interface RefereeDutyEntry {
  teamId: string;
  teamName: string;
  dutyCount: number;
}

export interface AssignPoolDto {
  poolNumber?: number;
  poolName?: string;
}

export interface AddPlayerDto {
  playerName: string;
  playerEmail?: string;
  userId?: string; // Optional: link player to a registered user
}

export interface UpdatePlayerDto {
  playerName?: string;
  playerEmail?: string;
  userId?: string;
}

// Team invitation types
export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export interface TournamentTeamInvitation {
  id: string;
  teamId: string;
  inviteeEmail: string;
  inviteeName?: string;
  inviteeUserId?: string;
  inviterId: string;
  inviteToken: string;
  status: InvitationStatus;
  message?: string;
  expiresAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  team?: TournamentTeam;
  inviter?: {
    id: string;
    name: string;
    email: string;
  };
  inviteeUser?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface SendTeamInvitationDto {
  inviteeEmail: string;
  inviteeName?: string;
  message?: string;
}

export interface AcceptTeamInvitationDto {
  inviteToken: string;
}

export interface TeamInviteLink {
  inviteUrl: string;
  inviteToken: string;
  expiresAt: Date | string;
}


// ==================== NEW GAP-FEATURE TYPES ====================

export enum ScoreDisputeStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export enum RegistrationFieldType {
  TEXT = 'text',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  SELECT = 'select',
}

export interface TournamentRegistrationWaitlistEntry {
  id: string;
  tournamentId: string;
  teamId: string;
  position: number;
  createdAt: Date | string;
  team?: { id: string; name: string; captainUserId?: string };
}

export interface TournamentScoreDisputeDto {
  reason: string;
}

export interface ResolveTournamentScoreDisputeDto {
  status: ScoreDisputeStatus.RESOLVED | ScoreDisputeStatus.DISMISSED;
  resolution?: string;
}

export interface TournamentAnnouncementDto {
  title: string;
  body: string;
  isPinned?: boolean;
}

export interface TournamentRegistrationFieldDto {
  label: string;
  fieldType?: RegistrationFieldType;
  isRequired?: boolean;
  options?: string[];
  sortOrder?: number;
}

export interface TournamentTeamAnswerDto {
  fieldId: string;
  value: string;
}

export interface TournamentPlayerStatDto {
  statKey: string;
  value: number;
}

// ==================== PHASE 3: GAME-DAY OPERATIONS ====================

export enum MatchIncidentType {
  LATE_START = 'late_start',
  INJURY = 'injury',
  DISPUTE = 'dispute',
  TECHNICAL = 'technical',
  OTHER = 'other',
}

export enum MatchIncidentStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export const MATCH_INCIDENT_TYPES = Object.values(MatchIncidentType);
export const MATCH_INCIDENT_STATUSES = Object.values(MatchIncidentStatus);

export interface TournamentMatchIncident {
  id: string;
  tournamentId: string;
  matchId: string;
  reportedByUserId: string;
  incidentType: MatchIncidentType;
  description: string;
  status: MatchIncidentStatus;
  slaDeadline?: Date | string;
  resolvedById?: string;
  resolution?: string;
  resolvedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateMatchIncidentDto {
  incidentType?: MatchIncidentType;
  description: string;
  slaMinutes?: number; // How many minutes from now the SLA deadline is
}

export interface ResolveMatchIncidentDto {
  status: MatchIncidentStatus.RESOLVED | MatchIncidentStatus.DISMISSED;
  resolution?: string;
}

// ==================== PHASE 4: PUBLIC PORTAL ====================

export interface PublicTournamentPortal {
  tournament: Tournament & {
    organizer?: { id: string; name: string };
  };
  teams: Array<{ id: string; name: string; checkedIn: boolean }>;
  matches: TournamentMatch[];
  standings: TournamentStanding[];
  courts?: TournamentCourt[];
  announcements?: Array<{ id: string; title: string; body: string; isPinned: boolean; createdAt: Date | string }>;
}

// ==================== PHASE 5: ORGANIZER ANALYTICS ====================

export interface TournamentAnalytics {
  registration: {
    totalTeams: number;
    checkedIn: number;
    noShows: number;
    paid: number;
    unpaid: number;
    pending: number;
    waived: number;
    waiverAccepted: number;
  };
  matches: {
    total: number;
    scheduled: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    lateStarts: number;       // matches that started more than 10 min after scheduledAt
    avgDurationMinutes: number | null;
  };
  disputes: {
    total: number;
    open: number;
    resolved: number;
    dismissed: number;
  };
  incidents: {
    total: number;
    open: number;
    resolved: number;
    pastSla: number;          // open incidents whose slaDeadline has passed
  };
  payments: {
    totalRevenue: number;
    transactionsPaid: number;
    transactionsRefunded: number;
  };
}
