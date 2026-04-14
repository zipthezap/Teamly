import prisma from '../config/database';
import { logger } from '../utils/logger';
import { Request, Response } from 'express';
import * as teamUpService from '../services/teamUpService';
import * as locationService from '../services/locationService';
import * as teamUpNotificationService from '../services/teamUpNotificationService';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { parseCoordinates, parseFloatStrict } from '../utils/validation';

// Valid request types
const VALID_REQUEST_TYPES = ['need_players', 'looking_for_play'] as const;
type TeamUpRequestType = (typeof VALID_REQUEST_TYPES)[number];

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
    skillLevel
  } = req.body;

  if (!title || !sportType) {
    throw new BadRequestError('title and sportType are required');
  }

  // Validate requestType
  const resolvedRequestType: TeamUpRequestType =
    requestType && VALID_REQUEST_TYPES.includes(requestType as TeamUpRequestType)
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

  // Validate sanitized required fields are not empty
  if (!sanitized.title || !sanitized.sportType) {
    throw new BadRequestError('Title and sport type cannot be empty or whitespace-only');
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

  // Validate playersNeeded if provided
  const players = playersNeeded ? parseInt(playersNeeded) : 1;
  if (players < 1) {
    throw new BadRequestError('playersNeeded must be at least 1');
  }

  // Set expiration to 1 hour after the session time (or 30 days for availability windows)
  const expiresAt = new Date(eventDate.getTime() + 60 * 60 * 1000);

  // Parse coordinates once if provided
  const coordinates = latitude && longitude ? parseCoordinates(latitude, longitude) : null;

  const teamUpRequest = await prisma.teamUpRequest.create({
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
      skillLevel: sanitized.skillLevel,
      status: 'open',
      expiresAt
    },
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
      }
    }
  });

  const enrichedRequest = locationService.enrichWithLocationInfo(teamUpRequest);

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
    fromDate,
    toDate,
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
  if (requestType && VALID_REQUEST_TYPES.includes(requestType as TeamUpRequestType)) {
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

  // Add cursor-based pagination if cursor is provided
  if (cursor) {
    where.id = { gt: cursor as string };
  }

  // Optimize query - fetch responses separately for large result sets
  const teamUpRequests = await prisma.teamUpRequest.findMany({
    where,
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
      }
    },
    orderBy: [
      { dateTime: 'asc' },
      { id: 'asc' } // Secondary sort for cursor stability
    ],
    take: validatedLimit,
    skip: cursor ? 0 : validatedOffset // Skip only for offset pagination
  });

  // Get accepted responses for the fetched requests (batch query for efficiency)
  const requestIds = teamUpRequests.map(r => r.id);
  const acceptedResponses = await prisma.teamUpResponse.findMany({
    where: {
      teamUpRequestId: { in: requestIds },
      status: 'accepted'
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profilePicture: true
        }
      }
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
  const requestsWithResponses = teamUpRequests.map(request => ({
    ...request,
    responses: responsesByRequest.get(request.id) || []
  }));

  // Enrich with location info
  const enrichedRequests = requestsWithResponses.map(request => 
    locationService.enrichWithLocationInfo(request)
  );

  // Calculate next cursor for cursor-based pagination
  const nextCursor = teamUpRequests.length === validatedLimit 
    ? teamUpRequests[teamUpRequests.length - 1].id 
    : null;

  // Return paginated response with metadata
  res.json({
    data: enrichedRequests,
    pagination: {
      limit: validatedLimit,
      offset: validatedOffset,
      total: enrichedRequests.length,
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

  const teamUpRequests = await prisma.teamUpRequest.findMany({
    where,
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
        select: { responses: true, comments: true }
      }
    },
    orderBy: { dateTime: 'asc' }
  });

  // Enrich with location info
  const enrichedRequests = teamUpRequests.map(request => 
    locationService.enrichWithLocationInfo(request)
  );

  res.json(enrichedRequests);
};

// Get a specific TeamUp request
export const getTeamUpRequest = async (req: Request, res: Response) => {
  const { id } = req.params;

  const teamUpRequest = await prisma.teamUpRequest.findUnique({
    where: { id },
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
      },
      comments: {
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

  const enrichedRequest = locationService.enrichWithLocationInfo(teamUpRequest);

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
    status
  } = req.body;

  const teamUpRequest = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { creatorId: true }
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

  const updateData: Record<string, unknown> = {};

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
  if (status !== undefined) updateData.status = status;

  // Validate and set requestType if provided
  if (requestType !== undefined) {
    if (!VALID_REQUEST_TYPES.includes(requestType as TeamUpRequestType)) {
      throw new BadRequestError('requestType must be need_players or looking_for_play');
    }
    updateData.requestType = requestType;
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

  const updated = await prisma.teamUpRequest.update({
    where: { id },
    data: updateData,
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
      },
      _count: {
        select: { responses: true }
      }
    }
  });

  res.json(updated);
};

// Delete a TeamUp request
export const deleteTeamUpRequest = async (req: Request, res: Response) => {
  const { id } = req.params;

  const teamUpRequest = await prisma.teamUpRequest.findUnique({
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
  const { message } = req.body;

  // Sanitize the message
  const sanitized = teamUpService.sanitizeTeamUpData({ message });

  const teamUpRequest = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { 
      status: true, 
      creatorId: true, 
      title: true,
      sportType: true,
      dateTime: true,
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

  // Check if user has already responded
  const existingResponse = await prisma.teamUpResponse.findFirst({
    where: {
      teamUpRequestId: id,
      userId: req.user!.id
    }
  });

  if (existingResponse) {
    throw new BadRequestError('You have already responded to this request');
  }

  const response = await prisma.teamUpResponse.create({
    data: {
      teamUpRequestId: id,
      userId: req.user!.id,
      message: sanitized.message,
      status: 'pending'
    },
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
  } catch (notifError) {
    logger.error('Failed to create TeamUp response notification:', 'teamUpController', { error: notifError });
    // Don't fail the response if notification fails
  }

  res.status(201).json({ message: 'Response submitted', response });
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
  const teamUpRequest = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { 
      creatorId: true, 
      playersNeeded: true, 
      title: true,
      sportType: true,
      dateTime: true,
      location: true
    }
  });

  if (!teamUpRequest) {
    throw new NotFoundError('TeamUp request not found');
  }

  if (teamUpRequest.creatorId !== req.user!.id) {
    throw new ForbiddenError('Only the creator can manage responses');
  }

  const existingResponse = await prisma.teamUpResponse.findUnique({
    where: { id: responseId },
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

  if (!existingResponse) {
    throw new NotFoundError('Response not found');
  }

  if (existingResponse.teamUpRequestId !== id) {
    throw new BadRequestError('Response does not belong to this TeamUp request');
  }

  // Use a transaction to atomically update the response status and conditionally
  // mark the request as filled, preventing concurrent accepts from over-booking.
  const { updated, requestFilled } = await prisma.$transaction(async (tx) => {
    // When accepting, verify we haven't already filled all spots
    if (action === 'accept') {
      const acceptedCount = await tx.teamUpResponse.count({
        where: { teamUpRequestId: id, status: 'accepted' }
      });
      if (acceptedCount >= teamUpRequest.playersNeeded) {
      throw new BadRequestError('Cannot accept: all available spots are already filled');
      }
    }

    const updated = await tx.teamUpResponse.update({
      where: { id: responseId },
      data: { status: action === 'accept' ? 'accepted' : 'declined' },
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

    // Auto-fill: recount after update and mark request filled if needed
    let requestFilled = false;
    if (action === 'accept') {
      const newAcceptedCount = await tx.teamUpResponse.count({
        where: { teamUpRequestId: id, status: 'accepted' }
      });
      if (newAcceptedCount >= teamUpRequest.playersNeeded) {
        await tx.teamUpRequest.update({
          where: { id },
          data: { status: 'filled' }
        });
        requestFilled = true;
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
  } catch (notifError) {
    logger.error('Failed to create TeamUp action notification:', 'teamUpController', { error: notifError });
    // Don't fail the response if notification fails
  }

  res.json({ message: `Response ${action}ed`, response: updated, requestFilled });
};

// Get responses for user's TeamUp requests (creator view: responses others submitted to MY requests)
export const getMyTeamUpResponses = async (req: Request, res: Response) => {
  const responses = await prisma.teamUpResponse.findMany({
    where: {
      teamUpRequest: {
        creatorId: req.user!.id
      }
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePicture: true
        }
      },
      teamUpRequest: {
        select: {
          id: true,
          title: true,
          sportType: true,
          requestType: true,
          dateTime: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(responses);
};

// Get applications I submitted (responder view: responses I submitted to others' requests)
export const getMyTeamUpApplications = async (req: Request, res: Response) => {
  const responses = await prisma.teamUpResponse.findMany({
    where: {
      userId: req.user!.id
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePicture: true
        }
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
    orderBy: { createdAt: 'desc' }
  });

  res.json(responses);
};

// Get nearby TeamUp requests based on location and radius
export const getNearbyTeamUpRequests = async (req: Request, res: Response) => {
  const { latitude, longitude, radius = 10, limit = 50 } = req.query;

  if (!latitude || !longitude) {
    throw new BadRequestError('Latitude and longitude are required');
  }

  const { lat, lon } = parseCoordinates(latitude, longitude);
  const radiusKm = parseFloatStrict(radius, 'Radius');

  // Validate radius (max 100km to prevent excessive queries)
  if (radiusKm <= 0 || radiusKm > 100) {
    throw new BadRequestError('Radius must be between 0 and 100 kilometers');
  }

  // Get all open TeamUp requests with location data
  const requests = await prisma.teamUpRequest.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
      status: 'open',
      dateTime: {
        gte: new Date() // Only show future requests
      }
    },
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
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profilePicture: true
            }
          }
        }
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
    locationService.enrichWithLocationInfo(request)
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

  const teamUpRequest = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!teamUpRequest) {
    throw new NotFoundError('TeamUp request not found');
  }

  const comments = await prisma.teamUpComment.findMany({
    where: { teamUpRequestId: id },
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

  const teamUpRequest = await prisma.teamUpRequest.findUnique({
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
