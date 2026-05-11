import prisma from '../config/database';
import { logger } from '../utils/logger';
import { Request, Response } from 'express';
import {
  Prisma,
  TeamUpModerationStatus,
  TeamUpRequestType as PrismaTeamUpRequestType,
  TeamUpResponseStatus,
} from '@prisma/client';
import * as teamUpService from '../services/teamUpService';
import * as locationService from '../services/locationService';
import * as teamUpNotificationService from '../services/teamUpNotificationService';
import { dispatchPushNotifications } from '../services/pushNotificationService';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { parseCoordinates, parseFloatStrict, sanitizeString } from '../utils/validation';
import { auditLog } from '../utils/prismaExtended';

type TeamUpRequestType = teamUpService.TeamUpRequestType;
const TEAMUP_AUTOFILL_CONFIRMATION_MINUTES = 45;

const BLOCKING_APPLICATION_STATUSES = ['pending', 'accepted'] as const;
const REAPPLY_ELIGIBLE_STATUSES = ['cancelled', 'declined', 'waitlisted'] as const;

const requireSystemAdmin = (req: Request): void => {
  const configuredAdmins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (
    !req.user?.email ||
    configuredAdmins.length === 0 ||
    !configuredAdmins.includes(req.user.email.toLowerCase())
  ) {
    throw new ForbiddenError('Admin access required');
  }
};

const clampScore = (value: number): number => {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
};

const computeRoleFitForApplication = ({
  selectedPosition,
  requestSkillLevel,
  requestCity,
  requestCountry,
  applicantSkillLevel,
  applicantCity,
  applicantCountry,
}: {
  selectedPosition?: { name?: string | null; skillLevelRequired?: string | null } | null;
  requestSkillLevel?: string | null;
  requestCity?: string | null;
  requestCountry?: string | null;
  applicantSkillLevel?: string | null;
  applicantCity?: string | null;
  applicantCountry?: string | null;
}) => {
  let score = 50;
  const reasons: string[] = [];

  if (selectedPosition?.name) {
    score += 20;
    reasons.push(`Applied for role "${selectedPosition.name}"`);
  }

  const expectedSkill = selectedPosition?.skillLevelRequired ?? requestSkillLevel ?? null;
  if (expectedSkill && applicantSkillLevel) {
    if (expectedSkill.toLowerCase() === applicantSkillLevel.toLowerCase()) {
      score += 20;
      reasons.push('Skill level matches request');
    } else {
      score -= 10;
      reasons.push('Skill level differs from requested level');
    }
  } else if (applicantSkillLevel) {
    score += 5;
    reasons.push('Skill level provided');
  }

  const normalizedApplicantCity = teamUpService.normalizeLocationToken(applicantCity);
  const normalizedRequestCity = teamUpService.normalizeLocationToken(requestCity);
  const normalizedApplicantCountry = teamUpService.normalizeLocationToken(applicantCountry);
  const normalizedRequestCountry = teamUpService.normalizeLocationToken(requestCountry);

  if (normalizedApplicantCity && normalizedRequestCity && normalizedApplicantCity === normalizedRequestCity) {
    score += 10;
    reasons.push('Same city as the request');
  } else if (
    normalizedApplicantCountry &&
    normalizedRequestCountry &&
    normalizedApplicantCountry === normalizedRequestCountry
  ) {
    score += 5;
    reasons.push('Same country as the request');
  }

  return { score: clampScore(score), reasons };
};

const getWaitlistRank = async (
  tx: typeof prisma,
  teamUpRequestId: string,
  requestPositionId: string | null
): Promise<number> => {
  const aggregate = await tx.teamUpResponse.aggregate({
    _max: { waitlistRank: true },
    where: {
      teamUpRequestId,
      status: 'waitlisted',
      // @ts-ignore
      requestPositionId,
    },
  });
  return (aggregate._max.waitlistRank ?? 0) + 1;
};

const buildAutoFillWindow = () => {
  const offeredAt = new Date();
  const expiresAt = new Date(offeredAt.getTime() + TEAMUP_AUTOFILL_CONFIRMATION_MINUTES * 60 * 1000);
  return { offeredAt, expiresAt };
};

// Create a TeamUp request
export const createTeamUpRequest = async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const {
    title,
    description,
    sportType,
    requestType,
    location,
    latitude,
    longitude,
    locationName,
    city,
    country,
    dateTime,
    playersNeeded,
    skillLevel,
    positions: positionsInput,
  } = req.body;

  if (!title || !sportType) {
    throw new BadRequestError('title and sportType are required');
  }

  // Validate requestType
  const resolvedRequestType: TeamUpRequestType =
    requestType &&
    teamUpService.VALID_REQUEST_TYPES.includes(requestType as TeamUpRequestType)
      ? (requestType as TeamUpRequestType)
      : 'need_players';

  // For need_players, dateTime is required (you have a specific session to fill)
  if (resolvedRequestType === 'need_players' && !dateTime) {
    throw new BadRequestError('dateTime is required for need_players requests');
  }

  // Sanitize text inputs
  const sanitized = teamUpService.sanitizeTeamUpData({
    title,
    description,
    sportType,
    location,
    locationName,
    city,
    country,
    skillLevel
  });
  teamUpService.validateTeamUpTextLengths(sanitized);

  // Validate sanitized required fields are not empty
  if (!sanitized.title || !sanitized.sportType) {
    throw new BadRequestError('Title and sport type cannot be empty or whitespace-only');
  }

  // Parse requested positions (optional; positions-first for need_players)
  const parsedPositions = teamUpService.parseTeamUpPositions(positionsInput);
  if (resolvedRequestType === 'need_players' && positionsInput !== undefined && parsedPositions.length === 0) {
    throw new BadRequestError('positions must contain at least one position when provided');
  }

  // Resolve dateTime: required for need_players, defaults to 30 days from now for looking_for_play
  let eventDate: Date;
  if (dateTime) {
    eventDate = new Date(dateTime);
    if (isNaN(eventDate.getTime())) {
      throw new BadRequestError('Invalid dateTime format');
    }
    if (eventDate <= new Date()) {
      throw new BadRequestError('dateTime must be in the future');
    }
  } else {
    // looking_for_play without explicit date: default availability window is 30 days
    eventDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  // Validate playersNeeded if provided (or derive from positions)
  const { derivedPlayersNeeded, derivedSkillLevel } =
    parsedPositions.length > 0
      ? teamUpService.deriveRequestLevelFieldsFromPositions(parsedPositions)
      : { derivedPlayersNeeded: null, derivedSkillLevel: null };
  const players =
    derivedPlayersNeeded ??
    (playersNeeded !== undefined && playersNeeded !== null ? parseInt(playersNeeded, 10) : 1);
  if (players < 1) {
    throw new BadRequestError('playersNeeded must be at least 1');
  }

  // Set expiration to 1 hour after the session time (or 30 days for availability windows)
  const expiresAt = new Date(eventDate.getTime() + 60 * 60 * 1000);

  // Parse coordinates once if provided
  const coordinates = latitude && longitude ? parseCoordinates(latitude, longitude) : null;

  const teamUpRequest: any = await prisma.teamUpRequest.create({
    data: {
      creatorId: req.user!.id,
      title: sanitized.title!,
      description: sanitized.description,
      sportType: sanitized.sportType!,
      requestType: resolvedRequestType,
      location: sanitized.location,
      latitude: coordinates?.lat ?? null,
      longitude: coordinates?.lon ?? null,
      locationName: sanitized.locationName,
      city: sanitized.city,
      country: sanitized.country,
      dateTime: eventDate,
      playersNeeded: players,
      skillLevel: derivedSkillLevel ?? sanitized.skillLevel ?? null,
      status: 'open',
      expiresAt,
      ...(parsedPositions.length > 0
        ? {
            // @ts-ignore
            positions: {
              create: parsedPositions.map((position) => ({
                name: position.name,
                slotsNeeded: position.slotsNeeded,
                skillLevelRequired: position.skillLevelRequired,
              })),
            },
          }
        : {}),
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
      _count: {
        select: { responses: true, comments: true }
      },
      // @ts-ignore
      positions: {
        orderBy: { createdAt: 'asc' },
      },
    }
  });

  const enrichedRequest = locationService.enrichWithLocationInfo(
    teamUpService.withPositionAvailability(teamUpRequest)
  );

  // Notify users about the new TeamUp request in their area (async, don't wait)
  teamUpNotificationService.notifyUsersAboutNewTeamUp({
    id: teamUpRequest.id,
    title: teamUpRequest.title,
    sportType: teamUpRequest.sportType,
    location: teamUpRequest.location,
    latitude: teamUpRequest.latitude,
    longitude: teamUpRequest.longitude,
    city: teamUpRequest.city,
    country: teamUpRequest.country,
    dateTime: teamUpRequest.dateTime,
    creatorId: teamUpRequest.creatorId,
  }).catch(error => {
    logger.error('Failed to send TeamUp notifications (non-blocking)', 'teamUpController', { error });
  });

  res.status(201).json(enrichedRequest);
};

