import prisma from '../../config/database';
import { Request, Response } from 'express';
import {
  TeamUpRequestType as PrismaTeamUpRequestType,
} from '@prisma/client';
import * as teamUpService from '../../services/teamUpService';
import * as locationService from '../../services/locationService';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors';
import { parseCoordinates, parseFloatStrict, sanitizeString } from '../../utils/validation';
import { clampScore } from './_helpers';

type TeamUpRequestType = teamUpService.TeamUpRequestType;

export const getNearbyTeamUpRequests = async (req: Request, res: Response) => {
  const { latitude, longitude, radius = 10, limit = 50 } = req.query;

  if (!latitude || !longitude) {
    throw new BadRequestError('Latitude and longitude are required');
  }

  const { lat, lon } = parseCoordinates(latitude, longitude);
  const radiusKm = parseFloatStrict(radius, 'Radius');
  const { latDelta, lonDelta } = locationService.calculateBoundingBox(lat, radiusKm);

  // Validate radius (max 100km to prevent excessive queries)
  if (radiusKm <= 0 || radiusKm > 100) {
    throw new BadRequestError('Radius must be between 0 and 100 kilometers');
  }

  const parsedLimit = Number.parseInt(String(limit), 10);
  const validatedLimit = Number.isNaN(parsedLimit)
    ? 50
    : Math.min(Math.max(parsedLimit, 1), 100);

  // Get all open TeamUp requests with location data
  const requests: any[] = await prisma.teamUpRequest.findMany({
    where: {
      AND: [
        { latitude: { not: null } },
        { longitude: { not: null } },
        { latitude: { gte: lat - latDelta, lte: lat + latDelta } },
        { longitude: { gte: lon - lonDelta, lte: lon + lonDelta } },
      ],
      status: 'open',
      dateTime: {
        gte: new Date() // Only show future requests
      }
    },
    // @ts-ignore
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
          city: true,
          country: true,
          profilePicture: true
        }
      },
      responses: {
        where: {
          status: 'accepted'
        },
        // @ts-ignore
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profilePicture: true
            }
          },
          // @ts-ignore
          requestPosition: {
            select: {
              id: true,
              name: true,
              slotsNeeded: true,
              skillLevelRequired: true,
            },
          },
        }
      },
      // @ts-ignore
      positions: {
        orderBy: { createdAt: 'asc' },
      },
      _count: {
        select: { responses: true }
      }
    },
    orderBy: { dateTime: 'asc' },
    take: validatedLimit * 2 // Get more than needed for filtering
  });

  // Filter by location and add distance
  const nearbyRequests = locationService.filterByLocation(
    requests,
    lat,
    lon,
    radiusKm
  ).slice(0, validatedLimit); // Limit after filtering

  // Enrich with location info
  const enrichedRequests = nearbyRequests.map(request => 
    locationService.enrichWithLocationInfo(teamUpService.withPositionAvailability(request))
  );

  res.json({
    results: enrichedRequests,
    total: enrichedRequests.length,
    center: { latitude: lat, longitude: lon },
    radius: radiusKm
  });
};

export const listTeamUpSavedSearches = async (req: Request, res: Response) => {
  const savedSearches = await prisma.teamUpSavedSearch.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(savedSearches);
};

