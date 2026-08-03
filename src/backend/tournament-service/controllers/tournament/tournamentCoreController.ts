/**
 * Tournament Controller
 *
 * This controller manages all tournament-related operations including:
 * - Tournament CRUD operations (create, read, update, delete)
 * - Team management (add, update, delete, assign to pool)
 * - Player management (add, update, remove, list)
 * - Bracket and match management (generate, create, update, delete, assign referee)
 * - Pool management (create, assign teams, standings)
 * - Score submission and verification
 */

import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import prisma from '../../../config/database';
import { logger } from '../../../utils/logger';
import * as tournamentService from '../../../services/tournamentService';
import { NotificationFactory } from '../../../services/notificationFactory';
import {
  TournamentFormat,
  TournamentStatus,
  MatchStatus,
  BracketStage,
  TournamentNotificationType,
  TournamentPaymentStatus,
  TOURNAMENT_PAYMENT_STATUSES,
  TournamentPaymentTransactionStatus,
  TournamentSeedingPolicy,
  MatchIncidentType,
  MatchIncidentStatus,
  MATCH_INCIDENT_TYPES,
  MATCH_INCIDENT_STATUSES,
  VALID_TIEBREAKER_RULES,
} from '../../../../shared/types/tournament.types';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../utils/errors';
import { isRequired, parseCoordinates, parseFloatStrict, sanitizeString, isValidEmail } from '../../../utils/validation';
import { ensureResourceExists } from '../../../utils/controllerHelpers';
import { isPrismaNotFoundError, isPrismaUniqueError } from '../../../utils/typeGuards';
import * as locationService from '../../../services/locationService';
import {
  canPerformTournamentLifecycleAction,
  isTerminalTournamentStatus,
} from '../../../services/tournamentLifecyclePolicy';
import { normalizeIdArrayInput, parseEnumInput } from './_requestValidators';
import {
  MAX_BATCH_PAYMENT_TEAMS,
  DEFAULT_INCIDENT_SLA_MINUTES,
  DEFAULT_MATCH_DURATION_MINUTES,
  DEFAULT_PAGE_SIZE,
  DEFAULT_REFEREE_REST_WINDOW_MINUTES,
  INVITATION_EXPIRY_DAYS,
  MAX_BULK_SHIFT_MINUTES,
  MAX_INCIDENT_DESCRIPTION_LENGTH,
  MAX_LOCATION_RADIUS_KM,
  MAX_MATCH_DURATION_MINUTES,
  MAX_PAGE_SIZE,
  MAX_PAYMENT_METADATA_BYTES,
  MAX_PLAYER_NAME_LENGTH,
  MAX_POOL_NAME_LENGTH,
  MAX_TEAMS_UPPER_BOUND,
  MILLISECONDS_PER_MINUTE,
  OVERLAP_GAP_INDICATOR,
  PROVIDER_REF_TEAM_ID_PREFIX_LENGTH,
  SHARE_TOKEN_BYTES,
  SPORT_CONFIG_TYPES,
  TOURNAMENT_CONTINGENCY_MODES,
  TOURNAMENT_PAYMENT_TRANSACTION_STATUSES,
} from './_constants';
import {
  parseBoolean,
  parseIntegerInRange,
  parseMatchScoreInput,
  parseNonNegativeInteger,
  parsePlayoffSize,
  parseTimeToMinutes,
} from './_helpers';

type PoolWaitlistPromoterClient = Pick<typeof prisma, 'tournamentPoolWaitlist' | 'tournamentPool' | 'tournamentTeam'>;

const syncTournamentAutoStatus = tournamentService.syncTournamentAutoStatus;
const reconcileTournamentLifecycleStatus = tournamentService.reconcileTournamentLifecycleStatus;

const isTournamentEditLocked = (tournament: { status: string; startDate: Date }): boolean => {
  if (
    tournament.status === TournamentStatus.CANCELLED ||
    tournament.status === TournamentStatus.COMPLETED ||
    tournament.status === TournamentStatus.IN_PROGRESS
  ) {
    return true;
  }

  return new Date() >= new Date(tournament.startDate);
};

const assertTournamentNotFinalized = (
  tournament: { status: string },
  message: string = 'Completed or cancelled tournaments cannot be edited'
): void => {
  if (isTerminalTournamentStatus(tournament.status)) {
    throw new BadRequestError(message);
  }
};

export const assertTournamentSetupEditable = (
  tournament: { status: string; startDate: Date },
  message: string
): void => {
  assertTournamentNotFinalized(tournament);
  if (isTournamentEditLocked(tournament)) {
    throw new BadRequestError(message);
  }
};

const resolveMoveTeamTargetPoolId = (
  body: unknown,
  params: { targetPoolId?: string }
): string | null => {
  const typedBody = body as { poolId?: string | null };
  if (typedBody.poolId !== undefined) return typedBody.poolId;
  return params.targetPoolId ?? null;
};

const assertTeamPaymentUpdateAllowed = (
  tournament: { status: string; paymentDeadline?: Date | null },
  paymentStatus: string
): void => {
  assertTournamentNotFinalized(
    tournament,
    'Team payment status cannot be updated for completed or cancelled tournaments'
  );

  if (
    tournament.paymentDeadline &&
    new Date() >= new Date(tournament.paymentDeadline) &&
    paymentStatus !== TournamentPaymentStatus.PAID &&
    paymentStatus !== TournamentPaymentStatus.WAIVED
  ) {
    throw new BadRequestError('Payment deadline has passed; only paid or waived updates are allowed');
  }
};

export const assertSupportedTournamentFormat = (format?: string): void => {
  if (format === TournamentFormat.DOUBLE_ELIMINATION) {
    throw new BadRequestError('Double elimination tournaments are not supported yet');
  }
};

export const MAX_MIN_TEAM_REST_MINUTES = 1_440;
const MAX_JERSEY_NUMBER = 999;