// Get all TeamUp requests (browse with filters)
export const getTeamUpRequests = async (req: Request, res: Response) => {
  const {
    sportType,
    requestType,
    city,
    country,
    skillLevel,
    status = 'open',
    search,
    fromDate,
    toDate,
    preferredPosition,
    preferredSkillLevel,
    sortBy = 'date',
    includeMatchReason = 'false',
    source = 'browse',
    limit = '50',
    offset = '0',
    cursor
  } = req.query;

  // Parse and validate pagination parameters
  const parsedLimit = parseInt(limit as string, 10);
  const parsedOffset = parseInt(offset as string, 10);
  
  // Validate parsed values and apply defaults/caps
  const validatedLimit = isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100);
  const validatedOffset = isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);

  // Build where clause - optimized to use composite indexes
  const where: Record<string, unknown> = {
    status: status as string  // First part of composite index
  };

  if (sportType) {
    where.sportType = sportType as string;
  }

  // Filter by request type (need_players or looking_for_play)
  if (
    requestType &&
    teamUpService.VALID_REQUEST_TYPES.includes(requestType as TeamUpRequestType)
  ) {
    where.requestType = requestType as string;
  }

  if (city) {
    where.city = city as string;
  }

  if (country) {
    where.country = country as string;
  }

  if (skillLevel) {
    where.skillLevel = skillLevel as string;
  }

  if (preferredPosition && typeof preferredPosition === 'string' && preferredPosition.trim()) {
    where.positions = {
      some: {
        name: {
          contains: preferredPosition.trim(),
          mode: 'insensitive',
        },
      },
    };
  }

  if (
    preferredSkillLevel &&
    typeof preferredSkillLevel === 'string' &&
    preferredSkillLevel.trim()
  ) {
    where.OR = [
      ...(Array.isArray(where.OR) ? (where.OR as unknown[]) : []),
      { skillLevel: preferredSkillLevel.trim().toLowerCase() },
      {
        positions: {
          some: {
            skillLevelRequired: preferredSkillLevel.trim().toLowerCase(),
          },
        },
      },
    ];
  }

  if (search && typeof search === 'string' && search.trim()) {
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { description: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  // Date range filtering
  const dateFilter: Record<string, Date> = {};
  if (fromDate) {
    const parsed = new Date(fromDate as string);
    if (!isNaN(parsed.getTime())) dateFilter.gte = parsed;
  }
  if (toDate) {
    const parsed = new Date(toDate as string);
    if (!isNaN(parsed.getTime())) dateFilter.lte = parsed;
  }
  // Default: only show requests in the present or future
  if (!dateFilter.gte) {
    dateFilter.gte = new Date();
  }
  where.dateTime = dateFilter;

  // Decode cursor: encoded as base64 JSON {id, dateTime} for composite sort stability
  let cursorCondition: Record<string, unknown> | undefined;
  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor as string, 'base64').toString('utf8')) as { id: string; dateTime: string };
      const cursorDate = new Date(decoded.dateTime);
      // Include rows where dateTime > cursorDate OR (dateTime == cursorDate AND id > cursorId)
      cursorCondition = {
        OR: [
          { dateTime: { gt: cursorDate } },
          { dateTime: { equals: cursorDate }, id: { gt: decoded.id } },
        ],
      };
    } catch {
      // Malformed cursor – ignore and start from the beginning
    }
  }

  // Merge cursor condition into the where clause
  if (cursorCondition) {
    // Combine with existing OR (search) if present using AND
    const existing = where.OR;
    if (existing) {
      where.AND = [{ OR: existing as unknown[] }, cursorCondition];
      delete where.OR;
    } else {
      Object.assign(where, cursorCondition);
    }
  }

  // Optimize query - fetch responses separately for large result sets
  const [teamUpRequests, totalCount] = await prisma.$transaction([
    prisma.teamUpRequest.findMany({
      where,
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
      _count: {
        select: { 
          responses: true,
          comments: true
        }
      },
      // @ts-ignore
      positions: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy:
      sortBy === 'newest'
        ? [{ createdAt: 'desc' }, { id: 'asc' }]
        : [{ dateTime: 'asc' }, { id: 'asc' }],
    take: validatedLimit,
    skip: cursor ? 0 : validatedOffset // Skip only for offset pagination
    }),
    prisma.teamUpRequest.count({ where }),
  ]);

  // Get accepted responses for the fetched requests (batch query for efficiency)
  const requestIds = teamUpRequests.map(r => r.id);
  const acceptedResponses: any[] = await prisma.teamUpResponse.findMany({
    where: {
      teamUpRequestId: { in: requestIds },
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
  });

  // Map responses to requests
  const responsesByRequest = new Map<string, typeof acceptedResponses[number][]>();
  acceptedResponses.forEach(response => {
    if (!responsesByRequest.has(response.teamUpRequestId)) {
      responsesByRequest.set(response.teamUpRequestId, []);
    }
    responsesByRequest.get(response.teamUpRequestId)!.push(response);
  });

  // Attach responses to requests
  const requestsWithResponses = teamUpRequests.map((request) =>
    teamUpService.withPositionAvailability({
      ...request,
      responses: responsesByRequest.get(request.id) || [],
    })
  );

  // Enrich with location info
  const enrichedRequests = requestsWithResponses.map((request) =>
    locationService.enrichWithLocationInfo(request)
  );

  let currentUser: { city: string | null; country: string | null } | null = null;
  if (sortBy === 'fit' || includeMatchReason === 'true') {
    currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { city: true, country: true },
    });
  }

  const requestsWithMatching = enrichedRequests.map((request) => {
    if (!currentUser) return request;
    const expectedSkill = request.skillLevel ?? preferredSkillLevel?.toString() ?? null;
    const { score, reasons } = computeRoleFitForApplication({
      selectedPosition:
        request.positions && preferredPosition
          ? request.positions.find((position: any) =>
              typeof position.name === 'string' &&
              position.name.toLowerCase().includes(String(preferredPosition).toLowerCase())
            )
          : null,
      requestSkillLevel: expectedSkill,
      requestCity: request.city ?? null,
      requestCountry: request.country ?? null,
      applicantSkillLevel:
        typeof preferredSkillLevel === 'string'
          ? preferredSkillLevel.toLowerCase()
          : null,
      applicantCity: currentUser.city,
      applicantCountry: currentUser.country,
    });
    return {
      ...request,
      matchScore: score,
      ...(includeMatchReason === 'true' ? { matchReasons: reasons } : {}),
    };
  });

  if (sortBy === 'fit') {
    requestsWithMatching.sort((a: any, b: any) => {
      const aScore = typeof a.matchScore === 'number' ? a.matchScore : 0;
      const bScore = typeof b.matchScore === 'number' ? b.matchScore : 0;
      if (aScore !== bScore) return bScore - aScore;
      return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
    });
  }

  await prisma.teamUpRequestView.createMany({
    data: requestsWithMatching.map((request: any) => ({
      teamUpRequestId: request.id,
      viewerId: req.user!.id,
      source: typeof source === 'string' ? source : 'browse',
    })),
    skipDuplicates: false,
  }).catch((_error: unknown): undefined => undefined);

  // Calculate next cursor for cursor-based pagination – encode last item's (id, dateTime) as base64 JSON
  const lastItem = teamUpRequests.length === validatedLimit ? teamUpRequests[teamUpRequests.length - 1] : null;
  const nextCursor = lastItem
    ? Buffer.from(JSON.stringify({ id: lastItem.id, dateTime: lastItem.dateTime })).toString('base64')
    : null;

  // Return paginated response with metadata
  res.json({
    data: requestsWithMatching,
    pagination: {
      limit: validatedLimit,
      offset: validatedOffset,
      total: totalCount,
      hasMore: teamUpRequests.length === validatedLimit,
      nextCursor
    }
  });
};

