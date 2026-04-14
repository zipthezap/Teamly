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
import prisma from '../config/database';
import { logger } from '../utils/logger';
import * as tournamentService from '../services/tournamentService';
import { 
  TournamentFormat, 
  TournamentStatus, 
  MatchStatus,
  BracketStage,
  SportScoringConfig,
  VolleyballConfig
} from '../../shared/types/tournament.types';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { isRequired, parseCoordinates } from '../utils/validation';
import { ensureResourceExists } from '../utils/controllerHelpers';
import { isPrismaUniqueError } from '../utils/typeGuards';

// ==================== CONSTANTS ====================

const TOURNAMENT_VALID_STATUSES = ['draft', 'registration', 'in_progress', 'completed', 'cancelled'] as const;
const INVITATION_EXPIRY_DAYS = 7;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_POOL_NAME_LENGTH = 100;
const MAX_PLAYER_NAME_LENGTH = 100;
const MAX_TEAMS_UPPER_BOUND = 1000;

const syncTournamentAutoStatus = async <T extends {
  id: string;
  status: string;
  startDate: Date;
  endDate?: Date | null;
  registrationStartDate?: Date | null;
  registrationDeadline?: Date | null;
}>(tournament: T): Promise<T> => {
  const nextStatus = tournamentService.computeAutoStatus(tournament);
  if (!nextStatus || nextStatus === tournament.status) {
    return tournament;
  }

  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { status: nextStatus as TournamentStatus },
  });

  return { ...tournament, status: nextStatus };
};

// Re-export for use in tests
export { INVITATION_EXPIRY_DAYS };

// ==================== TOURNAMENT CRUD OPERATIONS ====================

/**
 * Create a new tournament
 */
