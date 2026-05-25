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
import prisma from '../config/database';
import { logger } from '../utils/logger';
import * as tournamentService from '../services/tournamentService';
import { NotificationFactory } from '../services/notificationFactory';
import {
  TournamentFormat, 
  TournamentStatus, 
  MatchStatus,
  BracketStage,
  TournamentNotificationType,
  TournamentPaymentStatus,
  TOURNAMENT_PAYMENT_STATUSES,
  TournamentPaymentTransactionStatus,
  MatchIncidentType,
  MatchIncidentStatus,
  MATCH_INCIDENT_TYPES,
  MATCH_INCIDENT_STATUSES,
} from '../../shared/types/tournament.types';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { isRequired, parseCoordinates, parseFloatStrict, sanitizeString, isValidEmail } from '../utils/validation';
import { ensureResourceExists } from '../utils/controllerHelpers';
import { isPrismaNotFoundError, isPrismaUniqueError } from '../utils/typeGuards';
import * as locationService from '../services/locationService';
import {
  canPerformTournamentLifecycleAction,
  isTerminalTournamentStatus,
} from '../services/tournamentLifecyclePolicy';
import { normalizeIdArrayInput, parseEnumInput } from './tournamentRequestValidators';

// ==================== CONSTANTS ====================

const INVITATION_EXPIRY_DAYS = 7;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const MAX_LOCATION_RADIUS_KM = 100;
const MAX_LOCATION_FIELD_LENGTH = 100;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_POOL_NAME_LENGTH = 100;
const MAX_PLAYER_NAME_LENGTH = 100;
const MAX_TEAMS_UPPER_BOUND = 1000;
const MAX_BATCH_PAYMENT_TEAMS = 500;
const DEFAULT_MATCH_DURATION_MINUTES = 60;
const MAX_MATCH_DURATION_MINUTES = 480;
const MAX_PAYMENT_METADATA_BYTES = 4096;
const PROVIDER_REF_TEAM_ID_PREFIX_LENGTH = 8;
const TIME_24H_HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TOURNAMENT_PAYMENT_TRANSACTION_STATUSES = Object.values(TournamentPaymentTransactionStatus);
const SPORT_CONFIG_TYPES = ['default', 'volleyball', 'tennis'] as const;
const DEFAULT_INCIDENT_SLA_MINUTES = 30;
const MAX_INCIDENT_DESCRIPTION_LENGTH = 1000;
const SHARE_TOKEN_BYTES = 24; // 48 hex chars — used for both QR check-in tokens and public share tokens
// Minimum cool-down window between referee assignments to reduce back-to-back fatigue.
const DEFAULT_REFEREE_REST_WINDOW_MINUTES = 15;
const OVERLAP_GAP_INDICATOR = -1;
type PoolWaitlistPromoterClient = Pick<typeof prisma, 'tournamentPoolWaitlist' | 'tournamentPool' | 'tournamentTeam'>;

// Lifecycle helpers live in tournamentService; alias for brevity within this file.
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

