import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { 
  MatchStatus, 
  BracketStage,
  TournamentFormat,
  TournamentStatus,
  TournamentNotificationType,
  VolleyballConfig,
  SportScoringConfig,
  DetailedScore
} from '../../shared/types/tournament.types';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { sanitizeString } from '../utils/validation';
import { logger } from '../utils/logger';
import {
  recordTournamentLifecycleTransition,
  recordTournamentLifecycleTransitionFailure,
} from './metricsService';

const ALLOWED_SPORT_TYPES = [
  'football',
  'basketball',
  'tennis',
  'volleyball',
  'running',
  'cycling',
  'swimming',
  'cricket',
  'americanFootball',
  'iceHockey',
  'baseball',
  'rugby',
  'handball',
  'fieldHockey',
  'other',
] as const;

const ELIMINATION_STAGE_ORDER: BracketStage[] = [
  BracketStage.ROUND_OF_32,
  BracketStage.ROUND_OF_16,
  BracketStage.QUARTER_FINALS,
  BracketStage.SEMI_FINALS,
  BracketStage.FINALS,
] as const;

const GROUPS_KNOCKOUT_STAGE_ORDER: BracketStage[] = [
  BracketStage.ROUND_OF_16,
  BracketStage.QUARTER_FINALS,
  BracketStage.SEMI_FINALS,
  BracketStage.FINALS,
] as const;

type StandingLike = {
  teamId: string;
  groupName?: string | null;
  points: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
};

type QualifiedTeam = StandingLike & {
  rankInGroup: number;
};

/**
 * Returns the largest supported knockout bracket size (power of two, capped at 16)
 * that fits the number of available teams, or 0 when there are not enough teams
 * to seed a knockout round.
 */
const knockoutBracketSize = (teamCount: number) => {
  if (teamCount >= 16) return 16;
  if (teamCount >= 8) return 8;
  if (teamCount >= 4) return 4;
  if (teamCount >= 2) return 2;
  return 0;
};

const firstKnockoutStageForSize = (size: number): BracketStage => {
  if (size >= 16) return BracketStage.ROUND_OF_16;
  if (size >= 8) return BracketStage.QUARTER_FINALS;
  if (size >= 4) return BracketStage.SEMI_FINALS;
  return BracketStage.FINALS;
};

const seededPairOrder = (size: number): Array<[number, number]> => {
  switch (size) {
    case 16:
      return [
        [0, 15],
        [7, 8],
        [4, 11],
        [3, 12],
        [5, 10],
        [2, 13],
        [6, 9],
        [1, 14],
      ];
    case 8:
      return [
        [0, 7],
        [3, 4],
        [2, 5],
        [1, 6],
      ];
    case 4:
      return [
        [0, 3],
        [1, 2],
      ];
    case 2:
      return [[0, 1]];
    default:
      return [];
  }
};

const compareStandingsPerformance = (
  a: StandingLike,
  b: StandingLike,
  tiebreakerRules?: string[] | null
) => {
  if (b.points !== a.points) return b.points - a.points;

  const rules = tiebreakerRules && tiebreakerRules.length > 0
    ? tiebreakerRules
    : ['goal_difference', 'goals_for'];

  for (const rule of rules) {
    switch (rule) {
      case 'goal_difference': {
        const gdA = a.goalsFor - a.goalsAgainst;
        const gdB = b.goalsFor - b.goalsAgainst;
        if (gdB !== gdA) return gdB - gdA;
        break;
      }
      case 'goals_for':
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        break;
      case 'goals_against':
        if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
        break;
      case 'wins':
        if (b.wins !== a.wins) return b.wins - a.wins;
        break;
      default:
        break;
    }
  }

  return 0;
};

const compareQualifiedTeams = (
  a: QualifiedTeam,
  b: QualifiedTeam,
  tiebreakerRules?: string[] | null
) => {
  if (a.rankInGroup !== b.rankInGroup) return a.rankInGroup - b.rankInGroup;

  const performanceCompare = compareStandingsPerformance(a, b, tiebreakerRules);
  if (performanceCompare !== 0) return performanceCompare;

  const groupCompare = (a.groupName ?? '').localeCompare(b.groupName ?? '');
  if (groupCompare !== 0) return groupCompare;
  return a.teamId.localeCompare(b.teamId);
};

const selectGroupKnockoutQualifiers = (
  standings: StandingLike[],
  tiebreakerRules?: string[] | null
): QualifiedTeam[] => {
  const grouped = new Map<string, QualifiedTeam[]>();

  for (const standing of standings) {
    const groupName = standing.groupName ?? '';
    if (!grouped.has(groupName)) grouped.set(groupName, []);
    grouped.get(groupName)!.push({ ...standing, rankInGroup: 0 });
  }

  const orderedGroups = Array.from(grouped.entries())
    .map(([groupName, items]) => {
      const sorted = sortStandingsByTiebreakerRules(items, tiebreakerRules) as QualifiedTeam[];
      return [
        groupName,
        sorted.map((standing, index) => ({
          ...standing,
          rankInGroup: index + 1,
        })),
      ] as const;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  const totalTeams = orderedGroups.reduce((sum, [, items]) => sum + items.length, 0);
  const qualifierCount = knockoutBracketSize(totalTeams);
  if (qualifierCount < 2) {
    throw new BadRequestError(
      `At least 2 qualified teams are required to seed knockout brackets (found ${qualifierCount})`,
      'INSUFFICIENT_TEAMS'
    );
  }

  const basePerGroup = Math.max(1, Math.floor(qualifierCount / orderedGroups.length));
  const autoQualified: QualifiedTeam[] = [];
  const remainingCandidates: QualifiedTeam[] = [];

  for (const [, groupStandings] of orderedGroups) {
    autoQualified.push(...groupStandings.slice(0, basePerGroup));
    remainingCandidates.push(...groupStandings.slice(basePerGroup));
  }

  const remainingSlots = Math.max(0, qualifierCount - autoQualified.length);
  remainingCandidates.sort((a, b) => compareQualifiedTeams(a, b, tiebreakerRules));

  return [...autoQualified, ...remainingCandidates.slice(0, remainingSlots)].sort((a, b) =>
    compareQualifiedTeams(a, b, tiebreakerRules)
  );
};

const buildKnockoutMatchesFromQualifiedTeams = (
  tournamentId: string,
  qualifiedTeams: QualifiedTeam[]
) => {
  const qualifierCount = knockoutBracketSize(qualifiedTeams.length);
  if (qualifierCount < 2) return [];

  const seededTeams = qualifiedTeams.slice(0, qualifierCount);
  const stage = firstKnockoutStageForSize(qualifierCount);
  const seedPairs = seededPairOrder(qualifierCount);

  return seedPairs.map(([leftIndex, rightIndex], index) => ({
    tournamentId,
    homeTeamId: seededTeams[leftIndex].teamId,
    awayTeamId: seededTeams[rightIndex].teamId,
    stage,
    roundNumber: 1,
    matchOrder: index + 1,
    status: MatchStatus.SCHEDULED,
  }));
};

/**
 * Calculate winner for volleyball based on sets
 * Returns: { homeWins: number, awayWins: number, isValid: boolean, error?: string }
 */
export const calculateVolleyballWinner = (
  detailedScore: DetailedScore,
  config: VolleyballConfig
): { homeWins: number; awayWins: number; isValid: boolean; error?: string } => {
  if (!detailedScore.sets || detailedScore.sets.length === 0) {
    return { homeWins: 0, awayWins: 0, isValid: false, error: 'Sets are required for volleyball scoring' };
  }

  let homeSetWins = 0;
  let awaySetWins = 0;
  const sets = detailedScore.sets;
  const setsToWin = Math.ceil(config.bestOfSets / 2); // e.g., 2 for best of 3, 3 for best of 5

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];
    const isDecidingSet = (homeSetWins === setsToWin - 1 && awaySetWins === setsToWin - 1);
    const requiredPoints = isDecidingSet ? config.decidingSetPoints : config.regularSetPoints;

    // Validate set scores
    if (set.home < 0 || set.away < 0) {
      return { homeWins: 0, awayWins: 0, isValid: false, error: `Set ${i + 1}: Scores cannot be negative` };
    }

    // Check who won the set
    if (set.home > set.away) {
      // Home team won - must reach required points and win by minimum difference
      if (set.home < requiredPoints) {
        return { homeWins: 0, awayWins: 0, isValid: false, error: `Set ${i + 1}: Winning team must reach at least ${requiredPoints} points` };
      }
      if (set.home - set.away < config.minimumPointDifference) {
        return { homeWins: 0, awayWins: 0, isValid: false, error: `Set ${i + 1}: Must win by at least ${config.minimumPointDifference} points` };
      }
      homeSetWins++;
    } else if (set.away > set.home) {
      // Away team won
      if (set.away < requiredPoints) {
        return { homeWins: 0, awayWins: 0, isValid: false, error: `Set ${i + 1}: Winning team must reach at least ${requiredPoints} points` };
      }
      if (set.away - set.home < config.minimumPointDifference) {
        return { homeWins: 0, awayWins: 0, isValid: false, error: `Set ${i + 1}: Must win by at least ${config.minimumPointDifference} points` };
      }
      awaySetWins++;
    } else {
      return { homeWins: 0, awayWins: 0, isValid: false, error: `Set ${i + 1}: Sets cannot be tied` };
    }

    // Check if match is already decided
    if (homeSetWins === setsToWin || awaySetWins === setsToWin) {
      break;
    }
  }

  return { homeWins: homeSetWins, awayWins: awaySetWins, isValid: true };
};