// Get user's own TeamUp requests
export const getMyTeamUpRequests = async (req: Request, res: Response) => {
  const { status } = req.query;

  const where: Record<string, unknown> = {
    creatorId: req.user!.id
  };

  if (status) {
    where.status = status as string;
  }

  const teamUpRequests: any[] = await prisma.teamUpRequest.findMany({
    where,
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
        // @ts-ignore
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
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
        },
        orderBy: { createdAt: 'asc' }
      },
      // @ts-ignore
      positions: {
        orderBy: { createdAt: 'asc' },
      },
      _count: {
        select: { responses: true, comments: true }
      }
    },
    orderBy: { dateTime: 'asc' }
  });

  // Enrich with location info
  const enrichedRequests = teamUpRequests.map(request => 
    locationService.enrichWithLocationInfo(teamUpService.withPositionAvailability(request))
  );

  res.json(enrichedRequests);
};

// Get a specific TeamUp request
export const getTeamUpRequest = async (req: Request, res: Response) => {
  const { id } = req.params;

  const teamUpRequest: any = await prisma.teamUpRequest.findUnique({
    where: { id },
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
        // @ts-ignore
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
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
      comments: {
        // @ts-ignore
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePicture: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      },
      _count: {
        select: { 
          responses: true,
          comments: true
        }
      }
    }
  });

  if (!teamUpRequest) {
    throw new NotFoundError('TeamUp request not found');
  }

  await prisma.teamUpRequestView.create({
    data: {
      teamUpRequestId: id,
      viewerId: req.user!.id,
      source: 'detail',
    },
  }).catch((_error: unknown): undefined => undefined);

  const enrichedRequest = locationService.enrichWithLocationInfo(
    teamUpService.withPositionAvailability(teamUpRequest)
  );

  res.json(enrichedRequest);
};

// Update a TeamUp request
export const updateTeamUpRequest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    title,
    description,
    sportType,
    requestType,
    location,
    latitude,
    longitude,
    locationName,
    city,
    country,
    dateTime,
    playersNeeded,
    skillLevel,
    status,
    positions: positionsInput,
  } = req.body;

  const teamUpRequest: any = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { creatorId: true, requestType: true }
  });

  if (!teamUpRequest) {
    throw new NotFoundError('TeamUp request not found');
  }

  if (teamUpRequest.creatorId !== req.user!.id) {
    throw new ForbiddenError('Only the creator can update this request');
  }

  // Sanitize text inputs
  const sanitized = teamUpService.sanitizeTeamUpData({
    title,
    description,
    sportType,
    location,
    locationName,
    city,
    country,
    skillLevel
  });
  teamUpService.validateTeamUpTextLengths(sanitized);

  const updateData: Record<string, unknown> = {};
  const parsedPositions = teamUpService.parseTeamUpPositions(positionsInput);

  if (sanitized.title !== undefined) updateData.title = sanitized.title;
  if (sanitized.description !== undefined) updateData.description = sanitized.description;
  if (sanitized.sportType !== undefined) updateData.sportType = sanitized.sportType;
  if (sanitized.location !== undefined) updateData.location = sanitized.location;
  if (latitude !== undefined && longitude !== undefined) {
    const coords = parseCoordinates(latitude, longitude);
    updateData.latitude = coords.lat;
    updateData.longitude = coords.lon;
  }
  if (sanitized.locationName !== undefined) updateData.locationName = sanitized.locationName;
  if (sanitized.city !== undefined) updateData.city = sanitized.city;
  if (sanitized.country !== undefined) updateData.country = sanitized.country;
  if (sanitized.skillLevel !== undefined) updateData.skillLevel = sanitized.skillLevel;
  if (status !== undefined) {
    const VALID_REQUEST_STATUSES = ['open', 'filled', 'cancelled'] as const;
    if (!VALID_REQUEST_STATUSES.includes(status as typeof VALID_REQUEST_STATUSES[number])) {
      throw new BadRequestError(`status must be one of: ${VALID_REQUEST_STATUSES.join(', ')}`);
    }
    updateData.status = status;
  }

  // Validate and set requestType if provided
  if (requestType !== undefined) {
    if (!teamUpService.VALID_REQUEST_TYPES.includes(requestType as TeamUpRequestType)) {
      throw new BadRequestError('requestType must be need_players or looking_for_play');
    }
    updateData.requestType = requestType;
  }

  const effectiveRequestType = (requestType as TeamUpRequestType | undefined) ?? teamUpRequest.requestType;
  if (positionsInput !== undefined && effectiveRequestType !== 'need_players') {
    throw new BadRequestError('positions can only be set for need_players requests');
  }
  if (positionsInput !== undefined && parsedPositions.length === 0) {
    throw new BadRequestError('positions must contain at least one position');
  }

  if (dateTime !== undefined) {
    const eventDate = new Date(dateTime);
    if (isNaN(eventDate.getTime())) {
      throw new BadRequestError('Invalid dateTime format');
    }
    if (eventDate <= new Date()) {
      throw new BadRequestError('dateTime must be in the future');
    }
    updateData.dateTime = eventDate;
    updateData.expiresAt = new Date(eventDate.getTime() + 60 * 60 * 1000);
  }

  if (playersNeeded !== undefined) {
    const players = parseInt(playersNeeded);
    if (players < 1) {
      throw new BadRequestError('playersNeeded must be at least 1');
    }
    updateData.playersNeeded = players;
  }

  if (positionsInput !== undefined) {
    // Prevent replacing positions that already have accepted responses, since
    // doing so would orphan those responses (requestPositionId → null via onDelete:SetNull).
    const acceptedPositionResponses = await prisma.teamUpResponse.count({
      where: {
        teamUpRequestId: id,
        status: 'accepted',
        // @ts-ignore
        requestPositionId: { not: null },
      },
    });
    if (acceptedPositionResponses > 0) {
      throw new BadRequestError(
        'Cannot replace positions while accepted responses are linked to them'
      );
    }

    const { derivedPlayersNeeded, derivedSkillLevel } =
      teamUpService.deriveRequestLevelFieldsFromPositions(parsedPositions);
    updateData.playersNeeded = derivedPlayersNeeded;
    // Keep explicit request skill when sent; otherwise derive from positions.
    if (sanitized.skillLevel === undefined) {
      updateData.skillLevel = derivedSkillLevel;
    }
    updateData.positions = {
      deleteMany: {},
      create: parsedPositions.map((position) => ({
        name: position.name,
        slotsNeeded: position.slotsNeeded,
        skillLevelRequired: position.skillLevelRequired,
      })),
    };
  }

  const updated: any = await prisma.teamUpRequest.update({
    where: { id },
    data: updateData,
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
        // @ts-ignore
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
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
    }
  });

  res.json(teamUpService.withPositionAvailability(updated));
};

