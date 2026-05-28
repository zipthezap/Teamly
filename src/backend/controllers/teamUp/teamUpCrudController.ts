import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import { Request, Response } from 'express';
import * as teamUpService from '../../services/teamUpService';
import * as locationService from '../../services/locationService';
import * as teamUpNotificationService from '../../services/teamUpNotificationService';

import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors';
import { parseCoordinates } from '../../utils/validation';
import { computeRoleFitForApplication } from './_helpers';

type TeamUpRequestType = teamUpService.TeamUpRequestType;

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
