import { Request, Response } from 'express';

import prisma from '../../config/database';
import * as tournamentService from '../../services/tournamentService';
import { BracketStage, MatchStatus } from '../../../shared/types/tournament.types';
import {
  DEFAULT_PAGE_SIZE,
  MAX_LOCATION_RADIUS_KM,
  MAX_PAGE_SIZE,
} from '../../controllers/tournament/_constants';
import { parseCoordinates, parseFloatStrict } from '../../utils/validation';
import * as locationService from '../../services/locationService';

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
    const error = new Error('You do not have access to this private tournament');
    (error as Error & { statusCode?: number }).statusCode = 403;
    throw error;
  }
};

export const getTournamentSummary = async (req: Request, res: Response) => {
  const { id } = req.params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      format: true,
      sportType: true,
      startDate: true,
      endDate: true,
      location: true,
      locationName: true,
      city: true,
      country: true,
      isPublic: true,
      organizerId: true,
      updatedAt: true,
    },
  });

  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }

  return res.json(tournament);
};

export const getTournamentMatchCount = async (req: Request, res: Response) => {
  const { id } = req.params;

  const [tournament, matchCount] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
      },
    }),
    prisma.tournamentMatch.count({
      where: { tournamentId: id },
    }),
  ]);

  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }

  return res.json({
    tournamentId: id,
    matchCount,
  });
};

export const getTournamentMatches = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.header('x-user-id');
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

  if (!userId) {
    return res.status(401).json({ error: 'Missing x-user-id header' });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, organizerId: true, isPublic: true },
  });

  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }

  await assertCanViewTournament(tournament, userId);

  const parsedPage = Math.max(1, parseInt(page as string, 10) || 1);
  const parsedLimit = Math.min(
    Math.max(1, parseInt(limit as string, 10) || DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );
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

  return res.json({
    data: matches,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  });
};

export const getStandings = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.header('x-user-id');
  const { groupName } = req.query;

  if (!userId) {
    return res.status(401).json({ error: 'Missing x-user-id header' });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, organizerId: true, isPublic: true, tiebreakerRules: true },
  });

  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }

  await assertCanViewTournament(tournament, userId);

  const where: Record<string, unknown> = { tournamentId: id };
  if (groupName) {
    where.groupName = groupName as string;
  }

  const rawStandings = await prisma.tournamentStanding.findMany({
    where,
    include: { team: true },
    orderBy: [{ points: 'desc' }],
  });

  const tiebreakerRules = tournament.tiebreakerRules as string[] | null;
  const standings = tournamentService.sortStandingsByTiebreakerRules(rawStandings, tiebreakerRules);

  return res.json(standings);
};

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
    try {
      const parsedCoordinates = parseCoordinates(latitude, longitude);
      lat = parsedCoordinates.lat;
      lon = parsedCoordinates.lon;
      radiusKm = radius !== undefined ? parseFloatStrict(radius, 'Radius') : 25;
      if (radiusKm <= 0 || radiusKm > MAX_LOCATION_RADIUS_KM) {
        return res.status(400).json({
          error: `Radius must be greater than 0 and at most ${MAX_LOCATION_RADIUS_KM} kilometers`,
        });
      }
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid location coordinates',
      });
    }

    const { latDelta, lonDelta } = locationService.calculateBoundingBox(lat!, radiusKm!);
    where.AND = [
      { latitude: { not: null } },
      { longitude: { not: null } },
      { latitude: { gte: lat! - latDelta, lte: lat! + latDelta } },
      { longitude: { gte: lon! - lonDelta, lte: lon! + lonDelta } },
    ];
  }

  let total = 0;
  let tournaments: Array<Record<string, unknown>> = [];

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

    const filtered = locationService.filterByLocation(rawTournaments, lat, lon, radiusKm);
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
    tournaments = rawTournaments as unknown as Array<Record<string, unknown>>;
    total = counted;
  }

  const syncedTournaments = await Promise.all(
    tournaments.map((tournament) =>
      tournamentService.syncTournamentAutoStatus(tournament as never, 'public_list_read')
    )
  );

  return res.json({
    data: syncedTournaments,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  });
};