// Delete a TeamUp request
export const deleteTeamUpRequest = async (req: Request, res: Response) => {
  const { id } = req.params;

  const teamUpRequest: any = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { creatorId: true }
  });

  if (!teamUpRequest) {
    throw new NotFoundError('TeamUp request not found');
  }

  if (teamUpRequest.creatorId !== req.user!.id) {
    throw new ForbiddenError('Only the creator can delete this request');
  }

  await prisma.teamUpRequest.delete({
    where: { id }
  });

  res.json({ message: 'TeamUp request deleted' });
};

// Respond to a TeamUp request
export const respondToTeamUpRequest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { message, requestPositionId, applicantSkillLevel } = req.body;

  // Sanitize the message
  const sanitized = teamUpService.sanitizeTeamUpData({ message });
  teamUpService.validateTeamUpTextLengths({ message: sanitized.message });
  const sanitizedApplicantSkillLevel =
    teamUpService.parseSkillLevel(applicantSkillLevel, 'applicantSkillLevel') ?? undefined;

  const teamUpRequest: any = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { 
      status: true, 
      creatorId: true, 
      title: true,
      sportType: true,
      dateTime: true,
      playersNeeded: true,
      city: true,
      country: true,
      skillLevel: true,
      // @ts-ignore
      positions: {
        select: {
          id: true,
          name: true,
          slotsNeeded: true,
          skillLevelRequired: true,
        },
      },
      creator: {
        select: {
          email: true,
          name: true
        }
      }
    }
  });

  if (!teamUpRequest) {
    throw new NotFoundError('TeamUp request not found');
  }

  if (teamUpRequest.status !== 'open') {
    throw new BadRequestError('This TeamUp request is no longer accepting responses');
  }

  if (teamUpRequest.creatorId === req.user!.id) {
    throw new BadRequestError('You cannot respond to your own TeamUp request');
  }

  // Check if user has already responded (cancelled/declined responses may be reapplied)
  const existingResponse: any = await prisma.teamUpResponse.findFirst({
    where: {
      teamUpRequestId: id,
      userId: req.user!.id
    }
  });

  if (existingResponse && !REAPPLY_ELIGIBLE_STATUSES.includes(existingResponse.status)) {
    throw new BadRequestError('You have already responded to this request');
  }

  const hasPositionRequirements = teamUpRequest.positions.length > 0;
  if (hasPositionRequirements && !requestPositionId) {
    throw new BadRequestError('requestPositionId is required for this TeamUp request');
  }

  let selectedPosition: any = null;
  if (requestPositionId) {
    selectedPosition = teamUpRequest.positions.find((position: any) => position.id === requestPositionId);
    if (!selectedPosition) {
      throw new BadRequestError('Invalid requestPositionId for this TeamUp request');
    }
  }

  // Perform the slot-fill check and response upsert atomically to prevent
  // two concurrent requests from overfilling the same position slot.
  const applicantProfile = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { city: true, country: true },
  });

  const { score: matchScore, reasons: matchReasons } = computeRoleFitForApplication({
    selectedPosition,
    requestSkillLevel: teamUpRequest.skillLevel,
    requestCity: teamUpRequest.city,
    requestCountry: teamUpRequest.country,
    applicantSkillLevel: sanitizedApplicantSkillLevel ?? null,
    applicantCity: applicantProfile?.city ?? null,
    applicantCountry: applicantProfile?.country ?? null,
  });

  const response: any = await prisma.$transaction(async (tx) => {
    let nextStatus: 'pending' | 'waitlisted' = 'pending';
    let waitlistRank: number | null = null;
    let autoFillOfferedAt: Date | null = null;
    let autoFillExpiresAt: Date | null = null;

    if (selectedPosition) {
      const acceptedForPosition = await tx.teamUpResponse.count({
        where: {
          teamUpRequestId: id,
          // @ts-ignore
          requestPositionId: selectedPosition.id,
          status: 'accepted',
        },
      });
      if (acceptedForPosition >= selectedPosition.slotsNeeded) {
        nextStatus = 'waitlisted';
        waitlistRank = await getWaitlistRank(tx as typeof prisma, id, selectedPosition.id);
      } else {
        nextStatus = 'pending';
      }
    } else {
      const acceptedCount = await tx.teamUpResponse.count({
        where: { teamUpRequestId: id, status: 'accepted' },
      });
      if (acceptedCount >= teamUpRequest.playersNeeded) {
        nextStatus = 'waitlisted';
        waitlistRank = await getWaitlistRank(tx as typeof prisma, id, null);
      }
    }

    if (nextStatus === 'waitlisted') {
      const autoFillWindow = buildAutoFillWindow();
      autoFillOfferedAt = autoFillWindow.offeredAt;
      autoFillExpiresAt = autoFillWindow.expiresAt;
    }

    const responseData = {
      message: sanitized.message,
      status: nextStatus,
      // @ts-ignore
      requestPositionId: selectedPosition?.id ?? null,
      applicantSkillLevel: sanitizedApplicantSkillLevel ?? null,
      matchScore,
      matchReasons,
      waitlistRank,
      autoFillOfferedAt,
      autoFillExpiresAt,
      rsvpStatus: 'unset' as const,
    };

    if (existingResponse) {
      // Reapplication: update the cancelled/declined record back to pending
      return tx.teamUpResponse.update({
        where: { id: existingResponse.id },
        data: responseData,
        // @ts-ignore
        include: {
          user: { select: { id: true, name: true, email: true, profilePicture: true } },
          // @ts-ignore
          requestPosition: { select: { id: true, name: true, slotsNeeded: true, skillLevelRequired: true } },
        },
      });
    }

    return tx.teamUpResponse.create({
      data: {
        teamUpRequestId: id,
        userId: req.user!.id,
        ...responseData,
      },
      // @ts-ignore
      include: {
        user: { select: { id: true, name: true, email: true, profilePicture: true } },
        // @ts-ignore
        requestPosition: { select: { id: true, name: true, slotsNeeded: true, skillLevelRequired: true } },
      },
    });
  }, { isolationLevel: 'Serializable' });

  // Create notification for the request creator
  try {
    await prisma.teamUpNotification.create({
      data: {
        userId: teamUpRequest.creatorId,
        teamUpRequestId: id,
        type: 'teamup_response',
        params: {
          name: req.user!.name,
          title: teamUpRequest.title,
          sportType: teamUpRequest.sportType
        },
        metadata: {
          responseId: response.id,
          responderId: req.user!.id,
          responderName: req.user!.name
        }
      }
    });

    // Send email notification
    const emailHtml = `
      <h2>New Response to Your TeamUp Request</h2>
      <p>Hi ${teamUpRequest.creator.name},</p>
      <p><strong>${req.user!.name}</strong> has responded to your TeamUp request:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3 style="margin-top: 0;">${teamUpRequest.title}</h3>
        <p><strong>Sport:</strong> ${teamUpRequest.sportType}</p>
        <p><strong>Date:</strong> ${new Date(teamUpRequest.dateTime).toLocaleString()}</p>
        ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
      </div>
      <p>Log in to your account to accept or decline this response.</p>
    `;

    await prisma.emailQueue.create({
      data: {
        recipient: teamUpRequest.creator.email,
        subject: `New Response to "${teamUpRequest.title}"`,
        htmlContent: emailHtml,
        templateType: 'teamup_response',
        status: 'pending',
        scheduledAt: new Date()
      }
    });

    await dispatchPushNotifications({
      userIds: [teamUpRequest.creatorId],
      notificationKind: 'teamup',
      notificationType: 'teamup_response',
      entityId: id,
      params: {
        name: req.user!.name,
        title: teamUpRequest.title,
        sportType: teamUpRequest.sportType,
      },
      metadata: {
        actionUrl: `/teamup/${id}`,
      },
    });
  } catch (notifError) {
    logger.error('Failed to create TeamUp response notification:', 'teamUpController', { error: notifError });
    // Don't fail the response if notification fails
  }

  res.status(201).json({
    message:
      response.status === 'waitlisted'
        ? 'Response submitted and added to waitlist'
        : 'Response submitted',
    response,
    waitlisted: response.status === 'waitlisted',
    matchScore,
    matchReasons,
  });
};