const assertTournamentSetupEditable = (
  tournament: { status: string; startDate: Date },
  message: string
): void => {
  assertTournamentNotFinalized(tournament);
  if (isTournamentEditLocked(tournament)) {
    throw new BadRequestError(message);
  }
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

const assertSupportedTournamentFormat = (format?: string): void => {
  if (format === TournamentFormat.DOUBLE_ELIMINATION) {
    throw new BadRequestError('Double elimination tournaments are not supported yet');
  }
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

const parseTimeToMinutes = (time: string): number => {
  const match = TIME_24H_HH_MM_REGEX.exec(time);
  if (!match) {
    throw new BadRequestError('Time must be in HH:mm format');
  }
  return Number(match[1]) * 60 + Number(match[2]);
};

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
  const endA = new Date(startA.getTime() + durationMinutesA * 60_000);
  const endB = new Date(startB.getTime() + durationMinutesB * 60_000);
  return startA < endB && startB < endA;
};

const getRequiredRestGapMinutes = (
  startA: Date,
  durationMinutesA: number,
  startB: Date,
  durationMinutesB: number
): number => {
  const endA = new Date(startA.getTime() + durationMinutesA * 60_000);
  const endB = new Date(startB.getTime() + durationMinutesB * 60_000);
  if (hasScheduleOverlap(startA, durationMinutesA, startB, durationMinutesB)) {
    return OVERLAP_GAP_INDICATOR;
  }
  if (endA <= startB) {
    return Math.max(0, Math.floor((startB.getTime() - endA.getTime()) / 60_000));
  }
  return Math.max(0, Math.floor((startA.getTime() - endB.getTime()) / 60_000));
};

const maybeAutoGenerateGroupsKnockoutBrackets = async (
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

  await prisma.tournamentNotification.create({
    data: {
      userId: match.scorekeeper.id,
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
    },
  });
};

const notifyMatchResultToCaptains = async (
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

    await prisma.tournamentNotification.createMany({
      data: userIds.map((captainUserId) => ({
        userId: captainUserId,
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
      })),
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

  await prisma.tournamentNotification.createMany({
    data: userIds.map((userId) => ({
      userId,
      tournamentId: tournament.id,
      type: TournamentNotificationType.tournament_updated,
      params: {
        tournamentName: tournament.name,
        updateType: 'knockout_bracket_ready',
      },
      metadata,
    })),
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

/**
 * Enforce read access for private tournaments.
 * Public tournaments are visible to any authenticated user.
 * Private tournaments are visible only to organizers, admins, and participants.
 */
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

// Re-export for use in tests
export { INVITATION_EXPIRY_DAYS };

// ==================== TOURNAMENT CRUD OPERATIONS ====================

/**
 * Create a new tournament
 */
export const createTournament = async (req: Request, res: Response) => {
  const {
    name,
    description,
    sportType,
    format,
    startDate,
    endDate,
    maxTeams,
    location,
    latitude,
    longitude,
    locationName,
    city,
    country,
    groupId,
    // Admin controls
    registrationDeadline,
    registrationStartDate,
    isPublic,
    allowLateRegistration,
    autoGenerateBrackets,
    useManualBrackets,
    prizesDescription,
    rulesDescription,
    contactEmail,
    // Sport-specific configuration
    sportConfig,
    // Recurring tournament
    isRecurring,
    recurrenceRule,
    // Payment / fee
    registrationFee,
    requirePaymentForBrackets,
    paymentInfo,
    requireWaiverForRegistration,
    waiverText,
    // New gap-feature fields
    rosterLockDate,
    paymentDeadline,
    tiebreakerRules,
    // Self-ref
    selfRefEnabled,
  } = req.body;

  const userId = req.user!.id;

  // Validate required fields
  isRequired(name, 'Name');
  isRequired(sportType, 'Sport type');
  isRequired(format, 'Format');
  isRequired(startDate, 'Start date');

  tournamentService.validateTournamentEnums({ sportType, format });
  assertSupportedTournamentFormat(format);

  // Sanitize inputs
  const sanitized = tournamentService.sanitizeTournamentData({
    name,
    description,
    location,
    locationName,
    prizesDescription,
    rulesDescription,
    paymentInfo,
    waiverText,
  });

  if (!sanitized.name) {
    throw new BadRequestError('Name cannot be empty or whitespace-only');
  }
  if (sanitized.name.length > MAX_NAME_LENGTH) {
    throw new BadRequestError(`Name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  if (sanitized.description && sanitized.description.length > MAX_DESCRIPTION_LENGTH) {
    throw new BadRequestError(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  if (maxTeams !== undefined && maxTeams !== null) {
    if (maxTeams > MAX_TEAMS_UPPER_BOUND) {
      throw new BadRequestError(`Max teams cannot exceed ${MAX_TEAMS_UPPER_BOUND}`);
    }
  }

  // Validate dates
  const dateValidation = tournamentService.validateTournamentDates(startDate, endDate);
  if (!dateValidation.valid) {
    throw new BadRequestError(dateValidation.error!);
  }
  tournamentService.validateTournamentBusinessRules({
    startDate,
    endDate,
    registrationStartDate,
    registrationDeadline,
    maxTeams,
  });

  // Validate optional contact email format
  if (contactEmail) {
    if (!isValidEmail(contactEmail)) {
      throw new BadRequestError('Invalid contact email format');
    }
  }

  // Validate isPublic type
  if (isPublic !== undefined && typeof isPublic !== 'boolean') {
    throw new BadRequestError('isPublic must be a boolean');
  }

  // Validate city and country lengths
  if (city !== undefined && city !== null && typeof city === 'string' && city.length > MAX_LOCATION_FIELD_LENGTH) {
    throw new BadRequestError(`City must be at most ${MAX_LOCATION_FIELD_LENGTH} characters`);
  }
  if (country !== undefined && country !== null && typeof country === 'string' && country.length > MAX_LOCATION_FIELD_LENGTH) {
    throw new BadRequestError(`Country must be at most ${MAX_LOCATION_FIELD_LENGTH} characters`);
  }

  // Validate sportConfig structure when provided
  if (sportConfig !== undefined && sportConfig !== null) {
    if (typeof sportConfig !== 'object' || Array.isArray(sportConfig)) {
      throw new BadRequestError('sportConfig must be an object');
    }
    if (sportConfig.type !== undefined && !SPORT_CONFIG_TYPES.includes(sportConfig.type)) {
      throw new BadRequestError(`sportConfig.type must be one of: ${SPORT_CONFIG_TYPES.join(', ')}`);
    }
  }

  // Validate coordinates if provided
  if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
    parseCoordinates(latitude, longitude);
  }

  // If groupId is provided, verify user has access to the group
  if (groupId) {
    const groupMember = await prisma.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId
        }
      }
    });

    if (!groupMember || groupMember.role !== 'admin') {
      throw new ForbiddenError('Only group admins can create tournaments for the group');
    }
  }

  // Parse coordinates once if both are provided (0 is a valid coordinate)
  const coordinates =
    latitude !== undefined &&
    longitude !== undefined &&
    latitude !== null &&
    longitude !== null
      ? parseCoordinates(latitude, longitude)
      : null;

  const tournament = await prisma.tournament.create({
    data: {
      name: sanitized.name,
      description: sanitized.description || undefined,
      sportType,
      format: format as TournamentFormat,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      maxTeams,
      location: sanitized.location || undefined,
      latitude: coordinates?.lat ?? undefined,
      longitude: coordinates?.lon ?? undefined,
      locationName: sanitized.locationName || undefined,
      city: city ? sanitizeString(city) : undefined,
      country: country ? sanitizeString(country) : undefined,
      organizerId: userId,
      groupId: groupId || undefined,
      // Admin controls
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : undefined,
      registrationStartDate: registrationStartDate ? new Date(registrationStartDate) : undefined,
      isPublic: isPublic !== undefined ? isPublic : true,
      allowLateRegistration: allowLateRegistration || false,
      autoGenerateBrackets: autoGenerateBrackets || false,
      useManualBrackets: useManualBrackets || false,
      prizesDescription: sanitized.prizesDescription || undefined,
      rulesDescription: sanitized.rulesDescription || undefined,
      contactEmail: contactEmail || undefined,
      // Sport-specific configuration
      sportConfig: sportConfig || undefined,
      // Recurring tournament
      isRecurring: isRecurring || false,
      recurrenceRule: recurrenceRule || undefined,
      // Payment / fee
      registrationFee: registrationFee != null ? Number(registrationFee) : undefined,
      requirePaymentForBrackets: requirePaymentForBrackets || false,
      paymentInfo: sanitized.paymentInfo || undefined,
      requireWaiverForRegistration: requireWaiverForRegistration || false,
      waiverText: sanitized.waiverText || undefined,
      // New gap-feature fields
      rosterLockDate: rosterLockDate ? new Date(rosterLockDate) : undefined,
      paymentDeadline: paymentDeadline ? new Date(paymentDeadline) : undefined,
      tiebreakerRules: tiebreakerRules || undefined,
      // Self-ref
      selfRefEnabled: selfRefEnabled || false,
    },
    include: {
      organizer: {
        select: { id: true, name: true, email: true }
      },
      group: {
        select: { id: true, name: true }
      }
    }
  });

  logger.info('Tournament created', 'TournamentController', {
    tournamentId: tournament.id,
    userId,
    isRecurring: tournament.isRecurring
  });

  res.status(201).json(tournament);
};

/**
 * Get all tournaments (with optional filters)
 */
export const getTournaments = async (req: Request, res: Response) => {
  const { groupId, status, sportType, search, page, limit } = req.query;
  const userId = req.user!.id;

  const parsedPage = Math.max(1, parseInt(page as string, 10) || 1);
  const parsedLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const skip = (parsedPage - 1) * parsedLimit;

  const where: Record<string, unknown> = {
    // Authenticated users see public tournaments and any private ones they are associated with
    OR: [
      { isPublic: true },
      { organizerId: userId },
      { teams: { some: { captainUserId: userId } } },
      { teams: { some: { players: { some: { userId } } } } },
      { adminRoles: { some: { userId } } },
    ],
  };

  if (groupId) {
    where.groupId = groupId as string;
  }

  if (status) {
    where.status = status as TournamentStatus;
  }

  if (sportType) {
    where.sportType = sportType as string;
  }

  if (search) {
    where.name = { contains: search as string, mode: 'insensitive' };
  }

  const [tournaments, total] = await Promise.all([
    prisma.tournament.findMany({
      where,
      include: {
        organizer: {
          select: { id: true, name: true, email: true }
        },
        group: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            teams: true,
            matches: true
          }
        }
      },
      orderBy: { startDate: 'desc' },
      skip,
      take: parsedLimit,
    }),
    prisma.tournament.count({ where }),
  ]);

  const syncedTournaments = await Promise.all(
    tournaments.map((tournament) => syncTournamentAutoStatus(tournament, 'list_read'))
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

/**
 * Get a single tournament by ID
 */
export const getTournament = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      organizer: {
        select: { id: true, name: true, email: true }
      },
      group: {
        select: { id: true, name: true }
      },
      teams: {
        include: {
          captainUser: {
            select: { id: true, name: true, email: true }
          },
          players: {
            include: {
              user: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        }
      },
      matches: {
        include: {
          homeTeam: true,
          awayTeam: true,
          refereeTeam: { select: { id: true, name: true } },
          scorekeeper: { select: { id: true, name: true, email: true } },
        },
        orderBy: [
          { stage: 'asc' },
          { roundNumber: 'asc' },
          { matchOrder: 'asc' },
          { scheduledAt: 'asc' }
        ]
      },
      standings: {
        include: {
          team: true
        },
        orderBy: [
          { points: 'desc' },
        ]
      },
      categories: {
        orderBy: { sortOrder: 'asc' },
        include: {
          pools: {
            include: {
              teams: { select: { id: true, name: true } },
              waitlist: {
                orderBy: { position: 'asc' },
                include: { team: { select: { id: true, name: true } } }
              }
            }
          }
        }
      },
      pools: {
        include: {
          teams: {
            select: { id: true, name: true }
          },
          waitlist: {
            orderBy: { position: 'asc' },
            include: {
              team: { select: { id: true, name: true } }
            }
          },
          category: {
            select: { id: true, name: true, sortOrder: true }
          }
        }
      },
      adminRoles: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          grantedBy: { select: { id: true, name: true } }
        }
      }
    }
  });

  ensureResourceExists(tournament, 'Tournament');

  // Private tournaments are only visible to organizers, admins, and registered participants.
  if (userId) {
    await assertCanViewTournament(
      { id: tournament!.id, organizerId: tournament!.organizerId, isPublic: tournament!.isPublic },
      userId
    );
  } else if (!tournament!.isPublic) {
    throw new ForbiddenError('You do not have access to this private tournament');
  }

  const syncedTournament = await syncTournamentAutoStatus(tournament!, 'detail_read');

  // Apply goal-difference tiebreaker (GD = goalsFor - goalsAgainst) in memory,
  // consistent with getStandings. Prisma nested orderBy cannot express computed columns.
  const sortedStandings = [...(syncedTournament.standings ?? [])].sort((
    a: { points: number; goalsFor: number; goalsAgainst: number },
    b: { points: number; goalsFor: number; goalsAgainst: number }
  ) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });

  res.json({ ...syncedTournament, standings: sortedStandings });
};

/**
 * Update a tournament
 */
export const updateTournament = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { 
    name, description, status, startDate, endDate, maxTeams, sportType, format,
    location, locationName, city, country, latitude, longitude,
    // Admin controls
    registrationDeadline, registrationStartDate, isPublic, allowLateRegistration,
    autoGenerateBrackets, useManualBrackets, prizesDescription, rulesDescription, contactEmail,
    // Sport-specific configuration
    sportConfig,
    // Payment / fee
    registrationFee, requirePaymentForBrackets, paymentInfo,
    requireWaiverForRegistration, waiverText,
    // New gap-feature fields
    rosterLockDate, paymentDeadline, tiebreakerRules,
    // Self-ref
    selfRefEnabled,
  } = req.body;

  let tournament = await prisma.tournament.findUnique({
    where: { id }
  });

  ensureResourceExists(tournament, 'Tournament');

  tournament = await syncTournamentAutoStatus(tournament!, 'update_precheck');

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament!, userId);
  if (!isOrgOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can update the tournament');
  }

  assertTournamentSetupEditable(tournament!, 'Tournaments can only be edited before they start');

  if (status !== undefined) {
    throw new BadRequestError('Tournament status is system-managed and cannot be set manually');
  }

  tournamentService.validateTournamentEnums({ sportType, format });
  assertSupportedTournamentFormat(format);

  const updateData: Record<string, unknown> = {};

  if (name !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ name });
    if (!sanitized.name) {
      throw new BadRequestError('Name cannot be empty or whitespace-only');
    }
    if (sanitized.name.length > MAX_NAME_LENGTH) {
      throw new BadRequestError(`Name must be at most ${MAX_NAME_LENGTH} characters`);
    }
    updateData.name = sanitized.name;
  }

  if (description !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ description });
    if (sanitized.description && sanitized.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new BadRequestError(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
    }
    updateData.description = sanitized.description || null;
  }

  if (startDate !== undefined) {
    updateData.startDate = new Date(startDate);
  }

  if (endDate !== undefined) {
    updateData.endDate = endDate ? new Date(endDate) : null;
  }

  if (maxTeams !== undefined) {
    if (maxTeams > MAX_TEAMS_UPPER_BOUND) {
      throw new BadRequestError(`Max teams cannot exceed ${MAX_TEAMS_UPPER_BOUND}`);
    }
    if (maxTeams !== null) {
      const currentCount = await prisma.tournamentTeam.count({ where: { tournamentId: id } });
      if (currentCount > maxTeams) {
        throw new BadRequestError(
          `Cannot reduce max teams to ${maxTeams}: ${currentCount} teams are already registered`
        );
      }
    }
    updateData.maxTeams = maxTeams;
  }
  if (sportType !== undefined) {
    updateData.sportType = sportType;
  }
  if (format !== undefined) {
    updateData.format = format;
  }

  if (location !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ location });
    updateData.location = sanitized.location || null;
  }

  if (locationName !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ locationName });
    updateData.locationName = sanitized.locationName || null;
  }

  if (city !== undefined) {
    if (city !== null && typeof city === 'string' && city.length > MAX_LOCATION_FIELD_LENGTH) {
      throw new BadRequestError(`City must be at most ${MAX_LOCATION_FIELD_LENGTH} characters`);
    }
    updateData.city = city ? sanitizeString(city) : null;
  }
  if (country !== undefined) {
    if (country !== null && typeof country === 'string' && country.length > MAX_LOCATION_FIELD_LENGTH) {
      throw new BadRequestError(`Country must be at most ${MAX_LOCATION_FIELD_LENGTH} characters`);
    }
    updateData.country = country ? sanitizeString(country) : null;
  }
  
  if (latitude !== undefined && longitude !== undefined) {
    const coords = parseCoordinates(latitude, longitude);
    updateData.latitude = coords.lat;
    updateData.longitude = coords.lon;
  }

  // Admin controls
  if (registrationDeadline !== undefined) {
    updateData.registrationDeadline = registrationDeadline ? new Date(registrationDeadline) : null;
  }
  if (registrationStartDate !== undefined) {
    updateData.registrationStartDate = registrationStartDate ? new Date(registrationStartDate) : null;
  }
  if (isPublic !== undefined) {
    if (typeof isPublic !== 'boolean') {
      throw new BadRequestError('isPublic must be a boolean');
    }
    updateData.isPublic = isPublic;
  }
  if (allowLateRegistration !== undefined) {
    updateData.allowLateRegistration = allowLateRegistration;
  }
  if (autoGenerateBrackets !== undefined) {
    updateData.autoGenerateBrackets = autoGenerateBrackets;
  }
  if (useManualBrackets !== undefined) {
    updateData.useManualBrackets = useManualBrackets;
  }
  if (prizesDescription !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ prizesDescription });
    updateData.prizesDescription = sanitized.prizesDescription || null;
  }
  if (rulesDescription !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ rulesDescription });
    updateData.rulesDescription = sanitized.rulesDescription || null;
  }
  if (contactEmail !== undefined) {
    if (contactEmail) {
      if (!isValidEmail(contactEmail)) {
        throw new BadRequestError('Invalid contact email format');
      }
    }
    updateData.contactEmail = contactEmail || null;
  }
  if (sportConfig !== undefined) {
    if (sportConfig !== null) {
      if (typeof sportConfig !== 'object' || Array.isArray(sportConfig)) {
        throw new BadRequestError('sportConfig must be an object');
      }
      if (sportConfig.type !== undefined && !SPORT_CONFIG_TYPES.includes(sportConfig.type)) {
        throw new BadRequestError(`sportConfig.type must be one of: ${SPORT_CONFIG_TYPES.join(', ')}`);
      }
    }
    updateData.sportConfig = sportConfig || null;
  }
  if (registrationFee !== undefined) {
    if (registrationFee === null) {
      updateData.registrationFee = null;
    } else {
      const fee = Number(registrationFee);
      if (isNaN(fee) || fee < 0) {
        throw new BadRequestError('registrationFee must be a non-negative number');
      }
      updateData.registrationFee = fee;
    }
  }
  if (requirePaymentForBrackets !== undefined) {
    if (typeof requirePaymentForBrackets !== 'boolean') {
      throw new BadRequestError('requirePaymentForBrackets must be a boolean');
    }
    updateData.requirePaymentForBrackets = requirePaymentForBrackets;
  }
  if (paymentInfo !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ paymentInfo });
    updateData.paymentInfo = sanitized.paymentInfo || null;
  }
  if (requireWaiverForRegistration !== undefined) {
    if (typeof requireWaiverForRegistration !== 'boolean') {
      throw new BadRequestError('requireWaiverForRegistration must be a boolean');
    }
    updateData.requireWaiverForRegistration = requireWaiverForRegistration;
  }
  if (waiverText !== undefined) {
    const sanitized = tournamentService.sanitizeTournamentData({ waiverText });
    updateData.waiverText = sanitized.waiverText || null;
  }
  if (rosterLockDate !== undefined) {
    updateData.rosterLockDate = rosterLockDate ? new Date(rosterLockDate) : null;
  }
  if (paymentDeadline !== undefined) {
    updateData.paymentDeadline = paymentDeadline ? new Date(paymentDeadline) : null;
  }
  if (tiebreakerRules !== undefined) {
    updateData.tiebreakerRules = tiebreakerRules || null;
  }
  if (selfRefEnabled !== undefined) {
    if (typeof selfRefEnabled !== 'boolean') {
      throw new BadRequestError('selfRefEnabled must be a boolean');
    }
    updateData.selfRefEnabled = selfRefEnabled;
  }

  tournamentService.validateTournamentBusinessRules({
    startDate: (updateData.startDate as Date | undefined) ?? tournament!.startDate,
    endDate:
      (updateData.endDate as Date | null | undefined) !== undefined
        ? (updateData.endDate as Date | null)
        : tournament!.endDate,
    registrationStartDate:
      (updateData.registrationStartDate as Date | null | undefined) !== undefined
        ? (updateData.registrationStartDate as Date | null)
        : tournament!.registrationStartDate,
    registrationDeadline:
      (updateData.registrationDeadline as Date | null | undefined) !== undefined
        ? (updateData.registrationDeadline as Date | null)
        : tournament!.registrationDeadline,
    maxTeams:
      (updateData.maxTeams as number | undefined) !== undefined
        ? (updateData.maxTeams as number)
        : tournament!.maxTeams,
  });

  const updatedTournament = await prisma.tournament.update({
    where: { id },
    data: updateData,
    include: {
      organizer: {
        select: { id: true, name: true, email: true }
      },
      group: {
        select: { id: true, name: true }
      }
    }
  });

  const syncedTournament = await syncTournamentAutoStatus(updatedTournament, 'update_tournament');

  logger.info('Tournament updated', 'TournamentController', {
    tournamentId: id,
    userId
  });

  res.json(syncedTournament);
};

/**
 * Delete a tournament
 */
export const deleteTournament = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const tournament = await prisma.tournament.findUnique({
    where: { id }
  });

  ensureResourceExists(tournament, 'Tournament');

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament!, userId);
  if (!isOrgOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can delete the tournament');
  }

  await prisma.tournament.delete({
    where: { id }
  });

  logger.info('Tournament deleted', 'TournamentController', {
    tournamentId: id,
    userId
  });

  res.json({ message: 'Tournament deleted successfully' });
};

/**
 * Cancel a tournament (organizer only)
 */
export const cancelTournament = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only the organizer or a co-organizer can cancel the tournament');
  }

  if (tournament.status === TournamentStatus.CANCELLED) {
    throw new BadRequestError('Tournament is already cancelled');
  }

  if (tournament.status === TournamentStatus.COMPLETED) {
    throw new BadRequestError('Completed tournaments cannot be cancelled');
  }

  const updated = await prisma.tournament.update({
    where: { id },
    data: { status: TournamentStatus.CANCELLED },
    include: {
      organizer: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true } },
    },
  });

  // Invalidate TTL cache so subsequent reads reflect the cancellation immediately
  tournamentService.invalidateSyncCache(id);

  logger.info('Tournament cancelled', 'TournamentController', { tournamentId: id, userId });
  res.json(updated);
};

// ==================== TEAM MANAGEMENT ====================

/**
 * Add a team to a tournament
 */
export const addTeam = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { name, captainName, captainEmail, captainUserId, poolNumber, poolName, seedNumber, waiverAccepted } = req.body;

  isRequired(name, 'Team name');
  if (typeof name === 'string' && name.trim().length > MAX_NAME_LENGTH) {
    throw new BadRequestError(`Team name must be at most ${MAX_NAME_LENGTH} characters`);
  }

  // Validate email format when a captain email is supplied
  if (captainEmail && !isValidEmail(captainEmail)) {
    throw new BadRequestError('Invalid captain email format');
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
  });

  ensureResourceExists(tournament, 'Tournament');

  tournamentService.validateRegistrationEligibility(tournament!);

  if (tournament!.requireWaiverForRegistration && waiverAccepted !== true) {
    throw new BadRequestError('This tournament requires waiver acceptance before registration');
  }

  // If a captainUserId is provided, verify the user exists and is not an organizer or admin
  if (captainUserId) {
    const captainUser = await prisma.user.findUnique({ where: { id: captainUserId } });
    if (!captainUser) {
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

    return tx.tournamentTeam.create({
      data: {
        name,
        captainName,
        captainEmail,
        captainUserId: captainUserId || undefined,
        tournamentId: id,
        poolNumber: poolNumber || undefined,
        poolName: poolName || undefined,
        seedNumber: seedNumber || undefined,
        waiverAcceptedAt: waiverAccepted ? new Date() : undefined,
        waiverAcceptedByUserId: waiverAccepted ? userId : undefined,
      },
      include: {
        captainUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }).catch((error: unknown) => {
    // Handle unique constraint violation
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError('A team with this name already exists in the tournament');
    }
    throw error;
  });

  // Create notification for tournament organizer
  if (userId !== tournament!.organizerId) {
    try {
      await prisma.tournamentNotification.create({
        data: {
          userId: tournament!.organizerId,
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
          }
        }
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
  if (name !== undefined) updateData.name = name;
  if (captainName !== undefined) updateData.captainName = captainName;
  if (captainEmail !== undefined) {
    if (captainEmail && !isValidEmail(captainEmail)) {
      throw new BadRequestError('Invalid captain email format');
    }
    updateData.captainEmail = captainEmail || null;
  }
  if (captainUserId !== undefined) updateData.captainUserId = captainUserId || null;
  if (logoUrl !== undefined) updateData.logoUrl = logoUrl || null;
  // Only organizers and admins can change pool assignments and seeding
  if (isOrgOrAdmin) {
    if (poolNumber !== undefined) updateData.poolNumber = poolNumber || null;
    if (poolName !== undefined) updateData.poolName = poolName || null;
    if (seedNumber !== undefined) updateData.seedNumber = seedNumber || null;
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

  await prisma.tournamentTeam.delete({
    where: { id: teamId }
  });

  logger.info('Team deleted', 'TournamentController', {
    tournamentId: id,
    teamId,
    userId
  });

  res.json({ message: 'Team deleted successfully' });
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
  const { numberOfGroups, teamsPerGroup, usePoolAssignments, forceGenerate } = req.body;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

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
      where: { tournamentId: id, paymentStatus: { notIn: ['paid', 'waived'] } },
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

  logger.info('Group matches generated', 'TournamentController', {
    tournamentId: id,
    userId,
    isRegeneration,
  });

  res.json({
    message: isRegeneration ? 'Group matches regenerated successfully' : 'Group matches generated successfully',
    matchesCreated: result.count,
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
  const { usePoolAssignments, forceGenerate } = req.body;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can generate brackets');
  }

  const bracketPolicy = canPerformTournamentLifecycleAction('generate_brackets', tournament.status);
  if (!bracketPolicy.allowed) {
    throw new BadRequestError(bracketPolicy.reason ?? 'Brackets can only be generated or regenerated for active tournaments');
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
    where: { tournamentId: id }
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
      where: { tournamentId: id, paymentStatus: { notIn: ['paid', 'waived'] } },
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
      result = usePoolAssignments
        ? await tournamentService.generateRandomizedSingleEliminationBracketsFromPools(id)
        : await tournamentService.generateSingleEliminationBrackets(id);
      break;
    case TournamentFormat.DOUBLE_ELIMINATION:
      throw new BadRequestError('Double elimination bracket generation is not supported yet');
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

  if (homeScore < 0 || awayScore < 0) {
    throw new BadRequestError('Scores cannot be negative');
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (tournament.status === TournamentStatus.CANCELLED || tournament.status === TournamentStatus.COMPLETED) {
    throw new BadRequestError('Scores cannot be submitted for cancelled or completed tournaments');
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

  const isEliminationFormat =
    tournament.format === TournamentFormat.SINGLE_ELIMINATION ||
    tournament.format === TournamentFormat.DOUBLE_ELIMINATION;
  const isKnockoutStage = match.stage != null && match.stage !== BracketStage.GROUP_STAGE;
  if ((isEliminationFormat || isKnockoutStage) && homeScore === awayScore) {
    throw new BadRequestError('Draws are not allowed in elimination matches');
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
    homeScore,
    awayScore
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
          homeScore,
          awayScore,
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
  if (match.stage && match.stage !== BracketStage.FINALS) {
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

  if (homeScore < 0 || awayScore < 0) {
    throw new BadRequestError('Scores cannot be negative');
  }

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
  if ((isEliminationFormat || isKnockoutStage) && homeScore === awayScore) {
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
        homeScore,
        awayScore,
        status: MatchStatus.COMPLETED,
        completedAt: match.completedAt ?? new Date(),
      },
      include: { homeTeam: true, awayTeam: true },
    });

    await tournamentService.updateStandings(matchId, tournament, tx);

    return updated;
  });

  // If knockout stage, attempt to advance winners (idempotent)
  if (match.stage && match.stage !== BracketStage.FINALS) {
    await tournamentService.advanceWinners(id, match.stage as BracketStage);
  }

  await notifyMatchResultToCaptains(tournament, updatedMatch);
  await maybeAutoGenerateGroupsKnockoutBrackets(id);
  await reconcileTournamentLifecycleStatus(id, 'admin_update_score');

  logger.info('Match score overridden by admin', 'TournamentController', {
    tournamentId: id, matchId, homeScore, awayScore, userId,
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
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
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
  if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
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
    select: { id: true, name: true },
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

    // Rank eligible candidates by duty count (ascending), then by id (stable sort)
    const candidates = allTeams
      .filter((team) => {
        if (playingIds.has(team.id)) return false;
        if (match.scheduledAt ? hasConflict(team.id, match) : isPlayingInSameSlot(team.id, match)) {
          return false;
        }
        return true;
      })
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
  if (playerName.length > MAX_PLAYER_NAME_LENGTH) {
    throw new BadRequestError(`Player name must be at most ${MAX_PLAYER_NAME_LENGTH} characters`);
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (tournament.rosterLockDate && new Date() > new Date(tournament.rosterLockDate)) {
    throw new BadRequestError('Roster is locked — player changes are no longer allowed');
  }

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
        jerseyNumber: jerseyNumber !== undefined ? Number(jerseyNumber) : undefined,
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
  const team = await prisma.tournamentTeam.findFirst({
    where: { id: teamId, tournamentId: id },
    include: { captainUser: { select: { id: true, name: true, email: true } } }
  });

  ensureResourceExists(team, 'Team');

  const players = await prisma.tournamentPlayer.findMany({
    where: { teamId },
    include: {
      user: {
        select: { id: true, name: true, email: true }
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

  // Enforce roster lock
  if (tournament.rosterLockDate && new Date() > new Date(tournament.rosterLockDate)) {
    throw new BadRequestError('Roster is locked — player changes are no longer allowed');
  }

  // If newUserId is provided, verify the user exists
  if (newUserId !== undefined && newUserId !== null) {
    const user = await prisma.user.findUnique({
      where: { id: newUserId }
    });
    if (!user) {
      throw new BadRequestError('User not found');
    }
  }

  const updateData: Record<string, unknown> = {};
  if (playerName !== undefined) updateData.playerName = playerName;
  if (playerEmail !== undefined) updateData.playerEmail = playerEmail || null;
  if (newUserId !== undefined) updateData.userId = newUserId || null;
  if (jerseyNumber !== undefined) updateData.jerseyNumber = jerseyNumber !== null ? Number(jerseyNumber) : null;

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

  if (tournament.rosterLockDate && new Date() > new Date(tournament.rosterLockDate)) {
    throw new BadRequestError('Roster is locked — player changes are no longer allowed');
  }

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

  // If the player being removed is the team captain, enforce delegation when there are other members.
  const teamWithCount = await prisma.tournamentTeam.findFirst({
    where: { id: teamId, tournamentId: id },
    select: { id: true, captainUserId: true, _count: { select: { players: true } } }
  });
  ensureResourceExists(teamWithCount, 'Team');

  const isRemovingCaptain = !!player.userId && teamWithCount.captainUserId === player.userId;

  if (isRemovingCaptain) {
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
  const { poolId: targetPoolId } = req.body;

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

// ==================== TEAM INVITATION MANAGEMENT ====================

/**
 * Get invitation details by token (public — no auth required)
 * Used by the mobile invite page to show context before accept/decline.
 */
export const getInvitationDetails = async (req: Request, res: Response) => {
  const { inviteToken } = req.params;

  const invitation = await prisma.tournamentTeamInvitation.findUnique({
    where: { inviteToken },
    include: {
      team: {
        include: {
          tournament: {
            select: { id: true, name: true, sportType: true }
          }
        }
      },
      inviter: {
        select: { id: true, name: true }
      }
    }
  });

  if (!invitation) {
    throw new NotFoundError('Invitation not found');
  }

  if (invitation.status === 'expired' || (invitation.expiresAt && new Date() > new Date(invitation.expiresAt))) {
    throw new BadRequestError('Invitation has expired');
  }

  res.json({
    inviteToken: invitation.inviteToken,
    status: invitation.status,
    inviteeName: invitation.inviteeName,
    inviteeEmail: invitation.inviteeEmail,
    message: invitation.message,
    expiresAt: invitation.expiresAt,
    team: {
      id: invitation.team.id,
      name: invitation.team.name,
    },
    tournament: {
      id: invitation.team.tournament.id,
      name: invitation.team.tournament.name,
      sportType: invitation.team.tournament.sportType,
    },
    inviter: {
      id: invitation.inviter.id,
      name: invitation.inviter.name,
    },
  });
};

/**
 * Send a team invitation
 */
export const sendTeamInvitation = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;
  const { inviteeEmail, inviteeName, message } = req.body;

  if (!inviteeEmail) {
    throw new BadRequestError('Invitee email is required');
  }

  // Validate email format
  if (!isValidEmail(inviteeEmail)) {
    throw new BadRequestError('Invalid email format');
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const team = ensureResourceExists(
    await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id }
    }),
    'Team'
  );

  // Check permissions - only organizer or team captain can send invitations
  const canManage = await tournamentService.canManageTeamInvitations(teamId, id, userId);
  if (!canManage) {
    throw new ForbiddenError('Only the organizer or team captain can send invitations');
  }

  // Check if user is already a player on this team
  // Check if the invitee is already a player in any team for this tournament
  const existingPlayer = await prisma.tournamentPlayer.findFirst({
    where: {
      OR: [
        { playerEmail: inviteeEmail },
        { user: { email: inviteeEmail } }
      ],
      team: { tournamentId: id }
    }
  });

  if (existingPlayer) {
    throw new BadRequestError('This user is already a player in a team for this tournament');
  }

  // Check if the invitee is a registered user who is already a co-organizer
  // or a team captain in this tournament — they cannot also be a player
  const inviteeUserRecord = await prisma.user.findFirst({
    where: { email: inviteeEmail.toLowerCase() },
    select: { id: true }
  });
  if (inviteeUserRecord) {
    const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, inviteeUserRecord.id);
    if (isOrgOrAdmin) {
      throw new BadRequestError('Tournament organizers and co-organizers cannot be invited as players');
    }
    const existingCaptainTeam = await prisma.tournamentTeam.findFirst({
      where: { tournamentId: id, captainUserId: inviteeUserRecord.id },
      select: { id: true }
    });
    if (existingCaptainTeam) {
      throw new BadRequestError('This user is already a team captain in this tournament');
    }
  }

  // Check if there's already a pending invitation
  const existingInvitation = await prisma.tournamentTeamInvitation.findFirst({
    where: {
      teamId,
      inviteeEmail,
      status: 'pending'
    }
  });

  if (existingInvitation) {
    throw new BadRequestError('An invitation has already been sent to this email');
  }

  // Create invitation
  const invitation = await tournamentService.createTeamInvitation(
    teamId,
    userId,
    inviteeEmail,
    inviteeName,
    message
  );

  // Send email notification — failure is non-fatal (invitation is already created)
  try {
    const inviteUrl = `${process.env.FRONTEND_URL}/tournaments/invite/${invitation.inviteToken}`;
    const { sendEmail } = await import('../utils/emailService');
    await sendEmail(
      inviteeEmail,
      'tournamentTeamInvitation',
      inviteeName || inviteeEmail,
      req.user!.name,
      team.name,
      tournament.name,
      inviteUrl,
      message
    );
  } catch (emailError) {
    logger.error('Failed to send team invitation email', 'TournamentController', {
      tournamentId: id,
      teamId,
      inviteeEmail,
      error: emailError
    });
    // Continue — the invitation record was created successfully
  }

  // If invitee is a registered user, send an in-app tournament notification (non-fatal)
  try {
    const inviteeUser = invitation.inviteeUser || await prisma.user.findUnique({ where: { email: inviteeEmail } });
    if (inviteeUser) {
      await NotificationFactory.createTournamentNotifications({
        tournamentId: id,
        type: TournamentNotificationType.team_invited,
        userIds: [inviteeUser.id],
        params: {
          teamName: team.name,
          inviterName: req.user!.name,
          tournamentName: tournament.name,
          inviteToken: invitation.inviteToken
        },
        metadata: {
          actionUrl: `${process.env.FRONTEND_URL}/tournaments/${id}/teams/${teamId}/invitations/${invitation.inviteToken}/accept`,
          actionText: 'View invitation',
          category: 'tournament'
        },
        deduplicateWindow: 1000 * 60 * 5 // avoid duplicates within 5 minutes
      });
    }
  } catch (notifError) {
    logger.error('Failed to create in-app notification for team invitation', 'TournamentController', { tournamentId: id, teamId, inviteeEmail, error: notifError });
    // Non-fatal — invitation was created and email attempted
  }

  logger.info('Team invitation sent', 'TournamentController', {
    tournamentId: id,
    teamId,
    inviteeEmail,
    userId
  });

  res.status(201).json(invitation);
};

/**
 * Get team invitations
 */
export const getTeamInvitations = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const userId = req.user!.id;

  await ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  await ensureResourceExists(
    await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id }
    }),
    'Team'
  );

  // Enforce captain/organizer permissions — invitee emails must never be public
  const canManage = await tournamentService.canManageTeamInvitations(teamId, id, userId!);
  if (!canManage) {
    throw new ForbiddenError('Only the organizer or team captain can view invitations');
  }
  const invitations = await tournamentService.getTeamInvitations(teamId);
  res.json(invitations);
};

/**
 * Get user's pending invitations
 */
export const getUserInvitations = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const invitations = await tournamentService.getUserPendingInvitations(user.email);

  res.json(invitations);
};

/**
 * Get invitation details by token (authenticated — invitee or team captain/organizer only)
 */
export const getInvitationByToken = async (req: Request, res: Response) => {
  const { inviteToken } = req.params;
  const userId = req.user!.id;

  const invitation = await prisma.tournamentTeamInvitation.findUnique({
    where: { inviteToken },
    include: {
      team: { include: { tournament: true } },
      inviter: { select: { id: true, name: true, email: true } },
      inviteeUser: { select: { id: true, name: true, email: true } }
    }
  });

  if (!invitation) {
    return res.status(404).json({ error: 'Invitation not found' });
  }

  // Verify caller is the invitee or has team-management rights
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const isInvitee = user?.email === invitation.inviteeEmail;
  const canManage = await tournamentService.canManageTeamInvitations(
    invitation.teamId,
    invitation.team.tournamentId,
    userId
  );

  if (!isInvitee && !canManage) {
    throw new ForbiddenError('You do not have permission to view this invitation');
  }

  res.json(invitation);
};

/**
 * Accept a team invitation
 */
export const acceptTeamInvitation = async (req: Request, res: Response) => {
  const { inviteToken } = req.params;
  const userId = req.user!.id;

  const invitation = await tournamentService.acceptTeamInvitation(inviteToken, userId);

  logger.info('Team invitation accepted', 'TournamentController', {
    invitationId: invitation.id,
    teamId: invitation.teamId,
    userId
  });

  // Notify the team captain (if present) that a player joined the team
  try {
    // `acceptTeamInvitation` now returns the updated invitation including team and inviteeUser
    const joinedUser = invitation.inviteeUser ?? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    const teamWithCaptain = invitation.team ? await prisma.tournamentTeam.findUnique({ where: { id: invitation.team.id }, include: { captainUser: { select: { id: true, name: true, email: true } }, tournament: { select: { id: true, name: true } } } }) : null;
    if (teamWithCaptain && teamWithCaptain.captainUser && joinedUser) {
      await NotificationFactory.createTournamentNotifications({
        tournamentId: teamWithCaptain.tournament?.id ?? invitation.team?.tournament?.id ?? invitation.team?.tournamentId ?? '',
        type: TournamentNotificationType.team_registered,
        userIds: [teamWithCaptain.captainUser.id],
        params: {
          teamName: teamWithCaptain.name,
          playerName: joinedUser.name,
          tournamentName: teamWithCaptain.tournament?.name ?? invitation.team?.tournament?.name
        },
        metadata: {
          actionUrl: `${process.env.FRONTEND_URL}/tournaments/${teamWithCaptain.tournament?.id ?? invitation.team?.tournament?.id}/teams/${teamWithCaptain.id}`,
          actionText: 'View team roster',
          category: 'tournament'
        }
      });
    }
  } catch (notifError) {
    logger.error('Failed to notify captain about accepted invitation', 'TournamentController', { error: notifError, invitationId: invitation.id });
  }

  res.json({
    message: 'Invitation accepted successfully',
    team: invitation.team
  });
};

/**
 * Decline a team invitation
 */
export const declineTeamInvitation = async (req: Request, res: Response) => {
  const { inviteToken } = req.params;
  const userId = req.user!.id;

  const invitation = await prisma.tournamentTeamInvitation.findUnique({
    where: { inviteToken }
  });

  if (!invitation) {
    throw new NotFoundError('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new BadRequestError('Invitation has already been processed');
  }

  // Get user to verify email matches
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user || user.email !== invitation.inviteeEmail) {
    throw new ForbiddenError('This invitation is for a different email address');
  }

  // Mark invitation as declined
  await prisma.tournamentTeamInvitation.update({
    where: { id: invitation.id },
    data: { status: 'declined' }
  });

  logger.info('Team invitation declined', 'TournamentController', {
    invitationId: invitation.id,
    teamId: invitation.teamId,
    userId
  });

  // Notify the team captain that the invitation was declined
  try {
    const teamWithCaptain = await prisma.tournamentTeam.findUnique({ where: { id: invitation.teamId }, include: { captainUser: { select: { id: true, name: true, email: true } }, tournament: { select: { id: true, name: true } } } });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    if (teamWithCaptain && teamWithCaptain.captainUser && user) {
      await NotificationFactory.createTournamentNotifications({
        tournamentId: teamWithCaptain.tournament?.id ?? '',
        type: TournamentNotificationType.tournament_updated,
        userIds: [teamWithCaptain.captainUser.id],
        params: {
          teamName: teamWithCaptain.name,
          playerName: user.name,
          tournamentName: teamWithCaptain.tournament?.name
        },
        metadata: {
          actionUrl: `${process.env.FRONTEND_URL}/tournaments/${teamWithCaptain.tournament?.id ?? ''}/teams/${teamWithCaptain.id}`,
          actionText: 'View team roster',
          category: 'tournament'
        }
      });
    }
  } catch (notifError) {
    logger.error('Failed to notify captain about declined invitation', 'TournamentController', { error: notifError, invitationId: invitation.id });
  }

  res.json({ message: 'Invitation declined' });
};

/**
 * Cancel a team invitation (captain only)
 */
export const cancelTeamInvitation = async (req: Request, res: Response) => {
  const { id, teamId, invitationId } = req.params;
  const userId = req.user!.id;

  await ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  await ensureResourceExists(
    await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id }
    }),
    'Team'
  );

  const invitation = ensureResourceExists(
    await prisma.tournamentTeamInvitation.findUnique({
      where: { id: invitationId }
    }),
    'Invitation'
  );

  if (invitation.teamId !== teamId) {
    throw new BadRequestError('Invitation does not belong to this team');
  }

  // Check permissions
  const canManage = await tournamentService.canManageTeamInvitations(teamId, id, userId);
  if (!canManage) {
    throw new ForbiddenError('Only the organizer or team captain can cancel invitations');
  }

  await tournamentService.cancelTeamInvitation(invitationId);

  logger.info('Team invitation cancelled', 'TournamentController', {
    tournamentId: id,
    teamId,
    invitationId,
    userId
  });

  res.json({ message: 'Invitation cancelled successfully' });
};

// ==================== CATEGORY MANAGEMENT ====================

/**
 * Get all categories for a tournament (with their pools)
 */
export const getCategories = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page, limit } = req.query;

  const parsedPage = Math.max(1, parseInt(page as string, 10) || 1);
  const parsedLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const skip = (parsedPage - 1) * parsedLimit;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  const [categories, total] = await Promise.all([
    prisma.tournamentCategory.findMany({
      where: { tournamentId: id },
      orderBy: { sortOrder: 'asc' },
      skip,
      take: parsedLimit,
      include: {
        pools: {
          include: {
            teams: { select: { id: true, name: true } },
            waitlist: {
              orderBy: { position: 'asc' },
              include: { team: { select: { id: true, name: true } } }
            }
          }
        }
      }
    }),
    prisma.tournamentCategory.count({ where: { tournamentId: id } }),
  ]);

  res.json({
    data: categories,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  });
};

/**
 * Create a category for a tournament
 */
export const createCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { name, description, sortOrder } = req.body;

  isRequired(name, 'Name');
  if (name.trim().length > MAX_NAME_LENGTH) {
    throw new BadRequestError(`Category name must be at most ${MAX_NAME_LENGTH} characters`);
  }

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  // Only organizer or co-organizer can create categories
  const isOrganizerOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament!, userId);
  if (!isOrganizerOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can manage categories');
  }

  assertTournamentSetupEditable(tournament!, 'Categories can only be managed before the tournament starts');

  try {
    const category = await prisma.tournamentCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || undefined,
        sortOrder: sortOrder ?? 0,
        tournamentId: id
      }
    });

    logger.info('Category created', 'TournamentController', { tournamentId: id, categoryId: category.id, userId });
    res.status(201).json(category);
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError('A category with this name already exists in the tournament');
    }
    throw error;
  }
};

/**
 * Update a category
 */
export const updateCategory = async (req: Request, res: Response) => {
  const { id, categoryId } = req.params;
  const userId = req.user!.id;
  const { name, description, sortOrder } = req.body;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  const isOrganizerOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament!, userId);
  if (!isOrganizerOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can manage categories');
  }

  assertTournamentSetupEditable(tournament!, 'Categories can only be managed before the tournament starts');

  const category = await prisma.tournamentCategory.findFirst({
    where: { id: categoryId, tournamentId: id }
  });
  ensureResourceExists(category, 'Category');

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description?.trim() || null;
  if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

  try {
    const updated = await prisma.tournamentCategory.update({
      where: { id: categoryId },
      data: updateData
    });

    res.json(updated);
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError('A category with this name already exists in the tournament');
    }
    throw error;
  }
};

/**
 * Delete a category
 */
export const deleteCategory = async (req: Request, res: Response) => {
  const { id, categoryId } = req.params;
  const userId = req.user!.id;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  const isOrganizerOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament!, userId);
  if (!isOrganizerOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can manage categories');
  }

  assertTournamentSetupEditable(tournament!, 'Categories can only be managed before the tournament starts');

  const category = await prisma.tournamentCategory.findFirst({
    where: { id: categoryId, tournamentId: id }
  });
  ensureResourceExists(category, 'Category');

  await prisma.tournamentCategory.delete({ where: { id: categoryId } });

  logger.info('Category deleted', 'TournamentController', { tournamentId: id, categoryId, userId });
  res.json({ message: 'Category deleted successfully' });
};

/**
 * Assign a pool to a category
 */
export const assignPoolToCategory = async (req: Request, res: Response) => {
  const { id, poolId } = req.params;
  const userId = req.user!.id;
  const { categoryId } = req.body;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  const isOrganizerOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament!, userId);
  if (!isOrganizerOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can assign pools to categories');
  }

  assertTournamentSetupEditable(tournament!, 'Categories can only be managed before the tournament starts');

  const pool = await prisma.tournamentPool.findFirst({
    where: { id: poolId, tournamentId: id }
  });
  ensureResourceExists(pool, 'Pool');

  if (categoryId) {
    const category = await prisma.tournamentCategory.findFirst({
      where: { id: categoryId, tournamentId: id }
    });
    ensureResourceExists(category, 'Category');
  }

  const updated = await prisma.tournamentPool.update({
    where: { id: poolId },
    data: { categoryId: categoryId || null },
    include: {
      category: { select: { id: true, name: true } }
    }
  });

  res.json(updated);
};

// ==================== ADMIN DELEGATION ====================

/**
 * List co-organizers for a tournament
 */
export const getAdmins = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament!, userId);
  if (!isOrgOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can view admin roles');
  }

  const admins = await prisma.tournamentAdminRole.findMany({
    where: { tournamentId: id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      grantedBy: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  res.json(admins);
};

/**
 * Add a co-organizer to a tournament
 */
export const addAdmin = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { userId: targetUserId, email } = req.body;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  if (!tournamentService.isOrganizer(tournament!, userId)) {
    throw new ForbiddenError('Only the organizer can delegate admin roles');
  }

  assertTournamentNotFinalized(tournament!, 'Admins can only be managed for active tournaments');

  // Resolve user by userId or email
  let resolvedUserId = targetUserId;
  if (!resolvedUserId && email) {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), deletedAt: null }
    });
    if (!user) {
      throw new BadRequestError('No user found with that email');
    }
    resolvedUserId = user.id;
  }

  if (!resolvedUserId) {
    throw new BadRequestError('userId or email is required');
  }

  if (resolvedUserId === userId) {
    throw new BadRequestError('You cannot add yourself as a co-organizer (you are already the organizer)');
  }

  // Only users with verified email addresses can be granted admin roles
  const targetUser = await prisma.user.findUnique({
    where: { id: resolvedUserId },
    select: { id: true, emailVerified: true, deletedAt: true }
  });

  if (!targetUser || targetUser.deletedAt) {
    throw new BadRequestError('User not found');
  }

  if (!targetUser.emailVerified) {
    throw new BadRequestError('Cannot grant admin role to a user with an unverified email address');
  }

  // A team captain in this tournament cannot also be a co-organizer
  const existingCaptainTeam = await prisma.tournamentTeam.findFirst({
    where: { tournamentId: id, captainUserId: resolvedUserId },
    select: { id: true }
  });
  if (existingCaptainTeam) {
    throw new BadRequestError('This user already has a team registered in this tournament and cannot be a co-organizer');
  }

  try {
    const adminRole = await prisma.tournamentAdminRole.create({
      data: {
        tournamentId: id,
        userId: resolvedUserId,
        grantedById: userId
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        grantedBy: { select: { id: true, name: true } }
      }
    });

    logger.info('Co-organizer added', 'TournamentController', { tournamentId: id, addedUserId: resolvedUserId, grantedBy: userId });
    res.status(201).json(adminRole);
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError('This user is already a co-organizer');
    }
    throw error;
  }
};

/**
 * Remove a co-organizer from a tournament
 */
export const removeAdmin = async (req: Request, res: Response) => {
  const { id, adminUserId } = req.params;
  const userId = req.user!.id;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  if (!tournamentService.isOrganizer(tournament!, userId)) {
    throw new ForbiddenError('Only the organizer can remove admin roles');
  }

  assertTournamentNotFinalized(tournament!, 'Admins can only be managed for active tournaments');

  // The tournament organizer is always an admin by virtue of their organizerId.
  // Prevent removing an admin entry that belongs to the organizer themselves.
  if (adminUserId === tournament!.organizerId) {
    throw new BadRequestError('Cannot remove the tournament organizer from admin roles');
  }

  const adminRole = await prisma.tournamentAdminRole.findFirst({
    where: { tournamentId: id, userId: adminUserId }
  });
  ensureResourceExists(adminRole, 'Admin role');

  await prisma.tournamentAdminRole.delete({ where: { id: adminRole!.id } });

  logger.info('Co-organizer removed', 'TournamentController', { tournamentId: id, removedUserId: adminUserId, removedBy: userId });
  res.json({ message: 'Co-organizer removed successfully' });
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
  if (typeof name === 'string' && name.trim().length > MAX_NAME_LENGTH) {
    throw new BadRequestError(`Team name must be at most ${MAX_NAME_LENGTH} characters`);
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
            ? { categoryId: selectedCategory.id, poolName: selectedCategory.name }
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
  await prisma.$transaction(async (tx) => {
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
  });

  logger.info('Team self-unregistered', 'TournamentController', {
    tournamentId: id,
    teamIds,
    removedTeamCount: removableTeams.length,
    captainUserId: userId,
  });

  res.json({ message: 'Team unregistered successfully' });
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

  const updated = await prisma.tournamentMatch.update({
    where: { id: match.id },
    data: {
      courtId: court.id,
      scheduledAt: startAt,
      scheduledDurationMinutes: duration,
      location: typeof location === 'string' ? location : match.location,
    },
    include: {
      court: true,
      homeTeam: true,
      awayTeam: true,
    },
  });

  res.json(updated);
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

  await prisma.$transaction(async (tx) => {
    await tx.tournamentRegistrationWaitlist.delete({ where: { id: entry.id } });
    await tx.tournamentRegistrationWaitlist.updateMany({
      where: { tournamentId: id, position: { gt: entry.position } },
      data: { position: { decrement: 1 } },
    });
  });

  logger.info('Team promoted from registration waitlist', 'TournamentController', {
    tournamentId: id, teamId, userId,
  });

  res.json({ message: 'Team removed from registration waitlist (now registered)', teamId });
};

// ==================== SCORE DISPUTES (#3) ====================

export const createScoreDispute = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = req.user!.id;
  const { reason } = req.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new BadRequestError('Dispute reason is required');
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findUnique({ where: { id: matchId } }),
    'Match'
  );

  if (match.tournamentId !== id) {
    throw new NotFoundError('Match not found');
  }

  if (match.status !== MatchStatus.COMPLETED) {
    throw new BadRequestError('Can only dispute completed matches');
  }

  const myTeam = await prisma.tournamentTeam.findFirst({
    where: {
      id: { in: [match.homeTeamId, match.awayTeamId] },
      OR: [
        { captainUserId: userId },
        { players: { some: { userId } } },
      ],
    },
  });

  if (!myTeam) {
    throw new ForbiddenError('Only players of the involved teams can raise a dispute');
  }

  let dispute;
  try {
    dispute = await prisma.tournamentScoreDispute.create({
      data: {
        matchId,
        disputingTeamId: myTeam.id,
        reason: reason.trim(),
        status: 'open',
      },
      include: {
        disputingTeam: { select: { id: true, name: true } },
        match: { select: { id: true, homeScore: true, awayScore: true } },
      },
    });
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError('Your team has already raised a dispute for this match');
    }
    throw error;
  }

  try {
    await prisma.tournamentNotification.create({
      data: {
        userId: tournament.organizerId,
        tournamentId: id,
        type: TournamentNotificationType.score_disputed,
        params: { tournamentName: tournament.name, teamName: myTeam.name, matchId },
        metadata: { disputeId: dispute.id, reason: reason.trim() },
      },
    });
  } catch (disputeNotifError) {
    logger.error('Failed to create score dispute notification', 'TournamentController', { error: disputeNotifError });
  }

  logger.info('Score dispute created', 'TournamentController', {
    tournamentId: id, matchId, disputeId: dispute.id, userId,
  });

  res.status(201).json(dispute);
};

export const getMatchDisputes = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findUnique({ where: { id: matchId } }),
    'Match'
  );

  if (match.tournamentId !== id) {
    throw new NotFoundError('Match not found');
  }

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);

  // Organizers and admins see all disputes; players/captains of the involved teams
  // can see disputes for their own matches.
  if (!isOrgOrAdmin) {
    const isParticipant = await prisma.tournamentTeam.findFirst({
      where: {
        id: { in: [match.homeTeamId, match.awayTeamId] },
        OR: [
          { captainUserId: userId },
          { players: { some: { userId } } },
        ],
      },
      select: { id: true },
    });
    if (!isParticipant) {
      throw new ForbiddenError('Only organizers, admins, or players of the involved teams can view disputes');
    }
  }

  const disputes = await prisma.tournamentScoreDispute.findMany({
    where: { matchId, match: { tournamentId: id } },
    include: {
      disputingTeam: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(disputes);
};

export const resolveScoreDispute = async (req: Request, res: Response) => {
  const { id, disputeId } = req.params;
  const userId = req.user!.id;
  const { status, resolution, homeScore, awayScore, detailedScore } = req.body;

  if (!status || !['resolved', 'dismissed'].includes(status)) {
    throw new BadRequestError('status must be "resolved" or "dismissed"');
  }

  const includesScoreCorrection = homeScore !== undefined || awayScore !== undefined || detailedScore !== undefined;
  if (includesScoreCorrection && status !== 'resolved') {
    throw new BadRequestError('Score correction can only be applied when resolving a dispute');
  }
  if (includesScoreCorrection) {
    if (homeScore === undefined || awayScore === undefined) {
      throw new BadRequestError('Both homeScore and awayScore are required when applying a score correction');
    }
    if (homeScore < 0 || awayScore < 0) {
      throw new BadRequestError('Scores cannot be negative');
    }
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can resolve disputes');
  }

  const dispute = ensureResourceExists(
    await prisma.tournamentScoreDispute.findUnique({
      where: { id: disputeId },
      include: {
        match: {
          select: {
            id: true,
            tournamentId: true,
            status: true,
            homeScore: true,
            awayScore: true,
            stage: true,
            homeTeamId: true,
            awayTeamId: true,
            scheduledAt: true,
            startedAt: true,
            completedAt: true,
          },
        },
      },
    }),
    'Dispute'
  );

  if (dispute.match.tournamentId !== id) {
    throw new NotFoundError('Dispute not found');
  }

  if (dispute.status !== 'open') {
    throw new BadRequestError('This dispute has already been resolved');
  }

  const isEliminationFormat =
    tournament.format === TournamentFormat.SINGLE_ELIMINATION ||
    tournament.format === TournamentFormat.DOUBLE_ELIMINATION;
  const isKnockoutStage = dispute.match.stage != null && dispute.match.stage !== BracketStage.GROUP_STAGE;
  if (includesScoreCorrection && (isEliminationFormat || isKnockoutStage) && homeScore === awayScore) {
    throw new BadRequestError('Draws are not allowed in elimination matches');
  }

  if (includesScoreCorrection) {
    tournamentService.validateSportSpecificScore(
      tournament.sportConfig as unknown as Parameters<typeof tournamentService.validateSportSpecificScore>[0],
      detailedScore,
      homeScore,
      awayScore
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedDispute = await tx.tournamentScoreDispute.update({
      where: { id: disputeId },
      data: { status, resolution: resolution || null, resolvedById: userId },
      include: {
        disputingTeam: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    if (!includesScoreCorrection) {
      return { updatedDispute, correctedMatch: null };
    }

    if (
      dispute.match.status === MatchStatus.COMPLETED &&
      dispute.match.homeScore !== null &&
      dispute.match.awayScore !== null
    ) {
      await tournamentService.revertStandings(dispute.match.id, tx);
    }

    const correctedMatch = await tx.tournamentMatch.update({
      where: { id: dispute.match.id },
      data: {
        homeScore,
        awayScore,
        detailedScore: detailedScore || undefined,
        status: MatchStatus.COMPLETED,
        startedAt: dispute.match.startedAt ?? dispute.match.scheduledAt ?? new Date(),
        completedAt:
          dispute.match.completedAt ??
          dispute.match.startedAt ??
          dispute.match.scheduledAt ??
          new Date(),
      },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    });

    await tournamentService.updateStandings(dispute.match.id, tournament, tx);
    return { updatedDispute, correctedMatch };
  });

  if (
    result.correctedMatch?.stage &&
    result.correctedMatch.stage !== BracketStage.FINALS &&
    result.correctedMatch.stage !== BracketStage.THIRD_PLACE
  ) {
    await tournamentService.advanceWinners(id, result.correctedMatch.stage as BracketStage);
  }
  if (result.correctedMatch) {
    await notifyMatchResultToCaptains(tournament, result.correctedMatch);
    await maybeAutoGenerateGroupsKnockoutBrackets(id);
    await reconcileTournamentLifecycleStatus(id, 'resolve_dispute_score_correction');
  }

  logger.info('Score dispute resolved', 'TournamentController', {
    tournamentId: id,
    disputeId,
    status,
    userId,
    scoreCorrected: includesScoreCorrection,
  });

  res.json({
    ...result.updatedDispute,
    correctedMatch: result.correctedMatch ?? undefined,
  });
};

// ==================== ANNOUNCEMENTS (#7) ====================

export const createAnnouncement = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { title, body, isPinned } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new BadRequestError('Announcement title is required');
  }
  if (title.trim().length > MAX_NAME_LENGTH) {
    throw new BadRequestError(`Announcement title must be at most ${MAX_NAME_LENGTH} characters`);
  }
  if (!body || typeof body !== 'string' || !body.trim()) {
    throw new BadRequestError('Announcement body is required');
  }
  if (body.trim().length > MAX_DESCRIPTION_LENGTH) {
    throw new BadRequestError(`Announcement body must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can post announcements');
  }

  const announcement = await prisma.tournamentAnnouncement.create({
    data: {
      tournamentId: id,
      authorId: userId,
      title: title.trim(),
      body: body.trim(),
      isPinned: isPinned === true,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId: id, captainUserId: { not: null } },
    select: { captainUserId: true },
  });

  if (teams.length > 0) {
    await prisma.tournamentNotification.createMany({
      data: teams.map((t) => ({
        userId: t.captainUserId!,
        tournamentId: id,
        type: TournamentNotificationType.announcement,
        params: { tournamentName: tournament.name, announcementTitle: title.trim() },
        metadata: { announcementId: announcement.id },
      })),
      skipDuplicates: true,
    });
  }

  logger.info('Announcement created', 'TournamentController', {
    tournamentId: id, announcementId: announcement.id, userId,
  });

  res.status(201).json(announcement);
};

export const getAnnouncements = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { page, limit } = req.query;

  const parsedPage = Math.max(1, parseInt(page as string, 10) || 1);
  const parsedLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const skip = (parsedPage - 1) * parsedLimit;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id }, select: { id: true, organizerId: true, isPublic: true } }),
    'Tournament'
  );

  await assertCanViewTournament(tournament, userId);

  const [announcements, total] = await Promise.all([
    prisma.tournamentAnnouncement.findMany({
      where: { tournamentId: id },
      include: { author: { select: { id: true, name: true } } },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: parsedLimit,
    }),
    prisma.tournamentAnnouncement.count({ where: { tournamentId: id } }),
  ]);

  res.json({
    data: announcements,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  });
};

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

// ==================== TOURNAMENT CLONE (#14) ====================

export const cloneTournament = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const source = ensureResourceExists(
    await prisma.tournament.findUnique({
      where: { id },
      include: {
        categories: { orderBy: { sortOrder: 'asc' } },
        pools: {
          orderBy: { name: 'asc' },
          select: {
            name: true, description: true, maxTeams: true, venue: true,
            // We need the source pool id to re-link after we create cloned categories
            id: true,
            categoryId: true,
          },
        },
        registrationFields: { orderBy: { sortOrder: 'asc' } },
        courts: { where: { isActive: true }, orderBy: { name: 'asc' } },
      },
    }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(source, userId)) {
    throw new ForbiddenError('Only the organizer or a co-organizer can clone the tournament');
  }

  // Generate a unique clone name by appending "(Copy)" and, if a copy already
  // exists for this organizer, a numeric counter suffix.
  const baseName = `${source.name} (Copy)`;
  const existingCopies = await prisma.tournament.count({
    where: { organizerId: userId, name: { startsWith: baseName } },
  });
  const cloneName = existingCopies === 0 ? baseName : `${baseName} ${existingCopies + 1}`;

  // ── Run the whole clone inside a transaction ──────────────────────────────
  const cloned = await prisma.$transaction(async (tx) => {
    // 1. Core tournament row
    const newTournament = await tx.tournament.create({
      data: {
        name: cloneName,
        description: source.description ?? undefined,
        sportType: source.sportType,
        format: source.format,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endDate: undefined,
        maxTeams: source.maxTeams ?? undefined,
        location: source.location ?? undefined,
        latitude: source.latitude ?? undefined,
        longitude: source.longitude ?? undefined,
        locationName: source.locationName ?? undefined,
        city: source.city ?? undefined,
        country: source.country ?? undefined,
        organizerId: userId,
        groupId: source.groupId ?? undefined,
        isPublic: source.isPublic,
        allowLateRegistration: source.allowLateRegistration,
        autoGenerateBrackets: source.autoGenerateBrackets,
        useManualBrackets: source.useManualBrackets,
        prizesDescription: source.prizesDescription ?? undefined,
        rulesDescription: source.rulesDescription ?? undefined,
        contactEmail: source.contactEmail ?? undefined,
        sportConfig: source.sportConfig ?? undefined,
        registrationFee: source.registrationFee ?? undefined,
        requirePaymentForBrackets: source.requirePaymentForBrackets,
        paymentInfo: source.paymentInfo ?? undefined,
        requireWaiverForRegistration: source.requireWaiverForRegistration,
        waiverText: source.waiverText ?? undefined,
        tiebreakerRules: source.tiebreakerRules ?? undefined,
        selfRefEnabled: source.selfRefEnabled,
      },
      include: {
        organizer: { select: { id: true, name: true, email: true } },
      },
    });

    const newId = newTournament.id;

    // 2. Categories — build a mapping from old id → new id so pools can be linked
    const categoryIdMap = new Map<string, string>();
    for (const cat of source.categories) {
      const newCat = await tx.tournamentCategory.create({
        data: {
          tournamentId: newId,
          name: cat.name,
          description: cat.description ?? undefined,
          sortOrder: cat.sortOrder,
        },
      });
      categoryIdMap.set(cat.id, newCat.id);
    }

    // 3. Pools (structure only — no teams)
    for (const pool of source.pools) {
      await tx.tournamentPool.create({
        data: {
          tournamentId: newId,
          name: pool.name,
          description: pool.description ?? undefined,
          maxTeams: pool.maxTeams,
          venue: (pool as { venue?: string | null }).venue ?? undefined,
          categoryId: pool.categoryId ? categoryIdMap.get(pool.categoryId) ?? undefined : undefined,
        },
      });
    }

    // 4. Registration fields
    for (const field of source.registrationFields) {
      await tx.tournamentRegistrationField.create({
        data: {
          tournamentId: newId,
          label: field.label,
          fieldType: field.fieldType,
          isRequired: field.isRequired,
          options: field.options ?? [],
          sortOrder: field.sortOrder,
        },
      });
    }

    // 5. Courts (active courts only — no availability slots)
    for (const court of source.courts) {
      await tx.tournamentCourt.create({
        data: {
          tournamentId: newId,
          name: court.name,
          location: court.location ?? undefined,
          isActive: true,
        },
      });
    }

    return newTournament;
  });

  logger.info('Tournament cloned', 'TournamentController', {
    sourceTournamentId: id, clonedTournamentId: cloned.id, userId,
    categoriesCopied: source.categories.length,
    poolsCopied: source.pools.length,
    registrationFieldsCopied: source.registrationFields.length,
    courtsCopied: source.courts.length,
  });

  res.status(201).json(cloned);
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

  const updated = await prisma.tournamentTeam.update({
    where: { id: team.id },
    data: { checkedIn: true, checkedInAt: team.checkedInAt ?? new Date() },
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

  const updated = await prisma.$transaction(async (tx) => {
    const updatedMatch = await tx.tournamentMatch.update({
      where: { id: match.id },
      data: {
        status: MatchStatus.IN_PROGRESS,
        startedAt: match.startedAt ?? new Date(),
      },
    });

    if (canStartEarly) {
      await tx.tournament.update({
        where: { id },
        data: { status: TournamentStatus.IN_PROGRESS },
      });
    }

    return updatedMatch;
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
    : DEFAULT_INCIDENT_SLA_MINUTES) * 60_000;

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

  logger.info('Match incident resolved', 'TournamentController', { tournamentId: id, incidentId, status, userId });
  res.json(updated);
};

// ==================== PHASE 4: PUBLIC PORTAL ====================

/**
 * Generate (or regenerate) a public share token for a tournament.
 * Only the organizer/admin can do this.
 */
export const generateShareToken = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers/admins can generate a share token');
  }

  const shareToken = randomBytes(SHARE_TOKEN_BYTES).toString('hex');
  const updated = await prisma.tournament.update({
    where: { id },
    data: { shareToken },
    select: { id: true, name: true, shareToken: true },
  });

  logger.info('Share token generated', 'TournamentController', { tournamentId: id, userId });
  res.json(updated);
};

/**
 * Public tournament portal — returns full bracket + live match data.
 * No authentication required. Accepts either a tournament ID or a shareToken.
 */
export const getPublicTournamentPortal = async (req: Request, res: Response) => {
  const { shareToken } = req.params;

  const tournament = await prisma.tournament.findFirst({
    where: {
      OR: [
        { shareToken },
        { id: shareToken }, // allow direct ID for public tournaments
      ],
      isPublic: true,
    },
    include: {
      organizer: { select: { id: true, name: true } },
      courts: { where: { isActive: true }, select: { id: true, name: true, location: true } },
      announcements: {
        where: { isPinned: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, body: true, isPinned: true, createdAt: true },
      },
    },
  });

  if (!tournament) {
    throw new NotFoundError('Tournament not found or is not public');
  }

  const [teams, matches, standings] = await Promise.all([
    prisma.tournamentTeam.findMany({
      where: { tournamentId: tournament.id },
      select: { id: true, name: true, checkedIn: true, seedNumber: true, poolId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.tournamentMatch.findMany({
      where: { tournamentId: tournament.id },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        court: { select: { id: true, name: true } },
      },
      orderBy: [{ stage: 'asc' }, { roundNumber: 'asc' }, { matchOrder: 'asc' }],
    }),
    prisma.tournamentStanding.findMany({
      where: { tournamentId: tournament.id },
      include: { team: { select: { id: true, name: true } } },
      orderBy: [{ points: 'desc' }, { groupName: 'asc' }],
    }),
  ]);

  const sortedStandings = tournamentService.sortStandingsByTiebreakerRules(
    standings,
    tournament.tiebreakerRules as string[] | null
  );

  res.json({
    tournament,
    teams,
    matches,
    standings: sortedStandings,
    courts: tournament.courts,
    announcements: tournament.announcements,
  });
};

// ==================== PHASE 5: ORGANIZER ANALYTICS ====================

/**
 * Organizer analytics dashboard.
 * Returns registration funnel, match throughput, payment revenue, and incident SLA stats.
 */
export const getTournamentAnalytics = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers/admins can view analytics');
  }

  const [teams, matches, disputes, incidents, paymentTxns] = await Promise.all([
    prisma.tournamentTeam.findMany({
      where: { tournamentId: id },
      select: { checkedIn: true, paymentStatus: true, waiverAcceptedAt: true },
    }),
    prisma.tournamentMatch.findMany({
      where: { tournamentId: id },
      select: { status: true, scheduledAt: true, startedAt: true, completedAt: true, scheduledDurationMinutes: true },
    }),
    prisma.tournamentScoreDispute.findMany({
      where: { match: { tournamentId: id } },
      select: { status: true },
    }),
    prisma.tournamentMatchIncident.findMany({
      where: { tournamentId: id },
      select: { status: true, slaDeadline: true },
    }),
    prisma.tournamentPaymentTransaction.findMany({
      where: { tournamentId: id },
      select: { status: true, amount: true },
    }),
  ]);

  // Registration funnel
  const totalTeams = teams.length;
  const checkedIn = teams.filter((t) => t.checkedIn).length;
  const waiverAccepted = teams.filter((t) => t.waiverAcceptedAt !== null).length;
  const paid = teams.filter((t) => t.paymentStatus === 'paid').length;
  const unpaid = teams.filter((t) => t.paymentStatus === 'unpaid').length;
  const pending = teams.filter((t) => t.paymentStatus === 'pending').length;
  const waived = teams.filter((t) => t.paymentStatus === 'waived').length;
  const noShows = teams.filter((t) => !t.checkedIn).length;

  // Match throughput
  const LATE_START_THRESHOLD_MS = 10 * 60 * 1000;
  const completedMatches = matches.filter((m) => m.status === MatchStatus.COMPLETED && m.startedAt && m.completedAt);
  const lateStarts = matches.filter(
    (m) =>
      m.scheduledAt &&
      m.startedAt &&
      new Date(m.startedAt).getTime() - new Date(m.scheduledAt).getTime() > LATE_START_THRESHOLD_MS
  ).length;
  const avgDurationMinutes =
    completedMatches.length > 0
      ? Math.round(
          completedMatches.reduce((sum, m) => {
            const dur =
              (new Date(m.completedAt!).getTime() - new Date(m.startedAt!).getTime()) / 60_000;
            return sum + dur;
          }, 0) / completedMatches.length
        )
      : null;

  // Payments
  const paidTxns = paymentTxns.filter((p) => p.status === 'paid');
  const refundedTxns = paymentTxns.filter((p) => p.status === 'refunded');
  const totalRevenue = paidTxns.reduce((s, p) => s + p.amount, 0);

  // Incident SLA
  const now = new Date();
  const openIncidents = incidents.filter((i) => i.status === 'open');
  const pastSla = openIncidents.filter((i) => i.slaDeadline && new Date(i.slaDeadline) < now).length;

  res.json({
    registration: {
      totalTeams,
      checkedIn,
      noShows,
      paid,
      unpaid,
      pending,
      waived,
      waiverAccepted,
    },
    matches: {
      total: matches.length,
      scheduled: matches.filter((m) => m.status === MatchStatus.SCHEDULED).length,
      inProgress: matches.filter((m) => m.status === MatchStatus.IN_PROGRESS).length,
      completed: completedMatches.length,
      cancelled: matches.filter((m) => m.status === MatchStatus.CANCELLED).length,
      lateStarts,
      avgDurationMinutes,
    },
    disputes: {
      total: disputes.length,
      open: disputes.filter((d) => d.status === 'open').length,
      resolved: disputes.filter((d) => d.status === 'resolved').length,
      dismissed: disputes.filter((d) => d.status === 'dismissed').length,
    },
    incidents: {
      total: incidents.length,
      open: openIncidents.length,
      resolved: incidents.filter((i) => i.status === 'resolved').length,
      pastSla,
    },
    payments: {
      totalRevenue,
      transactionsPaid: paidTxns.length,
      transactionsRefunded: refundedTxns.length,
    },
  });
};