/**
 * Sanitize tournament data to prevent XSS attacks
 */
export const sanitizeTournamentData = (data: {
  name?: string;
  description?: string;
  location?: string;
  locationName?: string;
  prizesDescription?: string;
  rulesDescription?: string;
  paymentInfo?: string;
  waiverText?: string;
}) => {
  return {
    name: data.name ? sanitizeString(data.name) : '',
    description: data.description ? sanitizeString(data.description) : '',
    location: data.location ? sanitizeString(data.location) : '',
    locationName: data.locationName ? sanitizeString(data.locationName) : '',
    prizesDescription: data.prizesDescription ? sanitizeString(data.prizesDescription) : '',
    rulesDescription: data.rulesDescription ? sanitizeString(data.rulesDescription) : '',
    paymentInfo: data.paymentInfo ? sanitizeString(data.paymentInfo) : '',
    waiverText: data.waiverText ? sanitizeString(data.waiverText) : '',
  };
};

export const validateTournamentEnums = (payload: {
  sportType?: string;
  format?: string;
}) => {
  const isAllowedSportType = (value: string): value is (typeof ALLOWED_SPORT_TYPES)[number] =>
    ALLOWED_SPORT_TYPES.includes(value as (typeof ALLOWED_SPORT_TYPES)[number]);

  if (payload.sportType !== undefined && !isAllowedSportType(payload.sportType)) {
    throw new BadRequestError(`Invalid sportType. Must be one of: ${ALLOWED_SPORT_TYPES.join(', ')}`);
  }

  if (payload.format !== undefined && !Object.values(TournamentFormat).includes(payload.format as TournamentFormat)) {
    throw new BadRequestError(`Invalid format. Must be one of: ${Object.values(TournamentFormat).join(', ')}`);
  }
};