// Accept or decline a response (creator only)
// Uses a database transaction to prevent over-accepting (race condition safety)
export const handleTeamUpResponse = async (req: Request, res: Response) => {
  const { id, responseId } = req.params;
  const { action } = req.body;

  if (!action || !['accept', 'decline'].includes(action)) {
    throw new BadRequestError('Action must be "accept" or "decline"');
  }

  // Verify the creator owns this request (outside transaction for early exit)
  const teamUpRequest: any = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: {
      creatorId: true,
      playersNeeded: true,
      title: true,
      sportType: true,
      dateTime: true,
      location: true,
      // @ts-ignore
      positions: {
        select: {
          id: true,
          name: true,
          slotsNeeded: true,
          skillLevelRequired: true,
        },
      },
    }
  });

  if (!teamUpRequest) {
    throw new NotFoundError('TeamUp request not found');
  }

  if (teamUpRequest.creatorId !== req.user!.id) {
    throw new ForbiddenError('Only the creator can manage responses');
  }

  const existingResponse: any = await prisma.teamUpResponse.findUnique({
    where: { id: responseId },
    // @ts-ignore
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
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
  });

  if (!existingResponse) {
    throw new NotFoundError('Response not found');
  }

  if (existingResponse.teamUpRequestId !== id) {
    throw new BadRequestError('Response does not belong to this TeamUp request');
  }

  // Use a transaction to atomically update the response status and conditionally
  // mark the request as filled, preventing concurrent accepts from over-booking.
  const { updated, requestFilled } = await prisma.$transaction(async (tx) => {
    const hasPositionRequirements = teamUpRequest.positions.length > 0;

    // When accepting, verify we haven't already filled all spots
    if (action === 'accept') {
      const acceptedRoleForSameUser = await tx.teamUpResponse.findFirst({
        where: {
          teamUpRequestId: id,
          userId: existingResponse.userId,
          status: 'accepted',
          id: { not: responseId },
        },
        select: { id: true },
      });
      if (acceptedRoleForSameUser) {
        throw new BadRequestError(
          'This user already has an accepted application for this TeamUp request'
        );
      }

      if (hasPositionRequirements) {
        if (!existingResponse.requestPositionId) {
          throw new BadRequestError('Response is missing requestPositionId');
        }
        const selectedPosition = teamUpRequest.positions.find(
          (position: any) => position.id === existingResponse.requestPositionId
        );
        if (!selectedPosition) {
          throw new BadRequestError('Selected position is no longer available');
        }

        const acceptedForPosition = await tx.teamUpResponse.count({
          where: {
            teamUpRequestId: id,
            // @ts-ignore
            requestPositionId: existingResponse.requestPositionId,
            status: 'accepted',
            id: { not: responseId },
          },
        });
        if (acceptedForPosition >= selectedPosition.slotsNeeded) {
          throw new BadRequestError('Cannot accept: selected position is already filled');
        }
      } else {
        const acceptedCount = await tx.teamUpResponse.count({
          where: { teamUpRequestId: id, status: 'accepted', id: { not: responseId } },
        });
        if (acceptedCount >= teamUpRequest.playersNeeded) {
          throw new BadRequestError('Cannot accept: all available spots are already filled');
        }
      }
    }

    const updated = await tx.teamUpResponse.update({
      where: { id: responseId },
      data: { status: action === 'accept' ? 'accepted' : 'declined' },
      // @ts-ignore
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
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
    });

    // Auto-fill: recount after update and mark request filled if needed
    let requestFilled = false;
    if (action === 'accept') {
      if (teamUpRequest.positions.length > 0) {
        const acceptedResponses: any[] = await tx.teamUpResponse.findMany({
          where: {
            teamUpRequestId: id,
            status: 'accepted',
            // @ts-ignore
            requestPositionId: { not: null },
          },
          // @ts-ignore
          select: { requestPositionId: true },
        });
        const acceptedByPosition = new Map<string, number>();
        acceptedResponses.forEach((response) => {
          if (!response.requestPositionId) return;
          acceptedByPosition.set(
            response.requestPositionId,
            (acceptedByPosition.get(response.requestPositionId) ?? 0) + 1
          );
        });
        requestFilled = teamUpRequest.positions.every((position: any) => {
          const acceptedCount = acceptedByPosition.get(position.id) ?? 0;
          return acceptedCount >= position.slotsNeeded;
        });
      } else {
        const newAcceptedCount = await tx.teamUpResponse.count({
          where: { teamUpRequestId: id, status: 'accepted' },
        });
        requestFilled = newAcceptedCount >= teamUpRequest.playersNeeded;
      }

      if (requestFilled) {
        await tx.teamUpRequest.update({
          where: { id },
          data: { status: 'filled' }
        });
      }
    }

    return { updated, requestFilled };
  });

  // Send notifications outside the transaction (non-blocking)
  try {
    await prisma.teamUpNotification.create({
      data: {
        userId: existingResponse.userId,
        teamUpRequestId: id,
        type: action === 'accept' ? 'teamup_accepted' : 'teamup_declined',
        params: {
          title: teamUpRequest.title,
          sportType: teamUpRequest.sportType
        },
        metadata: {
          responseId: responseId,
          action: action,
          location: teamUpRequest.location,
          dateTime: teamUpRequest.dateTime
        }
      }
    });

    // Send email notification
    const emailHtml = action === 'accept' 
      ? `
        <h2>Your Response Was Accepted! 🎉</h2>
        <p>Hi ${existingResponse.user.name},</p>
        <p>Great news! Your response to the following TeamUp request has been accepted:</p>
        <div style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #3b82f6;">
          <h3 style="margin-top: 0; color: #1e40af;">${teamUpRequest.title}</h3>
          <p><strong>Sport:</strong> ${teamUpRequest.sportType}</p>
          <p><strong>Date:</strong> ${new Date(teamUpRequest.dateTime).toLocaleString()}</p>
          ${teamUpRequest.location ? `<p><strong>Location:</strong> ${teamUpRequest.location}</p>` : ''}
        </div>
        <p>Get ready for the game! Make sure to arrive on time.</p>
      `
      : `
        <h2>Response Status Update</h2>
        <p>Hi ${existingResponse.user.name},</p>
        <p>Thank you for your interest. Unfortunately, your response to the following TeamUp request was not accepted:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="margin-top: 0;">${teamUpRequest.title}</h3>
          <p><strong>Sport:</strong> ${teamUpRequest.sportType}</p>
          <p><strong>Date:</strong> ${new Date(teamUpRequest.dateTime).toLocaleString()}</p>
        </div>
        <p>Keep looking for other opportunities on TeamUp!</p>
      `;

    await prisma.emailQueue.create({
      data: {
        recipient: existingResponse.user.email,
        subject: action === 'accept' 
          ? `You're In! Response Accepted for "${teamUpRequest.title}"`
          : `Response Update for "${teamUpRequest.title}"`,
        htmlContent: emailHtml,
        templateType: action === 'accept' ? 'teamup_accepted' : 'teamup_declined',
        status: 'pending',
        scheduledAt: new Date()
      }
    });

    await dispatchPushNotifications({
      userIds: [existingResponse.userId],
      notificationKind: 'teamup',
      notificationType: action === 'accept' ? 'teamup_accepted' : 'teamup_declined',
      entityId: id,
      params: {
        title: teamUpRequest.title,
        sportType: teamUpRequest.sportType,
      },
      metadata: {
        actionUrl: `/teamup/${id}`,
      },
    });
  } catch (notifError) {
    logger.error('Failed to create TeamUp action notification:', 'teamUpController', { error: notifError });
    // Don't fail the response if notification fails
  }

  res.json({ message: `Response ${action}ed`, response: updated, requestFilled });
};

