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
      prizesDescription,
      rulesDescription,
      contactEmail,
      // Recurring tournament
      isRecurring,
      recurrenceRule
    } = req.body;

    const userId = (req as any).userId;

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
      if (regDate >= startDateObj) {
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
    const userId = (req as any).userId;
    const { 
      name, description, status, startDate, endDate, maxTeams, 
      location, locationName, city, country, latitude, longitude,
      // Admin controls
      registrationDeadline, isPublic, allowLateRegistration,
      autoGenerateBrackets, prizesDescription, rulesDescription, contactEmail
    } = req.body;

    const tournament = await prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (!tournamentService.isOrganizer(tournament, userId)) {
      return res.status(403).json({
        error: 'Only the organizer can update the tournament'
      });
    }

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
    const userId = (req as any).userId;

    const tournament = await prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (!tournamentService.isOrganizer(tournament, userId)) {
      return res.status(403).json({
        error: 'Only the organizer can delete the tournament'
      });
    }

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
    const userId = (req as any).userId;
    const { name, captainName, captainEmail, captainUserId } = req.body;

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
        tournamentId: id
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
    const userId = (req as any).userId;
    const { name, captainName, captainEmail, captainUserId } = req.body;

    const tournament = await prisma.tournament.findUnique({
      where: { id }
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

    // Check permissions
    const isOrg = tournamentService.isOrganizer(tournament, userId);
    const isCaptain = await tournamentService.isTeamCaptain(teamId, userId);

    if (!isOrg && !isCaptain) {
      return res.status(403).json({
        error: 'Only the organizer or team captain can update the team'
      });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (captainName !== undefined) updateData.captainName = captainName;
    if (captainEmail !== undefined) updateData.captainEmail = captainEmail;
    if (captainUserId !== undefined) updateData.captainUserId = captainUserId || null;

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
    const userId = (req as any).userId;

    const tournament = await prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (!tournamentService.isOrganizer(tournament, userId)) {
      return res.status(403).json({
        error: 'Only the organizer can delete teams'
      });
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
    const userId = (req as any).userId;
    const { numberOfGroups } = req.body;

    const tournament = await prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (!tournamentService.isOrganizer(tournament, userId)) {
      return res.status(403).json({
        error: 'Only the organizer can generate brackets'
      });
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
    const userId = (req as any).userId;
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

    // Check permissions - organizer or team captains can submit scores
    const isOrg = tournamentService.isOrganizer(tournament, userId);
    const isHomeCaptain = await tournamentService.isTeamCaptain(match.homeTeamId, userId);
    const isAwayCaptain = await tournamentService.isTeamCaptain(match.awayTeamId, userId);

    if (!isOrg && !isHomeCaptain && !isAwayCaptain) {
      return res.status(403).json({
        error: 'Only the organizer or team captains can submit scores'
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