const parseDateOrThrow = (value: Date | string, fieldName: string): Date => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid date`);
  }
  return parsed;
};

export const validateTournamentBusinessRules = (payload: {
  startDate: Date | string;
  endDate?: Date | string | null;
  registrationStartDate?: Date | string | null;
  registrationDeadline?: Date | string | null;
  maxTeams?: number | null;
}) => {
  const startDate = parseDateOrThrow(payload.startDate, 'Start date');
  const endDate = payload.endDate != null ? parseDateOrThrow(payload.endDate, 'End date') : null;
  const registrationStartDate =
    payload.registrationStartDate != null
      ? parseDateOrThrow(payload.registrationStartDate, 'Registration start date')
      : null;
  const registrationDeadline =
    payload.registrationDeadline != null
      ? parseDateOrThrow(payload.registrationDeadline, 'Registration deadline')
      : null;

  if (endDate && endDate <= startDate) {
    throw new BadRequestError('End date must be after start date');
  }

  if (registrationStartDate && registrationStartDate >= startDate) {
    throw new BadRequestError('Registration start date must be before tournament start date');
  }

  if (registrationDeadline && registrationDeadline >= startDate) {
    throw new BadRequestError('Registration deadline must be before tournament start date');
  }

  if (registrationStartDate && registrationDeadline && registrationDeadline <= registrationStartDate) {
    throw new BadRequestError('Registration deadline must be after registration start date');
  }

  if (payload.maxTeams !== undefined && payload.maxTeams !== null && payload.maxTeams < 2) {
    throw new BadRequestError('Max teams must be at least 2');
  }
};

export const validateRegistrationEligibility = (tournament: {
  status: string;
  startDate: Date;
  registrationStartDate?: Date | null;
  registrationDeadline?: Date | null;
  allowLateRegistration?: boolean;
}) => {
  if (
    tournament.status !== 'draft' &&
    tournament.status !== 'registration'
  ) {
    // registration_closed, in_progress, completed, cancelled all reject registration
    throw new BadRequestError('Tournament registration is closed');
  }

  const now = new Date();

  if (tournament.registrationStartDate && now < tournament.registrationStartDate) {
    throw new BadRequestError('Registration has not opened yet');
  }

  if (!tournament.allowLateRegistration) {
    if (tournament.registrationDeadline && now > tournament.registrationDeadline) {
      throw new BadRequestError('Registration deadline has passed');
    }
    if (now >= tournament.startDate) {
      throw new BadRequestError('Tournament registration is closed');
    }
  }
};

/**
 * Compute the expected automatic tournament status based on tournament dates.
 * Returns the new status string if the status should change, or null if no change is needed.
 *
 * Canonical lifecycle:
 *   draft
 *   → registration          (when registrationStartDate arrives and deadline hasn't passed)
 *   → registration_closed   (when registrationDeadline passes, before startDate)
 *   → in_progress           (when startDate arrives, or matches exist before startDate)
 *   → completed             (when endDate passes or all matches are done)
 *
 * Cancellation is an override and is never auto-set.
 */
export const computeAutoStatus = (tournament: {
  status: string;
  startDate: Date;
  endDate?: Date | null;
  registrationStartDate?: Date | null;
  registrationDeadline?: Date | null;
  hasMatches?: boolean;
  hasIncompleteMatches?: boolean;
}): string | null => {
  if (tournament.status === 'cancelled') return null;

  const now = new Date();

  // Rule 1: endDate has passed → completed
  if (tournament.endDate && now > tournament.endDate) {
    return tournament.status !== 'completed' ? 'completed' : null;
  }

  // Rule 2: startDate has arrived → in_progress (or completed if all matches done)
  if (now >= tournament.startDate) {
    if (tournament.hasMatches === true && tournament.hasIncompleteMatches === false) {
      return tournament.status !== 'completed' ? 'completed' : null;
    }

    if (tournament.status !== 'in_progress' && tournament.status !== 'completed') {
      return 'in_progress';
    }
    return null;
  }

  // Before startDate:

  // Rule 3: Matches have been generated (group or bracket) before the start date
  // → move to in_progress so scores can be entered.
  if (
    tournament.hasMatches === true &&
    tournament.status !== 'in_progress' &&
    tournament.status !== 'registration_closed' &&
    tournament.status !== 'completed'
  ) {
    return 'in_progress';
  }

  // Rule 4: registration_closed stays until startDate (no auto-transition back to registration)
  if (tournament.status === 'registration_closed') {
    return null;
  }

  // Rule 5: registrationDeadline has passed → registration_closed
  if (
    tournament.registrationDeadline != null &&
    now > tournament.registrationDeadline &&
    (tournament.status === 'draft' || tournament.status === 'registration')
  ) {
    return 'registration_closed';
  }

  // Rule 6: registrationStartDate has arrived and deadline hasn't → registration
  if (tournament.registrationStartDate && now >= tournament.registrationStartDate) {
    const deadlinePassed =
      tournament.registrationDeadline != null && now > tournament.registrationDeadline;
    if (!deadlinePassed && tournament.status === 'draft') {
      return 'registration';
    }
  }

  return null;
};

/**
 * Validate tournament dates
 */
export const validateTournamentDates = (startDate: Date | string, endDate?: Date | string) => {
  const start = new Date(startDate);
  const now = new Date();
  
  if (start < now) {
    return { valid: false, error: 'Start date must be in the future' };
  }
  
  if (endDate) {
    const end = new Date(endDate);
    if (end <= start) {
      return { valid: false, error: 'End date must be after start date' };
    }
  }
  
  return { valid: true };
};

/**
 * Check if user is tournament organizer
 */
export const isOrganizer = (tournament: { organizerId: string }, userId: string): boolean => {
  return tournament.organizerId === userId;
};

/**
 * Check if user is the organizer or a delegated co-organizer of the tournament
 */
export const isOrganizerOrAdmin = async (tournament: { id: string; organizerId: string }, userId: string): Promise<boolean> => {
  if (tournament.organizerId === userId) return true;
  const adminRole = await prisma.tournamentAdminRole.findFirst({
    where: { tournamentId: tournament.id, userId }
  });
  return adminRole !== null;
};

/**
 * Check if user is team captain
 */
export const isTeamCaptain = async (teamId: string, userId: string): Promise<boolean> => {
  const team = await prisma.tournamentTeam.findUnique({
    where: { id: teamId },
    select: { captainUserId: true, captainEmail: true }
  });

  if (!team) return false;

  // If a captain user id is set, compare directly
  if (team.captainUserId) {
    return team.captainUserId === userId;
  }

  // If no captainUserId is set, fall back to matching the user's email
  // against the stored captainEmail (covers seeded teams or invited captains)
  if (team.captainEmail) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    return !!user && user.email === team.captainEmail;
  }

  return false;
};

/**
 * Check if user is a registered player on a team
 */
export const isRegisteredPlayer = async (teamId: string, userId: string): Promise<boolean> => {
  const count = await prisma.tournamentPlayer.count({
    where: { 
      teamId,
      userId
    }
  });
  
  return count > 0;
};

/**
 * Check if user can submit score for a match
 * User can submit if they are:
 * - The tournament organizer or a delegated admin
 * - Team captain of either team
 * - Registered player on either team
 * - Registered player on the referee team
 */
export const canSubmitScore = async (
  match: { homeTeamId: string; awayTeamId: string; refereeTeamId?: string | null },
  tournament: { id: string; organizerId: string },
  userId: string
): Promise<boolean> => {
  // Check if organizer (no DB query needed)
  if (tournament.organizerId === userId) {
    return true;
  }

  // Fetch captain status for home, away, and referee teams AND admin role in parallel
  const teamIds = [match.homeTeamId, match.awayTeamId];
  if (match.refereeTeamId) teamIds.push(match.refereeTeamId);

  const [captainTeam, playerEntry, adminRole] = await Promise.all([
    // Check if user is captain of any relevant team
    prisma.tournamentTeam.findFirst({
      where: { id: { in: teamIds }, captainUserId: userId },
      select: { id: true }
    }),
    // Check if user is a registered player on any relevant team
    prisma.tournamentPlayer.findFirst({
      where: { teamId: { in: teamIds }, userId },
      select: { id: true }
    }),
    // Check if user is a delegated tournament admin
    prisma.tournamentAdminRole.findFirst({
      where: { tournamentId: tournament.id, userId },
      select: { id: true }
    }),
  ]);

  return captainTeam !== null || playerEntry !== null || adminRole !== null;
};

/**
 * Revert standings for a completed match (used when correcting scores retroactively).
 * Decrements the standing deltas that were applied when the match was originally scored.
 */
export const revertStandings = async (
  matchId: string,
  tx?: Prisma.TransactionClient
) => {
  const client = tx || prisma;
  const match = await client.tournamentMatch.findUnique({
    where: { id: matchId },
    include: { tournament: true }
  });

  if (!match || match.homeScore === null || match.awayScore === null) {
    return;
  }

  const { homeTeamId, awayTeamId, homeScore, awayScore, groupName } = match;

  const sportConfig = match.tournament?.sportConfig as unknown as SportScoringConfig | undefined;
  const defaultWinPoints = sportConfig?.type === 'default' ? sportConfig.winPoints : 3;
  const defaultDrawPoints = sportConfig?.type === 'default' ? sportConfig.drawPoints : 1;
  const defaultLossPoints = sportConfig?.type === 'default' ? sportConfig.lossPoints : 0;

  let homeWin = 0, homeDraw = 0, homeLoss = 0;
  let awayWin = 0, awayDraw = 0, awayLoss = 0;
  let homePoints = 0, awayPoints = 0;

  if (homeScore > awayScore) {
    homeWin = 1; awayLoss = 1;
    homePoints = defaultWinPoints; awayPoints = defaultLossPoints;
  } else if (homeScore < awayScore) {
    homeLoss = 1; awayWin = 1;
    awayPoints = defaultWinPoints; homePoints = defaultLossPoints;
  } else {
    homeDraw = 1; awayDraw = 1;
    homePoints = defaultDrawPoints; awayPoints = defaultDrawPoints;
  }

  await Promise.all([
    client.tournamentStanding.updateMany({
      where: groupName
        ? { tournamentId: match.tournamentId, teamId: homeTeamId, groupName }
        : { tournamentId: match.tournamentId, teamId: homeTeamId, groupName: null },
      data: {
        points: { decrement: homePoints },
        wins: { decrement: homeWin },
        draws: { decrement: homeDraw },
        losses: { decrement: homeLoss },
        goalsFor: { decrement: homeScore },
        goalsAgainst: { decrement: awayScore },
      },
    }),
    client.tournamentStanding.updateMany({
      where: groupName
        ? { tournamentId: match.tournamentId, teamId: awayTeamId, groupName }
        : { tournamentId: match.tournamentId, teamId: awayTeamId, groupName: null },
      data: {
        points: { decrement: awayPoints },
        wins: { decrement: awayWin },
        draws: { decrement: awayDraw },
        losses: { decrement: awayLoss },
        goalsFor: { decrement: awayScore },
        goalsAgainst: { decrement: homeScore },
      },
    }),
  ]);
};

/**
 * Generate brackets for single elimination tournament
 */
const buildSingleEliminationMatches = (tournamentId: string, teams: Array<{ id: string }>) => {
  if (teams.length < 2) {
    throw new BadRequestError('At least 2 teams are required to generate brackets', 'INSUFFICIENT_TEAMS');
  }

  const numTeams = teams.length;

  // Determine bracket stage based on number of teams
  let stage: BracketStage = BracketStage.FINALS;
  if (numTeams > 16) stage = BracketStage.ROUND_OF_32;
  else if (numTeams > 8) stage = BracketStage.ROUND_OF_16;
  else if (numTeams > 4) stage = BracketStage.QUARTER_FINALS;
  else if (numTeams > 2) stage = BracketStage.SEMI_FINALS;
  
  const nearestLowerPowerOfTwo = 2 ** Math.floor(Math.log2(numTeams));
  const preliminaryMatchCount = numTeams - nearestLowerPowerOfTwo;
  const byeTeamCount =
    preliminaryMatchCount > 0
      ? Math.max(0, numTeams - preliminaryMatchCount * 2)
      : 0;

  const teamsForMatches = preliminaryMatchCount > 0 ? teams.slice(byeTeamCount) : teams;

  // Create first round matches (deterministic order; top teams may receive byes)
  const matches = [];
  for (let i = 0; i < teamsForMatches.length; i += 2) {
    if (i + 1 < teamsForMatches.length) {
      matches.push({
        tournamentId,
        homeTeamId: teamsForMatches[i].id,
        awayTeamId: teamsForMatches[i + 1].id,
        stage,
        roundNumber: 1,
        matchOrder: matches.length + 1,
        status: MatchStatus.SCHEDULED
      });
    }
  }

  return matches;
};

const shuffleTeams = <T>(teams: T[]): T[] => {
  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomIndex = randomInt(0, i + 1);
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }
  return shuffled;
};

export const generateSingleEliminationBrackets = async (tournamentId: string) => {
  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    orderBy: { createdAt: 'asc' }
  });

  const matches = buildSingleEliminationMatches(tournamentId, teams);
  const createdMatches = await prisma.tournamentMatch.createMany({ data: matches });

  return createdMatches;
};

/**
 * Generate randomized single-elimination brackets from existing pool assignments.
 */
export const generateRandomizedSingleEliminationBracketsFromPools = async (tournamentId: string) => {
  const pools = await prisma.tournamentPool.findMany({
    where: { tournamentId },
    include: { teams: { orderBy: { createdAt: 'asc' } } },
    orderBy: { name: 'asc' }
  });

  const poolTeams = pools.flatMap(pool => pool.teams);
  // Safety deduplication in case of inconsistent data or transitional states where a team appears in multiple pool reads.
  const uniqueTeams = Array.from(new Map(poolTeams.map(team => [team.id, team])).values());
  const randomizedTeams = shuffleTeams(uniqueTeams);

  const matches = buildSingleEliminationMatches(tournamentId, randomizedTeams);
  const createdMatches = await prisma.tournamentMatch.createMany({ data: matches });

  return createdMatches;
};

/**
 * Generate brackets for round robin tournament.
 * Uses the circle (Berger table) method to assign a roundNumber to every
 * match so the display can group them into "Round 1", "Round 2", etc.
 * rather than lumping all matches under a single unlabelled group.
 *
 * Algorithm:
 *  - Fix the first team at position 0; rotate the remaining n-1 slots.
 *  - For odd n, add a virtual "bye" slot so the participant array is even;
 *    skip any pairing that involves the bye slot.
 *  - Results in n-1 rounds (even) or n rounds (odd), each with ⌊n/2⌋ games.
 */
export const generateRoundRobinBrackets = async (tournamentId: string) => {
  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    orderBy: { createdAt: 'asc' }
  });
  
  if (teams.length < 2) {
    throw new BadRequestError('At least 2 teams are required to generate brackets', 'INSUFFICIENT_TEAMS');
  }

  const n = teams.length;
  const isOdd = n % 2 === 1;
  // Pad to an even number; null represents the bye slot for odd-team counts
  const participants: (string | null)[] = teams.map(t => t.id);
  if (isOdd) participants.push(null);
  const size = participants.length; // always even
  const roundCount = size - 1;

  const matches: {
    tournamentId: string;
    homeTeamId: string;
    awayTeamId: string;
    roundNumber: number;
    status: MatchStatus;
  }[] = [];

  for (let round = 0; round < roundCount; round++) {
    const roundNumber = round + 1;
    for (let i = 0; i < size / 2; i++) {
      const home = participants[i];
      const away = participants[size - 1 - i];
      // Skip the bye pairing
      if (home === null || away === null) continue;
      matches.push({
        tournamentId,
        homeTeamId: home,
        awayTeamId: away,
        roundNumber,
        status: MatchStatus.SCHEDULED,
      });
    }
    // Rotate participants[1..size-1] right by 1: last element moves to index 1
    participants.splice(1, 0, participants.pop()!);
  }
  
  // Create matches in database
  const createdMatches = await prisma.tournamentMatch.createMany({
    data: matches
  });
  
  return createdMatches;
};

/**
 * Generate brackets for groups + knockout format
 */
export const generateGroupsKnockoutBrackets = async (
  tournamentId: string, 
  numberOfGroups: number = 4
) => {
  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    include: {
      pool: {
        select: {
          categoryId: true,
          category: { select: { id: true, name: true } },
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  if (teams.length < 2) {
    throw new BadRequestError(
      'At least 2 teams are required to generate group matches',
      'INSUFFICIENT_TEAMS'
    );
  }

  const teamsByCategory = new Map<string, { label: string; teams: typeof teams }>();
  const uncategorizedKey = '__uncategorized__';
  const hasCategoryHints = teams.some(
    (team) => team.pool?.categoryId != null || (team.poolName?.trim().length ?? 0) > 0
  );

  if (!hasCategoryHints && teams.length < numberOfGroups * 2) {
    throw new BadRequestError(
      `At least ${numberOfGroups * 2} teams are required for ${numberOfGroups} groups`,
      'INSUFFICIENT_TEAMS_FOR_GROUPS'
    );
  }

  for (const team of teams) {
    const categoryFromPool = team.pool?.category;
    const poolNameHint = team.poolName?.trim();
    const categoryKey =
      categoryFromPool?.id ??
      (poolNameHint && poolNameHint.length > 0 ? `name:${poolNameHint.toLowerCase()}` : uncategorizedKey);
    const categoryLabel = categoryFromPool?.name ?? (poolNameHint != null && poolNameHint.length > 0 ? poolNameHint : 'Group');

    if (!teamsByCategory.has(categoryKey)) {
      teamsByCategory.set(categoryKey, { label: categoryLabel, teams: [] });
    }
    teamsByCategory.get(categoryKey)!.teams.push(team);
  }

  // Distribute teams into groups separately for each category bucket.
  // numberOfGroups is treated as groups-per-category.
  const groups: { [key: string]: typeof teams } = {};
  for (const [categoryKey, bucket] of teamsByCategory.entries()) {
    if (bucket.teams.length < 2) continue;

    const groupsForBucket = Math.max(
      1,
      Math.min(numberOfGroups, Math.floor(bucket.teams.length / 2))
    );

    const groupNames = Array.from({ length: groupsForBucket }, (_, i) => {
      const suffix = String.fromCharCode(65 + i);
      return categoryKey === uncategorizedKey ? suffix : `${bucket.label} ${suffix}`;
    });

    bucket.teams.forEach((team, index) => {
      const groupName = groupNames[index % groupsForBucket];
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(team);
    });
  }

  if (Object.keys(groups).length === 0) {
    throw new BadRequestError(
      'At least one category must have 2 or more teams to generate group matches',
      'INSUFFICIENT_TEAMS_FOR_GROUPS'
    );
  }
  
  // Generate round-robin matches within each group
  const matches = [];
  for (const [groupName, groupTeams] of Object.entries(groups)) {
    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i + 1; j < groupTeams.length; j++) {
        matches.push({
          tournamentId,
          homeTeamId: groupTeams[i].id,
          awayTeamId: groupTeams[j].id,
          groupName,
          stage: BracketStage.GROUP_STAGE,
          status: MatchStatus.SCHEDULED
        });
      }
    }
  }
  
  // Create matches in database
  const createdMatches = await prisma.tournamentMatch.createMany({
    data: matches
  });
  
  return createdMatches;
};

/**
 * Generate pool-aware round-robin brackets.
 * Each pool becomes its own group — teams within a pool play each other
 * in a full round-robin. Pools that have no teams assigned are skipped.
 * Falls back to a flat round-robin if no pools with teams exist.
 */
export const generatePoolAwareBrackets = async (
  tournamentId: string,
  options: { fallbackToRoundRobin?: boolean } = {}
) => {
  const { fallbackToRoundRobin = true } = options;
  const pools = await prisma.tournamentPool.findMany({
    where: { tournamentId },
    include: { teams: { orderBy: { createdAt: 'asc' } } },
    orderBy: { name: 'asc' }
  });

  const populatedPools = pools.filter(p => p.teams.length >= 2);

  // Fall back to plain round-robin if pools aren't populated
  if (populatedPools.length === 0) {
    if (!fallbackToRoundRobin) {
      throw new BadRequestError(
        'No populated groups or pools are available to generate a groups + knockout stage',
        'INSUFFICIENT_GROUPS'
      );
    }
    return generateRoundRobinBrackets(tournamentId);
  }

  const matches = [];
  for (const pool of populatedPools) {
    const poolTeams = pool.teams;
    for (let i = 0; i < poolTeams.length; i++) {
      for (let j = i + 1; j < poolTeams.length; j++) {
        matches.push({
          tournamentId,
          homeTeamId: poolTeams[i].id,
          awayTeamId: poolTeams[j].id,
          groupName: pool.name,
          stage: BracketStage.GROUP_STAGE,
          status: MatchStatus.SCHEDULED
        });
      }
    }
  }

  if (matches.length === 0) {
    throw new BadRequestError('No pools have enough teams (minimum 2) to generate matches', 'INSUFFICIENT_TEAMS');
  }

  const createdMatches = await prisma.tournamentMatch.createMany({ data: matches });
  return createdMatches;
};

/**
 * Generate a knockout bracket from existing group-stage standings.
 * Called after all group-stage matches are completed. Selects qualifiers from
 * each group and builds the first knockout round.
 */
export const generateKnockoutFromStandings = async (tournamentId: string) => {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { tiebreakerRules: true },
  });

  const standings = await prisma.tournamentStanding.findMany({
    where: { tournamentId, groupName: { not: null } },
    select: {
      teamId: true,
      groupName: true,
      points: true,
      wins: true,
      goalsFor: true,
      goalsAgainst: true,
    },
  });

  if (standings.length === 0) {
    throw new BadRequestError(
      'No group standings available to seed the knockout bracket. Complete group matches first.',
      'NO_STANDINGS'
    );
  }

  const qualifiers = selectGroupKnockoutQualifiers(
    standings.filter((s) => s.groupName != null),
    tournament?.tiebreakerRules as string[] | null | undefined
  );

  const firstStageMatches = buildKnockoutMatchesFromQualifiedTeams(tournamentId, qualifiers);

  if (firstStageMatches.length === 0) {
    throw new BadRequestError(
      'Unable to build knockout bracket from current standings.',
      'CANNOT_BUILD_KNOCKOUT'
    );
  }

  const created = await prisma.tournamentMatch.createMany({ data: firstStageMatches });
  return created;
};
export const updateStandings = async (
  matchId: string, 
  tournament?: { sportConfig?: Prisma.JsonValue },
  tx?: Prisma.TransactionClient
) => {
  const client = tx || prisma;
  const match = await client.tournamentMatch.findUnique({
    where: { id: matchId },
    include: { homeTeam: true, awayTeam: true, tournament: true }
  });
  
  if (!match || match.homeScore === null || match.awayScore === null) {
    return;
  }
  
  // Use provided tournament or fetch from match
  const tournamentData = tournament || match.tournament;
  
  const { homeTeamId, awayTeamId, homeScore, awayScore, groupName } = match;
  
  // Determine match outcome based on sport configuration
  let homeWin = 0, homeDraw = 0, homeLoss = 0;
  let awayWin = 0, awayDraw = 0, awayLoss = 0;
  let homePoints = 0, awayPoints = 0;
  
  // Get sport-specific configuration
  const sportConfig = tournamentData?.sportConfig as unknown as SportScoringConfig | undefined;
  const defaultWinPoints = sportConfig?.type === 'default' ? sportConfig.winPoints : 3;
  const defaultDrawPoints = sportConfig?.type === 'default' ? sportConfig.drawPoints : 1;
  const defaultLossPoints = sportConfig?.type === 'default' ? sportConfig.lossPoints : 0;
  
  if (homeScore > awayScore) {
    homeWin = 1;
    awayLoss = 1;
    homePoints = defaultWinPoints;
    awayPoints = defaultLossPoints;
  } else if (homeScore < awayScore) {
    homeLoss = 1;
    awayWin = 1;
    awayPoints = defaultWinPoints;
    homePoints = defaultLossPoints;
  } else {
    homeDraw = 1;
    awayDraw = 1;
    homePoints = defaultDrawPoints;
    awayPoints = defaultDrawPoints;
  }
  
  // Update or create standings for home team
  const homeWhere = groupName 
    ? { tournamentId_teamId_groupName: { tournamentId: match.tournamentId, teamId: homeTeamId, groupName } }
    : { tournamentId_teamId_groupName: { tournamentId: match.tournamentId, teamId: homeTeamId, groupName: null } };
    
  await client.tournamentStanding.upsert({
    where: homeWhere,
    update: {
      points: { increment: homePoints },
      wins: { increment: homeWin },
      draws: { increment: homeDraw },
      losses: { increment: homeLoss },
      goalsFor: { increment: homeScore },
      goalsAgainst: { increment: awayScore }
    },
    create: {
      tournamentId: match.tournamentId,
      teamId: homeTeamId,
      groupName: groupName || null,
      points: homePoints,
      wins: homeWin,
      draws: homeDraw,
      losses: homeLoss,
      goalsFor: homeScore,
      goalsAgainst: awayScore
    }
  });
  
  // Update or create standings for away team
  const awayWhere = groupName 
    ? { tournamentId_teamId_groupName: { tournamentId: match.tournamentId, teamId: awayTeamId, groupName } }
    : { tournamentId_teamId_groupName: { tournamentId: match.tournamentId, teamId: awayTeamId, groupName: null } };
    
  await client.tournamentStanding.upsert({
    where: awayWhere,
    update: {
      points: { increment: awayPoints },
      wins: { increment: awayWin },
      draws: { increment: awayDraw },
      losses: { increment: awayLoss },
      goalsFor: { increment: awayScore },
      goalsAgainst: { increment: homeScore }
    },
    create: {
      tournamentId: match.tournamentId,
      teamId: awayTeamId,
      groupName: groupName || null,
      points: awayPoints,
      wins: awayWin,
      draws: awayDraw,
      losses: awayLoss,
      goalsFor: awayScore,
      goalsAgainst: homeScore
    }
  });
};

/**
 * Advance winners to next round in knockout tournament
 */
export const advanceWinners = async (tournamentId: string, currentStage: BracketStage) => {
  if (currentStage === BracketStage.GROUP_STAGE) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { format: true, tiebreakerRules: true }
    });

    if (!tournament || tournament.format !== TournamentFormat.GROUPS_KNOCKOUT) {
      return;
    }

    const groupStageMatches = await prisma.tournamentMatch.findMany({
      where: {
        tournamentId,
        stage: BracketStage.GROUP_STAGE,
      },
    });

    if (groupStageMatches.length === 0) {
      return;
    }

    const completedGroupMatches = groupStageMatches.filter((match) => match.status === MatchStatus.COMPLETED);
    if (completedGroupMatches.length !== groupStageMatches.length) {
      return;
    }

    const existingKnockoutMatches = await prisma.tournamentMatch.count({
      where: {
        tournamentId,
        stage: { in: GROUPS_KNOCKOUT_STAGE_ORDER },
      },
    });
    if (existingKnockoutMatches > 0) {
      return;
    }

    const standings = await prisma.tournamentStanding.findMany({
      where: { tournamentId },
      select: {
        teamId: true,
        groupName: true,
        points: true,
        wins: true,
        goalsFor: true,
        goalsAgainst: true,
      },
    });

    const qualifiers = selectGroupKnockoutQualifiers(
      standings.filter((standing) => standing.groupName != null),
      tournament.tiebreakerRules as string[] | null | undefined
    );
    const firstStageMatches = buildKnockoutMatchesFromQualifiedTeams(tournamentId, qualifiers);

    if (firstStageMatches.length > 0) {
      await prisma.tournamentMatch.createMany({
        data: firstStageMatches,
      });
    }
    return;
  }

  const allStageMatches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId,
      stage: currentStage
    },
    orderBy: [
      { roundNumber: 'asc' },
      { matchOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  if (allStageMatches.length === 0) {
    return;
  }

  const matches = allStageMatches.filter((match) => match.status === MatchStatus.COMPLETED);

  // Do not advance until all matches in this stage are complete
  if (matches.length !== allStageMatches.length) {
    return;
  }

  // Determine next stage
  const stageOrder: BracketStage[] = [...ELIMINATION_STAGE_ORDER];

  const currentIndex = stageOrder.indexOf(currentStage);
  if (currentIndex === -1 || currentIndex === stageOrder.length - 1) {
    return; // Already at finals or invalid stage
  }

  const nextStage = stageOrder[currentIndex + 1];

  // Idempotency guard: never create duplicate next-stage matches
  const existingNextStageMatches = await prisma.tournamentMatch.count({
    where: {
      tournamentId,
      stage: nextStage,
    },
  });
  if (existingNextStageMatches > 0) {
    return;
  }

  // Get winners from each completed match
  const winnersFromPlayedMatches = matches.map(match => {
    if (match.homeScore! > match.awayScore!) {
      return match.homeTeamId;
    } else {
      return match.awayTeamId;
    }
  });

  const previousStages = stageOrder.slice(0, currentIndex);
  const previousStageMatchCount = previousStages.length
    ? await prisma.tournamentMatch.count({
        where: {
          tournamentId,
          stage: { in: previousStages },
        },
      })
    : 0;

  // First elimination stage may have byes (teams not represented in current stage matches)
  let byeTeamIds: string[] = [];
  if (previousStageMatchCount === 0) {
    const participatingTeamIds = new Set<string>();
    for (const stageMatch of allStageMatches) {
      participatingTeamIds.add(stageMatch.homeTeamId);
      participatingTeamIds.add(stageMatch.awayTeamId);
    }

    const allTeams = await prisma.tournamentTeam.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    byeTeamIds = allTeams
      .map((team) => team.id)
      .filter((teamId) => !participatingTeamIds.has(teamId));
  }

  const winners = [...byeTeamIds, ...winnersFromPlayedMatches];
  
  // Create next round matches
  const nextMatches = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (i + 1 < winners.length) {
      nextMatches.push({
        tournamentId,
        homeTeamId: winners[i],
        awayTeamId: winners[i + 1],
        stage: nextStage,
        roundNumber: currentIndex + 2,
        matchOrder: nextMatches.length + 1,
        status: MatchStatus.SCHEDULED
      });
    }
  }
  
  if (nextMatches.length > 0) {
    await prisma.tournamentMatch.createMany({
      data: nextMatches
    });
  }
};

/**
 * Check if user can manage team invitations
 * User can manage invitations if they are organizer or team captain
 */
export const canManageTeamInvitations = async (
  teamId: string,
  tournamentId: string,
  userId: string
): Promise<boolean> => {
  // Get tournament to check organizer
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { organizerId: true }
  });
  
  if (!tournament) {
    return false;
  }
  
  // Check if organizer
  if (tournament.organizerId === userId) {
    return true;
  }
  
  // Check if team captain
  return await isTeamCaptain(teamId, userId);
};

/**
 * Create a team invitation
 */
export const createTeamInvitation = async (
  teamId: string,
  inviterId: string,
  inviteeEmail: string,
  inviteeName?: string,
  message?: string
): Promise<Prisma.TournamentTeamInvitationGetPayload<{
  include: {
    team: {
      include: {
        tournament: true;
      };
    };
    inviter: {
      select: { id: true; name: true; email: true };
    };
    inviteeUser: {
      select: { id: true; name: true; email: true };
    };
  };
}>> => {
  const crypto = await import('crypto');
  const inviteToken = crypto.randomBytes(32).toString('hex');
  
  // Check if user with this email exists
  const existingUser = await prisma.user.findUnique({
    where: { email: inviteeEmail }
  });
  
  // Set expiration to 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
  // Create invitation
  const invitation = await prisma.tournamentTeamInvitation.create({
    data: {
      teamId,
      inviterId,
      inviteeEmail,
      inviteeName,
      inviteeUserId: existingUser?.id,
      inviteToken,
      message,
      expiresAt,
      status: 'pending'
    },
    include: {
      team: {
        include: {
          tournament: true
        }
      },
      inviter: {
        select: { id: true, name: true, email: true }
      },
      inviteeUser: {
        select: { id: true, name: true, email: true }
      }
    }
  });

  // Create an InviteLog so we have an audit trail and can surface/resend invites
  try {
    await prisma.inviteLog.create({
      data: {
        inviterType: 'tournament',
        entityId: invitation.team.tournamentId,
        inviterId,
        inviteeEmail,
        inviteeId: existingUser?.id ?? undefined,
        status: 'sent',
        message,
        metadata: {
          teamId
        }
      }
    });
  } catch (err) {
    // Non-fatal: log and continue
    // eslint-disable-next-line no-console
    console.error('Failed to create InviteLog for tournament invitation', err);
  }
  
  return invitation;
};

/**
 * Get team invitations
 */
export const getTeamInvitations = async (teamId: string) => {
  return await prisma.tournamentTeamInvitation.findMany({
    where: { teamId, status: 'pending' },
    include: {
      inviter: {
        select: { id: true, name: true, email: true }
      },
      inviteeUser: {
        select: { id: true, name: true, email: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
};

/**
 * Get pending invitations for a user
 */
export const getUserPendingInvitations = async (userEmail: string) => {
  return await prisma.tournamentTeamInvitation.findMany({
    where: {
      inviteeEmail: userEmail,
      status: 'pending',
      expiresAt: {
        gt: new Date()
      }
    },
    include: {
      team: {
        include: {
          tournament: true
        }
      },
      inviter: {
        select: { id: true, name: true, email: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
};

/**
 * Accept a team invitation
 */
export const acceptTeamInvitation = async (inviteToken: string, userId: string) => {
  const invitation = await prisma.tournamentTeamInvitation.findUnique({
    where: { inviteToken },
    include: {
      team: {
        include: {
          tournament: true
        }
      }
    }
  });
  
  if (!invitation) {
    throw new BadRequestError('Invalid invitation token');
  }
  
  if (invitation.status !== 'pending') {
    throw new BadRequestError('Invitation has already been processed');
  }
  
  if (new Date() > new Date(invitation.expiresAt)) {
    // Mark as expired
    await prisma.tournamentTeamInvitation.update({
      where: { id: invitation.id },
      data: { status: 'expired' }
    });
    throw new BadRequestError('Invitation has expired');
  }
  
  // Get user to verify email matches
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user || user.email !== invitation.inviteeEmail) {
    throw new BadRequestError('This invitation is for a different email address');
  }
  
  // Guard against duplicate player (e.g. manually added after invitation was sent)
  // Prevent joining if user is already a player in this tournament
  const existingPlayer = await prisma.tournamentPlayer.findFirst({
    where: { userId: userId, team: { tournamentId: invitation.team.tournamentId } },
    select: { id: true }
  });
  if (existingPlayer) {
    // Mark as accepted anyway so the invitation is not left in a pending state
    await prisma.tournamentTeamInvitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted', inviteeUserId: userId }
    });
    throw new BadRequestError('You are already a participant in this tournament');
  }

  // Tournament organizers and co-organizers cannot participate as players
  if (await isOrganizerOrAdmin(invitation.team.tournament, userId)) {
    throw new ForbiddenError('Tournament organizers and co-organizers cannot participate as players');
  }

  // A team captain cannot join another team as a player
  const existingCaptainTeam = await prisma.tournamentTeam.findFirst({
    where: { tournamentId: invitation.team.tournamentId, captainUserId: userId },
    select: { id: true }
  });
  if (existingCaptainTeam) {
    throw new BadRequestError('Team captains cannot join another team as a player');
  }

  // Add user as a player to the team and mark invitation as accepted atomically
  const updated = await prisma.$transaction(async (tx) => {
    await tx.tournamentPlayer.create({
      data: {
        teamId: invitation.teamId,
        userId: userId,
        playerName: user.name,
        playerEmail: user.email
      }
    });

    return tx.tournamentTeamInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'accepted',
        inviteeUserId: userId
      },
      include: {
        team: { include: { tournament: true } },
        inviter: { select: { id: true, name: true, email: true } },
        inviteeUser: { select: { id: true, name: true, email: true } }
      }
    });
  });

  return updated;
};

/**
 * Cancel a team invitation
 */
export const cancelTeamInvitation = async (invitationId: string) => {
  const invitation = await prisma.tournamentTeamInvitation.findUnique({
    where: { id: invitationId },
    select: { id: true, status: true }
  });

  if (!invitation) {
    throw new NotFoundError('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new BadRequestError(`Invitation cannot be cancelled because it has already been ${invitation.status}`);
  }

  return await prisma.tournamentTeamInvitation.update({
    where: { id: invitationId },
    data: { status: 'cancelled' }
  });
};

/**
 * Expire old invitations (should be run periodically)
 */
export const expireOldInvitations = async () => {
  return await prisma.tournamentTeamInvitation.updateMany({
    where: {
      status: 'pending',
      expiresAt: {
        lt: new Date()
      }
    },
    data: { status: 'expired' }
  });
};

/**
 * Sort standings according to tournament tiebreaker rules.
 * Default: points, goal_difference, goals_for.
 * Custom rules: "goal_difference" | "goals_for" | "goals_against" | "wins" | "head_to_head"
 */
export const sortStandingsByTiebreakerRules = (
  standings: any[],
  tiebreakerRules?: string[] | null
): any[] => {
  const rules = tiebreakerRules && tiebreakerRules.length > 0
    ? tiebreakerRules
    : ['goal_difference', 'goals_for'];

  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    for (const rule of rules) {
      switch (rule) {
        case 'goal_difference': {
          const gdA = a.goalsFor - a.goalsAgainst;
          const gdB = b.goalsFor - b.goalsAgainst;
          if (gdB !== gdA) return gdB - gdA;
          break;
        }
        case 'goals_for':
          if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
          break;
        case 'goals_against':
          if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
          break;
        case 'wins':
          if (b.wins !== a.wins) return b.wins - a.wins;
          break;
        default:
          break;
      }
    }
    return 0;
  });
};

// ==================== SPORT-SPECIFIC SCORE VALIDATION ====================

/**
 * Validate sport-specific scoring rules (e.g. volleyball sets).
 * Throws BadRequestError when the submitted scores are inconsistent with the
 * detailed score breakdown or violate the sport configuration.
 */
export const validateSportSpecificScore = (
  sportConfig: SportScoringConfig | undefined | null,
  detailedScore: DetailedScore | undefined | null,
  homeScore: number,
  awayScore: number
): void => {
  if (!sportConfig || !detailedScore) return;
  if (sportConfig.type === 'volleyball') {
    const result = calculateVolleyballWinner(detailedScore, sportConfig as VolleyballConfig);
    if (!result.isValid) {
      throw new BadRequestError(result.error!);
    }
    if (homeScore !== result.homeWins || awayScore !== result.awayWins) {
      throw new BadRequestError(
        `Score mismatch: Based on sets, score should be ${result.homeWins}-${result.awayWins}`
      );
    }
  }
};

// ==================== ROSTER HELPERS ====================

/**
 * Ensure the team captain appears in the roster.  When teams are created via
 * self-registration the captain may not have a TournamentPlayer row.  This
 * helper prepends a synthetic entry so callers always see the full roster.
 */
export const buildRosterWithCaptain = (
  team: {
    id: string;
    createdAt: Date;
    captainUser: { id: string; name: string | null; email: string } | null;
  },
  players: Array<{ user: { id: string; name?: string | null; email?: string } | null; [key: string]: unknown }>
): Array<unknown> => {
  if (team.captainUser && !players.some((p) => p.user?.id === team.captainUser!.id)) {
    const captain = team.captainUser;
    const synthetic = {
      id: `captain:${captain.id}`,
      teamId: team.id,
      playerName: captain.name ?? null,
      createdAt: team.createdAt,
      user: { id: captain.id, name: captain.name, email: captain.email },
    };
    return [synthetic, ...players];
  }
  return players;
};

// ==================== TOURNAMENT LIFECYCLE / AUTO-STATUS ====================

// In-memory TTL cache: skip re-syncing the same tournament on every paginated
// list call (avoids N extra Prisma round-trips when listing many tournaments).
const lastSyncedAt = new Map<string, Date>();
const SYNC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fan out tournament_updated notifications to all team captains when a
 * tournament completes automatically.  Idempotent — checks for an existing
 * notification before creating new ones.
 */
export const sendTournamentCompletionNotifications = async (
  tournamentId: string,
  tournamentName: string
): Promise<void> => {
  const transitionKey = `auto_completed:${tournamentId}`;
  const existing = await prisma.tournamentNotification.findFirst({
    where: {
      tournamentId,
      type: TournamentNotificationType.tournament_updated,
      metadata: { path: ['transitionKey'], equals: transitionKey },
    },
    select: { id: true },
  });

  if (existing) return;

  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId, captainUserId: { not: null } },
    select: { captainUserId: true },
  });

  if (teams.length === 0) return;

  await prisma.tournamentNotification.createMany({
    data: teams.map((team) => ({
      userId: team.captainUserId!,
      tournamentId,
      type: TournamentNotificationType.tournament_updated,
      params: { tournamentName, lifecycleStatus: 'completed' },
      metadata: { transitionKey },
    })),
  });
};

/**
 * Read-and-write-if-stale: compute the expected auto-status for a tournament
 * and persist a status change when needed.  Returns the tournament with an
 * up-to-date `status` field.
 *
 * For list reads a TTL cache prevents syncing the same tournament on every
 * paginated request.  Detail reads always sync.  The cache is disabled in
 * test mode so tests can assert on sync behaviour deterministically.
 */
export const syncTournamentAutoStatus = async <T extends {
  id: string;
  status: string;
  name?: string;
  startDate: Date;
  endDate?: Date | null;
  registrationStartDate?: Date | null;
  registrationDeadline?: Date | null;
}>(tournament: T, trigger: string = 'read_sync'): Promise<T> => {
  if (process.env.NODE_ENV !== 'test' && trigger.endsWith('list_read')) {
    const lastSync = lastSyncedAt.get(tournament.id);
    if (lastSync && Date.now() - lastSync.getTime() < SYNC_CACHE_TTL_MS) {
      return tournament;
    }
  }

  const [matchCount, incompleteMatchCount] = await Promise.all([
    prisma.tournamentMatch.count({ where: { tournamentId: tournament.id } }),
    prisma.tournamentMatch.count({
      where: {
        tournamentId: tournament.id,
        OR: [
          { status: { not: MatchStatus.COMPLETED } },
          { homeScore: null },
          { awayScore: null },
        ],
      },
    }),
  ]);

  const nextStatus = computeAutoStatus({
    ...tournament,
    hasMatches: matchCount > 0,
    hasIncompleteMatches: incompleteMatchCount > 0,
  });

  if (!nextStatus || nextStatus === tournament.status) {
    lastSyncedAt.set(tournament.id, new Date());
    return tournament;
  }

  try {
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { status: nextStatus as TournamentStatus },
    });
    recordTournamentLifecycleTransition(tournament.status, nextStatus, trigger);

    if (nextStatus === TournamentStatus.COMPLETED) {
      await sendTournamentCompletionNotifications(tournament.id, tournament.name ?? 'Tournament');
    }
  } catch (error) {
    recordTournamentLifecycleTransitionFailure(tournament.status, nextStatus, trigger);
    throw error;
  }

  lastSyncedAt.set(tournament.id, new Date());

  logger.info('Tournament lifecycle status auto-updated', 'TournamentService', {
    tournamentId: tournament.id,
    from: tournament.status,
    to: nextStatus,
    trigger,
  });

  return { ...tournament, status: nextStatus };
};

/**
 * After any mutation that could affect lifecycle status (score submission,
 * bracket generation, etc.) refetch the tournament and reconcile its status.
 */
export const reconcileTournamentLifecycleStatus = async (
  tournamentId: string,
  trigger: string
): Promise<void> => {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      status: true,
      name: true,
      startDate: true,
      endDate: true,
      registrationStartDate: true,
      registrationDeadline: true,
    },
  });

  if (!tournament) return;

  await syncTournamentAutoStatus(tournament, trigger);
};

/**
 * Invalidate the in-memory lifecycle sync cache for a given tournament.
 * Call this whenever a status is explicitly mutated (e.g. cancellation) so
 * subsequent reads reflect the new status immediately without waiting for TTL.
 */
export const invalidateSyncCache = (tournamentId: string): void => {
  lastSyncedAt.delete(tournamentId);
};