export const parseOptionalDate = (value: unknown, fieldName: string): Date | null => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value as string | Date);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid date`);
  }
  return parsed;
};

const isValidHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const validateTiebreakerRules = (value: unknown): string[] | null => {
  if (value === undefined) return null;
  if (value === null) return [];
  if (!Array.isArray(value)) {
    throw new BadRequestError('tiebreakerRules must be an array of strings');
  }
  const normalized = value.map((rule) => String(rule).trim()).filter(Boolean);
  const allowed = new Set(VALID_TIEBREAKER_RULES);
  const invalidRules = normalized.filter((rule) => !allowed.has(rule as (typeof VALID_TIEBREAKER_RULES)[number]));
  if (invalidRules.length > 0) {
    throw new BadRequestError(
      `Invalid tiebreaker rule(s): ${invalidRules.join(', ')}. Allowed values: ${VALID_TIEBREAKER_RULES.join(', ')}`
    );
  }
  return normalized;
};

export const validateSportConfigShape = (sportConfig: unknown): void => {
  if (sportConfig === undefined || sportConfig === null) return;
  if (typeof sportConfig !== 'object' || Array.isArray(sportConfig)) {
    throw new BadRequestError('sportConfig must be an object');
  }
  const config = sportConfig as Record<string, unknown>;
  const type = config.type;
  if (type !== undefined && !SPORT_CONFIG_TYPES.includes(type as (typeof SPORT_CONFIG_TYPES)[number])) {
    throw new BadRequestError(`sportConfig.type must be one of: ${SPORT_CONFIG_TYPES.join(', ')}`);
  }
  if (type === 'volleyball') {
    if (
      !Number.isInteger(config.regularSetPoints) ||
      !Number.isInteger(config.decidingSetPoints) ||
      !Number.isInteger(config.bestOfSets)
    ) {
      throw new BadRequestError(
        'volleyball sportConfig requires integer regularSetPoints, decidingSetPoints, and bestOfSets'
      );
    }
  }
  if (type === 'tennis') {
    if (
      !Number.isInteger(config.bestOfSets) ||
      !Number.isInteger(config.gamesPerSet) ||
      !Number.isInteger(config.tiebreakPoints)
    ) {
      throw new BadRequestError('tennis sportConfig requires integer bestOfSets, gamesPerSet, and tiebreakPoints');
    }
  }
  if (type === 'default') {
    if (!Number.isInteger(config.winPoints) || !Number.isInteger(config.drawPoints) || !Number.isInteger(config.lossPoints)) {
      throw new BadRequestError('default sportConfig requires integer winPoints, drawPoints, and lossPoints');
    }
  }
};

const isUniqueConstraintOnField = (error: unknown, fieldName: string): boolean => {
  if (!isPrismaUniqueError(error)) return false;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  if (Array.isArray(target)) {
    return target.some((item) => String(item) === fieldName);
  }
  return String(target) === fieldName;
};

const getPaymentUpdatePayload = (paymentStatus: string, userId: string) => ({
  paymentStatus,
  paidAt:
    paymentStatus === TournamentPaymentStatus.PAID
      ? new Date()
      : paymentStatus === TournamentPaymentStatus.UNPAID
        ? null
        : undefined,
  paidByUserId:
    paymentStatus === TournamentPaymentStatus.PAID
      ? userId
      : paymentStatus === TournamentPaymentStatus.UNPAID
        ? null
        : undefined,
});

const normalizeRegistrationAnswers = (
  answers: unknown
): Array<{ fieldId: string; value: string }> => {
  if (!Array.isArray(answers)) {
    return [];
  }

  return answers
    .filter((answer): answer is { fieldId?: string; value?: unknown } => (
      !!answer &&
      typeof answer === 'object' &&
      'fieldId' in answer &&
      typeof answer.fieldId === 'string'
    ))
    .map((answer) => ({
      fieldId: answer.fieldId!.trim(),
      value: String(answer.value ?? '').trim(),
    }));
};

const hasScheduleOverlap = (
  startA: Date,
  durationMinutesA: number,
  startB: Date,
  durationMinutesB: number
): boolean => {
  const endA = new Date(startA.getTime() + durationMinutesA * MILLISECONDS_PER_MINUTE);
  const endB = new Date(startB.getTime() + durationMinutesB * MILLISECONDS_PER_MINUTE);
  return startA < endB && startB < endA;
};

const getRequiredRestGapMinutes = (
  startA: Date,
  durationMinutesA: number,
  startB: Date,
  durationMinutesB: number
): number => {
  const endA = new Date(startA.getTime() + durationMinutesA * MILLISECONDS_PER_MINUTE);
  const endB = new Date(startB.getTime() + durationMinutesB * MILLISECONDS_PER_MINUTE);
  if (hasScheduleOverlap(startA, durationMinutesA, startB, durationMinutesB)) {
    return OVERLAP_GAP_INDICATOR;
  }
  if (endA <= startB) {
    return Math.max(0, Math.floor((startB.getTime() - endA.getTime()) / MILLISECONDS_PER_MINUTE));
  }
  return Math.max(0, Math.floor((startA.getTime() - endB.getTime()) / MILLISECONDS_PER_MINUTE));
};

export const maybeAutoGenerateGroupsKnockoutBrackets = async (
  tournamentId: string
): Promise<void> => {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      status: true,
      format: true,
      autoGenerateBrackets: true,
    },
  });
  if (!tournament) return;
  if (String(tournament.format) !== TournamentFormat.GROUPS_KNOCKOUT) return;
  if (!tournament.autoGenerateBrackets) return;
  if (tournament.status === TournamentStatus.CANCELLED || tournament.status === TournamentStatus.COMPLETED) return;

  const [groupMatchCount, incompleteGroupMatchCount, knockoutMatchCount] = await Promise.all([
    prisma.tournamentMatch.count({
      where: { tournamentId, stage: BracketStage.GROUP_STAGE },
    }),
    prisma.tournamentMatch.count({
      where: { tournamentId, stage: BracketStage.GROUP_STAGE, status: { not: MatchStatus.COMPLETED } },
    }),
    prisma.tournamentMatch.count({
      where: { tournamentId, stage: { not: BracketStage.GROUP_STAGE } },
    }),
  ]);

  if (groupMatchCount === 0 || incompleteGroupMatchCount > 0 || knockoutMatchCount > 0) return;

  const result = await tournamentService.generateKnockoutFromStandings(tournamentId);
  await notifyKnockoutBracketReadyToCaptains(
    { id: tournament.id, name: tournament.name },
    { source: 'auto', matchesCreated: result.count }
  );
  await reconcileTournamentLifecycleStatus(tournamentId, 'auto_generate_knockout');

  logger.info('Auto-generated knockout bracket from completed group stage', 'TournamentController', {
    tournamentId,
    matchesCreated: result.count,
  });
};

const notifyAssignedScorekeeper = async (
  tournament: { id: string; name: string },
  match: {
    id: string;
    homeTeam?: { name: string } | null;
    awayTeam?: { name: string } | null;
    scorekeeper?: { id: string } | null;
    scheduledAt?: Date | null;
    court?: { name: string } | null;
  }
): Promise<void> => {
  if (!match.scorekeeper?.id) return;

  await NotificationFactory.createTournamentNotifications({
    userIds: [match.scorekeeper.id],
    tournamentId: tournament.id,
    type: TournamentNotificationType.match_scheduled,
    params: {
      tournamentName: tournament.name,
      homeTeamName: match.homeTeam?.name ?? 'Home Team',
      awayTeamName: match.awayTeam?.name ?? 'Away Team',
    },
    metadata: {
      matchId: match.id,
      scheduledAt: match.scheduledAt?.toISOString?.() ?? match.scheduledAt ?? null,
      courtName: match.court?.name ?? null,
      role: 'scorekeeper',
    },
  });
};

export const notifyMatchResultToCaptains = async (
  tournament: { id: string; name: string },
  match: {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number | null;
    awayScore: number | null;
    homeTeam?: { name: string } | null;
    awayTeam?: { name: string } | null;
  }
): Promise<void> => {
  try {
    const teams = await prisma.tournamentTeam.findMany({
      where: {
        id: { in: [match.homeTeamId, match.awayTeamId] },
        captainUserId: { not: null },
      },
      select: { captainUserId: true },
    });

    const userIds = [...new Set(teams.map((team) => team.captainUserId).filter(Boolean))] as string[];
    if (userIds.length === 0) return;

    await NotificationFactory.createTournamentNotifications({
      userIds,
      tournamentId: tournament.id,
      type: TournamentNotificationType.score_submitted,
      params: {
        tournamentName: tournament.name,
        homeTeamName: match.homeTeam?.name ?? 'Home Team',
        awayTeamName: match.awayTeam?.name ?? 'Away Team',
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      },
      metadata: {
        matchId: match.id,
      },
    });
  } catch (error) {
    logger.error('Failed to notify captains about match result', 'TournamentController', {
      tournamentId: tournament.id,
      matchId: match.id,
      error,
    });
  }
};

const notifyKnockoutBracketReadyToCaptains = async (
  tournament: { id: string; name: string },
  metadata: { source: 'manual' | 'auto'; matchesCreated: number }
): Promise<void> => {
  const teams = await prisma.tournamentTeam.findMany({
    where: {
      tournamentId: tournament.id,
      captainUserId: { not: null },
    },
    select: {
      captainUserId: true,
    },
  });

  const userIds = [...new Set(teams.map((team) => team.captainUserId).filter(Boolean))] as string[];
  if (userIds.length === 0) return;

  await NotificationFactory.createTournamentNotifications({
    userIds,
    tournamentId: tournament.id,
    type: TournamentNotificationType.tournament_updated,
    params: {
      tournamentName: tournament.name,
      updateType: 'knockout_bracket_ready',
    },
    metadata,
  });
};

const promoteFirstPoolWaitlistEntry = async (tx: PoolWaitlistPromoterClient, poolId: string) => {
  const firstWaitlistEntry = await tx.tournamentPoolWaitlist.findFirst({
    where: { poolId },
    orderBy: { position: 'asc' },
    include: { team: true },
  });

  if (!firstWaitlistEntry) return null;

  const pool = await tx.tournamentPool.findUnique({
    where: { id: poolId },
    include: { teams: true },
  });

  if (!pool) return null;

  await tx.tournamentTeam.update({
    where: { id: firstWaitlistEntry.teamId },
    data: {
      poolId,
      poolName: pool.name,
      registrationOrder: pool.teams.length + 1,
    },
  });

  await tx.tournamentPoolWaitlist.delete({
    where: { id: firstWaitlistEntry.id },
  });

  await tx.tournamentPoolWaitlist.updateMany({
    where: { poolId, position: { gt: firstWaitlistEntry.position } },
    data: { position: { decrement: 1 } },
  });

  return firstWaitlistEntry.team;
};

const mapPaymentTransactionStatusToTeamPaymentStatus = (
  status: TournamentPaymentTransactionStatus
): TournamentPaymentStatus => {
  if (status === TournamentPaymentTransactionStatus.PAID) {
    return TournamentPaymentStatus.PAID;
  }
  if (status === TournamentPaymentTransactionStatus.PENDING || status === TournamentPaymentTransactionStatus.INITIATED) {
    return TournamentPaymentStatus.PENDING;
  }
  return TournamentPaymentStatus.UNPAID;
};

const PAYMENT_TRANSACTION_ALLOWED_TRANSITIONS: Record<TournamentPaymentTransactionStatus, TournamentPaymentTransactionStatus[]> = {
  [TournamentPaymentTransactionStatus.INITIATED]: [
    TournamentPaymentTransactionStatus.PENDING,
    TournamentPaymentTransactionStatus.PAID,
    TournamentPaymentTransactionStatus.FAILED,
    TournamentPaymentTransactionStatus.CANCELLED,
  ],
  [TournamentPaymentTransactionStatus.PENDING]: [
    TournamentPaymentTransactionStatus.PAID,
    TournamentPaymentTransactionStatus.FAILED,
    TournamentPaymentTransactionStatus.CANCELLED,
  ],
  [TournamentPaymentTransactionStatus.PAID]: [
    TournamentPaymentTransactionStatus.REFUNDED,
  ],
  [TournamentPaymentTransactionStatus.FAILED]: [
    TournamentPaymentTransactionStatus.PENDING,
    TournamentPaymentTransactionStatus.CANCELLED,
  ],
  [TournamentPaymentTransactionStatus.REFUNDED]: [],
  [TournamentPaymentTransactionStatus.CANCELLED]: [],
};

const assertPaymentTransactionStatusTransitionAllowed = (
  current: TournamentPaymentTransactionStatus,
  next: TournamentPaymentTransactionStatus
): void => {
  if (current === next) return;
  if (!(PAYMENT_TRANSACTION_ALLOWED_TRANSITIONS[current] ?? []).includes(next)) {
    throw new BadRequestError(`Cannot transition payment transaction from ${current} to ${next}`);
  }
};

const assertCanViewTournament = async (
  tournament: { id: string; organizerId: string; isPublic: boolean },
  userId: string
): Promise<void> => {
  if (tournament.isPublic) return;
  if (await tournamentService.isOrganizerOrAdmin(tournament, userId)) return;
  const member = await prisma.tournamentTeam.findFirst({
    where: {
      tournamentId: tournament.id,
      OR: [{ captainUserId: userId }, { players: { some: { userId } } }],
    },
    select: { id: true },
  });
  if (!member) {
    throw new ForbiddenError('You do not have access to this private tournament');
  }
};

export { INVITATION_EXPIRY_DAYS };

// ==================== TEAM MANAGEMENT ====================

/**
 * Add a team to a tournament
 */
export const addTeam = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const {
    name,
    captainName,
    captainEmail,
    captainUserId,
    poolId,
    categoryId,
    poolNumber,
    poolName,
    seedNumber,
    waiverAccepted,
  } = req.body;

  isRequired(name, 'Team name');
  if (typeof name === 'string' && name.trim().length === 0) {
    throw new BadRequestError('Team name cannot be empty or whitespace-only');
  }
  if (typeof name === 'string' && name.trim().length > MAX_POOL_NAME_LENGTH) {
    throw new BadRequestError(`Team name must be at most ${MAX_POOL_NAME_LENGTH} characters`);
  }

  // Validate email format when a captain email is supplied
  if (captainEmail && !isValidEmail(captainEmail)) {
    throw new BadRequestError('Invalid captain email format');
  }
  if (poolNumber !== undefined && poolNumber !== null) {
    parseIntegerInRange(poolNumber, 'poolNumber', 1, MAX_TEAMS_UPPER_BOUND);
  }
  if (seedNumber !== undefined && seedNumber !== null) {
    parseIntegerInRange(seedNumber, 'seedNumber', 1, MAX_TEAMS_UPPER_BOUND);
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
  });

  ensureResourceExists(tournament, 'Tournament');

  tournamentService.validateRegistrationEligibility(tournament!);

  if (tournament!.requireWaiverForRegistration && waiverAccepted !== true) {
    throw new BadRequestError('This tournament requires waiver acceptance before registration');
  }

  const categoryCount = await prisma.tournamentCategory.count({
    where: { tournamentId: id },
  });
  const hasCategories = categoryCount > 0;

  let selectedCategory: { id: string; name: string } | null = null;
  if (categoryId) {
    selectedCategory = await prisma.tournamentCategory.findFirst({
      where: { id: categoryId, tournamentId: id },
      select: { id: true, name: true },
    });
    if (!selectedCategory) {
      throw new NotFoundError('Category not found');
    }
  }

  if (hasCategories && !selectedCategory) {
    throw new BadRequestError('Category selection is required for this tournament');
  }

  let validatedPool: { id: string; name: string; categoryId: string | null } | null = null;
  if (poolId) {
    validatedPool = await prisma.tournamentPool.findFirst({
      where: { id: poolId, tournamentId: id },
      select: { id: true, name: true, categoryId: true },
    });
    if (!validatedPool) {
      throw new NotFoundError('Pool not found');
    }
    if (selectedCategory && validatedPool.categoryId && validatedPool.categoryId !== selectedCategory.id) {
      throw new BadRequestError('Selected pool does not belong to selected category');
    }
  }

  // Guard against providing both legacy `poolNumber` and new `poolId` simultaneously
  if (poolId && poolNumber !== undefined && poolNumber !== null) {
    throw new BadRequestError('Provide either `poolId` to assign to a pool, or `poolNumber` (legacy). Do not provide both.');
  }

  // If a captainUserId is provided, verify the user exists and is not an organizer or admin
  if (captainUserId) {
    const captainUser = await prisma.user.findUnique({ where: { id: captainUserId }, select: { id: true, deletedAt: true } });
    if (!captainUser || captainUser.deletedAt) {
      throw new BadRequestError('Captain user not found');
    }
    if (await tournamentService.isOrganizerOrAdmin(tournament!, captainUserId)) {
      throw new ForbiddenError('Tournament organizers and co-organizers cannot be registered as team captains');
    }
  }

  // Wrap the max-teams check and team creation in a transaction to prevent
  // concurrent registrations from exceeding the limit (TOCTOU race).
  const team = await prisma.$transaction(async (tx) => {
    if (tournament!.maxTeams) {
      const teamCount = await tx.tournamentTeam.count({ where: { tournamentId: id } });
      if (teamCount >= tournament!.maxTeams) {
        throw new BadRequestError('Tournament has reached maximum number of teams');
      }
    }

    // First try to find an existing team that matches the deduplication keys
    // (captainUserId if provided, otherwise team name within the tournament).
    const existingWhere = captainUserId
      ? { tournamentId: id, OR: [{ captainUserId }, { name }] }
      : { tournamentId: id, name };

    const existing = await tx.tournamentTeam.findFirst({ where: existingWhere });
    if (existing) return existing;

    // Attempt to create; if a concurrent request created the same team, handle
    // the unique constraint by returning the existing row instead of failing.
    try {
      return await tx.tournamentTeam.create({
        data: {
          name,
          captainName,
          captainEmail,
          captainUserId: captainUserId || undefined,
          tournamentId: id,
          poolId: validatedPool?.id ?? undefined,
          poolName: validatedPool?.name ?? ((selectedCategory?.name ?? poolName) || undefined),
          poolNumber: poolNumber ? Number(poolNumber) : undefined,
          seedNumber: seedNumber ? Number(seedNumber) : undefined,
          waiverAcceptedAt: waiverAccepted ? new Date() : undefined,
          waiverAcceptedByUserId: waiverAccepted ? userId : undefined,
        },
        include: {
          captainUser: {
            select: { id: true, name: true, email: true }
          }
        }
      });
    } catch (err) {
      // If unique constraint occurred due to a concurrent create, return the
      // existing record instead of throwing; otherwise rethrow.
      if (isPrismaUniqueError(err)) {
        const found = await tx.tournamentTeam.findFirst({ where: existingWhere });
        if (found) return found;
      }
      throw err;
    }
  }).catch((error: unknown) => {
    // Handle unique constraint violation on captainUserId not covered above
    if (isUniqueConstraintOnField(error, 'captainUserId')) {
      throw new BadRequestError('User is already captain of another team in this tournament');
    }
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError('A team with this name already exists in the tournament');
    }
    throw error;
  });

  // Create notification for tournament organizer
  if (userId !== tournament!.organizerId) {
    try {
      await NotificationFactory.createTournamentNotifications({
        userIds: [tournament!.organizerId],
        tournamentId: id,
        type: TournamentNotificationType.team_registered,
        params: {
          tournamentName: tournament!.name,
          teamName: name,
          captainName: captainName || 'Unknown',
        },
        metadata: {
          teamId: team.id,
          registeredBy: userId,
        },
      });
    } catch (notifError) {
      logger.error('Failed to create tournament registration notification', 'TournamentController', { error: notifError });
      // Don't fail the team registration if notification fails
    }
  }

  logger.info('Team added to tournament', 'TournamentController', {
    tournamentId: id,
    teamId: team.id,
    userId
  });

  res.status(201).json(team);
};

/**
 * Update a team
 */
export const updateTeam = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;
  const { name, captainName, captainEmail, captainUserId, poolNumber, poolName, seedNumber, logoUrl } = req.body;

  const tournament = await prisma.tournament.findUnique({
    where: { id }
  });

  ensureResourceExists(tournament, 'Tournament');

  assertTournamentSetupEditable(tournament!, 'Teams can only be edited before the tournament starts');

  // Verify the team belongs to this tournament
  const team = await prisma.tournamentTeam.findFirst({
    where: { id: teamId, tournamentId: id }
  });

  ensureResourceExists(team, 'Team');

  // Check permissions
  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament!, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

  if (!isOrgOrAdmin && !isCaptain) {
    throw new ForbiddenError('Only the organizer, admin, or team captain can update the team');
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) {
    if (String(name).trim().length === 0) {
      throw new BadRequestError('Team name cannot be empty or whitespace-only');
    }
    if (String(name).trim().length > MAX_POOL_NAME_LENGTH) {
      throw new BadRequestError(`Team name must be at most ${MAX_POOL_NAME_LENGTH} characters`);
    }
    updateData.name = String(name).trim();
  }
  if (captainName !== undefined) updateData.captainName = captainName;
  if (captainEmail !== undefined) {
    if (captainEmail && !isValidEmail(captainEmail)) {
      throw new BadRequestError('Invalid captain email format');
    }
    updateData.captainEmail = captainEmail || null;
  }
  if (captainUserId !== undefined) {
    // Validate the new captain user when one is being assigned
    if (captainUserId) {
      const newCaptainUser = await prisma.user.findUnique({
        where: { id: captainUserId },
        select: { id: true, deletedAt: true }
      });
      if (!newCaptainUser || newCaptainUser.deletedAt) {
        throw new BadRequestError('Captain user not found');
      }
      // Cannot assign an organizer/co-organizer as captain
      if (await tournamentService.isOrganizerOrAdmin(tournament!, captainUserId)) {
        throw new ForbiddenError('Tournament organizers and co-organizers cannot be assigned as team captains');
      }
      // Cannot assign someone who is captain of another team in this tournament
      const conflictingTeam = await prisma.tournamentTeam.findFirst({
        where: { tournamentId: id, captainUserId, NOT: { id: teamId } },
        select: { id: true, name: true }
      });
      if (conflictingTeam) {
        throw new BadRequestError('This user is already a team captain in this tournament');
      }
    }
    updateData.captainUserId = captainUserId || null;
  }
  if (logoUrl !== undefined) {
    if (logoUrl && !isValidHttpUrl(String(logoUrl))) {
      throw new BadRequestError('logoUrl must be a valid http(s) URL');
    }
    updateData.logoUrl = logoUrl || null;
  }
  // Only organizers and admins can change pool assignments and seeding
  if (isOrgOrAdmin) {
    if (poolNumber !== undefined) {
      // If team is already assigned to a pool via poolId, require pool-move endpoint
      if (team.poolId) {
        throw new BadRequestError('Team is assigned to a pool via `poolId`; use the pool-move endpoint to change pool assignments or clear the pool first.');
      }
      if (poolNumber === null || poolNumber === '') {
        updateData.poolNumber = null;
      } else {
        updateData.poolNumber = parseIntegerInRange(poolNumber, 'poolNumber', 1, MAX_TEAMS_UPPER_BOUND);
      }
    }
    if (poolName !== undefined) updateData.poolName = poolName || null;
    if (seedNumber !== undefined) {
      if (seedNumber === null || seedNumber === '') {
        updateData.seedNumber = null;
      } else {
        updateData.seedNumber = parseIntegerInRange(seedNumber, 'seedNumber', 1, MAX_TEAMS_UPPER_BOUND);
      }
    }
  }

  let updatedTeam;
  try {
    updatedTeam = await prisma.tournamentTeam.update({
      where: { id: teamId },
      data: updateData,
      include: {
        captainUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError('A team with this name already exists in the tournament');
    }
    throw error;
  }

  logger.info('Team updated', 'TournamentController', {
    tournamentId: id,
    teamId,
    userId
  });

  res.json(updatedTeam);
};

/**
 * Delete a team
 */
export const deleteTeam = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;

  const tournament = await prisma.tournament.findUnique({
    where: { id }
  });

  ensureResourceExists(tournament, 'Tournament');

  if (!await tournamentService.isOrganizerOrAdmin(tournament!, userId)) {
    throw new ForbiddenError('Only organizers and admins can delete teams');
  }

  assertTournamentSetupEditable(tournament!, 'Cannot delete teams once tournament has started');

  // Verify the team actually belongs to this tournament before deleting
  const team = await prisma.tournamentTeam.findFirst({
    where: { id: teamId, tournamentId: id }
  });
  ensureResourceExists(team, 'Team');

  const result = await prisma.$transaction(async (tx) => {
    await tx.tournamentTeam.delete({
      where: { id: teamId }
    });

    const parsedWithdrawalDeadline = tournament!.withdrawalDeadline
      ? new Date(tournament!.withdrawalDeadline)
      : null;
    const shouldAutoPromote =
      tournament!.autoPromoteRegistrationWaitlist === true &&
      (
        !parsedWithdrawalDeadline ||
        new Date() <= parsedWithdrawalDeadline
      );

    if (!shouldAutoPromote) {
      return { promotedTeamId: null as string | null };
    }

    const firstWaitlistEntry = await tx.tournamentRegistrationWaitlist.findFirst({
      where: { tournamentId: id },
      orderBy: { position: 'asc' },
      select: { id: true, teamId: true, position: true },
    });

    if (!firstWaitlistEntry) {
      return { promotedTeamId: null as string | null };
    }

    await tx.tournamentRegistrationWaitlist.delete({
      where: { id: firstWaitlistEntry.id },
    });
    await tx.tournamentRegistrationWaitlist.updateMany({
      where: {
        tournamentId: id,
        position: { gt: firstWaitlistEntry.position },
      },
      data: { position: { decrement: 1 } },
    });

    return { promotedTeamId: firstWaitlistEntry.teamId };
  });

  logger.info('Team deleted', 'TournamentController', {
    tournamentId: id,
    teamId,
    userId
  });

  res.json({
    message: 'Team deleted successfully',
    ...(result.promotedTeamId ? { promotedTeamId: result.promotedTeamId } : {}),
  });
};

/**
 * Update payment status for a team (admin/organizer only)
 */
export const updateTeamPayment = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;
  const paymentStatus = parseEnumInput(
    req.body?.paymentStatus,
    TOURNAMENT_PAYMENT_STATUSES,
    'paymentStatus'
  );

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers and admins can update team payment status');
  }

  assertTeamPaymentUpdateAllowed(tournament, paymentStatus);

  const team = ensureResourceExists(
    await prisma.tournamentTeam.findFirst({ where: { id: teamId, tournamentId: id } }),
    'Team'
  );

  const updatedTeam = await prisma.tournamentTeam.update({
    where: { id: team.id },
    data: getPaymentUpdatePayload(paymentStatus, userId),
    include: {
      captainUser: { select: { id: true, name: true, email: true } },
    },
  });

  logger.info('Team payment status updated', 'TournamentController', {
    tournamentId: id,
    teamId,
    paymentStatus,
    userId,
  });

  res.json(updatedTeam);
};

/**
 * Batch update payment status for multiple teams (admin/organizer only)
 */
export const batchUpdateTeamPayments = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { teamIds, paymentStatus } = req.body ?? {};

  const normalizedTeamIds = normalizeIdArrayInput(teamIds, 'teamIds', MAX_BATCH_PAYMENT_TEAMS);
  const normalizedPaymentStatus = parseEnumInput(
    paymentStatus,
    TOURNAMENT_PAYMENT_STATUSES,
    'paymentStatus'
  );

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers and admins can update team payment status');
  }

  assertTeamPaymentUpdateAllowed(tournament, normalizedPaymentStatus);

  const updatePayload = getPaymentUpdatePayload(normalizedPaymentStatus, userId);
  const result = await prisma.$transaction(async (tx) => {
    const teams = await tx.tournamentTeam.findMany({
      where: {
        tournamentId: id,
        id: { in: normalizedTeamIds },
      },
      select: { id: true, paymentStatus: true },
    });

    const foundIds = new Set(teams.map((team) => team.id));
    const notFoundTeamIds = normalizedTeamIds.filter((teamId) => !foundIds.has(teamId));
    const skipped = teams
      .filter((team) => team.paymentStatus === normalizedPaymentStatus)
      .map((team) => team.id);
    const idsToUpdate = teams
      .filter((team) => team.paymentStatus !== normalizedPaymentStatus)
      .map((team) => team.id);

    if (idsToUpdate.length > 0) {
      await tx.tournamentTeam.updateMany({
        where: { tournamentId: id, id: { in: idsToUpdate } },
        data: updatePayload,
      });
    }

    return {
      requestedCount: normalizedTeamIds.length,
      updatedCount: idsToUpdate.length,
      skippedCount: skipped.length,
      notFoundCount: notFoundTeamIds.length,
      updatedTeamIds: idsToUpdate,
      skippedTeamIds: skipped,
      notFoundTeamIds,
    };
  });

  logger.info('Team payment status batch-updated', 'TournamentController', {
    tournamentId: id,
    paymentStatus: normalizedPaymentStatus,
    ...result,
    userId,
  });

  res.json({
    paymentStatus: normalizedPaymentStatus,
    ...result,
  });
};

export const acceptTeamWaiver = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;
  const { accepted = true } = req.body ?? {};

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const team = ensureResourceExists(
    await prisma.tournamentTeam.findFirst({ where: { id: teamId, tournamentId: id } }),
    'Team'
  );

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  const isCaptain = team.captainUserId === userId;
  if (!isOrgOrAdmin && !isCaptain) {
    throw new ForbiddenError('Only organizers/admins or team captain can update waiver status');
  }

  if (accepted !== true && accepted !== false) {
    throw new BadRequestError('accepted must be a boolean');
  }

  if (accepted === true && tournament.requireWaiverForRegistration && !tournament.waiverText) {
    throw new BadRequestError('Waiver text must be configured before accepting waivers');
  }

  const updated = await prisma.tournamentTeam.update({
    where: { id: team.id },
    data: {
      waiverAcceptedAt: accepted ? new Date() : null,
      waiverAcceptedByUserId: accepted ? userId : null,
    },
  });

  res.json(updated);
};

export const createTeamPaymentIntent = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;
  const { provider = 'manual', amount, currency = 'USD', metadata } = req.body ?? {};

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  const team = ensureResourceExists(
    await prisma.tournamentTeam.findFirst({ where: { id: teamId, tournamentId: id } }),
    'Team'
  );

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  const isCaptain = team.captainUserId === userId;
  if (!isOrgOrAdmin && !isCaptain) {
    throw new ForbiddenError('Only organizers/admins or team captain can create payment intents');
  }

  if (tournament.paymentDeadline && new Date() >= new Date(tournament.paymentDeadline)) {
    throw new BadRequestError('Payment deadline has passed');
  }

  const resolvedAmount =
    amount !== undefined
      ? Number(amount)
      : tournament.registrationFee !== null && tournament.registrationFee !== undefined
        ? Number(tournament.registrationFee)
        : 0;
  if (Number.isNaN(resolvedAmount) || resolvedAmount < 0) {
    throw new BadRequestError('amount must be a non-negative number');
  }
  if (resolvedAmount === 0) {
    throw new BadRequestError('Cannot create payment intent for zero amount');
  }
  if (metadata !== undefined) {
    if (typeof metadata !== 'object' || metadata === null) {
      throw new BadRequestError('metadata must be a JSON object when provided');
    }
    const metadataBytes = Buffer.byteLength(JSON.stringify(metadata), 'utf8');
    if (metadataBytes > MAX_PAYMENT_METADATA_BYTES) {
      throw new BadRequestError(`metadata must be at most ${MAX_PAYMENT_METADATA_BYTES} bytes`);
    }
  }

  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.tournamentPaymentTransaction.create({
      data: {
        tournamentId: id,
        teamId: team.id,
        createdByUserId: userId,
        provider: String(provider).trim() || 'manual',
        providerReference: `manual_${Date.now()}_${team.id.slice(0, PROVIDER_REF_TEAM_ID_PREFIX_LENGTH)}`,
        amount: resolvedAmount,
        currency: String(currency || 'USD').toUpperCase(),
        status: TournamentPaymentTransactionStatus.INITIATED,
        metadata: metadata ?? undefined,
      },
    });

    await tx.tournamentTeam.update({
      where: { id: team.id },
      data: getPaymentUpdatePayload(TournamentPaymentStatus.PENDING, userId),
    });

    return created;
  });

  res.status(201).json({
    ...transaction,
    paymentInstructions: tournament.paymentInfo ?? null,
  });
};

export const getTeamPaymentTransactions = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  const team = ensureResourceExists(
    await prisma.tournamentTeam.findFirst({ where: { id: teamId, tournamentId: id } }),
    'Team'
  );

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  const isCaptain = team.captainUserId === userId;
  if (!isOrgOrAdmin && !isCaptain) {
    throw new ForbiddenError('Only organizers/admins or team captain can view payment transactions');
  }

  const transactions = await prisma.tournamentPaymentTransaction.findMany({
    where: { tournamentId: id, teamId: team.id },
    orderBy: { createdAt: 'desc' },
  });

  res.json(transactions);
};

export const updatePaymentTransactionStatus = async (req: Request, res: Response) => {
  const { id, paymentId } = req.params;
  const userId = req.user!.id;
  const paymentStatus = parseEnumInput(
    req.body?.status,
    TOURNAMENT_PAYMENT_TRANSACTION_STATUSES,
    'status'
  ) as TournamentPaymentTransactionStatus;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers/admins can update payment transaction statuses');
  }

  const transaction = await prisma.$transaction(async (tx) => {
    const existing = ensureResourceExists(
      await tx.tournamentPaymentTransaction.findFirst({
        where: { id: paymentId, tournamentId: id },
      }),
      'Payment transaction'
    );

    const existingStatus = existing.status as TournamentPaymentTransactionStatus;
    assertPaymentTransactionStatusTransitionAllowed(existingStatus, paymentStatus);

    if (existingStatus === paymentStatus) {
      return existing;
    }

    const updated = await tx.tournamentPaymentTransaction.update({
      where: { id: existing.id },
      data: {
        status: paymentStatus,
        paidAt: paymentStatus === TournamentPaymentTransactionStatus.PAID ? new Date() : existing.paidAt,
        refundedAt:
          paymentStatus === TournamentPaymentTransactionStatus.REFUNDED ? new Date() : existing.refundedAt,
      },
    });

    const teamPaymentStatus = mapPaymentTransactionStatusToTeamPaymentStatus(paymentStatus);
    await tx.tournamentTeam.update({
      where: { id: existing.teamId },
      data: getPaymentUpdatePayload(teamPaymentStatus, userId),
    });

    return updated;
  });

  res.json(transaction);
};

// ==================== BRACKET & MATCH MANAGEMENT ====================

/**
 * Generate group-stage matches for a groups_knockout tournament.
 * Only allowed once registration is closed (status = registration_closed).
 * Deletes and recreates only the group_stage matches, leaving knockout matches untouched.
 */
export const generateGroupMatches = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const {
    numberOfGroups,
    teamsPerGroup,
    usePoolAssignments,
    forceGenerate,
    scheduleStartAt,
    gameDurationMinutes,
    warmupMinutes,
    breakMinutes,
    minTeamRestMinutes,
  } = req.body;
  if (numberOfGroups !== undefined) {
    parseIntegerInRange(numberOfGroups, 'numberOfGroups', 1, Math.max(1, MAX_TEAMS_UPPER_BOUND / 2));
  }
  if (teamsPerGroup !== undefined) {
    parseIntegerInRange(teamsPerGroup, 'teamsPerGroup', 2, MAX_TEAMS_UPPER_BOUND);
  }

  const resolvedGameDurationMinutes = gameDurationMinutes === undefined
    ? DEFAULT_MATCH_DURATION_MINUTES
    : parseIntegerInRange(gameDurationMinutes, 'gameDurationMinutes', 1, MAX_MATCH_DURATION_MINUTES);
  const resolvedWarmupMinutes = warmupMinutes === undefined
    ? 0
    : parseNonNegativeInteger(warmupMinutes, 'warmupMinutes');
  const resolvedBreakMinutes = breakMinutes === undefined
    ? 0
    : parseNonNegativeInteger(breakMinutes, 'breakMinutes');

  if (resolvedWarmupMinutes > 240) {
    throw new BadRequestError('warmupMinutes must be between 0 and 240');
  }
  if (resolvedBreakMinutes > 240) {
    throw new BadRequestError('breakMinutes must be between 0 and 240');
  }

  const resolvedScheduleStartAt = scheduleStartAt === undefined
    ? null
    : parseOptionalDate(scheduleStartAt, 'scheduleStartAt');

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const resolvedMinTeamRestMinutes = minTeamRestMinutes === undefined
    ? (tournament.minTeamRestMinutes ?? 0)
    : parseIntegerInRange(minTeamRestMinutes, 'minTeamRestMinutes', 0, MAX_MIN_TEAM_REST_MINUTES);

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can generate group matches');
  }

  if (String(tournament.format) !== TournamentFormat.GROUPS_KNOCKOUT) {
    throw new BadRequestError('Group match generation is only available for groups_knockout tournaments');
  }

  const groupMatchPolicy = canPerformTournamentLifecycleAction(
    'generate_group_matches',
    tournament.status
  );
  if (!groupMatchPolicy.allowed) {
    throw new BadRequestError(groupMatchPolicy.reason ?? 'Group matches cannot be generated in the current tournament status');
  }

  // Enforce payment gate
  if (tournament.requireWaiverForRegistration && !forceGenerate) {
    const missingWaiverCount = await prisma.tournamentTeam.count({
      where: { tournamentId: id, waiverAcceptedAt: null },
    });
    if (missingWaiverCount > 0) {
      throw new BadRequestError(
        `${missingWaiverCount} team(s) are missing waiver acceptance. Collect waivers or use forceGenerate to override.`
      );
    }
  }

  // Enforce payment gate
  if (tournament.requirePaymentForBrackets && !forceGenerate) {
    const unpaidCount = await prisma.tournamentTeam.count({
      where: { tournamentId: id, paymentStatus: { notIn: [TournamentPaymentStatus.PAID, TournamentPaymentStatus.WAIVED] } },
    });
    if (unpaidCount > 0) {
      throw new BadRequestError(
        `${unpaidCount} team(s) have not completed payment. Mark all teams as paid/waived or use forceGenerate to override.`
      );
    }
  }

  // Delete existing group-stage matches and their standings only
  const existingGroupMatches = await prisma.tournamentMatch.count({
    where: { tournamentId: id, stage: 'group_stage' }
  });
  const isRegeneration = existingGroupMatches > 0;

  if (isRegeneration) {
    await prisma.$transaction([
      // Delete only group-stage standings to avoid clobbering knockout standings
      prisma.tournamentStanding.deleteMany({ where: { tournamentId: id, groupName: { not: null } } }),
      prisma.tournamentMatch.deleteMany({ where: { tournamentId: id, stage: 'group_stage' } }),
    ]);
  }

  let result;
  if (usePoolAssignments) {
    const pools = await prisma.tournamentPool.findMany({
      where: { tournamentId: id },
      select: { id: true, teams: { select: { id: true } } },
    });
    const underfilledPools = pools.filter((pool) => pool.teams.length < 2);
    if (underfilledPools.length > 0) {
      throw new BadRequestError('All pools must have at least 2 teams before generating pool-based matches');
    }
    result = await tournamentService.generatePoolAwareBrackets(id, {
      fallbackToRoundRobin: false,
    });
  } else {
    let resolvedGroups = numberOfGroups;
    if (!resolvedGroups && teamsPerGroup) {
      const teamCount = await prisma.tournamentTeam.count({ where: { tournamentId: id } });
      resolvedGroups = Math.max(2, Math.floor(teamCount / teamsPerGroup));
    }
    result = await tournamentService.generateGroupsKnockoutBrackets(id, resolvedGroups || 4);
  }

  await reconcileTournamentLifecycleStatus(id, 'generate_group_matches');

  let scheduledMatches = 0;
  if (resolvedScheduleStartAt) {
    const generatedMatches = await prisma.tournamentMatch.findMany({
      where: {
        tournamentId: id,
        stage: BracketStage.GROUP_STAGE,
        status: { not: MatchStatus.CANCELLED },
      },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        groupName: true,
      },
      orderBy: [{ groupName: 'asc' }, { id: 'asc' }],
    });

    const poolsByName = new Map<string, { venue: string | null }>();
    const pools = await prisma.tournamentPool.findMany({
      where: { tournamentId: id },
      select: { name: true, venue: true },
    });
    for (const pool of pools) {
      poolsByName.set(pool.name, { venue: pool.venue ?? null });
    }

    const slotMinutes = resolvedGameDurationMinutes + resolvedWarmupMinutes + resolvedBreakMinutes;
    const occupiedDurationMinutes = resolvedGameDurationMinutes + resolvedWarmupMinutes;
    const nextStartByGroup = new Map<string, Date>();
    const teamLastEndByGroup = new Map<string, Map<string, Date>>();

    const resolveGroupKey = (groupName: string | null): string =>
      groupName && groupName.trim().length > 0 ? groupName : '__default_group__';

    for (const match of generatedMatches) {
      if (!match.homeTeamId || !match.awayTeamId) {
        continue;
      }

      const groupKey = resolveGroupKey(match.groupName);
      if (!nextStartByGroup.has(groupKey)) {
        nextStartByGroup.set(groupKey, new Date(resolvedScheduleStartAt));
      }
      if (!teamLastEndByGroup.has(groupKey)) {
        teamLastEndByGroup.set(groupKey, new Map<string, Date>());
      }

      const cursor = new Date(nextStartByGroup.get(groupKey)!);
      const teamLastEnd = teamLastEndByGroup.get(groupKey)!;
      const homeLastEnd = teamLastEnd.get(match.homeTeamId);
      const awayLastEnd = teamLastEnd.get(match.awayTeamId);
      const earliestByRest = [homeLastEnd, awayLastEnd]
        .filter((value): value is Date => !!value)
        .reduce((latest, value) => {
          const candidate = new Date(value.getTime() + (resolvedMinTeamRestMinutes * MILLISECONDS_PER_MINUTE));
          return candidate > latest ? candidate : latest;
        }, cursor);
      const scheduledAt = earliestByRest > cursor ? earliestByRest : cursor;
      const matchEnd = new Date(
        scheduledAt.getTime() + (occupiedDurationMinutes * MILLISECONDS_PER_MINUTE)
      );

      await prisma.tournamentMatch.update({
        where: { id: match.id },
        data: {
          scheduledAt,
          scheduledDurationMinutes: occupiedDurationMinutes,
          location: poolsByName.get(groupKey)?.venue ?? undefined,
        },
      });

      teamLastEnd.set(match.homeTeamId, matchEnd);
      teamLastEnd.set(match.awayTeamId, matchEnd);
      nextStartByGroup.set(
        groupKey,
        new Date(scheduledAt.getTime() + (slotMinutes * MILLISECONDS_PER_MINUTE))
      );
      scheduledMatches += 1;
    }

    if (minTeamRestMinutes !== undefined) {
      await prisma.tournament.update({
        where: { id },
        data: { minTeamRestMinutes: resolvedMinTeamRestMinutes },
      });
    }
  }

  logger.info('Group matches generated', 'TournamentController', {
    tournamentId: id,
    userId,
    isRegeneration,
    scheduledMatches,
  });

  res.json({
    message: isRegeneration ? 'Group matches regenerated successfully' : 'Group matches generated successfully',
    matchesCreated: result.count,
    scheduledMatches,
  });
};

/**
 * Generate tournament brackets
 * For groups_knockout: generates only the knockout stage, requiring all group matches to be done.
 * For other formats: generates the full bracket.
 */
export const generateBrackets = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { usePoolAssignments, forceGenerate, playoffSize, doubleElimination } = req.body;

  let tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const requestedPlayoffSize = playoffSize === undefined ? undefined : parsePlayoffSize(playoffSize);
  const requestedDoubleElimination =
    doubleElimination === undefined ? undefined : parseBoolean(doubleElimination, 'doubleElimination');

  if (
    requestedDoubleElimination !== undefined &&
    ![
      TournamentFormat.SINGLE_ELIMINATION,
      TournamentFormat.GROUPS_KNOCKOUT,
      TournamentFormat.DOUBLE_ELIMINATION,
    ].includes(tournament.format as TournamentFormat)
  ) {
    throw new BadRequestError('Double elimination is only supported for single elimination or groups + knockout playoffs');
  }

  if (requestedPlayoffSize !== undefined || requestedDoubleElimination !== undefined) {
    tournament = await prisma.tournament.update({
      where: { id },
      data: {
        ...(requestedPlayoffSize !== undefined ? { playoffSize: requestedPlayoffSize } : {}),
        ...(requestedDoubleElimination !== undefined ? { doubleElimination: requestedDoubleElimination } : {}),
      },
    });
  }

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can generate brackets');
  }

  const bracketPolicy = canPerformTournamentLifecycleAction('generate_brackets', tournament.status);
  if (!bracketPolicy.allowed) {
    throw new BadRequestError(bracketPolicy.reason ?? 'Brackets can only be generated or regenerated for active tournaments');
  }

  if (requestedPlayoffSize !== undefined) {
    const registeredTeamCount = await prisma.tournamentTeam.count({ where: { tournamentId: id } });
    if (registeredTeamCount > 0 && requestedPlayoffSize > registeredTeamCount) {
      throw new BadRequestError(`Playoff size ${requestedPlayoffSize} exceeds registered teams (${registeredTeamCount})`);
    }
  }

  // For groups_knockout: knockout brackets require all group matches to be completed.
  if (String(tournament.format) === TournamentFormat.GROUPS_KNOCKOUT) {
    const groupMatchCounts = await prisma.tournamentMatch.findMany({
      where: { tournamentId: id, stage: 'group_stage' },
      select: { status: true },
    });

    if (groupMatchCounts.length === 0) {
      throw new BadRequestError(
        'Group matches must be generated and completed before generating the knockout bracket. Use the "Generate Group Matches" action first.'
      );
    }

    const incompleteGroupMatches = groupMatchCounts.filter((m) => m.status !== 'completed').length;
    if (incompleteGroupMatches > 0) {
      throw new BadRequestError(
        `${incompleteGroupMatches} group match(es) are not yet completed. All group matches must be finished before generating the knockout bracket.`
      );
    }

    // Delete existing knockout matches and regenerate from standings
    await prisma.tournamentMatch.deleteMany({
      where: { tournamentId: id, stage: { not: 'group_stage' } },
    });

    // Generate knockout bracket seeded from current standings
    const result = await tournamentService.generateKnockoutFromStandings(id);
    await notifyKnockoutBracketReadyToCaptains(
      { id: tournament.id, name: tournament.name },
      { source: 'manual', matchesCreated: result.count }
    );

    await reconcileTournamentLifecycleStatus(id, 'generate_knockout');

    logger.info('Knockout brackets generated', 'TournamentController', {
      tournamentId: id,
      userId,
    });

    return res.json({
      message: 'Knockout brackets generated successfully',
      matchesCreated: result.count,
    });
  }

  // Non-groups_knockout formats: existing full-bracket generation
  const existingMatches = await prisma.tournamentMatch.count({
    where: { tournamentId: id, status: { not: MatchStatus.CANCELLED } }
  });
  const isRegeneration = existingMatches > 0;

  // Enforce payment gate when required (organizer can force-override via forceGenerate flag)
  if (tournament.requireWaiverForRegistration && !forceGenerate) {
    const missingWaiverCount = await prisma.tournamentTeam.count({
      where: { tournamentId: id, waiverAcceptedAt: null },
    });
    if (missingWaiverCount > 0) {
      throw new BadRequestError(
        `${missingWaiverCount} team(s) are missing waiver acceptance. Collect waivers or use forceGenerate to override.`
      );
    }
  }

  // Enforce payment gate when required (organizer can force-override via forceGenerate flag)
  if (tournament.requirePaymentForBrackets && !forceGenerate) {
    const unpaidCount = await prisma.tournamentTeam.count({
      where: { tournamentId: id, paymentStatus: { notIn: [TournamentPaymentStatus.PAID, TournamentPaymentStatus.WAIVED] } },
    });
    if (unpaidCount > 0) {
      throw new BadRequestError(
        `${unpaidCount} team(s) have not completed payment. Mark all teams as paid/waived or use forceGenerate to override.`
      );
    }
  }

  if (isRegeneration) {
    await prisma.$transaction([
      prisma.tournamentStanding.deleteMany({ where: { tournamentId: id } }),
      prisma.tournamentMatch.deleteMany({ where: { tournamentId: id } }),
    ]);
  }

  let result;
  switch (String(tournament.format)) {
    case TournamentFormat.SINGLE_ELIMINATION:
      result =
        tournament.doubleElimination
          ? await tournamentService.generateDoubleEliminationBrackets(id, {
              randomizeSeeds: tournament.seedingPolicy === TournamentSeedingPolicy.RANDOM || usePoolAssignments === true,
              allowByes: tournament.allowByes !== false,
              playoffSize: tournament.playoffSize,
            })
          : usePoolAssignments
            ? await tournamentService.generateRandomizedSingleEliminationBracketsFromPools(id)
            : await tournamentService.generateSingleEliminationBrackets(id, {
                randomizeSeeds: tournament.seedingPolicy === TournamentSeedingPolicy.RANDOM,
                allowByes: tournament.allowByes !== false,
                playoffSize: tournament.playoffSize,
              });
      break;
    case TournamentFormat.DOUBLE_ELIMINATION:
      result = await tournamentService.generateDoubleEliminationBrackets(id, {
        randomizeSeeds: tournament.seedingPolicy === TournamentSeedingPolicy.RANDOM || usePoolAssignments === true,
        allowByes: tournament.allowByes !== false,
        playoffSize: tournament.playoffSize,
      });
      break;
    case TournamentFormat.ROUND_ROBIN:
      result = await tournamentService.generateRoundRobinBrackets(id);
      break;
    case 'pool':
      // For pool format: prefer pool-aware generation when pools are set up
      result = await tournamentService.generatePoolAwareBrackets(id);
      break;
    default:
      throw new BadRequestError('Invalid tournament format');
  }

  await reconcileTournamentLifecycleStatus(id, 'generate_brackets');

  logger.info('Brackets generated', 'TournamentController', {
    tournamentId: id,
    userId,
    format: tournament.format
  });

  res.json({
    message: isRegeneration ? 'Brackets regenerated successfully' : 'Brackets generated successfully',
    matchesCreated: result.count
  });
};

/**
 * Submit match score
 */
export const submitScore = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = req.user!.id;
  const { homeScore, awayScore, detailedScore } = req.body;

  if (homeScore === undefined || awayScore === undefined) {
    throw new BadRequestError('Both home and away scores are required');
  }

  const parsedHomeScore = parseMatchScoreInput(homeScore, 'homeScore');
  const parsedAwayScore = parseMatchScoreInput(awayScore, 'awayScore');

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (
    tournament.status === TournamentStatus.DRAFT ||
    tournament.status === TournamentStatus.CANCELLED ||
    tournament.status === TournamentStatus.COMPLETED
  ) {
    throw new BadRequestError('Scores cannot be submitted for draft, cancelled or completed tournaments');
  }

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findUnique({ where: { id: matchId } }),
    'Match'
  );

  if (match.tournamentId !== id) {
    logger.warn('Match tournament mismatch on score submission', 'TournamentController', {
      tournamentId: id,
      matchId,
      matchTournamentId: match.tournamentId,
      userId,
    });
    throw new NotFoundError('Match not found');
  }
  if (!match.awayTeamId || match.isBye) {
    throw new BadRequestError('Scores can only be submitted for matches with two participating teams');
  }
  if (![MatchStatus.SCHEDULED, MatchStatus.IN_PROGRESS, MatchStatus.COMPLETED].includes(match.status as MatchStatus)) {
    throw new BadRequestError('Scores can only be submitted for scheduled or in-progress matches');
  }
  if (match.status === MatchStatus.SCHEDULED && match.scheduledAt && new Date() < new Date(match.scheduledAt)) {
    throw new BadRequestError('Score submission is not allowed before the scheduled match start time');
  }

  const isEliminationFormat =
    tournament.format === TournamentFormat.SINGLE_ELIMINATION ||
    tournament.format === TournamentFormat.DOUBLE_ELIMINATION;
  const isKnockoutStage = match.stage != null && match.stage !== BracketStage.GROUP_STAGE;
  if ((isEliminationFormat || isKnockoutStage) && parsedHomeScore === parsedAwayScore) {
    // Allow draws for third-place matches, or when a detailedScore tie-breaker declares a winner (penalties/overtime)
    const ds = detailedScore as unknown;
    const resolvedByDetail = ds ? (typeof ds === 'string' ? (() => { try { return JSON.parse(ds); } catch { return null; } })() : ds) : null;
    if (match.stage === BracketStage.THIRD_PLACE) {
      // third-place match may be allowed to end in a draw
    } else if (resolvedByDetail && (resolvedByDetail.winner === 'home' || resolvedByDetail.winner === 'away' || resolvedByDetail.winnerTeamId)) {
      // tie decided by penalties/overtime; acceptable
    } else {
      throw new BadRequestError('Draws are not allowed in elimination matches');
    }
  }

  // Prevent duplicate score submission for already completed matches
  if (match.status === MatchStatus.COMPLETED && match.homeScore !== null && match.awayScore !== null) {
    return res.status(409).json({ 
      error: 'Match score has already been submitted',
      match: {
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        completedAt: match.completedAt
      }
    });
  }

  // Check permissions - organizer, team captains, registered players, or referee team members can submit scores
  const canSubmit = await tournamentService.canSubmitScore(match, tournament, userId);

  if (!canSubmit) {
    throw new ForbiddenError('Only the organizer, team captains, registered players, or referee team members can submit scores');
  }

  // Validate sport-specific scoring if detailed score is provided
  const sportConfig = tournament.sportConfig;
  tournamentService.validateSportSpecificScore(
    sportConfig as unknown as Parameters<typeof tournamentService.validateSportSpecificScore>[0],
    detailedScore,
    parsedHomeScore,
    parsedAwayScore
  );

  // Use a transaction to ensure atomic update of match and standings
  let updatedMatch;
  try {
    updatedMatch = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.tournamentMatch.updateMany({
        where: {
          id: matchId,
          status: { not: MatchStatus.COMPLETED },
        },
        data: {
          homeScore: parsedHomeScore,
          awayScore: parsedAwayScore,
          detailedScore: detailedScore || undefined,
          status: MatchStatus.COMPLETED,
          // Populate startedAt if not already set (backfill for matches that skipped the in-progress state)
          startedAt: match.startedAt ?? new Date(),
          completedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictError(
          'Match score has already been submitted. Please refresh to see the latest match details.'
        );
      }

      const finalizedMatch = ensureResourceExists(
        await tx.tournamentMatch.findUnique({
          where: { id: matchId },
          include: {
            homeTeam: true,
            awayTeam: true,
          },
        }),
        'Match'
      );

      // Update standings within the same transaction
      await tournamentService.updateStandings(matchId, tournament, tx);

      return finalizedMatch;
    });
  } catch (error) {
    if (error instanceof ConflictError || isPrismaNotFoundError(error)) {
      throw new ConflictError(
        'Match score has already been submitted. Please refresh to see the latest match details.'
      );
    }
    throw error;
  }

  // If this is a knockout stage match, check if we should advance winners
  if (match.stage && match.stage !== BracketStage.THIRD_PLACE) {
    await tournamentService.advanceWinners(id, match.stage as BracketStage);
  }

  await notifyMatchResultToCaptains(tournament, updatedMatch);
  await maybeAutoGenerateGroupsKnockoutBrackets(id);
  await reconcileTournamentLifecycleStatus(id, 'submit_score');

  logger.info('Match score submitted', 'TournamentController', {
    tournamentId: id,
    matchId,
    userId
  });

  res.json(updatedMatch);
};

/**
 * Admin score override — allows organizers/admins to set or retroactively correct scores.
 * Unlike submitScore, this works even on already-completed matches (reverts old standings first).
 */
export const adminUpdateScore = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = req.user!.id;
  const { homeScore, awayScore } = req.body;

  if (homeScore === undefined || awayScore === undefined) {
    throw new BadRequestError('Both home and away scores are required');
  }

  const parsedHomeScore = parseMatchScoreInput(homeScore, 'homeScore');
  const parsedAwayScore = parseMatchScoreInput(awayScore, 'awayScore');

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can override match scores');
  }

  if (
    tournament.status === TournamentStatus.CANCELLED ||
    tournament.status === TournamentStatus.COMPLETED
  ) {
    throw new BadRequestError('Scores cannot be updated for cancelled or completed tournaments');
  }

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findUnique({ where: { id: matchId } }),
    'Match'
  );

  if (match.tournamentId !== id) {
    logger.warn('Match tournament mismatch on admin score update', 'TournamentController', {
      tournamentId: id, matchId, matchTournamentId: match.tournamentId, userId,
    });
    throw new NotFoundError('Match not found');
  }

  const isEliminationFormat =
    tournament.format === TournamentFormat.SINGLE_ELIMINATION ||
    tournament.format === TournamentFormat.DOUBLE_ELIMINATION;
  const isKnockoutStage = match.stage != null && match.stage !== BracketStage.GROUP_STAGE;
  if ((isEliminationFormat || isKnockoutStage) && parsedHomeScore === parsedAwayScore) {
    throw new BadRequestError('Draws are not allowed in elimination matches');
  }

  // Atomically: revert old standings (if match was already scored), update scores, apply new standings
  const updatedMatch = await prisma.$transaction(async (tx) => {
    // Revert old standings only if the match was already completed with scores
    if (match.status === MatchStatus.COMPLETED && match.homeScore !== null && match.awayScore !== null) {
      await tournamentService.revertStandings(matchId, tx);
    }

    const updated = await tx.tournamentMatch.update({
      where: { id: matchId },
      data: {
        homeScore: parsedHomeScore,
        awayScore: parsedAwayScore,
        status: MatchStatus.COMPLETED,
        completedAt: match.completedAt ?? new Date(),
      },
      include: { homeTeam: true, awayTeam: true },
    });

    await tournamentService.updateStandings(matchId, tournament, tx);

    return updated;
  });

  // If knockout stage, attempt to advance winners (idempotent)
  if (match.stage && match.stage !== BracketStage.THIRD_PLACE) {
    await tournamentService.advanceWinners(id, match.stage as BracketStage);
  }

  await notifyMatchResultToCaptains(tournament, updatedMatch);
  await maybeAutoGenerateGroupsKnockoutBrackets(id);
  await reconcileTournamentLifecycleStatus(id, 'admin_update_score');

  logger.info('Match score overridden by admin', 'TournamentController', {
    tournamentId: id, matchId, homeScore: parsedHomeScore, awayScore: parsedAwayScore, userId,
  });

  res.json(updatedMatch);
};

/**
 * Get tournament standings
 */
export const getStandings = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { groupName } = req.query;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id }, select: { id: true, organizerId: true, isPublic: true, tiebreakerRules: true } }),
    'Tournament'
  );

  await assertCanViewTournament(tournament, userId);

  const where: Record<string, unknown> = { tournamentId: id };
  if (groupName) {
    where.groupName = groupName as string;
  }

  const rawStandings = await prisma.tournamentStanding.findMany({
    where,
    include: { team: true },
    orderBy: [{ points: 'desc' }]
  });

  const tiebreakerRules = tournament.tiebreakerRules as string[] | null;
  if (tiebreakerRules && tiebreakerRules.includes('head_to_head')) {
    await tournamentService.computeAndAttachHeadToHeadPoints(id, rawStandings as Array<Record<string, unknown>>);
  }
  const standings = tournamentService.sortStandingsByTiebreakerRules(rawStandings, tiebreakerRules);

  res.json(standings);
};

export const getTournamentMatches = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const {
    status,
    stage,
    teamId,
    courtId,
    scheduledFrom,
    scheduledTo,
    page,
    limit,
  } = req.query;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id }, select: { id: true, organizerId: true, isPublic: true } }),
    'Tournament'
  );

  await assertCanViewTournament(tournament, userId);

  const parsedPage = Math.max(1, parseInt(page as string, 10) || 1);
  const parsedLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const skip = (parsedPage - 1) * parsedLimit;

  const where: Record<string, unknown> = { tournamentId: id };
  if (status) where.status = status as MatchStatus;
  if (stage) where.stage = stage as BracketStage;
  if (teamId) {
    where.OR = [{ homeTeamId: teamId as string }, { awayTeamId: teamId as string }];
  }
  if (courtId) where.courtId = courtId as string;
  if (scheduledFrom || scheduledTo) {
    where.scheduledAt = {
      ...(scheduledFrom ? { gte: new Date(String(scheduledFrom)) } : {}),
      ...(scheduledTo ? { lte: new Date(String(scheduledTo)) } : {}),
    };
  }

  const [matches, total] = await Promise.all([
    prisma.tournamentMatch.findMany({
      where,
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        refereeTeam: { select: { id: true, name: true } },
        scorekeeper: { select: { id: true, name: true, email: true } },
        court: { select: { id: true, name: true, location: true } },
      },
      orderBy: [
        { scheduledAt: 'asc' },
        { stage: 'asc' },
        { roundNumber: 'asc' },
        { matchOrder: 'asc' },
      ],
      skip,
      take: parsedLimit,
    }),
    prisma.tournamentMatch.count({ where }),
  ]);

  res.json({
    data: matches,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  });
};

/**
 * Create a manual match (admin only)
 */
export const createMatch = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const {
    homeTeamId,
    awayTeamId,
    refereeTeamId,
    stage,
    roundNumber,
    groupName,
    scheduledAt,
    matchOrder,
    location
  } = req.body;
  const parsedScheduledAt = parseOptionalDate(scheduledAt, 'scheduledAt');
  if (roundNumber !== undefined && roundNumber !== null && roundNumber !== '') {
    parseIntegerInRange(roundNumber, 'roundNumber', 1, MAX_TEAMS_UPPER_BOUND);
  }

  if (!homeTeamId || !awayTeamId) {
    throw new BadRequestError('Both home and away teams are required');
  }

  if (homeTeamId === awayTeamId) {
    throw new BadRequestError('Home and away teams must be different');
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can create matches');
  }

  assertTournamentSetupEditable(tournament, 'Matches can only be created before the tournament starts');
  if (parsedScheduledAt && parsedScheduledAt < new Date()) {
    throw new BadRequestError('scheduledAt cannot be in the past');
  }
  if (parsedScheduledAt && parsedScheduledAt < tournament.startDate) {
    throw new BadRequestError('scheduledAt cannot be before tournament startDate');
  }
  if (parsedScheduledAt && tournament.endDate && parsedScheduledAt > tournament.endDate) {
    throw new BadRequestError('scheduledAt cannot be after tournament endDate');
  }

  // Verify teams exist and belong to this tournament
  const homeTeam = await prisma.tournamentTeam.findFirst({
    where: { id: homeTeamId, tournamentId: id }
  });
  const awayTeam = await prisma.tournamentTeam.findFirst({
    where: { id: awayTeamId, tournamentId: id }
  });

  if (!homeTeam || !awayTeam) {
    throw new BadRequestError('Invalid team IDs or teams do not belong to this tournament');
  }

  // Verify referee team if provided
  if (refereeTeamId) {
    if (refereeTeamId === homeTeamId || refereeTeamId === awayTeamId) {
      throw new BadRequestError('Referee team cannot be one of the playing teams');
    }
    const refereeTeam = await prisma.tournamentTeam.findFirst({
      where: { id: refereeTeamId, tournamentId: id }
    });
    if (!refereeTeam) {
      throw new BadRequestError('Invalid referee team ID or team does not belong to this tournament');
    }
  }

  const match = await prisma.tournamentMatch.create({
    data: {
      tournamentId: id,
      homeTeamId,
      awayTeamId,
      refereeTeamId: refereeTeamId || undefined,
      stage: stage as BracketStage || undefined,
      roundNumber,
      groupName,
      scheduledAt: parsedScheduledAt ?? undefined,
      matchOrder,
      location: location || undefined,
      isManuallyCreated: true,
      status: MatchStatus.SCHEDULED
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      refereeTeam: true
    }
  });

  logger.info('Match created manually', 'TournamentController', {
    tournamentId: id,
    matchId: match.id,
    userId
  });

  await reconcileTournamentLifecycleStatus(id, 'create_match');

  res.status(201).json(match);
};

/**
 * Update a match (admin only)
 */
export const updateMatch = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = req.user!.id;
  const {
    homeTeamId,
    awayTeamId,
    refereeTeamId,
    stage,
    roundNumber,
    groupName,
    scheduledAt,
    matchOrder,
    status,
    location
  } = req.body;
  const parsedScheduledAt = parseOptionalDate(scheduledAt, 'scheduledAt');
  if (roundNumber !== undefined && roundNumber !== null && roundNumber !== '') {
    parseIntegerInRange(roundNumber, 'roundNumber', 1, MAX_TEAMS_UPPER_BOUND);
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can update matches');
  }

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findUnique({ where: { id: matchId } }),
    'Match'
  );

  if (match.tournamentId !== id) {
    logger.warn('Match tournament mismatch on match update', 'TournamentController', {
      tournamentId: id,
      matchId,
      matchTournamentId: match.tournamentId,
      userId,
    });
    throw new NotFoundError('Match not found');
  }

  assertTournamentSetupEditable(tournament, 'Matches can only be updated before the tournament starts');
  if (parsedScheduledAt && parsedScheduledAt < new Date()) {
    throw new BadRequestError('scheduledAt cannot be in the past');
  }
  if (parsedScheduledAt && parsedScheduledAt < tournament.startDate) {
    throw new BadRequestError('scheduledAt cannot be before tournament startDate');
  }
  if (parsedScheduledAt && tournament.endDate && parsedScheduledAt > tournament.endDate) {
    throw new BadRequestError('scheduledAt cannot be after tournament endDate');
  }

  // Validate new team IDs if provided
  if (homeTeamId || awayTeamId) {
    const newHomeId = homeTeamId || match.homeTeamId;
    const newAwayId = awayTeamId || match.awayTeamId;

    if (newHomeId === newAwayId) {
      throw new BadRequestError('Home and away teams must be different');
    }

    if (homeTeamId) {
      const homeTeam = await prisma.tournamentTeam.findFirst({
        where: { id: homeTeamId, tournamentId: id }
      });
      if (!homeTeam) {
        throw new BadRequestError('Invalid home team ID');
      }
    }

    if (awayTeamId) {
      const awayTeam = await prisma.tournamentTeam.findFirst({
        where: { id: awayTeamId, tournamentId: id }
      });
      if (!awayTeam) {
        throw new BadRequestError('Invalid away team ID');
      }
    }
  }

  const updateData: Record<string, unknown> = {};
  if (homeTeamId !== undefined) updateData.homeTeamId = homeTeamId;
  if (awayTeamId !== undefined) updateData.awayTeamId = awayTeamId;
  if (refereeTeamId !== undefined) updateData.refereeTeamId = refereeTeamId || null;
  if (stage !== undefined) updateData.stage = stage;
  if (roundNumber !== undefined) updateData.roundNumber = roundNumber;
  if (groupName !== undefined) updateData.groupName = groupName;
  if (scheduledAt !== undefined) updateData.scheduledAt = parsedScheduledAt;
  if (matchOrder !== undefined) updateData.matchOrder = matchOrder;
  if (location !== undefined) updateData.location = location || null;

  // Status changes are managed automatically via score submission or admin score override.
  // Allowing arbitrary status changes here would leave standings in an inconsistent state.
  if (status !== undefined) {
    throw new BadRequestError(
      'Match status cannot be changed directly. Use the score submission endpoint to complete matches or the admin score override to correct scores'
    );
  }

  const updatedMatch = await prisma.tournamentMatch.update({
    where: { id: matchId },
    data: updateData,
    include: {
      homeTeam: true,
      awayTeam: true,
      refereeTeam: true
    }
  });

  logger.info('Match updated', 'TournamentController', {
    tournamentId: id,
    matchId,
    userId
  });

  await reconcileTournamentLifecycleStatus(id, 'update_match');

  res.json(updatedMatch);
};

/**
 * Delete a match (admin only)
 */
export const deleteMatch = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can delete matches');
  }

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findUnique({ where: { id: matchId } }),
    'Match'
  );

  if (match.tournamentId !== id) {
    logger.warn('Match tournament mismatch on match delete', 'TournamentController', {
      tournamentId: id,
      matchId,
      matchTournamentId: match.tournamentId,
      userId,
    });
    throw new NotFoundError('Match not found');
  }

  assertTournamentSetupEditable(tournament, 'Matches can only be deleted before the tournament starts');

  // If the match has scores, revert standings first then delete atomically
  await prisma.$transaction(async (tx) => {
    if (match.status === MatchStatus.COMPLETED && match.homeScore !== null && match.awayScore !== null) {
      await tournamentService.revertStandings(matchId, tx);
    }
    await tx.tournamentMatch.delete({ where: { id: matchId } });
  });

  logger.info('Match deleted', 'TournamentController', {
    tournamentId: id,
    matchId,
    userId
  });

  await reconcileTournamentLifecycleStatus(id, 'delete_match');

  res.json({ message: 'Match deleted successfully' });
};

/**
 * Assign referee to a match (admin only)
 */
export const assignReferee = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = req.user!.id;
  const { refereeTeamId } = req.body;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can assign referees');
  }

  assertTournamentSetupEditable(tournament, 'Referees can only be assigned before the tournament starts');

  if (tournament.selfRefEnabled === false) {
    throw new BadRequestError('Self-ref mode is disabled for this tournament');
  }

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findUnique({ where: { id: matchId } }),
    'Match'
  );

  if (match.tournamentId !== id) {
    logger.warn('Match tournament mismatch on referee assignment', 'TournamentController', {
      tournamentId: id,
      matchId,
      matchTournamentId: match.tournamentId,
      userId,
    });
    throw new NotFoundError('Match not found');
  }

  // Verify referee team if provided
  if (refereeTeamId) {
    if (refereeTeamId === match.homeTeamId || refereeTeamId === match.awayTeamId) {
      throw new BadRequestError('Referee team cannot be one of the playing teams');
    }
    const refereeTeam = await prisma.tournamentTeam.findFirst({
      where: { id: refereeTeamId, tournamentId: id }
    });
    if (!refereeTeam) {
      throw new BadRequestError('Invalid referee team ID or team does not belong to this tournament');
    }

    if (match.scheduledAt) {
      const relatedMatches = await prisma.tournamentMatch.findMany({
        where: {
          tournamentId: id,
          id: { not: match.id },
          status: { not: MatchStatus.CANCELLED },
          scheduledAt: { not: null },
          OR: [
            { homeTeamId: refereeTeamId },
            { awayTeamId: refereeTeamId },
            { refereeTeamId },
          ],
        },
        select: {
          id: true,
          scheduledAt: true,
          scheduledDurationMinutes: true,
        },
      });

      const currentDuration = match.scheduledDurationMinutes ?? DEFAULT_MATCH_DURATION_MINUTES;
      for (const related of relatedMatches) {
        if (!related.scheduledAt) continue;
        const relatedDuration = related.scheduledDurationMinutes ?? DEFAULT_MATCH_DURATION_MINUTES;
        if (hasScheduleOverlap(match.scheduledAt, currentDuration, related.scheduledAt, relatedDuration)) {
          throw new BadRequestError(
            `Referee assignment conflict: team already assigned in overlapping match ${related.id}`
          );
        }
        const restGap = getRequiredRestGapMinutes(
          match.scheduledAt,
          currentDuration,
          related.scheduledAt,
          relatedDuration
        );
        if (restGap < DEFAULT_REFEREE_REST_WINDOW_MINUTES) {
          throw new BadRequestError(
            `Referee assignment conflict: team needs at least ${DEFAULT_REFEREE_REST_WINDOW_MINUTES} minutes rest between assignments (conflicts with match ${related.id})`
          );
        }
      }
    }
  }

  const updatedMatch = await prisma.tournamentMatch.update({
    where: { id: matchId },
    data: {
      refereeTeamId: refereeTeamId || null
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      refereeTeam: true
    }
  });

  logger.info('Referee assigned to match', 'TournamentController', {
    tournamentId: id,
    matchId,
    refereeTeamId,
    userId
  });

  res.json(updatedMatch);
};

/**
 * Auto-assign referee teams to matches that don't yet have one.
 * Uses a fairness algorithm: teams on break (not playing in overlapping
 * time slots) are assigned as referees, prioritising those with the
 * fewest existing referee duties so that the workload is evenly shared.
 *
 * Optional body filters:
 *   - roundNumber: only process matches in this round
 *   - groupName: only process matches in this group
 *   - stage: only process matches at this bracket stage
 */
export const autoAssignReferees = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { roundNumber, groupName, stage } = req.body ?? {};

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can auto-assign referees');
  }

  assertTournamentSetupEditable(tournament, 'Referees can only be assigned before the tournament starts');

  if (tournament.selfRefEnabled === false) {
    throw new BadRequestError('Self-ref mode is disabled for this tournament');
  }

  // Fetch all non-cancelled matches in the tournament
  const allMatches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId: id,
      status: { not: MatchStatus.CANCELLED },
    },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      refereeTeamId: true,
      scheduledAt: true,
      scheduledDurationMinutes: true,
      roundNumber: true,
      groupName: true,
      stage: true,
      status: true,
    },
  });

  // Fetch all teams in the tournament
  const allTeams = await prisma.tournamentTeam.findMany({
    where: { tournamentId: id },
    select: { id: true, name: true, poolId: true, poolName: true },
  });

  if (allTeams.length < 3) {
    throw new BadRequestError(
      'At least 3 teams are required to use self-ref (one team per match + one referee)',
      'INSUFFICIENT_TEAMS'
    );
  }

  // Build filter predicate for target matches (those needing a referee)
  const targetMatches = allMatches.filter((m) => {
    if (m.refereeTeamId !== null) return false; // already has a referee
    if (m.status === MatchStatus.COMPLETED || m.status === MatchStatus.CANCELLED) return false;
    if (roundNumber !== undefined && m.roundNumber !== Number(roundNumber)) return false;
    if (groupName !== undefined && m.groupName !== groupName) return false;
    if (stage !== undefined && m.stage !== stage) return false;
    return true;
  });

  if (targetMatches.length === 0) {
    return res.json({ assigned: 0, matches: [] });
  }

  // Count existing referee duties per team (across all non-cancelled matches)
  const dutyCount = new Map<string, number>();
  for (const team of allTeams) {
    dutyCount.set(team.id, 0);
  }
  for (const m of allMatches) {
    if (m.refereeTeamId) {
      dutyCount.set(m.refereeTeamId, (dutyCount.get(m.refereeTeamId) ?? 0) + 1);
    }
  }

  // Helper: does a candidate team have a schedule conflict with a given match?
  const hasConflict = (
    candidateId: string,
    match: (typeof allMatches)[0]
  ): boolean => {
    if (!match.scheduledAt) return false; // no scheduled time → no conflict possible
    const matchDuration = match.scheduledDurationMinutes ?? DEFAULT_MATCH_DURATION_MINUTES;
    for (const other of allMatches) {
      if (other.id === match.id) continue;
      if (!other.scheduledAt) continue;
      const isInvolved =
        other.homeTeamId === candidateId ||
        other.awayTeamId === candidateId ||
        other.refereeTeamId === candidateId;
      if (!isInvolved) continue;
      const otherDuration = other.scheduledDurationMinutes ?? DEFAULT_MATCH_DURATION_MINUTES;
      if (hasScheduleOverlap(match.scheduledAt!, matchDuration, other.scheduledAt, otherDuration)) {
        return true;
      }
      const gap = getRequiredRestGapMinutes(
        match.scheduledAt!,
        matchDuration,
        other.scheduledAt,
        otherDuration
      );
      if (gap < DEFAULT_REFEREE_REST_WINDOW_MINUTES) {
        return true;
      }
    }
    return false;
  };

  // For unscheduled matches (no scheduledAt), a team is unavailable if it
  // appears as home/away in another match in the same round + group.
  const isPlayingInSameSlot = (
    candidateId: string,
    match: (typeof allMatches)[0]
  ): boolean => {
    if (match.scheduledAt) return false; // handled by hasConflict above
    return allMatches.some(
      (other) =>
        other.id !== match.id &&
        other.roundNumber === match.roundNumber &&
        other.groupName === match.groupName &&
        (other.homeTeamId === candidateId || other.awayTeamId === candidateId)
    );
  };

  // Process target matches, maintaining a mutable duty count so assignments
  // within this batch are also reflected in subsequent picks (fairness).
  const updatedMatchIds: string[] = [];
  for (const match of targetMatches) {
    // Teams ineligible for this match
    const playingIds = new Set([match.homeTeamId, match.awayTeamId]);
    const targetGroupName = match.groupName?.trim();

    // Rank eligible candidates by duty count (ascending), then by id (stable sort)
    const eligibleCandidates = allTeams
      .filter((team) => {
        if (playingIds.has(team.id)) return false;
        if (match.scheduledAt ? hasConflict(team.id, match) : isPlayingInSameSlot(team.id, match)) {
          return false;
        }
        return true;
      });

    const samePoolCandidates = targetGroupName
      ? eligibleCandidates.filter((team) => (team.poolName ?? '').trim() === targetGroupName)
      : [];

    const candidates = (samePoolCandidates.length > 0 ? samePoolCandidates : eligibleCandidates)
      .sort((a, b) => {
        const diff = (dutyCount.get(a.id) ?? 0) - (dutyCount.get(b.id) ?? 0);
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      });

    if (candidates.length === 0) continue; // no eligible referee for this match

    const chosen = candidates[0];
    await prisma.tournamentMatch.update({
      where: { id: match.id },
      data: { refereeTeamId: chosen.id },
    });
    dutyCount.set(chosen.id, (dutyCount.get(chosen.id) ?? 0) + 1);
    updatedMatchIds.push(match.id);

    // Reflect this assignment in allMatches so subsequent iterations see it
    match.refereeTeamId = chosen.id;
  }

  // Return updated matches with full details
  const updatedMatches = updatedMatchIds.length > 0
    ? await prisma.tournamentMatch.findMany({
        where: { id: { in: updatedMatchIds } },
        include: {
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
          refereeTeam: { select: { id: true, name: true } },
        },
      })
    : [];

  logger.info('Auto-assigned referees', 'TournamentController', {
    tournamentId: id,
    assigned: updatedMatchIds.length,
    userId,
  });

  res.json({ assigned: updatedMatchIds.length, matches: updatedMatches });
};

/**
 * Get the referee duty count for each team in a tournament.
 * Returns a list sorted by duty count (descending) so organizers can
 * quickly spot any imbalance.
 */
export const getRefereeDuties = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  // Both organizers/admins and registered teams can view referee duties
  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  if (!isOrgOrAdmin) {
    const isMember = await prisma.tournamentTeam.findFirst({
      where: {
        tournamentId: id,
        OR: [
          { captainUserId: userId },
          { players: { some: { userId } } },
        ],
      },
    });
    if (!isMember && tournament.isPublic === false) {
      throw new ForbiddenError('You do not have access to this tournament');
    }
  }

  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId: id },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  // Count referee assignments per team (only non-cancelled matches)
  const refMatches = await prisma.tournamentMatch.groupBy({
    by: ['refereeTeamId'],
    where: {
      tournamentId: id,
      refereeTeamId: { not: null },
      status: { not: MatchStatus.CANCELLED },
    },
    _count: { refereeTeamId: true },
  });

  const countMap = new Map<string, number>();
  for (const row of refMatches) {
    if (row.refereeTeamId) {
      countMap.set(row.refereeTeamId, row._count.refereeTeamId);
    }
  }

  const duties = teams
    .map((team) => ({
      teamId: team.id,
      teamName: team.name,
      dutyCount: countMap.get(team.id) ?? 0,
    }))
    .sort((a, b) => b.dutyCount - a.dutyCount || a.teamName.localeCompare(b.teamName));

  res.json(duties);
};

/**
 * Assign team to pool (admin only)
 */
export const assignTeamToPool = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;
  const { poolNumber, poolName } = req.body;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can assign teams to pools');
  }

  assertTournamentSetupEditable(tournament, 'Pools can only be managed before the tournament starts');

  const team = await prisma.tournamentTeam.findFirst({
    where: { id: teamId, tournamentId: id }
  });

  ensureResourceExists(team, 'Team');

  const updatedTeam = await prisma.tournamentTeam.update({
    where: { id: teamId },
    data: {
      poolNumber: poolNumber || null,
      poolName: poolName || null
    },
    include: {
      captainUser: {
        select: { id: true, name: true, email: true }
      }
    }
  });

  logger.info('Team assigned to pool', 'TournamentController', {
    tournamentId: id,
    teamId,
    poolNumber,
    poolName,
    userId
  });

  res.json(updatedTeam);
};

// ==================== PLAYER MANAGEMENT ====================

/**
 * Add a player to a team (captain only)
 */
export const addPlayer = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;
  const { playerName, playerEmail, userId: playerId, jerseyNumber } = req.body;

  if (!playerName) {
    throw new BadRequestError('Player name is required');
  }
  if (String(playerName).trim().length === 0) {
    throw new BadRequestError('Player name cannot be empty or whitespace-only');
  }
  if (playerName.length > MAX_PLAYER_NAME_LENGTH) {
    throw new BadRequestError(`Player name must be at most ${MAX_PLAYER_NAME_LENGTH} characters`);
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  await ensureResourceExists(
    await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id }
    }),
    'Team'
  );

  // Check permissions - only organizer/admin or team captain can add players
  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

  if (!isOrgOrAdmin && !isCaptain) {
    throw new ForbiddenError('Only the organizer, admin, or team captain can add players');
  }
  if (!isOrgOrAdmin && tournament.rosterLockDate && new Date() > new Date(tournament.rosterLockDate)) {
    throw new BadRequestError('Roster is locked — player changes are no longer allowed');
  }
  if (jerseyNumber !== undefined && jerseyNumber !== null && jerseyNumber !== '') {
    parseIntegerInRange(jerseyNumber, 'jerseyNumber', 0, MAX_JERSEY_NUMBER);
  }

  // If userId is provided, verify the user exists and cannot be an organizer, co-organizer, or captain of another team
  if (playerId) {
    const user = await prisma.user.findUnique({
      where: { id: playerId }
    });
    if (!user) {
      throw new BadRequestError('User not found');
    }
    if (await tournamentService.isOrganizerOrAdmin(tournament, playerId)) {
      throw new ForbiddenError('Tournament organizers and co-organizers cannot participate as players');
    }
    const existingCaptainTeam = await prisma.tournamentTeam.findFirst({
      where: { tournamentId: id, captainUserId: playerId, NOT: { id: teamId } },
      select: { id: true }
    });
    if (existingCaptainTeam) {
      throw new BadRequestError('This user is already a team captain in this tournament');
    }
    const existingPlayerInTournament = await prisma.tournamentPlayer.findFirst({
      where: { userId: playerId, team: { tournamentId: id }, NOT: { teamId } },
      select: { id: true }
    });
    if (existingPlayerInTournament) {
      throw new BadRequestError('This user is already a player in another team in this tournament');
    }
  }

  // Explicitly catch Prisma unique constraint violations (P2002) and return 409
  let player;
  try {
    player = await prisma.tournamentPlayer.create({
      data: {
        teamId,
        userId: playerId,
        playerName,
        playerEmail,
        jerseyNumber:
          jerseyNumber !== undefined && jerseyNumber !== null && jerseyNumber !== ''
            ? parseIntegerInRange(jerseyNumber, 'jerseyNumber', 0, MAX_JERSEY_NUMBER)
            : undefined,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError('This player is already registered on this team');
    }
    throw error;
  }

  logger.info('Player added to team', 'TournamentController', {
    tournamentId: id,
    teamId,
    playerId: player.id,
    userId
  });

  res.status(201).json(player);
};

/**
 * Get players for a team
 */
export const getPlayers = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user?.id;
  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({
      where: { id },
      select: { id: true, organizerId: true, isPublic: true }
    }),
    'Tournament'
  );
  if (!userId && !tournament.isPublic) {
    throw new ForbiddenError('You do not have access to this private tournament');
  }
  if (userId) {
    await assertCanViewTournament(tournament, userId);
  }

  const userSelect = userId
    ? { id: true, name: true, email: true }
    : { id: true, name: true };

  const team = await prisma.tournamentTeam.findFirst({
    where: { id: teamId, tournamentId: id },
    include: { captainUser: { select: userSelect } }
  });

  ensureResourceExists(team, 'Team');

  const players = await prisma.tournamentPlayer.findMany({
    where: { teamId },
    include: {
      user: {
        select: userSelect
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  // Ensure the team captain appears in the members list. Delegates to the
  // service helper which prepends a synthetic entry when the captain has no
  // TournamentPlayer row (e.g. self-registered captains).
  const roster = tournamentService.buildRosterWithCaptain(team, players);
  res.json(roster);
};

/**
 * Update a player (captain only)
 */
export const updatePlayer = async (req: Request, res: Response) => {
  const { id, teamId, playerId } = req.params;
  const userId = req.user!.id;
  const { playerName, playerEmail, userId: newUserId, jerseyNumber } = req.body;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const team = await prisma.tournamentTeam.findFirst({
    where: { id: teamId, tournamentId: id }
  });

  ensureResourceExists(team, 'Team');

  const player = await prisma.tournamentPlayer.findUnique({
    where: { id: playerId }
  });

  if (!player || player.teamId !== teamId) {
    throw new NotFoundError('Player not found');
  }

  // Check permissions
  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

  if (!isOrgOrAdmin && !isCaptain) {
    throw new ForbiddenError('Only the organizer, admin, or team captain can update players');
  }

  // Enforce roster lock for non-admin callers
  if (!isOrgOrAdmin && tournament.rosterLockDate && new Date() > new Date(tournament.rosterLockDate)) {
    throw new BadRequestError('Roster is locked — player changes are no longer allowed');
  }

  // If newUserId is provided, verify the user exists and has no role conflicts
  if (newUserId !== undefined && newUserId !== null) {
    const user = await prisma.user.findUnique({
      where: { id: newUserId },
      select: { id: true, deletedAt: true }
    });
    if (!user || user.deletedAt) {
      throw new BadRequestError('User not found');
    }
    // Cannot assign an organizer/co-organizer as a player
    if (await tournamentService.isOrganizerOrAdmin(tournament, newUserId)) {
      throw new ForbiddenError('Tournament organizers and co-organizers cannot participate as players');
    }
    // Cannot assign someone who is captain of another team in this tournament
    const captainConflict = await prisma.tournamentTeam.findFirst({
      where: { tournamentId: id, captainUserId: newUserId, NOT: { id: teamId } },
      select: { id: true }
    });
    if (captainConflict) {
      throw new BadRequestError('This user is already a team captain in this tournament');
    }
    // Cannot assign someone who is already a player in another team in this tournament
    const playerConflict = await prisma.tournamentPlayer.findFirst({
      where: { userId: newUserId, team: { tournamentId: id }, NOT: { id: playerId } },
      select: { id: true }
    });
    if (playerConflict) {
      throw new BadRequestError('This user is already a player in another team in this tournament');
    }
  }

  const updateData: Record<string, unknown> = {};
  if (playerName !== undefined) {
    if (String(playerName).trim().length === 0) {
      throw new BadRequestError('Player name cannot be empty or whitespace-only');
    }
    if (String(playerName).trim().length > MAX_PLAYER_NAME_LENGTH) {
      throw new BadRequestError(`Player name must be at most ${MAX_PLAYER_NAME_LENGTH} characters`);
    }
    updateData.playerName = String(playerName).trim();
  }
  if (playerEmail !== undefined) updateData.playerEmail = playerEmail || null;
  if (newUserId !== undefined) updateData.userId = newUserId || null;
  if (jerseyNumber !== undefined) {
    updateData.jerseyNumber =
      jerseyNumber !== null && jerseyNumber !== ''
        ? parseIntegerInRange(jerseyNumber, 'jerseyNumber', 0, MAX_JERSEY_NUMBER)
        : null;
  }

  let updatedPlayer;
  try {
    updatedPlayer = await prisma.tournamentPlayer.update({
      where: { id: playerId },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError('This user is already registered on this team');
    }
    throw error;
  }

  logger.info('Player updated', 'TournamentController', {
    tournamentId: id,
    teamId,
    playerId,
    userId
  });

  res.json(updatedPlayer);
};

/**
 * Remove a player from a team (captain only)
 */
export const removePlayer = async (req: Request, res: Response) => {
  const { id, teamId, playerId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const team = await prisma.tournamentTeam.findFirst({
    where: { id: teamId, tournamentId: id }
  });

  ensureResourceExists(team, 'Team');

  const player = await prisma.tournamentPlayer.findUnique({
    where: { id: playerId }
  });

  if (!player || player.teamId !== teamId) {
    throw new NotFoundError('Player not found');
  }

  // Check permissions
  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);
  // Allow removal when:
  // - requester is organizer/admin
  // - requester is team captain
  // - requester is the player themselves (self-leave)
  const isSelf = !!player.userId && player.userId === userId;

  if (!isOrgOrAdmin && !isCaptain && !isSelf) {
    throw new ForbiddenError('Only the organizer, admin, team captain, or the player themselves can remove this player');
  }
  if (!isOrgOrAdmin && tournament.rosterLockDate && new Date() > new Date(tournament.rosterLockDate)) {
    throw new BadRequestError('Roster is locked — player changes are no longer allowed');
  }

  // If the player being removed is the team captain, enforce delegation when there are other members.
  const teamWithCount = await prisma.tournamentTeam.findFirst({
    where: { id: teamId, tournamentId: id },
    select: { id: true, captainUserId: true, _count: { select: { players: true } } }
  });
  ensureResourceExists(teamWithCount, 'Team');

  const isRemovingCaptain = !!player.userId && teamWithCount.captainUserId === player.userId;

  if (isRemovingCaptain) {
    if (player.userId === userId && tournament.status === TournamentStatus.IN_PROGRESS) {
      throw new BadRequestError('Team captains cannot remove themselves while the tournament is in progress');
    }
    // If captain is sole member (only one player row), removing them should unregister the team.
    if (teamWithCount._count.players <= 1) {
      await prisma.tournamentTeam.delete({ where: { id: teamId } });

      logger.info('Captain removed and team unregistered (sole member)', 'TournamentController', {
        tournamentId: id,
        teamId,
        playerId,
        userId
      });

      return res.json({ message: 'Team unregistered successfully' });
    }

    // Otherwise, captain must delegate before leaving
    throw new BadRequestError('Cannot remove the team captain while the team has other members. Delegate captain role before leaving.');
  }

  // Normal removal: delete the tournamentPlayer record
  await prisma.tournamentPlayer.delete({ where: { id: playerId } });

  logger.info('Player removed from team', 'TournamentController', {
    tournamentId: id,
    teamId,
    playerId,
    userId
  });

  res.json({ message: 'Player removed successfully' });
};

// ==================== POOL MANAGEMENT ====================

/**
 * Get all pools for a tournament
 */
export const getPools = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { page, limit } = req.query;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id }, select: { id: true, organizerId: true, isPublic: true } }),
    'Tournament'
  );

  await assertCanViewTournament(tournament, userId);

  const parsedPage = Math.max(1, parseInt(page as string, 10) || 1);
  const parsedLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const skip = (parsedPage - 1) * parsedLimit;

  const [pools, total] = await Promise.all([
    prisma.tournamentPool.findMany({
      where: { tournamentId: id },
      include: {
        _count: {
          select: {
            teams: true,
            waitlist: true
          }
        }
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: parsedLimit,
    }),
    prisma.tournamentPool.count({ where: { tournamentId: id } }),
  ]);

  res.json({
    data: pools,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  });
};

/**
 * Get pool details with teams and waitlist
 */
export const getPoolDetails = async (req: Request, res: Response) => {
  const { id, poolId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id }, select: { id: true, organizerId: true, isPublic: true } }),
    'Tournament'
  );

  await assertCanViewTournament(tournament, userId);

  const pool = ensureResourceExists(
    await prisma.tournamentPool.findFirst({
      where: { 
        id: poolId,
        tournamentId: id 
      },
      include: {
        teams: {
          include: {
            captainUser: {
              select: { id: true, name: true, email: true }
            },
            players: true
          },
          orderBy: { registrationOrder: 'asc' }
        },
        waitlist: {
          include: {
            team: {
              include: {
                captainUser: {
                  select: { id: true, name: true, email: true }
                }
              }
            }
          },
          orderBy: { position: 'asc' }
        }
      }
    }),
    'Pool'
  );

  res.json(pool);
};

/**
 * Create a new pool for a tournament (organizer only)
 */
export const createPool = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { name, description, venue, maxTeams } = req.body;

  if (!name || !maxTeams) {
    throw new BadRequestError('Pool name and max teams are required');
  }

  if (typeof name === 'string' && !name.trim()) {
    throw new BadRequestError('Pool name cannot be empty or whitespace-only');
  }

  const sanitizedName = sanitizeString(name).trim();
  if (!sanitizedName) {
    throw new BadRequestError('Pool name cannot be empty or whitespace-only');
  }

  if (sanitizedName.length > MAX_POOL_NAME_LENGTH) {
    throw new BadRequestError(`Pool name must be at most ${MAX_POOL_NAME_LENGTH} characters`);
  }

  const sanitizedDescription = description ? sanitizeString(description) : undefined;
  const sanitizedVenue = venue ? sanitizeString(venue).trim() : undefined;

  if (maxTeams < 2) {
    throw new BadRequestError('Pool must allow at least 2 teams');
  }

  if (maxTeams > MAX_TEAMS_UPPER_BOUND) {
    throw new BadRequestError(`Pool max teams cannot exceed ${MAX_TEAMS_UPPER_BOUND}`);
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can create pools');
  }

  assertTournamentSetupEditable(tournament, 'Pools can only be managed before the tournament starts');

  let pool;
  try {
    pool = await prisma.tournamentPool.create({
      data: {
        name: sanitizedName,
        description: sanitizedDescription,
        venue: sanitizedVenue || undefined,
        maxTeams,
        tournamentId: id
      }
    });
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError('A pool with this name already exists in the tournament');
    }
    throw error;
  }

  logger.info('Pool created', 'TournamentController', {
    tournamentId: id,
    poolId: pool.id,
    userId
  });

  res.status(201).json(pool);
};

/**
 * Update a pool (organizer only)
 */
export const updatePool = async (req: Request, res: Response) => {
  const { id, poolId } = req.params;
  const userId = req.user!.id;
  const { name, description, venue, maxTeams } = req.body;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can update pools');
  }

  assertTournamentSetupEditable(tournament, 'Pools can only be managed before the tournament starts');

  ensureResourceExists(
    await prisma.tournamentPool.findFirst({ where: { id: poolId, tournamentId: id } }),
    'Pool'
  );

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) {
    if (typeof name === 'string' && !name.trim()) {
      throw new BadRequestError('Pool name cannot be empty or whitespace-only');
    }
    const sanitizedName = sanitizeString(name).trim();
    if (!sanitizedName) {
      throw new BadRequestError('Pool name cannot be empty or whitespace-only');
    }
    if (sanitizedName.length > MAX_POOL_NAME_LENGTH) {
      throw new BadRequestError(`Pool name must be at most ${MAX_POOL_NAME_LENGTH} characters`);
    }
    updateData.name = sanitizedName;
  }
  if (description !== undefined) {
    updateData.description = description ? sanitizeString(description) : null;
  }
  if (venue !== undefined) {
    updateData.venue = venue ? sanitizeString(venue).trim() : null;
  }
  if (maxTeams !== undefined) {
    if (maxTeams < 2) throw new BadRequestError('Pool must allow at least 2 teams');
    if (maxTeams > MAX_TEAMS_UPPER_BOUND) throw new BadRequestError(`Pool max teams cannot exceed ${MAX_TEAMS_UPPER_BOUND}`);
    const teamCount = await prisma.tournamentTeam.count({ where: { poolId } });
    if (maxTeams < teamCount) {
      throw new BadRequestError(`Cannot reduce max teams below current team count (${teamCount})`);
    }
    updateData.maxTeams = maxTeams;
  }

  let updatedPool;
  try {
    updatedPool = await prisma.tournamentPool.update({
      where: { id: poolId },
      data: updateData,
      include: {
        teams: { select: { id: true, name: true } },
        waitlist: { orderBy: { position: 'asc' }, include: { team: { select: { id: true, name: true } } } },
        category: { select: { id: true, name: true } }
      }
    });
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError('A pool with this name already exists in the tournament');
    }
    throw error;
  }

  logger.info('Pool updated', 'TournamentController', { tournamentId: id, poolId, userId });
  res.json(updatedPool);
};

/**
 * Delete a pool (organizer only) — only allowed when pool is empty
 */
export const deletePool = async (req: Request, res: Response) => {
  const { id, poolId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can delete pools');
  }

  assertTournamentSetupEditable(tournament, 'Pools can only be managed before the tournament starts');

  const pool = ensureResourceExists(
    await prisma.tournamentPool.findFirst({
      where: { id: poolId, tournamentId: id },
      include: { _count: { select: { teams: true } } }
    }),
    'Pool'
  );

  const teamCount = pool._count.teams;
  if (teamCount > 0) {
    throw new BadRequestError(`Cannot delete pool with ${teamCount} registered team(s). Remove all teams first.`);
  }

  await prisma.tournamentPool.delete({ where: { id: poolId } });

  logger.info('Pool deleted', 'TournamentController', { tournamentId: id, poolId, userId });
  res.json({ message: 'Pool deleted successfully' });
};

/**
 * Register a team to a pool (team captain or tournament admin)
 */
export const registerTeamToPool = async (req: Request, res: Response) => {
  const { id, poolId, teamId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  // Check permissions first — admins bypass registration eligibility
  const isAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

  if (!isAdmin && !isCaptain) {
    throw new ForbiddenError('Only the organizer, admin, or team captain can register teams to pools');
  }

  assertTournamentSetupEditable(tournament, 'Pools can only be managed before the tournament starts');

  // Non-admins must pass registration eligibility check
  if (!isAdmin) {
    tournamentService.validateRegistrationEligibility(tournament);
  }

  const team = ensureResourceExists(
    await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id }
    }),
    'Team'
  );

  // Check if team is already registered to a pool
  if (team.poolId) {
    throw new BadRequestError('Team is already registered to a pool');
  }

  // Check if team is already on a waitlist for this specific pool (or any pool)
  const existingWaitlist = await prisma.tournamentPoolWaitlist.findFirst({
    where: { teamId }
  });

  if (existingWaitlist) {
    if (existingWaitlist.poolId === poolId) {
      throw new BadRequestError('Team is already on the waitlist for this pool');
    }
    throw new BadRequestError('Team is already on a waitlist for another pool');
  }

  // Wrap the capacity check and registration/waitlist insert in a transaction
  // to prevent race conditions where two concurrent requests both see space available
  // or both see the pool full and compute the same waitlist position.
  const result = await prisma.$transaction(async (tx) => {
    const pool = await tx.tournamentPool.findFirst({
      where: { id: poolId, tournamentId: id },
      include: { teams: true }
    });

    if (!pool) {
      throw new NotFoundError('Pool not found');
    }

    if (pool.teams.length >= pool.maxTeams) {
      // Pool full — add to waitlist atomically
      const waitlistPosition = await tx.tournamentPoolWaitlist.count({
        where: { poolId }
      });

      const waitlistEntry = await tx.tournamentPoolWaitlist.create({
        data: {
          poolId,
          teamId,
          position: waitlistPosition + 1
        },
        include: {
          pool: true,
          team: {
            include: {
              captainUser: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        }
      });

      return { type: 'waitlist' as const, waitlistEntry, position: waitlistPosition + 1 };
    }

    // Space available — register atomically
    const registrationOrder = pool.teams.length + 1;

    const updatedTeam = await tx.tournamentTeam.update({
      where: { id: teamId },
      data: {
        poolId,
        poolName: pool.name,
        registrationOrder
      },
      include: {
        pool: true,
        captainUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return { type: 'registered' as const, updatedTeam, registrationOrder };
  });

  if (result.type === 'waitlist') {
    logger.info('Team added to pool waitlist', 'TournamentController', {
      tournamentId: id,
      poolId,
      teamId,
      position: result.position,
      userId
    });

    return res.status(201).json({
      message: 'Pool is full. Team added to waitlist',
      waitlist: result.waitlistEntry
    });
  }

  logger.info('Team registered to pool', 'TournamentController', {
    tournamentId: id,
    poolId,
    teamId,
    registrationOrder: result.registrationOrder,
    userId
  });

  res.json(result.updatedTeam);
};

/**
 * Remove a team from a pool (organizer, admin, or team captain)
 * This will automatically promote the first team from the waitlist
 */
export const removeTeamFromPool = async (req: Request, res: Response) => {
  const { id, poolId, teamId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  ensureResourceExists(
    await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id, poolId }
    }),
    'Team not found in this pool'
  );

  // Check permissions (organizer/admin) or team captain
  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

  if (!isOrgOrAdmin && !isCaptain) {
    throw new ForbiddenError('Only the organizer, admin, or team captain can remove teams from pools');
  }

  assertTournamentSetupEditable(tournament, 'Pools can only be managed before the tournament starts');

  // Remove team from pool and handle waitlist promotion atomically
  const promotionResult = await prisma.$transaction(async (tx) => {
    // Remove team from pool
    await tx.tournamentTeam.update({
      where: { id: teamId },
      data: {
        poolId: null,
        poolNumber: null,
        poolName: null,
        registrationOrder: null
      }
    });

    return promoteFirstPoolWaitlistEntry(tx, poolId);
  });

  logger.info('Team removed from pool', 'TournamentController', {
    tournamentId: id,
    poolId,
    teamId,
    userId
  });

  if (promotionResult) {
    logger.info('Team promoted from waitlist', 'TournamentController', {
      tournamentId: id,
      poolId,
      promotedTeamId: promotionResult.id
    });

    return res.json({
      message: 'Team removed from pool and first waitlist team promoted',
      promotedTeam: promotionResult
    });
  }

  res.json({ message: 'Team removed from pool successfully' });
};

/**
 * Remove a team from waitlist (organizer or team captain)
 */
export const removeTeamFromWaitlist = async (req: Request, res: Response) => {
  const { id, poolId, teamId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  ensureResourceExists(
    await prisma.tournamentTeam.findFirst({ where: { id: teamId, tournamentId: id } }),
    'Team'
  );

  // Check permissions (organizer/admin) or team captain
  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

  if (!isOrgOrAdmin && !isCaptain) {
    throw new ForbiddenError('Only the organizer, admin, or team captain can remove teams from waitlist');
  }

  assertTournamentSetupEditable(tournament, 'Pools can only be managed before the tournament starts');

  const waitlistEntry = ensureResourceExists(
    await prisma.tournamentPoolWaitlist.findFirst({ where: { poolId, teamId } }),
    'Team not found in waitlist'
  );

  // Remove from waitlist and reorder remaining entries atomically with a bulk update
  await prisma.$transaction(async (tx) => {
    await tx.tournamentPoolWaitlist.delete({
      where: { id: waitlistEntry.id }
    });

    await tx.tournamentPoolWaitlist.updateMany({
      where: { poolId, position: { gt: waitlistEntry.position } },
      data: { position: { decrement: 1 } }
    });
  });

  logger.info('Team removed from waitlist', 'TournamentController', {
    tournamentId: id,
    poolId,
    teamId,
    userId
  });

  res.json({ message: 'Team removed from waitlist successfully' });
};

/**
 * Move a team from one pool to another (organizer/admin only).
 * Handles waitlist promotion on the source pool and respects capacity on the destination pool.
 * Pass poolId: null to remove the team from its current pool without reassigning.
 */
export const moveTeamToPool = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;
  const targetPoolId = resolveMoveTeamTargetPoolId(req.body, req.params);

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can move teams between pools');
  }

  assertTournamentSetupEditable(tournament, 'Pools can only be managed before the tournament starts');

  const team = ensureResourceExists(
    await prisma.tournamentTeam.findFirst({ where: { id: teamId, tournamentId: id } }),
    'Team'
  );

  const currentPoolId = team.poolId;

  // Nothing to do if the team is already in the target pool
  if (currentPoolId === (targetPoolId || null)) {
    return res.json({ message: 'Team is already in the target pool', team });
  }

  // Validate target pool belongs to this tournament
  if (targetPoolId) {
    const targetPool = await prisma.tournamentPool.findFirst({
      where: { id: targetPoolId, tournamentId: id }
    });
    if (!targetPool) {
      throw new BadRequestError('Target pool not found in this tournament');
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Remove team from current pool (if any), promote waitlist
    if (currentPoolId) {
      await tx.tournamentTeam.update({
        where: { id: teamId },
        data: { poolId: null, poolNumber: null, poolName: null, registrationOrder: null }
      });

      // Promote first waitlist entry for the old pool
      const firstWaitlistEntry = await tx.tournamentPoolWaitlist.findFirst({
        where: { poolId: currentPoolId },
        orderBy: { position: 'asc' },
        include: { team: true }
      });

      if (firstWaitlistEntry) {
        await promoteFirstPoolWaitlistEntry(tx, currentPoolId);
      }
    }

    // Also remove team from any waitlist it may be on
    const waitlistEntry = await tx.tournamentPoolWaitlist.findFirst({ where: { teamId } });
    if (waitlistEntry) {
      await tx.tournamentPoolWaitlist.delete({ where: { id: waitlistEntry.id } });
      await tx.tournamentPoolWaitlist.updateMany({
        where: { poolId: waitlistEntry.poolId, position: { gt: waitlistEntry.position } },
        data: { position: { decrement: 1 } }
      });
    }

    // 2. Add team to target pool (or waitlist if full)
    if (!targetPoolId) {
      return { type: 'unassigned' as const };
    }

    const targetPool = await tx.tournamentPool.findUnique({
      where: { id: targetPoolId },
      include: { teams: true }
    });

    if (!targetPool) {
      throw new NotFoundError('Target pool not found');
    }

    if (targetPool.teams.length >= targetPool.maxTeams) {
      const waitlistPosition = await tx.tournamentPoolWaitlist.count({ where: { poolId: targetPoolId } });
      const newWaitlistEntry = await tx.tournamentPoolWaitlist.create({
        data: { poolId: targetPoolId, teamId, position: waitlistPosition + 1 },
        include: { pool: true, team: { include: { captainUser: { select: { id: true, name: true, email: true } } } } }
      });
      return { type: 'waitlisted' as const, waitlistEntry: newWaitlistEntry, position: waitlistPosition + 1 };
    }

    const updatedTeam = await tx.tournamentTeam.update({
      where: { id: teamId },
      data: { poolId: targetPoolId, poolName: targetPool.name, registrationOrder: targetPool.teams.length + 1 },
      include: { pool: true, captainUser: { select: { id: true, name: true, email: true } } }
    });

    return { type: 'moved' as const, updatedTeam };
  });

  logger.info('Team moved between pools', 'TournamentController', {
    tournamentId: id, teamId, fromPoolId: currentPoolId, toPoolId: targetPoolId, userId
  });

  if (result.type === 'waitlisted') {
    return res.status(200).json({
      message: 'Target pool is full. Team added to its waitlist',
      waitlist: result.waitlistEntry,
      position: result.position,
    });
  }

  if (result.type === 'unassigned') {
    return res.json({ message: 'Team removed from pool successfully' });
  }

  res.json(result.updatedTeam);
};

// ==================== CAPTAIN SELF-REGISTRATION ====================

/**
 * Captain self-registers their team and becomes its captain.
 * No admin permission required — any authenticated user can create and captain their own team.
 */
export const selfRegisterTeam = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { name, poolId, categoryId, waiverAccepted, answers } = req.body;

  isRequired(name, 'Team name');
  if (typeof name === 'string' && name.trim().length === 0) {
    throw new BadRequestError('Team name cannot be empty or whitespace-only');
  }
  if (typeof name === 'string' && name.trim().length > MAX_POOL_NAME_LENGTH) {
    throw new BadRequestError(`Team name must be at most ${MAX_POOL_NAME_LENGTH} characters`);
  }

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  tournamentService.validateRegistrationEligibility(tournament!);

  if (tournament!.requireWaiverForRegistration && waiverAccepted !== true) {
    throw new BadRequestError('This tournament requires waiver acceptance before registration');
  }

  if (await tournamentService.isOrganizerOrAdmin(tournament!, userId)) {
    throw new ForbiddenError('Tournament organizers and co-organizers cannot register as participants');
  }

  if (tournament!.maxTeams) {
    const teamCount = await prisma.tournamentTeam.count({
      where: { tournamentId: id },
    });
    if (teamCount >= tournament!.maxTeams) {
      throw new BadRequestError('Tournament has reached maximum number of teams');
    }
  }

  // Allow selecting both a category and a specific pool. If both are provided
  // ensure the selected pool belongs to the selected category.
  const categoryCount = await prisma.tournamentCategory.count({
    where: { tournamentId: id },
  });
  const hasCategories = categoryCount > 0;

  let selectedCategory: { id: string; name: string } | null = null;
  if (categoryId) {
    selectedCategory = await prisma.tournamentCategory.findFirst({
      where: { id: categoryId, tournamentId: id },
      select: { id: true, name: true }
    });
    if (!selectedCategory) {
      throw new NotFoundError('Category not found');
    }
  }
  if (hasCategories && !selectedCategory) {
    throw new BadRequestError('Category selection is required for this tournament');
  }

  let validatedPool: { id: string; categoryId?: string | null } | null = null;
  if (poolId) {
    validatedPool = await prisma.tournamentPool.findFirst({
      where: { id: poolId, tournamentId: id },
      select: { id: true, categoryId: true },
    });
    if (!validatedPool) {
      throw new NotFoundError('Pool not found');
    }
  }

  if (selectedCategory && validatedPool && validatedPool.categoryId && validatedPool.categoryId !== selectedCategory.id) {
    throw new BadRequestError('Selected pool does not belong to selected category');
  }

  try {
    const team = await prisma.$transaction(async (tx) => {
      if (tournament!.maxTeams) {
        const teamCount = await tx.tournamentTeam.count({ where: { tournamentId: id } });
        if (teamCount >= tournament!.maxTeams) {
          throw new BadRequestError('Tournament has reached maximum number of teams');
        }
      }

      const existingTeam = await tx.tournamentTeam.findFirst({
        where: { tournamentId: id, captainUserId: userId },
        select: { id: true }
      });
      if (existingTeam) {
        throw new BadRequestError('You already have a registered team in this tournament');
      }

      // Prevent a user who is already a player in this tournament from self-registering as a captain
      const existingPlayer = await tx.tournamentPlayer.findFirst({
        where: { userId: userId, team: { tournamentId: id } },
        select: { id: true }
      });
      if (existingPlayer) {
        throw new BadRequestError('You are already a participant in this tournament and cannot register another team');
      }

      const normalizedAnswers = normalizeRegistrationAnswers(answers);

      const requiredFields = await tx.tournamentRegistrationField.findMany({
        where: { tournamentId: id, isRequired: true },
        select: { id: true, label: true },
      });
      const providedAnswers = new Map(normalizedAnswers.map((answer) => [answer.fieldId, answer.value]));
      const missingRequiredLabels = requiredFields
        .filter((field) => !providedAnswers.get(field.id))
        .map((field) => field.label);

      if (missingRequiredLabels.length > 0) {
        throw new BadRequestError(
          `Missing required registration answers: ${missingRequiredLabels.join(', ')}`
        );
      }

      const submittedFieldIds = normalizedAnswers.map((answer) => answer.fieldId).filter(Boolean);
      if (submittedFieldIds.length > 0) {
        const validFields = await tx.tournamentRegistrationField.findMany({
          where: { tournamentId: id, id: { in: submittedFieldIds } },
          select: { id: true },
        });
        const validFieldIds = new Set(validFields.map((field) => field.id));
        const invalidFieldIds = submittedFieldIds.filter((fieldId) => !validFieldIds.has(fieldId));
        if (invalidFieldIds.length > 0) {
          throw new BadRequestError('One or more registration field IDs are invalid for this tournament');
        }
      }

      // Include category data atomically in the create call when registering
      // to a category without a specific pool, so there is no inter-transaction gap.
      const createdTeam = await tx.tournamentTeam.create({
        data: {
          name: name.trim(),
          tournamentId: id,
          captainUserId: userId,
          ...(selectedCategory && !validatedPool
            ? { poolName: selectedCategory.name }
            : {}),
          waiverAcceptedAt: waiverAccepted ? new Date() : undefined,
          waiverAcceptedByUserId: waiverAccepted ? userId : undefined,
        },
        include: {
          captainUser: { select: { id: true, name: true, email: true } }
        }
      });

      for (const answer of normalizedAnswers) {
        await tx.tournamentTeamAnswer.upsert({
          where: { fieldId_teamId: { fieldId: answer.fieldId, teamId: createdTeam.id } },
          create: { fieldId: answer.fieldId, teamId: createdTeam.id, value: answer.value },
          update: { value: answer.value },
        });
      }

      return createdTeam;
    });

    logger.info('Team self-registered', 'TournamentController', { tournamentId: id, teamId: team.id, captainUserId: userId });

    // If a poolId was provided, attempt to register the new team to the pool atomically
    if (poolId) {
      const poolResult = await prisma.$transaction(async (tx) => {
        const pool = await tx.tournamentPool.findFirst({
          where: { id: poolId, tournamentId: id },
          include: {
            teams: true,
          }
        });

        if (!pool) {
          throw new NotFoundError('Pool not found');
        }

        if (pool.teams.length < pool.maxTeams) {
          await tx.tournamentTeam.update({
            where: { id: team.id },
            data: { poolId: pool.id, poolName: pool.name }
          });
          return { pool, onWaitlist: false, waitlistEntry: null };
        } else {
          // Pool full — add to waitlist atomically
          const waitlistPosition = await tx.tournamentPoolWaitlist.count({
            where: { poolId: pool.id }
          });
          const waitlistEntry = await tx.tournamentPoolWaitlist.create({
            data: { poolId: pool.id, teamId: team.id, position: waitlistPosition + 1 }
          });
          return { pool, onWaitlist: true, waitlistEntry };
        }
      });

      return res.status(201).json({
        team,
        pool: poolResult.pool,
        onWaitlist: poolResult.onWaitlist,
        ...(poolResult.waitlistEntry ? { waitlistEntry: poolResult.waitlistEntry } : {}),
        ...(selectedCategory ? { categoryId: selectedCategory.id, categoryName: selectedCategory.name } : {})
      });
    }

    res.status(201).json({
      team,
      onWaitlist: false,
      ...(selectedCategory ? { categoryId: selectedCategory.id, categoryName: selectedCategory.name } : {})
    });
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError('A team with this name already exists in the tournament');
    }
    throw error;
  }
};

/**
 * Captain self-unregisters their team from a tournament.
 * No admin permission required — only the team captain can unregister their own team.
 */
export const selfUnregisterTeam = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  if (tournament.status !== TournamentStatus.DRAFT && tournament.status !== TournamentStatus.REGISTRATION) {
    throw new BadRequestError('You can only unregister while tournament registration is open');
  }

  // Allow unregister if user is the captain OR the only member of a team
  const teamsWithUser = await prisma.tournamentTeam.findMany({
    where: {
      tournamentId: id,
      OR: [
        { players: { some: { userId } } },
        { captainUserId: userId }
      ]
    },
    select: {
      id: true,
      name: true,
      captainUserId: true,
      _count: { select: { players: true } }
    }
  });

  // Only the team captain can unregister a team
  const removableTeams = teamsWithUser.filter(t => t.captainUserId === userId);

  if (removableTeams.length === 0) {
    throw new BadRequestError('You do not have a registered team to unregister');
  }

  const teamIds = removableTeams.map(team => team.id);

  // Delete teams and, if enabled, auto-promote from the registration waitlist
  const result = await prisma.$transaction(async (tx) => {
    const waitlistEntries = await tx.tournamentPoolWaitlist.findMany({
      where: { teamId: { in: teamIds } },
      select: { poolId: true, position: true },
    });

    await tx.tournamentTeam.deleteMany({ where: { id: { in: teamIds } } });

    for (const entry of waitlistEntries) {
      await tx.tournamentPoolWaitlist.updateMany({
        where: { poolId: entry.poolId, position: { gt: entry.position } },
        data: { position: { decrement: 1 } },
      });
    }

    // Check auto-promote conditions
    const refreshedTournament = await tx.tournament.findUnique({ where: { id }, select: { id: true, maxTeams: true, autoPromoteRegistrationWaitlist: true, withdrawalDeadline: true } });
    if (!refreshedTournament || !refreshedTournament.maxTeams) {
      return { promotedTeamId: null as string | null };
    }

    const teamCount = await tx.tournamentTeam.count({ where: { tournamentId: id } });

    const parsedWithdrawalDeadline = refreshedTournament.withdrawalDeadline
      ? new Date(refreshedTournament.withdrawalDeadline)
      : null;
    const shouldAutoPromote =
      refreshedTournament.autoPromoteRegistrationWaitlist === true &&
      (
        !parsedWithdrawalDeadline ||
        new Date() <= parsedWithdrawalDeadline
      );

    if (!shouldAutoPromote || teamCount >= refreshedTournament.maxTeams) {
      return { promotedTeamId: null as string | null };
    }

    const firstEntry = await tx.tournamentRegistrationWaitlist.findFirst({ where: { tournamentId: id }, orderBy: { position: 'asc' }, select: { id: true, teamId: true, position: true } });
    if (!firstEntry) return { promotedTeamId: null as string | null };

    await tx.tournamentRegistrationWaitlist.delete({ where: { id: firstEntry.id } });
    await tx.tournamentRegistrationWaitlist.updateMany({
      where: { tournamentId: id, position: { gt: firstEntry.position } },
      data: { position: { decrement: 1 } },
    });

    return { promotedTeamId: firstEntry.teamId };
  });

  logger.info('Team self-unregistered', 'TournamentController', {
    tournamentId: id,
    teamIds,
    removedTeamCount: removableTeams.length,
    captainUserId: userId,
  });

  res.json({ message: 'Team unregistered successfully', ...(result.promotedTeamId ? { promotedTeamId: result.promotedTeamId } : {}) });
};

// ==================== PUBLIC DISCOVERY ====================

export const getPublicTournaments = async (req: Request, res: Response) => {
  const { sportType, status, page, limit, latitude, longitude, radius } = req.query;

  const parsedPage = Math.max(1, parseInt(page as string, 10) || 1);
  const parsedLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const skip = (parsedPage - 1) * parsedLimit;

  const where: Record<string, unknown> = { isPublic: true };
  if (sportType) where.sportType = sportType;
  if (status) where.status = status;
  const hasCoordinates = latitude !== undefined && longitude !== undefined;
  let lat: number | null = null;
  let lon: number | null = null;
  let radiusKm: number | null = null;

  if (hasCoordinates) {
    const parsedCoordinates = parseCoordinates(latitude, longitude);
    lat = parsedCoordinates.lat;
    lon = parsedCoordinates.lon;
    radiusKm = radius !== undefined ? parseFloatStrict(radius, 'Radius') : 25;
    if (radiusKm <= 0 || radiusKm > MAX_LOCATION_RADIUS_KM) {
      throw new BadRequestError(
        `Radius must be greater than 0 and at most ${MAX_LOCATION_RADIUS_KM} kilometers`
      );
    }

    const { latDelta, lonDelta } = locationService.calculateBoundingBox(lat, radiusKm);
    where.AND = [
      { latitude: { not: null } },
      { longitude: { not: null } },
      { latitude: { gte: lat - latDelta, lte: lat + latDelta } },
      { longitude: { gte: lon - lonDelta, lte: lon + lonDelta } },
    ];
  }

  let total = 0;
  let tournaments = [];

  if (hasCoordinates && lat !== null && lon !== null && radiusKm !== null) {
    const rawTournaments = await prisma.tournament.findMany({
      where,
      include: {
        organizer: { select: { id: true, name: true } },
        _count: { select: { teams: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(MAX_PAGE_SIZE, skip + parsedLimit * 2),
    });

    const filtered = locationService.filterByLocation(
      rawTournaments,
      lat,
      lon,
      radiusKm
    );
    total = filtered.length;
    tournaments = filtered.slice(skip, skip + parsedLimit);
  } else {
    const [rawTournaments, counted] = await Promise.all([
      prisma.tournament.findMany({
        where,
        include: {
          organizer: { select: { id: true, name: true } },
          _count: { select: { teams: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parsedLimit,
      }),
      prisma.tournament.count({ where }),
    ]);
    tournaments = rawTournaments;
    total = counted;
  }

  const syncedTournaments = await Promise.all(
    tournaments.map((tournament) => syncTournamentAutoStatus(tournament, 'public_list_read'))
  );

  res.json({
    data: syncedTournaments,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  });
};

// ==================== NOTIFICATIONS ====================

export const getTournamentNotifications = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { page, limit } = req.query;

  const parsedPage = Math.max(1, parseInt(page as string, 10) || 1);
  const parsedLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const skip = (parsedPage - 1) * parsedLimit;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  if (!isOrgOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can view notifications');
  }

  const [notifications, total] = await Promise.all([
    prisma.tournamentNotification.findMany({
      where: { tournamentId: id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parsedLimit,
    }),
    prisma.tournamentNotification.count({ where: { tournamentId: id } }),
  ]);

  res.json({
    data: notifications,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  });
};

// ==================== TEAM CHECK-IN (#4) ====================

export const checkInTeam = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;
  const { checkedIn } = req.body;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

  if (!isOrgOrAdmin && !isCaptain) {
    throw new ForbiddenError('Only the organizer, admin, or team captain can check in a team');
  }

  const team = ensureResourceExists(
    await prisma.tournamentTeam.findFirst({ where: { id: teamId, tournamentId: id } }),
    'Team'
  );

  const nowCheckedIn = checkedIn !== false;
  const updatedTeam = await prisma.tournamentTeam.update({
    where: { id: team.id },
    data: {
      checkedIn: nowCheckedIn,
      checkedInAt: nowCheckedIn ? (team.checkedInAt ?? new Date()) : null,
    },
  });

  logger.info('Team check-in updated', 'TournamentController', {
    tournamentId: id, teamId, checkedIn: nowCheckedIn, userId,
  });

  res.json(updatedTeam);
};

export const getCourts = async (req: Request, res: Response) => {
  const { id } = req.params;
  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  await assertCanViewTournament(tournament, req.user!.id);

  const courts = await prisma.tournamentCourt.findMany({
    where: { tournamentId: id },
    include: { availabilities: true },
    orderBy: { name: 'asc' },
  });
  res.json(courts);
};

export const createCourt = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { name, location, isActive } = req.body ?? {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new BadRequestError('Court name is required');
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers/admins can manage courts');
  }

  const created = await prisma.tournamentCourt.create({
    data: {
      tournamentId: id,
      name: name.trim(),
      location: typeof location === 'string' ? location.trim() || null : undefined,
      isActive: isActive === undefined ? true : Boolean(isActive),
    },
  });

  res.status(201).json(created);
};

export const updateCourt = async (req: Request, res: Response) => {
  const { id, courtId } = req.params;
  const userId = req.user!.id;
  const { name, location, isActive } = req.body ?? {};

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers/admins can manage courts');
  }

  const court = ensureResourceExists(
    await prisma.tournamentCourt.findFirst({ where: { id: courtId, tournamentId: id } }),
    'Court'
  );

  const data: Record<string, unknown> = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new BadRequestError('Court name cannot be empty');
    }
    data.name = name.trim();
  }
  if (location !== undefined) {
    data.location = typeof location === 'string' ? location.trim() || null : null;
  }
  if (isActive !== undefined) {
    data.isActive = Boolean(isActive);
  }

  const updated = await prisma.tournamentCourt.update({
    where: { id: court.id },
    data,
  });

  res.json(updated);
};

export const createCourtAvailability = async (req: Request, res: Response) => {
  const { id, courtId } = req.params;
  const userId = req.user!.id;
  const { dayOfWeek, date, startTime, endTime, isBlocked = false, notes } = req.body ?? {};

  if (!startTime || !endTime) {
    throw new BadRequestError('startTime and endTime are required');
  }
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (endMinutes <= startMinutes) {
    throw new BadRequestError('endTime must be after startTime');
  }
  if ((dayOfWeek === undefined && !date) || (dayOfWeek !== undefined && date)) {
    throw new BadRequestError('Provide exactly one of dayOfWeek or date');
  }
  if (dayOfWeek !== undefined && (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) {
    throw new BadRequestError('dayOfWeek must be an integer between 0 and 6');
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers/admins can manage court availability');
  }

  const court = ensureResourceExists(
    await prisma.tournamentCourt.findFirst({ where: { id: courtId, tournamentId: id } }),
    'Court'
  );

  const normalizedDate = date ? new Date(date) : null;
  if (normalizedDate) {
    normalizedDate.setHours(0, 0, 0, 0);
  }

  const availability = await prisma.tournamentCourtAvailability.create({
    data: {
      courtId: court.id,
      dayOfWeek: dayOfWeek ?? undefined,
      date: normalizedDate ?? undefined,
      startTime,
      endTime,
      isBlocked: Boolean(isBlocked),
      notes: typeof notes === 'string' ? notes.trim() || null : undefined,
    },
  });

  res.status(201).json(availability);
};

export const deleteCourtAvailability = async (req: Request, res: Response) => {
  const { id, courtId, availabilityId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers/admins can manage court availability');
  }

  ensureResourceExists(
    await prisma.tournamentCourt.findFirst({ where: { id: courtId, tournamentId: id } }),
    'Court'
  );

  const availability = ensureResourceExists(
    await prisma.tournamentCourtAvailability.findFirst({ where: { id: availabilityId, courtId } }),
    'Court availability'
  );

  await prisma.tournamentCourtAvailability.delete({ where: { id: availability.id } });
  res.json({ message: 'Court availability deleted successfully' });
};

export const scheduleMatchOnCourt = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = req.user!.id;
  const { courtId, scheduledAt, scheduledDurationMinutes, location } = req.body ?? {};

  if (!courtId || typeof courtId !== 'string') {
    throw new BadRequestError('courtId is required');
  }
  if (!scheduledAt) {
    throw new BadRequestError('scheduledAt is required');
  }

  const duration = scheduledDurationMinutes === undefined
    ? DEFAULT_MATCH_DURATION_MINUTES
    : Number(scheduledDurationMinutes);
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_MATCH_DURATION_MINUTES) {
    throw new BadRequestError(`scheduledDurationMinutes must be between 1 and ${MAX_MATCH_DURATION_MINUTES}`);
  }

  const startAt = new Date(scheduledAt);
  if (Number.isNaN(startAt.getTime())) {
    throw new BadRequestError('scheduledAt must be a valid date');
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers/admins can schedule matches');
  }

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findFirst({ where: { id: matchId, tournamentId: id } }),
    'Match'
  );
  const court = ensureResourceExists(
    await prisma.tournamentCourt.findFirst({ where: { id: courtId, tournamentId: id, isActive: true } }),
    'Court'
  );

  // Pool play constraint: teams in a pool can switch courts, but never gyms.
  // We enforce this by ensuring the selected court's location matches the pool venue.
  if (match.stage === BracketStage.GROUP_STAGE && typeof match.groupName === 'string' && match.groupName.trim().length > 0) {
    const groupName = match.groupName.trim();
    const pool = await prisma.tournamentPool.findFirst({
      where: { tournamentId: id, name: groupName },
      select: { id: true, venue: true },
    });

    if (pool && typeof pool.venue === 'string' && pool.venue.trim().length > 0) {
      const poolVenue = pool.venue.trim().toLowerCase();
      const courtLocation = (court.location ?? '').trim().toLowerCase();

      if (!courtLocation) {
        throw new BadRequestError(
          `Court "${court.name}" must have a gym location set to schedule ${groupName} pool matches`
        );
      }

      if (courtLocation !== poolVenue) {
        throw new BadRequestError(
          `Pool ${groupName} is assigned to gym "${pool.venue}", but court "${court.name}" is in "${court.location}"`
        );
      }
    }
  }

  const isReschedule = !!match.scheduledAt;
  if (
    isReschedule &&
    tournament.status === TournamentStatus.IN_PROGRESS &&
    tournament.allowRescheduleAfterStart !== true
  ) {
    throw new BadRequestError('Rescheduling is disabled once the tournament is in progress');
  }

  if (isReschedule && (tournament.rescheduleCutoffMinutes ?? 0) > 0 && match.scheduledAt) {
    const cutoffMs = (tournament.rescheduleCutoffMinutes as number) * MILLISECONDS_PER_MINUTE;
    const cutoffAt = new Date(match.scheduledAt.getTime() - cutoffMs);
    if (new Date() >= cutoffAt) {
      throw new BadRequestError(
        `Reschedule cutoff reached (${tournament.rescheduleCutoffMinutes} minute(s) before kickoff)`
      );
    }
  }

  const localDate = new Date(startAt);
  localDate.setHours(0, 0, 0, 0);

  const blockedAvailabilities = await prisma.tournamentCourtAvailability.findMany({
    where: {
      courtId: court.id,
      isBlocked: true,
      OR: [
        { date: localDate },
        { dayOfWeek: startAt.getDay() },
      ],
    },
  });
  const startMinutes = startAt.getHours() * 60 + startAt.getMinutes();
  const endMinutes = startMinutes + duration;
  const blockedOverlap = blockedAvailabilities.some((entry) => {
    const blockedStart = parseTimeToMinutes(entry.startTime);
    const blockedEnd = parseTimeToMinutes(entry.endTime);
    return startMinutes < blockedEnd && endMinutes > blockedStart;
  });
  if (blockedOverlap) {
    throw new ConflictError('Selected court is blocked for the chosen time window');
  }

  const sameCourtMatches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId: id,
      courtId: court.id,
      id: { not: match.id },
      status: { not: MatchStatus.CANCELLED },
      scheduledAt: { not: null },
    },
    select: { id: true, scheduledAt: true, scheduledDurationMinutes: true },
  });

  const conflictingMatch = sameCourtMatches.find((other) => {
    if (!other.scheduledAt) return false;
    return hasScheduleOverlap(
      startAt,
      duration,
      other.scheduledAt,
      other.scheduledDurationMinutes ?? DEFAULT_MATCH_DURATION_MINUTES
    );
  });
  if (conflictingMatch) {
    throw new ConflictError(`Court conflict with match ${conflictingMatch.id}`);
  }

  const minTeamRestMinutes = tournament.minTeamRestMinutes ?? 0;
  if (minTeamRestMinutes > 0) {
    const relatedMatches = await prisma.tournamentMatch.findMany({
      where: {
        tournamentId: id,
        id: { not: match.id },
        status: { not: MatchStatus.CANCELLED },
        scheduledAt: { not: null },
        OR: [
          { homeTeamId: match.homeTeamId },
          { awayTeamId: match.homeTeamId },
          { homeTeamId: match.awayTeamId },
          { awayTeamId: match.awayTeamId },
        ],
      },
      select: {
        id: true,
        scheduledAt: true,
        scheduledDurationMinutes: true,
      },
    });

    for (const related of relatedMatches) {
      if (!related.scheduledAt) continue;
      const relatedDuration = related.scheduledDurationMinutes ?? DEFAULT_MATCH_DURATION_MINUTES;
      const restGap = getRequiredRestGapMinutes(startAt, duration, related.scheduledAt, relatedDuration);
      if (restGap < minTeamRestMinutes) {
        throw new ConflictError(
          `Team rest-window conflict with match ${related.id}: requires at least ${minTeamRestMinutes} minutes between matches`
        );
      }
    }
  }

  const updated = await prisma.tournamentMatch.update({
    where: { id: match.id },
    data: {
      courtId: court.id,
      scheduledAt: startAt,
      scheduledDurationMinutes: duration,
      location: typeof location === 'string' ? location : (court.location ?? match.location),
    },
    include: {
      court: true,
      homeTeam: true,
      awayTeam: true,
    },
  });

  res.json(updated);
};

/**
 * Bulk-shift scheduled matches for operational contingency scenarios.
 */
export const bulkShiftScheduledMatches = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { minutes, contingencyMode, contingencyNotes } = req.body ?? {};

  const shiftMinutes = Number(minutes);
  if (!Number.isInteger(shiftMinutes) || shiftMinutes === 0 || Math.abs(shiftMinutes) > MAX_BULK_SHIFT_MINUTES) {
    throw new BadRequestError(
      `minutes must be a non-zero integer between -${MAX_BULK_SHIFT_MINUTES} and ${MAX_BULK_SHIFT_MINUTES}`
    );
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers/admins can bulk-shift scheduled matches');
  }

  const normalizedContingencyMode =
    contingencyMode !== undefined
      ? parseEnumInput(contingencyMode, TOURNAMENT_CONTINGENCY_MODES, 'contingencyMode')
      : undefined;
  const nextContingencyDelayMinutes = (tournament.contingencyDelayMinutes ?? 0) + shiftMinutes;
  if (nextContingencyDelayMinutes < 0) {
    throw new BadRequestError(
      'Requested shift would make contingencyDelayMinutes negative; reduce rollback magnitude or reset contingency settings first'
    );
  }

  const matches = await prisma.tournamentMatch.findMany({
    where: {
      tournamentId: id,
      status: { in: [MatchStatus.SCHEDULED, MatchStatus.IN_PROGRESS] },
      scheduledAt: { not: null },
    },
    select: { id: true, scheduledAt: true },
  });

  const updatedCount = await prisma.$transaction(async (tx) => {
    for (const match of matches) {
      if (!match.scheduledAt) continue;
      const shifted = new Date(match.scheduledAt.getTime() + shiftMinutes * MILLISECONDS_PER_MINUTE);
      await tx.tournamentMatch.update({
        where: { id: match.id },
        data: { scheduledAt: shifted },
      });
    }

    await tx.tournament.update({
      where: { id },
      data: {
        contingencyMode: normalizedContingencyMode ?? tournament.contingencyMode,
        contingencyNotes:
          contingencyNotes !== undefined
            ? contingencyNotes === null || contingencyNotes === ''
              ? null
              : sanitizeString(String(contingencyNotes))
            : tournament.contingencyNotes,
        contingencyDelayMinutes: nextContingencyDelayMinutes,
      },
    });

    return matches.length;
  });

  res.json({
    message: `Shifted ${updatedCount} scheduled match(es) by ${shiftMinutes} minute(s)`,
    shiftedMatches: updatedCount,
  });
};

export const deleteCourt = async (req: Request, res: Response) => {
  const { id, courtId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers/admins can manage courts');
  }

  const court = ensureResourceExists(
    await prisma.tournamentCourt.findFirst({ where: { id: courtId, tournamentId: id } }),
    'Court'
  );

  const assignedMatchCount = await prisma.tournamentMatch.count({
    where: {
      tournamentId: id,
      courtId: court.id,
      status: { not: MatchStatus.CANCELLED },
    },
  });

  if (assignedMatchCount > 0) {
    throw new BadRequestError('Cannot delete a court that is assigned to matches');
  }

  await prisma.tournamentCourt.delete({ where: { id: court.id } });
  res.json({ message: 'Court deleted successfully' });
};

// ==================== REGISTRATION WAITLIST (#2) ====================

export const getRegistrationWaitlist = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id }, select: { id: true, organizerId: true, isPublic: true } }),
    'Tournament'
  );

  await assertCanViewTournament(tournament, userId);

  const waitlist = await prisma.tournamentRegistrationWaitlist.findMany({
    where: { tournamentId: id },
    include: { team: { select: { id: true, name: true, captainUserId: true } } },
    orderBy: { position: 'asc' },
  });

  res.json(waitlist);
};

export const joinRegistrationWaitlist = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (
    tournament.status !== TournamentStatus.REGISTRATION &&
    tournament.status !== TournamentStatus.REGISTRATION_CLOSED
  ) {
    throw new BadRequestError('Registration waitlist is only available while registration is open or closed');
  }

  const myTeam = await prisma.tournamentTeam.findFirst({
    where: { tournamentId: id, captainUserId: userId },
  });

  if (!myTeam) {
    throw new BadRequestError('You must have a registered team to join the waitlist');
  }

  // Registration waitlist is only meaningful when the tournament has a team cap.
  if (!tournament.maxTeams) {
    throw new BadRequestError('This tournament has no team limit — registration waitlist is not applicable');
  }

  const teamCount = await prisma.tournamentTeam.count({ where: { tournamentId: id } });
  if (teamCount < tournament.maxTeams) {
    throw new BadRequestError('Tournament still has open spots — no need to join waitlist');
  }

  const existing = await prisma.tournamentRegistrationWaitlist.findFirst({
    where: { tournamentId: id, teamId: myTeam.id },
  });

  if (existing) {
    throw new BadRequestError('Your team is already on the registration waitlist');
  }

  const entry = await prisma.$transaction(async (tx) => {
    const position = await tx.tournamentRegistrationWaitlist.count({ where: { tournamentId: id } });
    return tx.tournamentRegistrationWaitlist.create({
      data: { tournamentId: id, teamId: myTeam.id, position: position + 1 },
      include: { team: { select: { id: true, name: true } } },
    });
  });

  logger.info('Team joined registration waitlist', 'TournamentController', {
    tournamentId: id, teamId: myTeam.id, userId,
  });

  res.status(201).json(entry);
};

export const leaveRegistrationWaitlist = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const myTeam = await prisma.tournamentTeam.findFirst({
    where: { tournamentId: id, captainUserId: userId },
  });

  if (!myTeam) {
    throw new BadRequestError('No team found for this user in the tournament');
  }

  const entry = ensureResourceExists(
    await prisma.tournamentRegistrationWaitlist.findFirst({
      where: { tournamentId: id, teamId: myTeam.id },
    }),
    'Waitlist entry'
  );

  await prisma.$transaction(async (tx) => {
    await tx.tournamentRegistrationWaitlist.delete({ where: { id: entry.id } });
    await tx.tournamentRegistrationWaitlist.updateMany({
      where: { tournamentId: id, position: { gt: entry.position } },
      data: { position: { decrement: 1 } },
    });
  });

  logger.info('Team left registration waitlist', 'TournamentController', {
    tournamentId: id, teamId: myTeam.id, userId,
  });

  res.json({ message: 'Removed from registration waitlist' });
};

export const promoteFromRegistrationWaitlist = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can promote from the waitlist');
  }

  const entry = ensureResourceExists(
    await prisma.tournamentRegistrationWaitlist.findFirst({
      where: { tournamentId: id, teamId },
    }),
    'Waitlist entry'
  );

  // Promote and optionally assign to an available pool (if the tournament uses pools)
  await prisma.$transaction(async (tx) => {
    await tx.tournamentRegistrationWaitlist.delete({ where: { id: entry.id } });
    await tx.tournamentRegistrationWaitlist.updateMany({
      where: { tournamentId: id, position: { gt: entry.position } },
      data: { position: { decrement: 1 } },
    });

    // If the tournament has pools, try to find one with available capacity
    const pools = await tx.tournamentPool.findMany({
      where: { tournamentId: id },
      include: { teams: true },
      orderBy: { createdAt: 'asc' },
    });

    const availablePool = pools.find((p) => p.teams.length < p.maxTeams);
    if (availablePool) {
      await tx.tournamentTeam.update({
        where: { id: teamId },
        data: {
          poolId: availablePool.id,
          poolName: availablePool.name,
          registrationOrder: availablePool.teams.length + 1,
        },
      });
    }
  });

  logger.info('Team promoted from registration waitlist', 'TournamentController', {
    tournamentId: id, teamId, userId,
  });

  // Notify the promoted team's captain (best-effort)
  try {
    const team = await prisma.tournamentTeam.findUnique({
      where: { id: teamId },
      select: { captainUserId: true, name: true },
    });
    if (team?.captainUserId) {
      await NotificationFactory.createTournamentNotifications({
        userIds: [team.captainUserId],
        tournamentId: id,
        type: TournamentNotificationType.tournament_updated,
        params: {
          tournamentName: tournament.name,
          teamName: team.name,
          promoted: true,
        },
        metadata: { updateType: 'waitlist_promoted', teamId },
      });
    }
  } catch (notifErr) {
    logger.error('Failed to notify promoted team', 'TournamentController', { error: notifErr, tournamentId: id, teamId });
  }

  res.json({ message: 'Team removed from registration waitlist (now registered)', teamId });
};

// ==================== SCORE DISPUTES (#3) ====================
// createScoreDispute, getMatchDisputes, resolveScoreDispute moved to tournamentDisputeController.ts

// ==================== REGISTRATION FIELDS (#9) ====================

export const getRegistrationFields = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id }, select: { id: true, organizerId: true, isPublic: true } }),
    'Tournament'
  );

  await assertCanViewTournament(tournament, userId);

  const fields = await prisma.tournamentRegistrationField.findMany({
    where: { tournamentId: id },
    orderBy: { sortOrder: 'asc' },
  });

  res.json(fields);
};

export const createRegistrationField = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { label, fieldType, isRequired, options, sortOrder } = req.body;

  if (!label || typeof label !== 'string' || !label.trim()) {
    throw new BadRequestError('Field label is required');
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can manage registration fields');
  }

  const allowedTypes = ['text', 'number', 'boolean', 'select'];
  if (fieldType && !allowedTypes.includes(fieldType)) {
    throw new BadRequestError(`fieldType must be one of: ${allowedTypes.join(', ')}`);
  }

  const field = await prisma.tournamentRegistrationField.create({
    data: {
      tournamentId: id,
      label: label.trim(),
      fieldType: fieldType || 'text',
      isRequired: isRequired === true,
      options: options || null,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
    },
  });

  res.status(201).json(field);
};

export const updateRegistrationField = async (req: Request, res: Response) => {
  const { id, fieldId } = req.params;
  const userId = req.user!.id;
  const { label, isRequired, options, sortOrder } = req.body;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can manage registration fields');
  }

  ensureResourceExists(
    await prisma.tournamentRegistrationField.findFirst({ where: { id: fieldId, tournamentId: id } }),
    'Registration field'
  );

  const data: Record<string, unknown> = {};
  if (label !== undefined) data.label = label.trim();
  if (isRequired !== undefined) data.isRequired = isRequired === true;
  if (options !== undefined) data.options = options || null;
  if (sortOrder !== undefined) data.sortOrder = sortOrder;

  const field = await prisma.tournamentRegistrationField.update({ where: { id: fieldId }, data });

  res.json(field);
};

export const deleteRegistrationField = async (req: Request, res: Response) => {
  const { id, fieldId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can manage registration fields');
  }

  ensureResourceExists(
    await prisma.tournamentRegistrationField.findFirst({ where: { id: fieldId, tournamentId: id } }),
    'Registration field'
  );

  await prisma.tournamentRegistrationField.delete({ where: { id: fieldId } });

  res.json({ message: 'Registration field deleted' });
};

export const submitTeamAnswers = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;
  const { answers } = req.body;

  if (!Array.isArray(answers)) {
    throw new BadRequestError('answers must be an array');
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  ensureResourceExists(
    await prisma.tournamentTeam.findFirst({ where: { id: teamId, tournamentId: id } }),
    'Team'
  );

  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);
  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);

  if (!isCaptain && !isOrgOrAdmin) {
    throw new ForbiddenError('Only team captains or organizers can submit registration answers');
  }

  // Validate that all submitted fieldIds belong to this tournament
  const submittedFieldIds = [...new Set(
    normalizeRegistrationAnswers(answers).map((answer) => answer.fieldId)
  )];
  if (submittedFieldIds.length > 0) {
    const validFields = await prisma.tournamentRegistrationField.findMany({
      where: { id: { in: submittedFieldIds }, tournamentId: id },
      select: { id: true },
    });
    const validFieldIdSet = new Set(validFields.map((f) => f.id));
    const invalidIds = submittedFieldIds.filter((fid) => !validFieldIdSet.has(fid));
    if (invalidIds.length > 0) {
      throw new BadRequestError('One or more registration field IDs are invalid for this tournament');
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const ans of answers) {
      if (!ans.fieldId || ans.value === undefined) continue;
      await tx.tournamentTeamAnswer.upsert({
        where: { fieldId_teamId: { fieldId: ans.fieldId, teamId } },
        create: { fieldId: ans.fieldId, teamId, value: String(ans.value) },
        update: { value: String(ans.value) },
      });
    }
  });

  const savedAnswers = await prisma.tournamentTeamAnswer.findMany({
    where: { teamId },
    include: { field: { select: { id: true, label: true, fieldType: true } } },
  });

  res.json(savedAnswers);
};

export const getTeamAnswers = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id }, select: { id: true, organizerId: true, isPublic: true } }),
    'Tournament'
  );

  await assertCanViewTournament(tournament, userId);

  ensureResourceExists(
    await prisma.tournamentTeam.findFirst({ where: { id: teamId, tournamentId: id } }),
    'Team'
  );

  const answers = await prisma.tournamentTeamAnswer.findMany({
    where: { teamId },
    include: { field: { select: { id: true, label: true, fieldType: true } } },
  });

  res.json(answers);
};

// ==================== PLAYER STATS (#12) ====================

export const getPlayerStats = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id }, select: { id: true, organizerId: true, isPublic: true } }),
    'Tournament'
  );

  await assertCanViewTournament(tournament, userId);

  ensureResourceExists(
    await prisma.tournamentTeam.findFirst({ where: { id: teamId, tournamentId: id } }),
    'Team'
  );

  const stats = await prisma.tournamentPlayerStat.findMany({
    where: { teamId },
    include: { player: { select: { id: true, playerName: true, jerseyNumber: true } } },
    orderBy: [{ player: { playerName: 'asc' } }, { statKey: 'asc' }],
  });

  res.json(stats);
};

export const upsertPlayerStat = async (req: Request, res: Response) => {
  const { id, teamId, playerId } = req.params;
  const userId = req.user!.id;
  const { statKey, value } = req.body;

  if (!statKey || typeof statKey !== 'string' || !statKey.trim()) {
    throw new BadRequestError('statKey is required');
  }
  if (value === undefined || typeof value !== 'number') {
    throw new BadRequestError('value must be a number');
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  ensureResourceExists(
    await prisma.tournamentTeam.findFirst({ where: { id: teamId, tournamentId: id } }),
    'Team'
  );

  ensureResourceExists(
    await prisma.tournamentPlayer.findFirst({ where: { id: playerId, teamId } }),
    'Player'
  );

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

  if (!isOrgOrAdmin && !isCaptain) {
    throw new ForbiddenError('Only organizers, admins, or team captains can record player stats');
  }

  const stat = await prisma.tournamentPlayerStat.upsert({
    where: { playerId_statKey: { playerId, statKey: statKey.trim() } },
    create: { tournamentId: id, teamId, playerId, statKey: statKey.trim(), value },
    update: { value },
    include: { player: { select: { id: true, playerName: true } } },
  });

  res.json(stat);
};

// ==================== PHASE 3: GAME-DAY OPERATIONS ====================

/**
 * Generate a unique QR check-in token for a team.
 * Organizer/admin or the team captain can call this.
 * Returns the token in plain text (to be encoded into a QR code by the client).
 */
export const generateCheckInQrToken = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);
  if (!isOrgOrAdmin && !isCaptain) {
    throw new ForbiddenError('Only organizer, admin, or team captain can generate a check-in token');
  }

  const team = ensureResourceExists(
    await prisma.tournamentTeam.findFirst({ where: { id: teamId, tournamentId: id } }),
    'Team'
  );

  const token = randomBytes(SHARE_TOKEN_BYTES).toString('hex');
  const updated = await prisma.tournamentTeam.update({
    where: { id: team.id },
    data: { checkInToken: token },
    select: { id: true, name: true, checkInToken: true },
  });

  logger.info('QR check-in token generated', 'TournamentController', { tournamentId: id, teamId, userId });
  res.json(updated);
};

/**
 * Check in a team by scanning their QR token.
 * No special permission needed — anyone who has the token can check in the team.
 */
export const checkInViaQrToken = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { token } = req.body ?? {};

  if (!token || typeof token !== 'string') {
    throw new BadRequestError('token is required');
  }

  ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const team = await prisma.tournamentTeam.findFirst({
    where: { tournamentId: id, checkInToken: token.trim() },
  });
  if (!team) {
    throw new NotFoundError('Invalid or expired check-in token');
  }

  // Atomic: mark team as checked in and rotate (clear) the token so it cannot be replayed
  const updated = await prisma.tournamentTeam.update({
    where: { id: team.id },
    data: {
      checkedIn: true,
      checkedInAt: team.checkedInAt ?? new Date(),
      checkInToken: null,
    },
    select: { id: true, name: true, checkedIn: true, checkedInAt: true },
  });

  logger.info('Team checked in via QR', 'TournamentController', { tournamentId: id, teamId: team.id });
  res.json(updated);
};

/**
 * Assign (or remove) a scorekeeper user to a match.
 * Only organizer/admin can do this.
 */
export const assignMatchScorekeeper = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = req.user!.id;
  const { scorekeeperUserId } = req.body ?? {};

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers/admins can assign a scorekeeper');
  }

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findFirst({ where: { id: matchId, tournamentId: id } }),
    'Match'
  );

  const updated = await prisma.tournamentMatch.update({
    where: { id: match.id },
    data: { scorekeeperUserId: scorekeeperUserId ?? null },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      scorekeeper: { select: { id: true, name: true, email: true } },
      court: { select: { id: true, name: true } },
    },
  });

  if (updated.scorekeeper?.id) {
    try {
      await notifyAssignedScorekeeper(tournament, updated);
    } catch (error) {
      logger.error('Failed to notify assigned scorekeeper', 'TournamentController', {
        tournamentId: id,
        matchId,
        scorekeeperUserId,
        error,
      });
    }
  }

  logger.info('Scorekeeper assigned', 'TournamentController', { tournamentId: id, matchId, scorekeeperUserId, userId });
  res.json(updated);
};

/**
 * Start a match — marks it as in_progress and records startedAt.
 * Organizer/admin or the assigned scorekeeper can start.
 */
export const startMatch = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = req.user!.id;
  const { allowEarlyStart = false } = req.body ?? {};

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findFirst({ where: { id: matchId, tournamentId: id } }),
    'Match'
  );

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  const isScorekeeper = match.scorekeeperUserId === userId;
  if (!isOrgOrAdmin && !isScorekeeper) {
    throw new ForbiddenError('Only organizers, admins, or the assigned scorekeeper can start a match');
  }

  const canStartEarly =
    isOrgOrAdmin &&
    allowEarlyStart === true &&
    tournament.status === TournamentStatus.REGISTRATION_CLOSED;
  const startMatchPolicy = canPerformTournamentLifecycleAction('start_match', tournament.status, {
    allowEarlyStart: canStartEarly,
  });
  if (!startMatchPolicy.allowed) {
    throw new BadRequestError(startMatchPolicy.reason ?? 'Matches can only be started once the tournament is in progress');
  }

  if (match.status === MatchStatus.COMPLETED || match.status === MatchStatus.CANCELLED) {
    throw new BadRequestError(`Cannot start a match that is already ${match.status}`);
  }

  // Idempotent: if already in_progress, re-fetch from DB for latest state and return
  if (match.status === MatchStatus.IN_PROGRESS) {
    const current = await prisma.tournamentMatch.findUnique({ where: { id: match.id } });
    res.json(current ?? match);
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Conditional update to prevent duplicate transitions under concurrency
    const updateResult = await tx.tournamentMatch.updateMany({
      where: { id: match.id, status: MatchStatus.SCHEDULED },
      data: {
        status: MatchStatus.IN_PROGRESS,
        startedAt: match.startedAt ?? new Date(),
      },
    });

    if (updateResult.count === 0) {
      // Another request already transitioned the match — fetch and validate current state
      const current = await tx.tournamentMatch.findUnique({ where: { id: match.id } });
      if (current && (current.status === MatchStatus.COMPLETED || current.status === MatchStatus.CANCELLED)) {
        // The match was moved to a terminal state, not started
        throw new BadRequestError(`Cannot start a match that is already ${current.status}`);
      }
      return current;
    }

    if (canStartEarly) {
      await tx.tournament.update({
        where: { id },
        data: { status: TournamentStatus.IN_PROGRESS },
      });
    }

    return tx.tournamentMatch.findUnique({ where: { id: match.id } });
  });

  logger.info('Match started', 'TournamentController', { tournamentId: id, matchId, userId });
  res.json(updated);
};

export const cancelMatch = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can cancel matches');
  }

  assertTournamentNotFinalized(tournament, 'Cannot cancel matches for completed or cancelled tournaments');

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findFirst({ where: { id: matchId, tournamentId: id } }),
    'Match'
  );

  if (match.status === MatchStatus.CANCELLED) {
    throw new BadRequestError('Match is already cancelled');
  }
  if (match.status === MatchStatus.COMPLETED) {
    throw new BadRequestError('Completed matches cannot be cancelled');
  }

  const updated = await prisma.tournamentMatch.update({
    where: { id: match.id },
    data: { status: MatchStatus.CANCELLED },
  });

  logger.info('Match cancelled', 'TournamentController', { tournamentId: id, matchId, userId });
  res.json(updated);
};

/**
 * List incidents for a match.
 */
export const getMatchIncidents = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  await assertCanViewTournament(tournament, userId);

  ensureResourceExists(
    await prisma.tournamentMatch.findFirst({ where: { id: matchId, tournamentId: id } }),
    'Match'
  );

  const incidents = await prisma.tournamentMatchIncident.findMany({
    where: { matchId, tournamentId: id },
    orderBy: { createdAt: 'desc' },
    include: {
      resolvedBy: { select: { id: true, name: true } },
    },
  });
  res.json(incidents);
};

/**
 * Report a game-day incident for a match.
 * Organizer, admin, or the assigned scorekeeper can report.
 */
export const createMatchIncident = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = req.user!.id;
  const { incidentType, description, slaMinutes } = req.body ?? {};

  if (!description || typeof description !== 'string' || !description.trim()) {
    throw new BadRequestError('description is required');
  }
  if (description.length > MAX_INCIDENT_DESCRIPTION_LENGTH) {
    throw new BadRequestError(`description must be at most ${MAX_INCIDENT_DESCRIPTION_LENGTH} characters`);
  }
  const resolvedType = incidentType && MATCH_INCIDENT_TYPES.includes(incidentType)
    ? (incidentType as MatchIncidentType)
    : MatchIncidentType.OTHER;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findFirst({ where: { id: matchId, tournamentId: id } }),
    'Match'
  );

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  const isScorekeeper = match.scorekeeperUserId === userId;
  if (!isOrgOrAdmin && !isScorekeeper) {
    throw new ForbiddenError('Only organizers, admins, or the assigned scorekeeper can report incidents');
  }

  const slaMs = (typeof slaMinutes === 'number' && slaMinutes > 0
    ? slaMinutes
    : DEFAULT_INCIDENT_SLA_MINUTES) * MILLISECONDS_PER_MINUTE;

  const incident = await prisma.tournamentMatchIncident.create({
    data: {
      tournamentId: id,
      matchId: match.id,
      reportedByUserId: userId,
      incidentType: resolvedType,
      description: description.trim(),
      slaDeadline: new Date(Date.now() + slaMs),
      status: MatchIncidentStatus.OPEN,
    },
  });

  // Notify organizer of the new incident (non-fatal)
  try {
    await NotificationFactory.createTournamentNotifications({
      userIds: [tournament.organizerId],
      tournamentId: id,
      type: TournamentNotificationType.tournament_updated,
      params: {
        tournamentName: tournament.name,
        updateType: 'incident_reported',
        incidentType: resolvedType,
      },
      metadata: { incidentId: incident.id, matchId: match.id, reportedBy: userId },
    });
  } catch (notifError) {
    logger.error('Failed to notify organizer of match incident', 'TournamentController', { tournamentId: id, incidentId: incident.id, error: notifError });
  }

  logger.info('Match incident reported', 'TournamentController', { tournamentId: id, matchId, incidentId: incident.id, userId });
  res.status(201).json(incident);
};

/**
 * Resolve (or dismiss) an incident.
 * Only organizer/admin can resolve incidents.
 */
export const resolveMatchIncident = async (req: Request, res: Response) => {
  const { id, incidentId } = req.params;
  const userId = req.user!.id;
  const { status, resolution } = req.body ?? {};

  if (!MATCH_INCIDENT_STATUSES.includes(status) || status === MatchIncidentStatus.OPEN) {
    throw new BadRequestError('status must be "resolved" or "dismissed"');
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers/admins can resolve incidents');
  }

  const incident = ensureResourceExists(
    await prisma.tournamentMatchIncident.findFirst({ where: { id: incidentId, tournamentId: id } }),
    'Incident'
  );

  if (incident.status !== MatchIncidentStatus.OPEN) {
    throw new BadRequestError('Incident is already resolved or dismissed');
  }

  const updated = await prisma.tournamentMatchIncident.update({
    where: { id: incident.id },
    data: {
      status: status as MatchIncidentStatus,
      resolvedById: userId,
      resolution: typeof resolution === 'string' ? resolution.trim() || null : null,
      resolvedAt: new Date(),
    },
  });

  // Notify the reporter that their incident has been resolved (non-fatal)
  if (incident.reportedByUserId && incident.reportedByUserId !== userId) {
    try {
      await NotificationFactory.createTournamentNotifications({
        userIds: [incident.reportedByUserId],
        tournamentId: id,
        type: TournamentNotificationType.tournament_updated,
        params: { tournamentName: tournament.name, updateType: 'incident_resolved', status },
        metadata: { incidentId: incident.id, resolvedBy: userId },
      });
    } catch (notifError) {
      logger.error('Failed to notify incident reporter of resolution', 'TournamentController', { tournamentId: id, incidentId, error: notifError });
    }
  }

  logger.info('Match incident resolved', 'TournamentController', { tournamentId: id, incidentId, status, userId });
  res.json(updated);
};

// ==================== PHASE 5: ORGANIZER ANALYTICS ====================
// getTournamentAnalytics moved to tournamentAnalyticsController.ts / services/tournament/analyticsService.ts