// Get responses for user's TeamUp requests (creator view: responses others submitted to MY requests)
export const getMyTeamUpResponses = async (req: Request, res: Response) => {
  const { limit = '50', offset = '0' } = req.query;
  const parsedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 100);
  const parsedOffset = Math.max(parseInt(String(offset), 10) || 0, 0);

  const [responses, total]: [any[], number] = await prisma.$transaction([
    prisma.teamUpResponse.findMany({
      where: {
        teamUpRequest: {
          creatorId: req.user!.id
        }
      },
      // @ts-ignore
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
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
        teamUpRequest: {
          select: {
            id: true,
            title: true,
            sportType: true,
            requestType: true,
            dateTime: true,
            // @ts-ignore
            positions: {
              select: {
                id: true,
                name: true,
                slotsNeeded: true,
                skillLevelRequired: true,
              },
            },
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parsedLimit,
      skip: parsedOffset,
    }),
    prisma.teamUpResponse.count({
      where: {
        teamUpRequest: {
          creatorId: req.user!.id
        }
      },
    }),
  ]);

  res.json({
    data: responses.map((response) => ({
      ...response,
      reapplicationEligible: REAPPLY_ELIGIBLE_STATUSES.includes(response.status),
      blocksReapply: BLOCKING_APPLICATION_STATUSES.includes(response.status),
      canUpdateRsvp: response.status === 'accepted',
    })),
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total,
      hasMore: parsedOffset + responses.length < total,
    },
  });
};

// Get applications I submitted (responder view: responses I submitted to others' requests)
export const getMyTeamUpApplications = async (req: Request, res: Response) => {
  const { limit = '50', offset = '0' } = req.query;
  const parsedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 100);
  const parsedOffset = Math.max(parseInt(String(offset), 10) || 0, 0);

  const [responses, total]: [any[], number] = await prisma.$transaction([
    prisma.teamUpResponse.findMany({
      where: {
        userId: req.user!.id
      },
      // @ts-ignore
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
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
        teamUpRequest: {
          select: {
            id: true,
            title: true,
            sportType: true,
            requestType: true,
            dateTime: true,
            city: true,
            location: true,
            status: true,
            // @ts-ignore
            positions: {
              select: {
                id: true,
                name: true,
                slotsNeeded: true,
                skillLevelRequired: true,
              },
              orderBy: { createdAt: 'asc' },
            },
            creator: {
              select: {
                id: true,
                name: true,
                profilePicture: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parsedLimit,
      skip: parsedOffset,
    }),
    prisma.teamUpResponse.count({
      where: { userId: req.user!.id },
    }),
  ]);

  res.json({
    data: responses.map((response) => ({
      ...response,
      reapplicationEligible: REAPPLY_ELIGIBLE_STATUSES.includes(response.status),
      blocksReapply: BLOCKING_APPLICATION_STATUSES.includes(response.status),
      canUpdateRsvp: response.status === 'accepted',
    })),
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total,
      hasMore: parsedOffset + responses.length < total,
    },
  });
};

// Get nearby TeamUp requests based on location and radius
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
    take: parseInt(limit as string) * 2 // Get more than needed for filtering
  });

  // Filter by location and add distance
  const nearbyRequests = locationService.filterByLocation(
    requests,
    lat,
    lon,
    radiusKm
  ).slice(0, parseInt(limit as string)); // Limit after filtering

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

// Get comments for a TeamUp request
export const getTeamUpComments = async (req: Request, res: Response) => {
  const { id } = req.params;

  const teamUpRequest: any = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!teamUpRequest) {
    throw new NotFoundError('TeamUp request not found');
  }

  const comments = await prisma.teamUpComment.findMany({
    where: { teamUpRequestId: id },
    // @ts-ignore
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePicture: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  res.json(comments);
};

// Add a comment to a TeamUp request
export const addTeamUpComment = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    throw new BadRequestError('Comment content is required');
  }

  // Sanitize the content
  const sanitized = teamUpService.sanitizeTeamUpData({ message: content });
  teamUpService.validateTeamUpTextLengths({ message: sanitized.message });

  const teamUpRequest: any = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { 
      id: true, 
      status: true,
      title: true,
      sportType: true,
      creatorId: true
    }
  });

  if (!teamUpRequest) {
    throw new NotFoundError('TeamUp request not found');
  }

  const comment = await prisma.teamUpComment.create({
    data: {
      teamUpRequestId: id,
      userId: req.user!.id,
      content: sanitized.message || content.trim()
    },
    // @ts-ignore
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePicture: true
        }
      }
    }
  });

  // Create notification for TeamUp creator if commenter is not the creator
  if (req.user!.id !== teamUpRequest.creatorId) {
    await prisma.teamUpNotification.create({
      data: {
        userId: teamUpRequest.creatorId,
        teamUpRequestId: id,
        type: 'teamup_comment',
        params: {
          name: req.user!.name,
          title: teamUpRequest.title,
          sportType: teamUpRequest.sportType,
        },
        metadata: {
          commentId: comment.id,
          commenterId: req.user!.id,
          commenterName: req.user!.name,
        }
      }
    });

    await dispatchPushNotifications({
      userIds: [teamUpRequest.creatorId],
      notificationKind: 'teamup',
      notificationType: 'teamup_comment',
      entityId: id,
      params: {
        name: req.user!.name,
        title: teamUpRequest.title,
        sportType: teamUpRequest.sportType,
      },
      metadata: {
        actionUrl: `/teamup/${id}`,
      },
    });
  }

  res.status(201).json(comment);
};

// Delete a comment (author only)
export const deleteTeamUpComment = async (req: Request, res: Response) => {
  const { id, commentId } = req.params;

  const comment = await prisma.teamUpComment.findUnique({
    where: { id: commentId },
    select: { userId: true, teamUpRequestId: true }
  });

  if (!comment) {
    throw new NotFoundError('Comment not found');
  }

  if (comment.teamUpRequestId !== id) {
    throw new BadRequestError('Comment does not belong to this TeamUp request');
  }

  if (comment.userId !== req.user!.id) {
    throw new ForbiddenError('Only the author can delete this comment');
  }

  await prisma.teamUpComment.delete({
    where: { id: commentId }
  });

  res.json({ message: 'Comment deleted' });
};