export const createTournament = async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
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
    recurrenceRule
  } = req.body;

  const userId = req.user!.id;

  // Validate required fields
  isRequired(name, 'Name');
  isRequired(sportType, 'Sport type');
  isRequired(format, 'Format');
  isRequired(startDate, 'Start date');

  tournamentService.validateTournamentEnums({ sportType, format });

  // Sanitize inputs
  const sanitized = tournamentService.sanitizeTournamentData({
    name,
    description,
    location,
    locationName,
    prizesDescription,
    rulesDescription
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

  // Parse coordinates once if provided
  const coordinates = latitude && longitude ? parseCoordinates(latitude, longitude) : null;

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
      city,
      country,
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
      recurrenceRule: recurrenceRule || undefined
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
  const { groupId, status, sportType, page, limit } = req.query;

  const parsedPage = Math.max(1, parseInt(page as string, 10) || 1);
  const parsedLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const skip = (parsedPage - 1) * parsedLimit;

  const where: Record<string, unknown> = {};

  if (groupId) {
    where.groupId = groupId as string;
  }

  if (status) {
    where.status = status as TournamentStatus;
  }

  if (sportType) {
    where.sportType = sportType as string;
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
    tournaments.map((tournament) => syncTournamentAutoStatus(tournament))
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
          awayTeam: true
        },
        orderBy: [
          { stage: 'asc' },
          { roundNumber: 'asc' },
          { scheduledAt: 'asc' }
        ]
      },
      standings: {
        include: {
          team: true
        },
        orderBy: [
          { points: 'desc' },
          { goalsFor: 'desc' }
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

  const syncedTournament = await syncTournamentAutoStatus(tournament!);

  res.json(syncedTournament);
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
    sportConfig
  } = req.body;

  let tournament = await prisma.tournament.findUnique({
    where: { id }
  });

  ensureResourceExists(tournament, 'Tournament');

  tournament = await syncTournamentAutoStatus(tournament!);

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament!, userId);
  if (!isOrgOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can update the tournament');
  }

  if (tournament!.status === TournamentStatus.COMPLETED) {
    throw new BadRequestError('Completed tournaments cannot be edited');
  }

  if (status !== undefined) {
    throw new BadRequestError('Tournament status cannot be updated via this endpoint. Use PUT /tournaments/:id/status');
  }

  tournamentService.validateTournamentEnums({ sportType, format });

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

  if (city !== undefined) updateData.city = city;
  if (country !== undefined) updateData.country = country;
  
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
    updateData.contactEmail = contactEmail || null;
  }
  if (sportConfig !== undefined) {
    updateData.sportConfig = sportConfig || null;
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

  logger.info('Tournament updated', 'TournamentController', {
    tournamentId: id,
    userId
  });

  res.json(updatedTournament);
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

// ==================== TEAM MANAGEMENT ====================

/**
 * Add a team to a tournament
 */
export const addTeam = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { name, captainName, captainEmail, captainUserId, poolNumber, poolName, seedNumber } = req.body;

  isRequired(name, 'Team name');

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      teams: true
    }
  });

  ensureResourceExists(tournament, 'Tournament');

  tournamentService.validateRegistrationEligibility(tournament!);

  // Check max teams limit
  if (tournament!.maxTeams && tournament!.teams.length >= tournament!.maxTeams) {
    throw new BadRequestError('Tournament has reached maximum number of teams');
  }

  const team = await prisma.tournamentTeam.create({
    data: {
      name,
      captainName,
      captainEmail,
      captainUserId: captainUserId || undefined,
      tournamentId: id,
      poolNumber: poolNumber || undefined,
      poolName: poolName || undefined,
      seedNumber: seedNumber || undefined
    },
    include: {
      captainUser: {
        select: { id: true, name: true, email: true }
      }
    }
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
          type: 'team_registered',
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
  const { name, captainName, captainEmail, captainUserId, poolNumber, poolName, seedNumber } = req.body;

  const tournament = await prisma.tournament.findUnique({
    where: { id }
  });

  ensureResourceExists(tournament, 'Tournament');

  const team = await prisma.tournamentTeam.findUnique({
    where: { id: teamId }
  });

  ensureResourceExists(team, 'Team');

  // Check permissions
  const isOrg = tournamentService.isOrganizer(tournament!, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

  if (!isOrg && !isCaptain) {
    throw new ForbiddenError('Only the organizer or team captain can update the team');
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (captainName !== undefined) updateData.captainName = captainName;
  if (captainEmail !== undefined) updateData.captainEmail = captainEmail;
  if (captainUserId !== undefined) updateData.captainUserId = captainUserId || null;
  // Only organizer can change pool assignments
  if (isOrg) {
    if (poolNumber !== undefined) updateData.poolNumber = poolNumber || null;
    if (poolName !== undefined) updateData.poolName = poolName || null;
    if (seedNumber !== undefined) updateData.seedNumber = seedNumber || null;
  }

  const updatedTeam = await prisma.tournamentTeam.update({
    where: { id: teamId },
    data: updateData,
    include: {
      captainUser: {
        select: { id: true, name: true, email: true }
      }
    }
  });

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

  // Check if tournament has started
  if (tournament!.status !== TournamentStatus.DRAFT && tournament!.status !== TournamentStatus.REGISTRATION) {
    throw new BadRequestError('Cannot delete teams once tournament has started');
  }

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

// ==================== BRACKET & MATCH MANAGEMENT ====================

/**
 * Generate tournament brackets
 */
export const generateBrackets = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { numberOfGroups } = req.body;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can generate brackets');
  }

  // Check if brackets already exist
  const existingMatches = await prisma.tournamentMatch.count({
    where: { tournamentId: id }
  });

  if (existingMatches > 0) {
    throw new BadRequestError('Brackets have already been generated for this tournament');
  }

  let result;
  switch (String(tournament.format)) {
    case TournamentFormat.SINGLE_ELIMINATION:
    case TournamentFormat.DOUBLE_ELIMINATION:
      result = await tournamentService.generateSingleEliminationBrackets(id);
      break;
    case TournamentFormat.ROUND_ROBIN:
      result = await tournamentService.generateRoundRobinBrackets(id);
      break;
    case TournamentFormat.GROUPS_KNOCKOUT:
      result = await tournamentService.generateGroupsKnockoutBrackets(
        id,
        numberOfGroups || 4
      );
      break;
    case 'pool':
      result = await tournamentService.generateRoundRobinBrackets(id);
      break;
    default:
      throw new BadRequestError('Invalid tournament format');
  }

  // Update tournament status to in_progress
  await prisma.tournament.update({
    where: { id },
    data: { status: TournamentStatus.IN_PROGRESS }
  });

  logger.info('Brackets generated', 'TournamentController', {
    tournamentId: id,
    userId,
    format: tournament.format
  });

  res.json({
    message: 'Brackets generated successfully',
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

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findUnique({ where: { id: matchId } }),
    'Match'
  );

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
  const sportConfig = tournament.sportConfig as unknown as SportScoringConfig | undefined;
  if (sportConfig && detailedScore) {
    if (sportConfig.type === 'volleyball') {
      const result = tournamentService.calculateVolleyballWinner(detailedScore, sportConfig as VolleyballConfig);
      if (!result.isValid) {
        throw new BadRequestError(result.error!);
      }
      // The homeScore and awayScore should match the set wins
      if (homeScore !== result.homeWins || awayScore !== result.awayWins) {
        throw new BadRequestError(`Score mismatch: Based on sets, score should be ${result.homeWins}-${result.awayWins}`);
      }
    }
  }

  // Use a transaction to ensure atomic update of match and standings
  const updatedMatch = await prisma.$transaction(async (tx) => {
    // Update match with score - the WHERE clause will prevent concurrent updates
    const match = await tx.tournamentMatch.update({
      where: { 
        id: matchId,
        // Ensure we only update if status is not already COMPLETED
        status: { not: MatchStatus.COMPLETED }
      },
      data: {
        homeScore,
        awayScore,
        detailedScore: detailedScore || undefined,
        status: MatchStatus.COMPLETED,
        completedAt: new Date()
      },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });

    // Update standings within the same transaction
    await tournamentService.updateStandings(matchId, tournament, tx);

    return match;
  });

  // If this is a knockout stage match, check if we should advance winners
  if (match.stage && match.stage !== BracketStage.FINALS) {
    await tournamentService.advanceWinners(id, match.stage as BracketStage);
  }

  logger.info('Match score submitted', 'TournamentController', {
    tournamentId: id,
    matchId,
    userId
  });

  res.json(updatedMatch);
};

/**
 * Get tournament standings
 */
export const getStandings = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { groupName } = req.query;

  const where: Record<string, unknown> = { tournamentId: id };
  if (groupName) {
    where.groupName = groupName as string;
  }

  const standings = await prisma.tournamentStanding.findMany({
    where,
    include: {
      team: true
    },
    orderBy: [
      { points: 'desc' },
      { goalsFor: 'desc' },
      { goalsAgainst: 'asc' }
    ]
  });

  res.json(standings);
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
    matchOrder
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
    status
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
  if (status !== undefined) updateData.status = status;

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

  // Don't allow deleting completed matches with scores
  if (match.status === MatchStatus.COMPLETED && (match.homeScore !== null || match.awayScore !== null)) {
    throw new BadRequestError('Cannot delete completed matches with scores. Please remove scores first.');
  }

  await prisma.tournamentMatch.delete({
    where: { id: matchId }
  });

  logger.info('Match deleted', 'TournamentController', {
    tournamentId: id,
    matchId,
    userId
  });

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

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findUnique({ where: { id: matchId } }),
    'Match'
  );

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

  if (!tournamentService.isOrganizer(tournament, userId)) {
    throw new ForbiddenError('Only the organizer can assign teams to pools');
  }

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
  const { playerName, playerEmail, userId: playerId } = req.body;

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

  await ensureResourceExists(
    await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id }
    }),
    'Team'
  );

  // Check permissions - only organizer or team captain can add players
  const isOrg = tournamentService.isOrganizer(tournament, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

  if (!isOrg && !isCaptain) {
    throw new ForbiddenError('Only the organizer or team captain can add players');
  }

  // If userId is provided, verify the user exists
  if (playerId) {
    const user = await prisma.user.findUnique({
      where: { id: playerId }
    });
    if (!user) {
      throw new BadRequestError('User not found');
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
        playerEmail
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
    where: { id: teamId, tournamentId: id }
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

  res.json(players);
};

/**
 * Update a player (captain only)
 */
export const updatePlayer = async (req: Request, res: Response) => {
  const { id, teamId, playerId } = req.params;
  const userId = req.user!.id;
  const { playerName, playerEmail, userId: newUserId } = req.body;

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
  const isOrg = tournamentService.isOrganizer(tournament, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

  if (!isOrg && !isCaptain) {
    throw new ForbiddenError('Only the organizer or team captain can update players');
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
  const isOrg = tournamentService.isOrganizer(tournament, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

  if (!isOrg && !isCaptain) {
    throw new ForbiddenError('Only the organizer or team captain can remove players');
  }

  await prisma.tournamentPlayer.delete({
    where: { id: playerId }
  });

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
  const { page, limit } = req.query;

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
  const { name, description, maxTeams } = req.body;

  if (!name || !maxTeams) {
    throw new BadRequestError('Pool name and max teams are required');
  }

  if (name.trim().length > MAX_POOL_NAME_LENGTH) {
    throw new BadRequestError(`Pool name must be at most ${MAX_POOL_NAME_LENGTH} characters`);
  }

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

  let pool;
  try {
    pool = await prisma.tournamentPool.create({
      data: {
        name,
        description,
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
  const { name, description, maxTeams } = req.body;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can update pools');
  }

  ensureResourceExists(
    await prisma.tournamentPool.findFirst({ where: { id: poolId, tournamentId: id } }),
    'Pool'
  );

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) {
    if (name.trim().length > MAX_POOL_NAME_LENGTH) {
      throw new BadRequestError(`Pool name must be at most ${MAX_POOL_NAME_LENGTH} characters`);
    }
    updateData.name = name;
  }
  if (description !== undefined) updateData.description = description || null;
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
 * Register a team to a pool (team captain only)
 */
export const registerTeamToPool = async (req: Request, res: Response) => {
  const { id, poolId, teamId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  tournamentService.validateRegistrationEligibility(tournament);

  const team = ensureResourceExists(
    await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id }
    }),
    'Team'
  );

  // Check permissions - must be organizer or team captain
  const isOrg = tournamentService.isOrganizer(tournament, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

  if (!isOrg && !isCaptain) {
    throw new ForbiddenError('Only the organizer or team captain can register teams to pools');
  }

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
 * Remove a team from a pool (organizer or team captain)
 * This will automatically promote the first team from the waitlist
 */
export const removeTeamFromPool = async (req: Request, res: Response) => {
  const { id, poolId, teamId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const team = ensureResourceExists(
    await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id, poolId }
    }),
    'Team not found in this pool'
  );

  // Check permissions
  const isOrg = tournamentService.isOrganizer(tournament, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

  if (!isOrg && !isCaptain) {
    throw new ForbiddenError('Only the organizer or team captain can remove teams from pools');
  }

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

    // Check for waitlist and promote first team
    const firstWaitlistEntry = await tx.tournamentPoolWaitlist.findFirst({
      where: { poolId },
      orderBy: { position: 'asc' },
      include: { team: true }
    });

    if (!firstWaitlistEntry) {
      return null;
    }

    const pool = await tx.tournamentPool.findUnique({
      where: { id: poolId },
      include: { teams: true }
    });

    if (!pool) {
      return null;
    }

    const registrationOrder = pool.teams.length + 1;

    await tx.tournamentTeam.update({
      where: { id: firstWaitlistEntry.teamId },
      data: {
        poolId,
        poolName: pool.name,
        registrationOrder
      }
    });

    await tx.tournamentPoolWaitlist.delete({
      where: { id: firstWaitlistEntry.id }
    });

    // Reorder remaining waitlist entries
    const remainingEntries = await tx.tournamentPoolWaitlist.findMany({
      where: { poolId, position: { gt: firstWaitlistEntry.position } }
    });

    await Promise.all(
      remainingEntries.map(entry =>
        tx.tournamentPoolWaitlist.update({
          where: { id: entry.id },
          data: { position: entry.position - 1 }
        })
      )
    );

    return firstWaitlistEntry.team;
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

  // Suppress unused variable warning
  void team;
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

  // Check permissions
  const isOrg = tournamentService.isOrganizer(tournament, userId);
  const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

  if (!isOrg && !isCaptain) {
    throw new ForbiddenError('Only the organizer or team captain can remove teams from waitlist');
  }

  const waitlistEntry = ensureResourceExists(
    await prisma.tournamentPoolWaitlist.findFirst({ where: { poolId, teamId } }),
    'Team not found in waitlist'
  );

  // Remove from waitlist and reorder remaining entries atomically
  await prisma.$transaction(async (tx) => {
    await tx.tournamentPoolWaitlist.delete({
      where: { id: waitlistEntry.id }
    });

    const remainingEntries = await tx.tournamentPoolWaitlist.findMany({
      where: { poolId, position: { gt: waitlistEntry.position } }
    });

    await Promise.all(
      remainingEntries.map(entry =>
        tx.tournamentPoolWaitlist.update({
          where: { id: entry.id },
          data: { position: entry.position - 1 }
        })
      )
    );
  });

  logger.info('Team removed from waitlist', 'TournamentController', {
    tournamentId: id,
    poolId,
    teamId,
    userId
  });

  res.json({ message: 'Team removed from waitlist successfully' });
};



// ==================== TEAM INVITATION MANAGEMENT ====================

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
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(inviteeEmail)) {
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
  const existingPlayer = await prisma.tournamentPlayer.findFirst({
    where: {
      teamId,
      OR: [
        { playerEmail: inviteeEmail },
        { user: { email: inviteeEmail } }
      ]
    }
  });

  if (existingPlayer) {
    throw new BadRequestError('This user is already a player on this team');
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
    const inviteUrl = `${process.env.FRONTEND_URL}/tournaments/${id}/teams/${teamId}/invitations/${invitation.inviteToken}/accept`;
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

  // Check permissions
  const canManage = await tournamentService.canManageTeamInvitations(teamId, id, userId);
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
  const { name, poolId, categoryId } = req.body;

  isRequired(name, 'Team name');
  if (typeof name === 'string' && name.trim().length > MAX_NAME_LENGTH) {
    throw new BadRequestError(`Team name must be at most ${MAX_NAME_LENGTH} characters`);
  }

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  tournamentService.validateRegistrationEligibility(tournament!);

  if (tournament!.maxTeams) {
    const teamCount = await prisma.tournamentTeam.count({
      where: { tournamentId: id },
    });
    if (teamCount >= tournament!.maxTeams) {
      throw new BadRequestError('Tournament has reached maximum number of teams');
    }
  }

  if (poolId && categoryId) {
    throw new BadRequestError('Select either a category or a pool, not both');
  }

  let selectedCategoryName: string | null = null;
  if (categoryId) {
    const category = await prisma.tournamentCategory.findFirst({
      where: { id: categoryId, tournamentId: id },
      select: { id: true, name: true }
    });
    if (!category) {
      throw new NotFoundError('Category not found');
    }
    selectedCategoryName = category.name;
  }

  try {
    const team = await prisma.$transaction(async (tx) => {
      const existingTeam = await tx.tournamentTeam.findFirst({
        where: { tournamentId: id, captainUserId: userId },
        select: { id: true }
      });
      if (existingTeam) {
        throw new BadRequestError('You already have a registered team in this tournament');
      }

      return tx.tournamentTeam.create({
        data: {
          name: name.trim(),
          tournamentId: id,
          captainUserId: userId,
          ...(selectedCategoryName != null ? { poolName: selectedCategoryName } : {})
        },
        include: {
          captainUser: { select: { id: true, name: true, email: true } }
        }
      });
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

        if (!pool) return null;

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

      if (poolResult) {
        return res.status(201).json({ team, pool: poolResult.pool, onWaitlist: poolResult.onWaitlist, ...(poolResult.waitlistEntry ? { waitlistEntry: poolResult.waitlistEntry } : {}) });
      }
    }

    res.status(201).json({
      team,
      onWaitlist: false,
      ...(categoryId ? { categoryId, categoryName: selectedCategoryName } : {})
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

  tournamentService.validateRegistrationEligibility(tournament!);

  const existingTeams = await prisma.tournamentTeam.findMany({
    where: { tournamentId: id, captainUserId: userId },
    select: { id: true, name: true }
  });

  if (existingTeams.length === 0) {
    throw new BadRequestError('You do not have a registered team to unregister');
  }

  const teamIds = existingTeams.map(team => team.id);
  await prisma.tournamentTeam.deleteMany({
    where: { id: { in: teamIds } }
  });

  logger.info('Team self-unregistered', 'TournamentController', {
    tournamentId: id,
    teamIds,
    removedTeamCount: existingTeams.length,
    captainUserId: userId,
  });

  res.json({ message: 'Team unregistered successfully' });
};

// ==================== STATUS MANAGEMENT ====================

export const updateTournamentStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { status } = req.body;

  if (!status || !TOURNAMENT_VALID_STATUSES.includes(status as typeof TOURNAMENT_VALID_STATUSES[number])) {
    throw new BadRequestError(`Invalid status. Must be one of: ${TOURNAMENT_VALID_STATUSES.join(', ')}`);
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);
  if (!isOrgOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can change tournament status');
  }

  const transitions: Record<string, string[]> = {
    draft: ['registration', 'cancelled'],
    registration: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };

  const current = tournament.status;
  const allowed = transitions[current] ?? [];
  if (!allowed.includes(status)) {
    throw new BadRequestError(
      `Cannot transition from '${current}' to '${status}'. Allowed: ${allowed.length ? allowed.join(', ') : 'none'}`
    );
  }

  // Enforce pre-conditions for each transition
  if (status === 'in_progress') {
    // registration → in_progress: require at least 2 registered teams
    const teamCount = await prisma.tournamentTeam.count({ where: { tournamentId: id } });
    if (teamCount < 2) {
      throw new BadRequestError('Cannot start tournament: at least 2 teams must be registered');
    }
  }

  const updated = await prisma.tournament.update({
    where: { id },
    data: { status },
    include: {
      organizer: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true } },
    },
  });

  // On cancellation, notify all registered teams via tournament notifications
  if (status === 'cancelled') {
    try {
      const teams = await prisma.tournamentTeam.findMany({
        where: { tournamentId: id },
        include: { captainUser: { select: { id: true } } }
      });

      await Promise.all(
        teams
          .filter(team => team.captainUserId)
          .map(team =>
            prisma.tournamentNotification.create({
              data: {
                userId: team.captainUserId!,
                tournamentId: id,
                type: 'tournament_cancelled',
                params: { tournamentName: tournament.name },
                metadata: { cancelledBy: userId }
              }
            })
          )
      );
    } catch (notifError) {
      logger.error('Failed to send cancellation notifications', 'TournamentController', {
        tournamentId: id,
        error: notifError
      });
      // Non-fatal: status update already succeeded
    }
  }

  logger.info('Tournament status updated', 'TournamentController', {
    tournamentId: id,
    from: current,
    to: status,
    userId,
  });

  res.json(updated);
};

// ==================== PUBLIC DISCOVERY ====================

export const getPublicTournaments = async (req: Request, res: Response) => {
  const { sportType, status, page, limit } = req.query;

  const parsedPage = Math.max(1, parseInt(page as string, 10) || 1);
  const parsedLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const skip = (parsedPage - 1) * parsedLimit;

  const where: Record<string, unknown> = { isPublic: true };
  if (sportType) where.sportType = sportType;
  if (status) where.status = status;

  const [tournaments, total] = await Promise.all([
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

  const syncedTournaments = await Promise.all(
    tournaments.map((tournament) => syncTournamentAutoStatus(tournament))
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
