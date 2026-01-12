import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import * as tournamentService from '../services/tournamentService';
import { 
  TournamentFormat, 
  TournamentStatus, 
  MatchStatus,
  BracketStage 
} from '../../shared/types/tournament.types';
import * as locationService from '../services/locationService';

/**
 * Create a new tournament
 */
export const createTournament = async (req: Request, res: Response) => {
  try {
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
      isPublic,
      allowLateRegistration,
      autoGenerateBrackets,
      useManualBrackets,
      prizesDescription,
      rulesDescription,
      contactEmail,
      // Recurring tournament
      isRecurring,
      recurrenceRule
    } = req.body;

    const userId = (req.user as any).id;

    if (!name || !sportType || !format || !startDate) {
      return res.status(400).json({
        error: 'Name, sport type, format, and start date are required'
      });
    }

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
      return res.status(400).json({
        error: 'Name cannot be empty or whitespace-only'
      });
    }

    // Validate dates
    const dateValidation = tournamentService.validateTournamentDates(startDate, endDate);
    if (!dateValidation.valid) {
      return res.status(400).json({ error: dateValidation.error });
    }

    // Validate registration deadline if provided
    if (registrationDeadline) {
      const regDate = new Date(registrationDeadline);
      const startDateObj = new Date(startDate);
      if (regDate > startDateObj) {
        return res.status(400).json({
          error: 'Registration deadline must be before the start date'
        });
      }
    }

    // Validate coordinates if provided
    if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
      const coordValidation = locationService.validateCoordinates(
        parseFloat(latitude),
        parseFloat(longitude)
      );
      if (!coordValidation.valid) {
        return res.status(400).json({ error: coordValidation.error });
      }
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
        return res.status(403).json({
          error: 'Only group admins can create tournaments for the group'
        });
      }
    }

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
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        locationName: sanitized.locationName || undefined,
        city,
        country,
        organizerId: userId,
        groupId: groupId || undefined,
        // Admin controls
        registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : undefined,
        isPublic: isPublic !== undefined ? isPublic : true,
        allowLateRegistration: allowLateRegistration || false,
        autoGenerateBrackets: autoGenerateBrackets || false,
        useManualBrackets: useManualBrackets || false,
        prizesDescription: sanitized.prizesDescription || undefined,
        rulesDescription: sanitized.rulesDescription || undefined,
        contactEmail: contactEmail || undefined,
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
  } catch (error) {
    logger.error('Error creating tournament', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to create tournament' });
  }
};

/**
 * Get all tournaments (with optional filters)
 */
export const getTournaments = async (req: Request, res: Response) => {
  try {
    const { groupId, status, sportType } = req.query;

    const where: any = {};

    if (groupId) {
      where.groupId = groupId as string;
    }

    if (status) {
      where.status = status as TournamentStatus;
    }

    if (sportType) {
      where.sportType = sportType as string;
    }

    const tournaments = await prisma.tournament.findMany({
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
      orderBy: { startDate: 'desc' }
    });

    res.json(tournaments);
  } catch (error) {
    logger.error('Error fetching tournaments', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
};

/**
 * Get a single tournament by ID
 */
export const getTournament = async (req: Request, res: Response) => {
  try {
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
        }
      }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    res.json(tournament);
  } catch (error) {
    logger.error('Error fetching tournament', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to fetch tournament' });
  }
};

/**
 * Update a tournament
 */
export const updateTournament = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any).id;
    const { 
      name, description, status, startDate, endDate, maxTeams, 
      location, locationName, city, country, latitude, longitude,
      // Admin controls
      registrationDeadline, isPublic, allowLateRegistration,
      autoGenerateBrackets, useManualBrackets, prizesDescription, rulesDescription, contactEmail
    } = req.body;

    // Middleware already checked permissions, so no need to check again
    const updateData: any = {};

    if (name !== undefined) {
      const sanitized = tournamentService.sanitizeTournamentData({ name });
      if (!sanitized.name) {
        return res.status(400).json({
          error: 'Name cannot be empty or whitespace-only'
        });
      }
      updateData.name = sanitized.name;
    }

    if (description !== undefined) {
      const sanitized = tournamentService.sanitizeTournamentData({ description });
      updateData.description = sanitized.description || null;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    if (startDate !== undefined) {
      updateData.startDate = new Date(startDate);
    }

    if (endDate !== undefined) {
      updateData.endDate = endDate ? new Date(endDate) : null;
    }

    if (maxTeams !== undefined) {
      updateData.maxTeams = maxTeams;
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
      const coordValidation = locationService.validateCoordinates(
        parseFloat(latitude),
        parseFloat(longitude)
      );
      if (!coordValidation.valid) {
        return res.status(400).json({ error: coordValidation.error });
      }
      updateData.latitude = parseFloat(latitude);
      updateData.longitude = parseFloat(longitude);
    }

    // Admin controls
    if (registrationDeadline !== undefined) {
      updateData.registrationDeadline = registrationDeadline ? new Date(registrationDeadline) : null;
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
  } catch (error) {
    logger.error('Error updating tournament', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to update tournament' });
  }
};

/**
 * Delete a tournament
 */
export const deleteTournament = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any).id;

    // Middleware already checked permissions
    await prisma.tournament.delete({
      where: { id }
    });

    logger.info('Tournament deleted', 'TournamentController', {
      tournamentId: id,
      userId
    });

    res.json({ message: 'Tournament deleted successfully' });
  } catch (error) {
    logger.error('Error deleting tournament', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to delete tournament' });
  }
};