export const withdrawTeamUpResponse = async (req: Request, res: Response) => {
  const { id } = req.params;

  const teamUpRequest = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!teamUpRequest) {
    throw new NotFoundError('TeamUp request not found');
  }

  const existingResponse = await prisma.teamUpResponse.findFirst({
    where: {
      teamUpRequestId: id,
      userId: req.user!.id,
    },
    select: { id: true, status: true, requestPositionId: true },
  });

  if (!existingResponse) {
    throw new NotFoundError('Response not found');
  }

  if (!['pending', 'accepted', 'waitlisted'].includes(existingResponse.status)) {
    throw new BadRequestError('Only pending, accepted, or waitlisted responses can be withdrawn');
  }

  const promotedResponses = await prisma.$transaction(async (tx) => {
    await tx.teamUpResponse.update({
      where: { id: existingResponse.id },
      data: { status: 'cancelled' },
    });

    if (existingResponse.status !== 'accepted') {
      return [];
    }

    await tx.teamUpRequest.update({
      where: { id },
      data: { status: 'open' },
    });

    const candidates = await tx.teamUpResponse.findMany({
      where: {
        teamUpRequestId: id,
        status: 'waitlisted',
        // @ts-ignore
        requestPositionId: existingResponse.requestPositionId ?? null,
      },
      orderBy: [{ waitlistRank: 'asc' }, { createdAt: 'asc' }],
      take: 1,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (candidates.length === 0) {
      return [];
    }

    const autoFillWindow = buildAutoFillWindow();
    const promoted = await tx.teamUpResponse.update({
      where: { id: candidates[0].id },
      data: {
        status: 'pending',
        waitlistRank: null,
        autoFillOfferedAt: autoFillWindow.offeredAt,
        autoFillExpiresAt: autoFillWindow.expiresAt,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return [promoted];
  });

  if (promotedResponses.length > 0) {
    await Promise.all(
      promotedResponses.map(async (promoted) => {
        try {
          await prisma.teamUpNotification.create({
            data: {
              userId: promoted.userId,
              teamUpRequestId: id,
              type: 'teamup_response',
              params: {
                title: 'Auto-fill confirmation requested',
                sportType: 'teamup',
              },
              metadata: {
                actionUrl: `/teamup/${id}`,
                autoFill: true,
                expiresAt: promoted.autoFillExpiresAt,
              },
            },
          });
        } catch (error) {
          logger.error('Failed to notify promoted waitlisted response', 'teamUpController', { error });
        }
      })
    );
  }

  res.json({
    message: 'Response withdrawn',
    autoFillPromotedCount: promotedResponses.length,
  });
};

export const reportTeamUpRequest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body ?? {};
  const sanitizedReason =
    typeof reason === 'string' ? sanitizeString(reason).trim() : '';

  if (!sanitizedReason) {
    throw new BadRequestError('reason is required');
  }

  teamUpService.assertMaxLength(sanitizedReason, 'reason', teamUpService.TEAMUP_LIMITS.message);

  const requestRecord = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { id: true, creatorId: true },
  });

  if (!requestRecord) {
    throw new NotFoundError('TeamUp request not found');
  }

  await prisma.$transaction(async (tx) => {
    await auditLog(tx as typeof prisma).create({
      data: {
        entityType: 'teamup',
        entityId: id,
        actorId: req.user!.id,
        action: 'reported',
        metadata: {
          reason: sanitizedReason,
          reportedCreatorId: requestRecord.creatorId,
        },
      },
    });
    await tx.teamUpModerationCase.create({
      data: {
        teamUpRequestId: id,
        reporterId: req.user!.id,
        reason: sanitizedReason,
        status: 'open',
        metadata: {
          reportedCreatorId: requestRecord.creatorId,
        },
      },
    });
  });

  res.status(201).json({ message: 'TeamUp request reported' });
};

export const bulkHandleTeamUpResponses = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, responseIds } = req.body ?? {};

  if (!action || !['accept', 'decline'].includes(action)) {
    throw new BadRequestError('Action must be "accept" or "decline"');
  }
  if (!Array.isArray(responseIds) || responseIds.length === 0) {
    throw new BadRequestError('responseIds must be a non-empty array');
  }

  const requestRecord = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { creatorId: true, playersNeeded: true },
  });
  if (!requestRecord) throw new NotFoundError('TeamUp request not found');
  if (requestRecord.creatorId !== req.user!.id) {
    throw new ForbiddenError('Only the creator can manage responses');
  }

  const uniqueResponseIds = [...new Set(responseIds.map((value) => String(value)))];
  const responses = await prisma.teamUpResponse.findMany({
    where: {
      id: { in: uniqueResponseIds },
      teamUpRequestId: id,
    },
    select: { id: true, status: true },
  });

  const acceptedCount = await prisma.teamUpResponse.count({
    where: { teamUpRequestId: id, status: 'accepted' },
  });
  const acceptedInPayload = responses.filter((item) => item.status !== 'accepted').length;
  if (action === 'accept' && acceptedCount + acceptedInPayload > requestRecord.playersNeeded) {
    throw new BadRequestError('Bulk accept exceeds available slots');
  }

  const updateData: Prisma.TeamUpResponseUpdateManyMutationInput =
    action === 'accept'
      ? {
          status: TeamUpResponseStatus.accepted,
        }
      : {
          status: TeamUpResponseStatus.declined,
          rsvpStatus: 'unset',
          rsvpUpdatedAt: null,
        };

  await prisma.teamUpResponse.updateMany({
    where: { id: { in: responses.map((item) => item.id) } },
    data: updateData,
  });

  if (action === 'accept') {
    const refreshedAccepted = await prisma.teamUpResponse.count({
      where: { teamUpRequestId: id, status: 'accepted' },
    });
    if (refreshedAccepted >= requestRecord.playersNeeded) {
      await prisma.teamUpRequest.update({
        where: { id },
        data: { status: 'filled' },
      });
    }
  }

  res.json({
    message: `Bulk ${action} completed`,
    updatedCount: responses.length,
  });
};

export const updateTeamUpRsvp = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rsvpStatus } = req.body ?? {};
  if (!rsvpStatus || !['going', 'late', 'cant_make_it'].includes(rsvpStatus)) {
    throw new BadRequestError('rsvpStatus must be one of: going, late, cant_make_it');
  }

  const response = await prisma.teamUpResponse.findFirst({
    where: {
      teamUpRequestId: id,
      userId: req.user!.id,
      status: 'accepted',
    },
    select: {
      id: true,
      teamUpRequestId: true,
      teamUpRequest: { select: { creatorId: true, title: true, sportType: true } },
    },
  });
  if (!response) {
    throw new NotFoundError('Accepted response not found for this TeamUp request');
  }

  const updated = await prisma.teamUpResponse.update({
    where: { id: response.id },
    data: {
      rsvpStatus,
      rsvpUpdatedAt: new Date(),
    },
    select: {
      id: true,
      rsvpStatus: true,
      rsvpUpdatedAt: true,
      teamUpRequestId: true,
    },
  });

  await prisma.teamUpNotification.create({
    data: {
      userId: response.teamUpRequest.creatorId,
      teamUpRequestId: response.teamUpRequestId,
      type: 'teamup_response',
      params: {
        title: response.teamUpRequest.title,
        sportType: response.teamUpRequest.sportType,
        name: req.user!.name,
      },
      metadata: {
        rsvpStatus,
        actionUrl: `/teamup/${response.teamUpRequestId}`,
      },
    },
  }).catch((_error: unknown): undefined => undefined);

  res.json(updated);
};

