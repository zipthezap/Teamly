// Tournament type definitions

export enum TournamentFormat {
  SINGLE_ELIMINATION = 'single_elimination',
  DOUBLE_ELIMINATION = 'double_elimination',
  ROUND_ROBIN = 'round_robin',
  GROUPS_KNOCKOUT = 'groups_knockout'
}

export enum TournamentStatus {
  DRAFT = 'draft',
  REGISTRATION = 'registration',
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
  // Recurring tournament support
  isRecurring?: boolean;
  recurrenceRule?: string;
  parentTournamentId?: string;
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
  // Recurring tournament support
  isRecurring?: boolean;
  recurrenceRule?: string;
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
  matchOrder?: number;
  status?: MatchStatus;
}

export interface AssignRefereeDto {
  refereeTeamId: string | null; // null to remove referee assignment
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