export const createTeamUpSavedSearch = async (req: Request, res: Response) => {
  const {
    name,
    sportType,
    requestType,
    skillLevel,
    city,
    country,
    search,
    fromDate,
    toDate,
    preferredPosition,
    preferredSkillLevel,
    notifyOnMatch = true,
  } = req.body ?? {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new BadRequestError('name is required');
  }

  const created = await prisma.teamUpSavedSearch.create({
    data: {
      userId: req.user!.id,
      name: sanitizeString(name),
      sportType: typeof sportType === 'string' ? sanitizeString(sportType) : null,
      requestType:
        typeof requestType === 'string' &&
        teamUpService.VALID_REQUEST_TYPES.includes(requestType as TeamUpRequestType)
          ? (requestType as PrismaTeamUpRequestType)
          : null,
      skillLevel: teamUpService.parseSkillLevel(skillLevel, 'skillLevel'),
      city: typeof city === 'string' ? sanitizeString(city) : null,
      country: typeof country === 'string' ? sanitizeString(country) : null,
      search: typeof search === 'string' ? sanitizeString(search) : null,
      fromDate: (() => {
        if (!fromDate) return null;
        const d = new Date(fromDate);
        if (isNaN(d.getTime())) throw new BadRequestError('fromDate must be a valid ISO date string');
        return d;
      })(),
      toDate: (() => {
        if (!toDate) return null;
        const d = new Date(toDate);
        if (isNaN(d.getTime())) throw new BadRequestError('toDate must be a valid ISO date string');
        return d;
      })(),
      preferredPosition:
        typeof preferredPosition === 'string' ? sanitizeString(preferredPosition) : null,
      preferredSkillLevel: teamUpService.parseSkillLevel(
        preferredSkillLevel,
        'preferredSkillLevel'
      ),
      notifyOnMatch: Boolean(notifyOnMatch),
    },
  });

  res.status(201).json(created);
};

export const deleteTeamUpSavedSearch = async (req: Request, res: Response) => {
  const { searchId } = req.params;
  const existing = await prisma.teamUpSavedSearch.findUnique({
    where: { id: searchId },
    select: { userId: true },
  });
  if (!existing || existing.userId !== req.user!.id) {
    throw new NotFoundError('Saved search not found');
  }
  await prisma.teamUpSavedSearch.delete({ where: { id: searchId } });
  res.json({ message: 'Saved search deleted' });
};

export const getTeamUpReplacementSuggestions = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { requestPositionId } = req.query;

  const requestRecord = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: {
      creatorId: true,
      sportType: true,
      city: true,
      country: true,
      responses: {
        where: {
          status: { in: ['declined', 'cancelled', 'waitlisted'] },
          ...(requestPositionId
            ? {
                // @ts-ignore
                requestPositionId: String(requestPositionId),
              }
            : {}),
        },
        select: {
          userId: true,
          user: {
            select: { id: true, name: true, profilePicture: true },
          },
          matchScore: true,
          matchReasons: true,
        },
        orderBy: [{ matchScore: 'desc' }, { createdAt: 'asc' }],
        take: 10,
      },
    },
  });

  if (!requestRecord) throw new NotFoundError('TeamUp request not found');
  if (requestRecord.creatorId !== req.user!.id) {
    throw new ForbiddenError('Only the creator can view replacement suggestions');
  }

  const userIds = requestRecord.responses.map((response) => response.userId);
  const attendanceHistory = await prisma.teamUpResponse.groupBy({
    by: ['userId', 'attendanceStatus'],
    where: {
      userId: { in: userIds },
      attendanceStatus: { not: null },
    },
    _count: { _all: true },
  });

  const attendanceMap = new Map<string, { attended: number; late: number; no_show: number; excused: number }>();
  attendanceHistory.forEach((row) => {
    if (!attendanceMap.has(row.userId)) {
      attendanceMap.set(row.userId, { attended: 0, late: 0, no_show: 0, excused: 0 });
    }
    const current = attendanceMap.get(row.userId)!;
    const key = row.attendanceStatus as keyof typeof current;
    current[key] = row._count._all;
  });

  const suggestions = requestRecord.responses.map((response) => {
    const attendance = attendanceMap.get(response.userId) ?? {
      attended: 0,
      late: 0,
      no_show: 0,
      excused: 0,
    };
    const attendedLike = attendance.attended + attendance.late;
    const totalAttendance =
      attendance.attended + attendance.late + attendance.no_show + attendance.excused;
    const reliabilityScore =
      totalAttendance > 0 ? clampScore((attendedLike / totalAttendance) * 100) : 0;
    return {
      user: response.user,
      matchScore: response.matchScore ?? 0,
      matchReasons: response.matchReasons ?? [],
      reliabilityScore,
      attendance,
    };
  });

  suggestions.sort((a, b) => {
    if (a.reliabilityScore !== b.reliabilityScore) {
      return b.reliabilityScore - a.reliabilityScore;
    }
    return (b.matchScore ?? 0) - (a.matchScore ?? 0);
  });

  res.json({ data: suggestions });
};