export const markTeamUpAttendance = async (req: Request, res: Response) => {
  const { id, responseId } = req.params;
  const { attendanceStatus } = req.body ?? {};
  if (!attendanceStatus || !['attended', 'late', 'no_show', 'excused'].includes(attendanceStatus)) {
    throw new BadRequestError('attendanceStatus must be one of: attended, late, no_show, excused');
  }

  const requestRecord = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { creatorId: true },
  });
  if (!requestRecord) throw new NotFoundError('TeamUp request not found');
  if (requestRecord.creatorId !== req.user!.id) {
    throw new ForbiddenError('Only the creator can mark attendance');
  }

  const updated = await prisma.teamUpResponse.update({
    where: { id: responseId },
    data: {
      attendanceStatus,
      attendanceMarkedAt: new Date(),
      attendanceMarkedByUserId: req.user!.id,
    },
    select: {
      id: true,
      userId: true,
      attendanceStatus: true,
      attendanceMarkedAt: true,
    },
  });

  res.json(updated);
};

export const getMyTeamUpAttendanceHistory = async (req: Request, res: Response) => {
  const history = await prisma.teamUpResponse.findMany({
    where: {
      userId: req.user!.id,
      attendanceStatus: { not: null },
    },
    select: {
      attendanceStatus: true,
      createdAt: true,
      teamUpRequest: {
        select: {
          id: true,
          title: true,
          sportType: true,
          dateTime: true,
          city: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totals = history.reduce(
    (acc, row) => {
      const key = row.attendanceStatus as keyof typeof acc;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    { attended: 0, late: 0, no_show: 0, excused: 0 }
  );
  const attendedLike = totals.attended + totals.late;
  const reliabilityScore =
    history.length === 0 ? 0 : clampScore((attendedLike / history.length) * 100);

  res.json({
    reliabilityScore,
    totals,
    history,
  });
};

export const sendTeamUpReminderNudges = async (req: Request, res: Response) => {
  const { id } = req.params;
  const requestRecord = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { creatorId: true, title: true, sportType: true },
  });
  if (!requestRecord) throw new NotFoundError('TeamUp request not found');
  if (requestRecord.creatorId !== req.user!.id) {
    throw new ForbiddenError('Only the creator can send reminders');
  }

  const recipients = await prisma.teamUpResponse.findMany({
    where: {
      teamUpRequestId: id,
      status: 'accepted',
      rsvpStatus: 'unset',
    },
    select: { userId: true },
  });

  if (recipients.length === 0) {
    return res.json({ message: 'No pending RSVPs to remind', notifiedCount: 0 });
  }

  await prisma.teamUpNotification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.userId,
      teamUpRequestId: id,
      type: 'teamup_response',
      params: {
        title: requestRecord.title,
        sportType: requestRecord.sportType,
      },
      metadata: {
        reminder: true,
        actionUrl: `/teamup/${id}`,
      },
    })),
    skipDuplicates: false,
  });

  await dispatchPushNotifications({
    userIds: recipients.map((recipient) => recipient.userId),
    notificationKind: 'teamup',
    notificationType: 'teamup_response',
    entityId: id,
    params: {
      title: requestRecord.title,
      sportType: requestRecord.sportType,
    },
    metadata: { actionUrl: `/teamup/${id}`, reminder: true },
  }).catch((_error: unknown): undefined => undefined);

  res.json({ message: 'Reminder nudges sent', notifiedCount: recipients.length });
};

export const listTeamUpModerationCases = async (req: Request, res: Response) => {
  requireSystemAdmin(req);
  const { status = 'open', limit = '50', offset = '0' } = req.query;
  const parsedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 200);
  const parsedOffset = Math.max(parseInt(String(offset), 10) || 0, 0);

  const normalizedStatus = String(status);
  const where: Prisma.TeamUpModerationCaseWhereInput =
    normalizedStatus === 'all'
      ? {}
      : {
          status: normalizedStatus as TeamUpModerationStatus,
        };
  const [cases, total] = await prisma.$transaction([
    prisma.teamUpModerationCase.findMany({
      where,
      include: {
        teamUpRequest: {
          select: {
            id: true,
            title: true,
            creatorId: true,
            status: true,
          },
        },
        reporter: {
          select: { id: true, name: true, email: true },
        },
        assignee: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: parsedLimit,
      skip: parsedOffset,
    }),
    prisma.teamUpModerationCase.count({ where }),
  ]);

  res.json({
    data: cases,
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total,
      hasMore: parsedOffset + cases.length < total,
    },
  });
};

export const updateTeamUpModerationCase = async (req: Request, res: Response) => {
  requireSystemAdmin(req);
  const { caseId } = req.params;
  const { status, resolutionNote, assigneeId } = req.body ?? {};

  if (!status || !['open', 'in_review', 'resolved', 'dismissed'].includes(status)) {
    throw new BadRequestError('status must be one of: open, in_review, resolved, dismissed');
  }

  const updated = await prisma.teamUpModerationCase.update({
    where: { id: caseId },
    data: {
      status,
      resolutionNote:
        typeof resolutionNote === 'string' ? sanitizeString(resolutionNote) : undefined,
      assigneeId: assigneeId ? String(assigneeId) : undefined,
      decisionAt: ['resolved', 'dismissed'].includes(status) ? new Date() : null,
      decidedByUserId: ['resolved', 'dismissed'].includes(status) ? req.user!.id : null,
    },
    include: {
      teamUpRequest: { select: { id: true, title: true } },
      reporter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  res.json(updated);
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

export const getTeamUpAnalytics = async (req: Request, res: Response) => {
  const { fromDate, toDate } = req.query;
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (fromDate) {
    const parsed = new Date(String(fromDate));
    if (!isNaN(parsed.getTime())) dateFilter.gte = parsed;
  }
  if (toDate) {
    const parsed = new Date(String(toDate));
    if (!isNaN(parsed.getTime())) dateFilter.lte = parsed;
  }

  const requestWhere = Object.keys(dateFilter).length
    ? { createdAt: dateFilter }
    : undefined;

  const [views, applications, accepted, attendance, requests] = await Promise.all([
    prisma.teamUpRequestView.count({
      where: requestWhere
        ? {
            viewedAt: dateFilter,
          }
        : undefined,
    }),
    prisma.teamUpResponse.count({
      where: requestWhere
        ? {
            createdAt: dateFilter,
          }
        : undefined,
    }),
    prisma.teamUpResponse.count({
      where: {
        status: 'accepted',
        ...(requestWhere
          ? {
              createdAt: dateFilter,
            }
          : {}),
      },
    }),
    prisma.teamUpResponse.count({
      where: {
        attendanceStatus: { in: ['attended', 'late'] },
      },
    }),
    prisma.teamUpRequest.findMany({
      where: requestWhere,
      select: {
        id: true,
        sportType: true,
        city: true,
        createdAt: true,
        responses: {
          where: { status: 'accepted' },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    }),
  ]);

  const fillTimes = requests
    .map((item) => {
      const firstAccepted = item.responses[0];
      if (!firstAccepted) return null;
      return {
        sportType: item.sportType,
        city: item.city ?? 'unknown',
        fillHours:
          (new Date(firstAccepted.createdAt).getTime() - new Date(item.createdAt).getTime()) /
          (1000 * 60 * 60),
      };
    })
    .filter((value): value is { sportType: string; city: string; fillHours: number } => Boolean(value));

  const averageFillTimeHours =
    fillTimes.length === 0
      ? 0
      : clampScore(fillTimes.reduce((sum, item) => sum + item.fillHours, 0) / fillTimes.length);

  const conversion = {
    viewToApply: views === 0 ? 0 : clampScore((applications / views) * 100),
    applyToAccept: applications === 0 ? 0 : clampScore((accepted / applications) * 100),
    acceptToAttend: accepted === 0 ? 0 : clampScore((attendance / accepted) * 100),
  };

  res.json({
    funnel: {
      views,
      applications,
      accepted,
      attended: attendance,
      conversion,
    },
    fillTime: {
      averageHours: averageFillTimeHours,
      samples: fillTimes,
    },
  });
};