/**
 * Add a team to a tournament
 */
export const addTeam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any).id;
    const { name, captainName, captainEmail, captainUserId, poolNumber, poolName, seedNumber } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        teams: true
      }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Check if tournament is still in registration or draft status
    if (tournament.status !== TournamentStatus.DRAFT && tournament.status !== TournamentStatus.REGISTRATION) {
      return res.status(400).json({
        error: 'Cannot add teams once tournament has started'
      });
    }

    // Check max teams limit
    if (tournament.maxTeams && tournament.teams.length >= tournament.maxTeams) {
      return res.status(400).json({
        error: 'Tournament has reached maximum number of teams'
      });
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
    });

    logger.info('Team added to tournament', 'TournamentController', {
      tournamentId: id,
      teamId: team.id,
      userId
    });

    res.status(201).json(team);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        error: 'A team with this name already exists in the tournament'
      });
    }
    logger.error('Error adding team', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to add team' });
  }
};

/**
 * Update a team
 */
export const updateTeam = async (req: Request, res: Response) => {
  try {
    const { id, teamId } = req.params;
    const userId = (req.user as any).id;
    const { name, captainName, captainEmail, captainUserId, poolNumber, poolName, seedNumber } = req.body;

    // Middleware already checked permissions
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: { organizerId: true, groupId: true }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const team = await prisma.tournamentTeam.findUnique({
      where: { id: teamId }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if user is organizer or group admin for pool assignments
    const isOrg = tournamentService.isOrganizer(tournament, userId);
    let isGroupAdmin = false;
    if (tournament.groupId) {
      const groupMember = await prisma.groupMember.findUnique({
        where: {
          userId_groupId: {
            userId,
            groupId: tournament.groupId
          }
        }
      });
      isGroupAdmin = groupMember?.role === 'admin';
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (captainName !== undefined) updateData.captainName = captainName;
    if (captainEmail !== undefined) updateData.captainEmail = captainEmail;
    if (captainUserId !== undefined) updateData.captainUserId = captainUserId || null;
    
    // Only organizer or group admin can change pool assignments
    if (isOrg || isGroupAdmin) {
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
  } catch (error) {
    logger.error('Error updating team', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to update team' });
  }
};

/**
 * Delete a team
 */
export const deleteTeam = async (req: Request, res: Response) => {
  try {
    const { id, teamId } = req.params;
    const userId = (req.user as any).id;

    // Middleware already checked permissions
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: { status: true }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Check if tournament has started
    if (tournament.status !== TournamentStatus.DRAFT && tournament.status !== TournamentStatus.REGISTRATION) {
      return res.status(400).json({
        error: 'Cannot delete teams once tournament has started'
      });
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
  } catch (error) {
    logger.error('Error deleting team', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to delete team' });
  }
};

/**
 * Generate tournament brackets
 */
export const generateBrackets = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any).id;
    const { numberOfGroups } = req.body;

    // Middleware already checked permissions
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: { format: true }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Check if brackets already exist
    const existingMatches = await prisma.tournamentMatch.count({
      where: { tournamentId: id }
    });

    if (existingMatches > 0) {
      return res.status(400).json({
        error: 'Brackets have already been generated for this tournament'
      });
    }

    let result;
    switch (tournament.format) {
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
      default:
        return res.status(400).json({ error: 'Invalid tournament format' });
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
  } catch (error: any) {
    logger.error('Error generating brackets', 'TournamentController', { error });
    res.status(500).json({
      error: error.message || 'Failed to generate brackets'
    });
  }
};

/**
 * Submit match score
 */
export const submitScore = async (req: Request, res: Response) => {
  try {
    const { id, matchId } = req.params;
    const userId = (req.user as any).id;
    const { homeScore, awayScore } = req.body;

    if (homeScore === undefined || awayScore === undefined) {
      return res.status(400).json({
        error: 'Both home and away scores are required'
      });
    }

    if (homeScore < 0 || awayScore < 0) {
      return res.status(400).json({ error: 'Scores cannot be negative' });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const match = await prisma.tournamentMatch.findUnique({
      where: { id: matchId }
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Check permissions - organizer, team captains, registered players, or referee team members can submit scores
    const canSubmit = await tournamentService.canSubmitScore(match, tournament, userId);

    if (!canSubmit) {
      return res.status(403).json({
        error: 'Only the organizer, team captains, registered players, or referee team members can submit scores'
      });
    }

    // Update match with score
    const updatedMatch = await prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        homeScore,
        awayScore,
        status: MatchStatus.COMPLETED,
        completedAt: new Date()
      },
      include: {
        homeTeam: true,
        awayTeam: true
      }
    });

    // Update standings
    await tournamentService.updateStandings(matchId);

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
  } catch (error) {
    logger.error('Error submitting score', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to submit score' });
  }
};

/**
 * Get tournament standings
 */
export const getStandings = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { groupName } = req.query;

    const where: any = { tournamentId: id };
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
  } catch (error) {
    logger.error('Error fetching standings', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
};

/**
 * Create a manual match (organizer or group admin only)
 */
export const createMatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any).id;
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
      return res.status(400).json({
        error: 'Both home and away teams are required'
      });
    }

    if (homeTeamId === awayTeamId) {
      return res.status(400).json({
        error: 'Home and away teams must be different'
      });
    }

    // Middleware already checked permissions

    // Verify teams exist and belong to this tournament
    const homeTeam = await prisma.tournamentTeam.findFirst({
      where: { id: homeTeamId, tournamentId: id }
    });
    const awayTeam = await prisma.tournamentTeam.findFirst({
      where: { id: awayTeamId, tournamentId: id }
    });

    if (!homeTeam || !awayTeam) {
      return res.status(400).json({
        error: 'Invalid team IDs or teams do not belong to this tournament'
      });
    }

    // Verify referee team if provided
    if (refereeTeamId) {
      if (refereeTeamId === homeTeamId || refereeTeamId === awayTeamId) {
        return res.status(400).json({
          error: 'Referee team cannot be one of the playing teams'
        });
      }
      const refereeTeam = await prisma.tournamentTeam.findFirst({
        where: { id: refereeTeamId, tournamentId: id }
      });
      if (!refereeTeam) {
        return res.status(400).json({
          error: 'Invalid referee team ID or team does not belong to this tournament'
        });
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
  } catch (error) {
    logger.error('Error creating match', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to create match' });
  }
};

/**
 * Update a match (organizer or group admin only)
 */
export const updateMatch = async (req: Request, res: Response) => {
  try {
    const { id, matchId } = req.params;
    const userId = (req.user as any).id;
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

    // Middleware already checked permissions

    const match = await prisma.tournamentMatch.findUnique({
      where: { id: matchId }
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Validate new team IDs if provided
    if (homeTeamId || awayTeamId) {
      const newHomeId = homeTeamId || match.homeTeamId;
      const newAwayId = awayTeamId || match.awayTeamId;

      if (newHomeId === newAwayId) {
        return res.status(400).json({
          error: 'Home and away teams must be different'
        });
      }

      if (homeTeamId) {
        const homeTeam = await prisma.tournamentTeam.findFirst({
          where: { id: homeTeamId, tournamentId: id }
        });
        if (!homeTeam) {
          return res.status(400).json({ error: 'Invalid home team ID' });
        }
      }

      if (awayTeamId) {
        const awayTeam = await prisma.tournamentTeam.findFirst({
          where: { id: awayTeamId, tournamentId: id }
        });
        if (!awayTeam) {
          return res.status(400).json({ error: 'Invalid away team ID' });
        }
      }
    }

    const updateData: any = {};
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
  } catch (error) {
    logger.error('Error updating match', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to update match' });
  }
};

/**
 * Delete a match (organizer or group admin only)
 */
export const deleteMatch = async (req: Request, res: Response) => {
  try {
    const { id, matchId } = req.params;
    const userId = (req.user as any).id;

    // Middleware already checked permissions

    const match = await prisma.tournamentMatch.findUnique({
      where: { id: matchId }
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Don't allow deleting completed matches with scores
    if (match.status === MatchStatus.COMPLETED && (match.homeScore !== null || match.awayScore !== null)) {
      return res.status(400).json({
        error: 'Cannot delete completed matches with scores. Please remove scores first.'
      });
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
  } catch (error) {
    logger.error('Error deleting match', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to delete match' });
  }
};

/**
 * Assign referee to a match (organizer or group admin only)
 */
export const assignReferee = async (req: Request, res: Response) => {
  try {
    const { id, matchId } = req.params;
    const userId = (req.user as any).id;
    const { refereeTeamId } = req.body;

    const tournament = await prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (!tournamentService.isOrganizer(tournament, userId)) {
      return res.status(403).json({
        error: 'Only the organizer can assign referees'
      });
    }

    const match = await prisma.tournamentMatch.findUnique({
      where: { id: matchId }
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Verify referee team if provided
    if (refereeTeamId) {
      if (refereeTeamId === match.homeTeamId || refereeTeamId === match.awayTeamId) {
        return res.status(400).json({
          error: 'Referee team cannot be one of the playing teams'
        });
      }
      const refereeTeam = await prisma.tournamentTeam.findFirst({
        where: { id: refereeTeamId, tournamentId: id }
      });
      if (!refereeTeam) {
        return res.status(400).json({
          error: 'Invalid referee team ID or team does not belong to this tournament'
        });
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
  } catch (error) {
    logger.error('Error assigning referee', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to assign referee' });
  }
};

/**
 * Assign team to pool (admin only)
 */
export const assignTeamToPool = async (req: Request, res: Response) => {
  try {
    const { id, teamId } = req.params;
    const userId = (req.user as any).id;
    const { poolNumber, poolName } = req.body;

    const tournament = await prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (!tournamentService.isOrganizer(tournament, userId)) {
      return res.status(403).json({
        error: 'Only the organizer can assign teams to pools'
      });
    }

    const team = await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

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
  } catch (error) {
    logger.error('Error assigning team to pool', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to assign team to pool' });
  }
};

/**
 * Add a player to a team (captain only)
 */
export const addPlayer = async (req: Request, res: Response) => {
  try {
    const { id, teamId } = req.params;
    const userId = (req.user as any).id;
    const { playerName, playerEmail, userId: playerId } = req.body;

    if (!playerName) {
      return res.status(400).json({ error: 'Player name is required' });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const team = await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check permissions - only organizer or team captain can add players
    const isOrg = tournamentService.isOrganizer(tournament, userId);
    const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

    if (!isOrg && !isCaptain) {
      return res.status(403).json({
        error: 'Only the organizer or team captain can add players'
      });
    }

    // If userId is provided, verify the user exists
    if (playerId) {
      const user = await prisma.user.findUnique({
        where: { id: playerId }
      });
      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }
    }

    const player = await prisma.tournamentPlayer.create({
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

    logger.info('Player added to team', 'TournamentController', {
      tournamentId: id,
      teamId,
      playerId: player.id,
      userId
    });

    res.status(201).json(player);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        error: 'This player is already registered on this team'
      });
    }
    logger.error('Error adding player', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to add player' });
  }
};

/**
 * Get players for a team
 */
export const getPlayers = async (req: Request, res: Response) => {
  try {
    const { id, teamId } = req.params;

    const team = await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

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
  } catch (error) {
    logger.error('Error fetching players', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to fetch players' });
  }
};

/**
 * Update a player (captain only)
 */
export const updatePlayer = async (req: Request, res: Response) => {
  try {
    const { id, teamId, playerId } = req.params;
    const userId = (req.user as any).id;
    const { playerName, playerEmail, userId: newUserId } = req.body;

    const tournament = await prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const team = await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const player = await prisma.tournamentPlayer.findUnique({
      where: { id: playerId }
    });

    if (!player || player.teamId !== teamId) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check permissions
    const isOrg = tournamentService.isOrganizer(tournament, userId);
    const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

    if (!isOrg && !isCaptain) {
      return res.status(403).json({
        error: 'Only the organizer or team captain can update players'
      });
    }

    // If newUserId is provided, verify the user exists
    if (newUserId !== undefined && newUserId !== null) {
      const user = await prisma.user.findUnique({
        where: { id: newUserId }
      });
      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }
    }

    const updateData: any = {};
    if (playerName !== undefined) updateData.playerName = playerName;
    if (playerEmail !== undefined) updateData.playerEmail = playerEmail || null;
    if (newUserId !== undefined) updateData.userId = newUserId || null;

    const updatedPlayer = await prisma.tournamentPlayer.update({
      where: { id: playerId },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    logger.info('Player updated', 'TournamentController', {
      tournamentId: id,
      teamId,
      playerId,
      userId
    });

    res.json(updatedPlayer);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        error: 'This user is already registered on this team'
      });
    }
    logger.error('Error updating player', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to update player' });
  }
};

/**
 * Remove a player from a team (captain only)
 */
export const removePlayer = async (req: Request, res: Response) => {
  try {
    const { id, teamId, playerId } = req.params;
    const userId = (req.user as any).id;

    const tournament = await prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const team = await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const player = await prisma.tournamentPlayer.findUnique({
      where: { id: playerId }
    });

    if (!player || player.teamId !== teamId) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check permissions
    const isOrg = tournamentService.isOrganizer(tournament, userId);
    const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

    if (!isOrg && !isCaptain) {
      return res.status(403).json({
        error: 'Only the organizer or team captain can remove players'
      });
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
  } catch (error) {
    logger.error('Error removing player', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to remove player' });
  }
};

/**
 * Get all pools for a tournament
 */
export const getPools = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const pools = await prisma.tournamentPool.findMany({
      where: { tournamentId: id },
      include: {
        _count: {
          select: {
            teams: true,
            waitlist: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(pools);
  } catch (error) {
    logger.error('Error fetching pools', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to fetch pools' });
  }
};

/**
 * Get pool details with teams and waitlist
 */
export const getPoolDetails = async (req: Request, res: Response) => {
  try {
    const { id, poolId } = req.params;

    const pool = await prisma.tournamentPool.findFirst({
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
    });

    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    res.json(pool);
  } catch (error) {
    logger.error('Error fetching pool details', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to fetch pool details' });
  }
};

/**
 * Create a new pool for a tournament (organizer only)
 */
export const createPool = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req.user as any).id;
    const { name, description, maxTeams } = req.body;

    if (!name || !maxTeams) {
      return res.status(400).json({ 
        error: 'Pool name and max teams are required' 
      });
    }

    if (maxTeams < 2) {
      return res.status(400).json({ 
        error: 'Pool must allow at least 2 teams' 
      });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (!tournamentService.isOrganizer(tournament, userId)) {
      return res.status(403).json({
        error: 'Only the organizer can create pools'
      });
    }

    const pool = await prisma.tournamentPool.create({
      data: {
        name,
        description,
        maxTeams,
        tournamentId: id
      }
    });

    logger.info('Pool created', 'TournamentController', {
      tournamentId: id,
      poolId: pool.id,
      userId
    });

    res.status(201).json(pool);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        error: 'A pool with this name already exists in the tournament'
      });
    }
    logger.error('Error creating pool', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to create pool' });
  }
};

/**
 * Register a team to a pool (team captain only)
 */
export const registerTeamToPool = async (req: Request, res: Response) => {
  try {
    const { id, poolId, teamId } = req.params;
    const userId = (req.user as any).id;

    const tournament = await prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Check if tournament is in registration status
    if (tournament.status !== 'draft' && tournament.status !== 'registration') {
      return res.status(400).json({
        error: 'Tournament registration is closed'
      });
    }

    const team = await prisma.tournamentTeam.findFirst({
      where: { 
        id: teamId,
        tournamentId: id 
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check permissions - must be organizer or team captain
    const isOrg = tournamentService.isOrganizer(tournament, userId);
    const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

    if (!isOrg && !isCaptain) {
      return res.status(403).json({
        error: 'Only the organizer or team captain can register teams to pools'
      });
    }

    // Check if team is already registered to a pool
    if (team.poolId) {
      return res.status(400).json({
        error: 'Team is already registered to a pool'
      });
    }

    // Check if team is already on a waitlist
    const existingWaitlist = await prisma.tournamentPoolWaitlist.findFirst({
      where: { teamId }
    });

    if (existingWaitlist) {
      return res.status(400).json({
        error: 'Team is already on a waitlist for another pool'
      });
    }

    const pool = await prisma.tournamentPool.findFirst({
      where: { 
        id: poolId,
        tournamentId: id 
      },
      include: {
        teams: true
      }
    });

    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    // Check if pool is full
    if (pool.teams.length >= pool.maxTeams) {
      // Add to waitlist
      const waitlistPosition = await prisma.tournamentPoolWaitlist.count({
        where: { poolId }
      }) + 1;

      const waitlistEntry = await prisma.tournamentPoolWaitlist.create({
        data: {
          poolId,
          teamId,
          position: waitlistPosition
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

      logger.info('Team added to pool waitlist', 'TournamentController', {
        tournamentId: id,
        poolId,
        teamId,
        position: waitlistPosition,
        userId
      });

      return res.status(201).json({
        message: 'Pool is full. Team added to waitlist',
        waitlist: waitlistEntry
      });
    }

    // Register team to pool
    const registrationOrder = pool.teams.length + 1;

    const updatedTeam = await prisma.tournamentTeam.update({
      where: { id: teamId },
      data: {
        poolId,
        poolName: pool.name,
        registrationOrder
        // Note: poolNumber is legacy field, poolId is now the primary pool reference
      },
      include: {
        pool: true,
        captainUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    logger.info('Team registered to pool', 'TournamentController', {
      tournamentId: id,
      poolId,
      teamId,
      registrationOrder,
      userId
    });

    res.json(updatedTeam);
  } catch (error) {
    logger.error('Error registering team to pool', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to register team to pool' });
  }
};

/**
 * Remove a team from a pool (organizer or team captain)
 * This will automatically promote the first team from the waitlist
 */
export const removeTeamFromPool = async (req: Request, res: Response) => {
  try {
    const { id, poolId, teamId } = req.params;
    const userId = (req.user as any).id;

    const tournament = await prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const team = await prisma.tournamentTeam.findFirst({
      where: { 
        id: teamId,
        tournamentId: id,
        poolId 
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found in this pool' });
    }

    // Check permissions
    const isOrg = tournamentService.isOrganizer(tournament, userId);
    const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

    if (!isOrg && !isCaptain) {
      return res.status(403).json({
        error: 'Only the organizer or team captain can remove teams from pools'
      });
    }

    // Remove team from pool
    await prisma.tournamentTeam.update({
      where: { id: teamId },
      data: {
        poolId: null,
        poolNumber: null,
        poolName: null,
        registrationOrder: null
      }
    });

    logger.info('Team removed from pool', 'TournamentController', {
      tournamentId: id,
      poolId,
      teamId,
      userId
    });

    // Check for waitlist and promote first team
    const firstWaitlistEntry = await prisma.tournamentPoolWaitlist.findFirst({
      where: { poolId },
      orderBy: { position: 'asc' },
      include: {
        team: true
      }
    });

    if (firstWaitlistEntry) {
      // Get the pool to find registration order
      const pool = await prisma.tournamentPool.findUnique({
        where: { id: poolId },
        include: { teams: true }
      });

      if (pool) {
        const registrationOrder = pool.teams.length + 1;

        // Promote team from waitlist
        await prisma.tournamentTeam.update({
          where: { id: firstWaitlistEntry.teamId },
          data: {
            poolId,
            poolName: pool.name,
            registrationOrder
            // Note: poolNumber is legacy field, poolId is now the primary pool reference
          }
        });

        // Remove from waitlist
        await prisma.tournamentPoolWaitlist.delete({
          where: { id: firstWaitlistEntry.id }
        });

        // Update positions for remaining waitlist entries
        // Get all waitlist entries after the promoted one
        const remainingEntries = await prisma.tournamentPoolWaitlist.findMany({
          where: { 
            poolId,
            position: { gt: firstWaitlistEntry.position }
          }
        });

        // Update each entry's position
        for (const entry of remainingEntries) {
          await prisma.tournamentPoolWaitlist.update({
            where: { id: entry.id },
            data: { position: entry.position - 1 }
          });
        }

        logger.info('Team promoted from waitlist', 'TournamentController', {
          tournamentId: id,
          poolId,
          promotedTeamId: firstWaitlistEntry.teamId,
          previousPosition: firstWaitlistEntry.position
        });

        return res.json({
          message: 'Team removed from pool and first waitlist team promoted',
          promotedTeam: firstWaitlistEntry.team
        });
      }
    }

    res.json({ message: 'Team removed from pool successfully' });
  } catch (error) {
    logger.error('Error removing team from pool', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to remove team from pool' });
  }
};

/**
 * Remove a team from waitlist (organizer or team captain)
 */
export const removeTeamFromWaitlist = async (req: Request, res: Response) => {
  try {
    const { id, poolId, teamId } = req.params;
    const userId = (req.user as any).id;

    const tournament = await prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const team = await prisma.tournamentTeam.findFirst({
      where: { 
        id: teamId,
        tournamentId: id 
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check permissions
    const isOrg = tournamentService.isOrganizer(tournament, userId);
    const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

    if (!isOrg && !isCaptain) {
      return res.status(403).json({
        error: 'Only the organizer or team captain can remove teams from waitlist'
      });
    }

    const waitlistEntry = await prisma.tournamentPoolWaitlist.findFirst({
      where: { 
        poolId,
        teamId 
      }
    });

    if (!waitlistEntry) {
      return res.status(404).json({ error: 'Team not found in waitlist' });
    }

    // Remove from waitlist
    await prisma.tournamentPoolWaitlist.delete({
      where: { id: waitlistEntry.id }
    });

    // Update positions for remaining entries
    const remainingEntries = await prisma.tournamentPoolWaitlist.findMany({
      where: { 
        poolId,
        position: { gt: waitlistEntry.position }
      }
    });

    // Update each entry's position
    for (const entry of remainingEntries) {
      await prisma.tournamentPoolWaitlist.update({
        where: { id: entry.id },
        data: { position: entry.position - 1 }
      });
    }

    logger.info('Team removed from waitlist', 'TournamentController', {
      tournamentId: id,
      poolId,
      teamId,
      userId
    });

    res.json({ message: 'Team removed from waitlist successfully' });
  } catch (error) {
    logger.error('Error removing team from waitlist', 'TournamentController', { error });
    res.status(500).json({ error: 'Failed to remove team from waitlist' });
  }
};


