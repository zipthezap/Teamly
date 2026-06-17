/**
 * Event Controller
 * 
 * This controller manages all session-related operations including:
 * - Event CRUD operations (create, read, update, delete, archive, status)
 * - Event participation (join, leave, update status)
 * - Guest participant management
 * - Recurring events management
 * - Event queries (nearby, statistics, activity feed)
 * - Event export functionality
 */

import prisma from '../config/database';
import { logger } from '../utils/logger';
import { Request, Response } from 'express';
import { createInviteToken } from '../utils/inviteToken';
import { TRANSACTION } from '../config/security';
import * as sessionService from '../services/sessionService';
import { SessionParticipantStatus, GuestParticipantStatus } from '../../shared/types/event.types';
import * as locationService from '../services/locationService';
import { exportToCSV, exportToICalendar, exportToJSON } from '../services/exportService';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { parseCoordinates, parseFloatStrict } from '../utils/validation';
import { hasGroupId } from '../utils/typeGuards';
import { ensureResourceExists } from '../utils/controllerHelpers';
import { CacheService } from '../services/cacheService';
import { InviteService, calculateExpirationDate } from '../services/inviteService';
import { permissionService } from '../services/permissionService';
import { Permission } from '../../shared/types/permissions.types';
import { recordSearchQuery } from '../services/metricsService';

export const getEventByInviteToken = async (req: Request, res: Response) => {
  const { token } = req.params;

  const session = await prisma.session.findFirst({
    where: {
      inviteToken: token
      // Both public and private events can be accessed via valid invite token
      // Private events remain unlisted but accessible to those with the link
    },
    include: {
      creator: {
        select: { id: true, name: true }
      },
      group: {
        select: { id: true, name: true }
      },
      participants: {
        select: {
          id: true,
          status: true,
          user: {
            select: { name: true }
          }
        }
      },
      guestParticipants: {
        select: {
          id: true,
          name: true,
          status: true,
          joinedAt: true
        }
      }
    }
  });

  if (!session) {
    throw new NotFoundError('Event not found or invite link is invalid');
  }

  res.json(session);
};

// Generate or regenerate invite token for an session
export const generateInviteToken = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user is the creator of the session or a group admin
  const session = ensureResourceExists(
    await prisma.session.findUnique({ where: { id } }),
    'Event'
  );

  // Check if user has permission to manage this session
  const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the session creator or group admins can generate invite links');
  }

  // Generate new token
  const inviteToken = createInviteToken();

  // For private events, keep them private but allow invite link access
  // For public events, ensure they stay public
  const updatedSession = await prisma.session.update({
    where: { id },
    data: { 
      inviteToken
    }
  });

  res.json({ 
    inviteToken: updatedSession.inviteToken,
    inviteUrl: `/sessions/join/${updatedSession.inviteToken}`,
    isPublic: updatedSession.isPublic
  });
};

// Join session as guest (no authentication required)
export const joinEventAsGuest = async (req: Request, res: Response) => {
  const { token } = req.params;
  const { name } = req.body;

  if (!name || name.trim().length === 0) {
    throw new BadRequestError('Name is required');
  }

  // Sanitize guest name
  const sanitizedName = sessionService.sanitizeGuestName(name);

  // Use a transaction with serializable isolation to prevent race conditions
  const result = await prisma.$transaction(async (tx) => {
    // Find session by invite token
    const session = await tx.session.findFirst({
      where: {
        inviteToken: token
      }
    });

    if (!session) {
      throw new NotFoundError('Event not found or invite link is invalid');
    }

    // Check max players with accurate count within transaction
    if (session.maxPlayers) {
      const confirmedParticipants = await tx.sessionParticipant.count({
        where: {
          sessionId: session.id,
          status: SessionParticipantStatus.confirmed
        }
      });

      const confirmedGuests = await tx.guestParticipant.count({
        where: {
          sessionId: session.id,
          status: GuestParticipantStatus.confirmed
        }
      });

      const totalConfirmed = confirmedParticipants + confirmedGuests;
      
      if (totalConfirmed >= session.maxPlayers) {
        throw new BadRequestError('Event is full');
      }
    }

    // Check for duplicate guest name within this session
    const existingGuest = await tx.guestParticipant.findFirst({
      where: {
        sessionId: session.id,
        name: sanitizedName
      }
    });

    if (existingGuest) {
      throw new BadRequestError('A guest with this name has already joined the session');
    }

    // Create guest participant as pending — guests must confirm their attendance
    const guestParticipant = await tx.guestParticipant.create({
      data: {
        sessionId: session.id,
        name: sanitizedName,
        status: GuestParticipantStatus.pending
      }
    });

    return { guestParticipant, groupId: session.groupId };
  }, {
    isolationLevel: 'Serializable', // Highest isolation level to prevent race conditions
    maxWait: TRANSACTION.MAX_WAIT_MS,
    timeout: TRANSACTION.TIMEOUT_MS
  });

  // Invalidate events cache for all group members
  await CacheService.deletePattern(`sessions:user:*:group:${result.groupId}:*`);
  await CacheService.deletePattern(`sessions:user:*:group:all:*`);

  res.status(201).json({ 
    message: 'Successfully joined session',
    participant: result.guestParticipant
  });
};

// Get nearby events based on location and radius
export const getNearbyEvents = async (req: Request, res: Response) => {
  const { latitude, longitude, radius = 10, limit = 50 } = req.query;

  if (!latitude || !longitude) {
    throw new BadRequestError('Latitude and longitude are required');
  }

  const { lat, lon } = parseCoordinates(latitude, longitude);
  const radiusKm = parseFloatStrict(radius, 'Radius');
  const parsedLimit = parseFloatStrict(limit, 'Limit');
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    throw new BadRequestError('Limit must be an integer between 1 and 100');
  }
  const safeLimit = parsedLimit;

  // Validate radius (max 100km to prevent excessive queries)
  if (radiusKm <= 0 || radiusKm > 100) {
    throw new BadRequestError('Radius must be between 0 and 100 kilometers');
  }

  // Record search metric for observability of discovery traffic
  recordSearchQuery('sessions');

  const { latDelta, lonDelta } = locationService.calculateBoundingBox(lat, radiusKm);

  // Get all events with location data
    const sessions = await prisma.session.findMany({
      where: {
        AND: [
          { latitude: { not: null } },
          { longitude: { not: null } },
          { latitude: { gte: lat - latDelta, lte: lat + latDelta } },
          { longitude: { gte: lon - lonDelta, lte: lon + lonDelta } },
        ],
        status: 'upcoming', // Only show upcoming events
        archived: false
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, profilePicture: true }
        },
        group: {
          select: { id: true, name: true }
        },
        participants: {
          select: {
            id: true,
            userId: true,
            status: true
          }
        },
        _count: {
          select: { participants: true }
        }
      },
      orderBy: { startTime: 'asc' },
      take: Math.min(safeLimit * 10, 500) // Wider candidate set from DB bounding box
    });

    // Filter by location and add distance
    const nearbyEvents = locationService.filterByLocation(
      sessions,
      lat,
      lon,
      radiusKm
    ).slice(0, safeLimit); // Limit after filtering

  // Enrich with location info
  const enrichedEvents = nearbyEvents.map(session => 
    locationService.enrichWithLocationInfo(session)
  );

  res.json({
    results: enrichedEvents,
    total: enrichedEvents.length,
    center: { latitude: lat, longitude: lon },
    radius: radiusKm
  });
};

/**
 * Export user's events to various formats
 */
export const exportEvents = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const format = (req.query.format as string)?.toLowerCase() || 'csv';
  
  // Validate format
  if (!['csv', 'ical', 'json'].includes(format)) {
    throw new BadRequestError('Invalid format. Supported formats: csv, ical, json');
  }

  logger.debug('Exporting events', 'EventController', { userId, format });

  // Optimize query - only fetch fields needed for export
  const sessions = await prisma.session.findMany({
    where: {
      participants: {
        some: {
          userId: userId
        }
      }
    },
    select: {
      id: true,
      title: true,
      description: true,
      sessionType: true,
      location: true,
      startTime: true,
      endTime: true,
      status: true,
      maxPlayers: true,
      participants: {
        where: {
          userId: userId
        },
        select: {
          status: true,
          userId: true
        }
      },
      _count: {
        select: {
          participants: true
        }
      },
      group: {
        select: {
          name: true
        }
      },
      creator: {
        select: {
          name: true,
          email: true
        }
      }
    },
    orderBy: {
      startTime: 'desc'
    }
  });

  // Transform events to export format
  const exportData = sessions.map(session => {
    const userParticipant = session.participants.find(p => p.userId === userId);
    
    return {
      id: session.id,
      title: session.title,
      description: session.description,
      sessionType: session.sessionType,
      location: session.location,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      participantStatus: userParticipant?.status || 'unknown',
      groupName: session.group.name,
      creatorName: session.creator.name,
      participantCount: session._count.participants,
      maxPlayers: session.maxPlayers
    };
  });

  // Generate export content based on format
  let content: string;
  let filename: string;
  let contentType: string;

  switch (format) {
    case 'csv':
      content = exportToCSV(exportData);
      filename = `teamly-events-${new Date().toISOString().split('T')[0]}.csv`;
      contentType = 'text/csv';
      break;
    
    case 'ical':
      content = exportToICalendar(exportData);
      filename = `teamly-events-${new Date().toISOString().split('T')[0]}.ics`;
      contentType = 'text/calendar';
      break;
    
    case 'json':
      content = exportToJSON(exportData);
      filename = `teamly-events-${new Date().toISOString().split('T')[0]}.json`;
      contentType = 'application/json';
      break;
    
    default:
      throw new BadRequestError('Invalid format');
  }

  // Set headers for file download
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', Buffer.byteLength(content));
  
  logger.debug('Events exported successfully', 'EventController', { 
    userId, 
    format, 
    eventCount: sessions.length 
  });

  res.send(content);
};

/**
 * Get session participants filtered by status
 * Leverages the composite index [sessionId, status] for optimal performance
 */
export const getEventParticipantsByStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.query;

  // Verify user is a member of the group that owns this session
  const session = await prisma.session.findFirst({
    where: {
      id,
      group: {
        members: {
          some: {
            userId: req.user!.id
          }
        }
      }
    }
  });

  if (!session) {
    throw new NotFoundError('Event not found');
  }

  // Build where clause to leverage composite index [sessionId, status]
  const where: Record<string, unknown> = { sessionId: id };
  const validStatuses = Object.values(SessionParticipantStatus);
  if (status && validStatuses.includes(status as SessionParticipantStatus)) {
    where.status = status; // Uses composite index [sessionId, status]
  }

  // Get participants with optimal query using composite index
  const participants = await prisma.sessionParticipant.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePicture: true,
          city: true,
          country: true
        }
      }
    },
    orderBy: {
      joinedAt: 'asc'  // Use joinedAt index for sorting
    }
  });

  // Get counts by status for summary
  const statusCounts = await prisma.sessionParticipant.groupBy({
    by: ['status'],
    where: { sessionId: id },
    _count: true
  });

  // Calculate totals
  const totalAllStatuses = statusCounts.reduce((sum, sc) => sum + sc._count, 0);
  
  const summary = {
    total: totalAllStatuses,  // Total of ALL participants regardless of filter
    filtered: participants.length,  // Number of participants matching the filter
    byStatus: Object.fromEntries(
      statusCounts.map(sc => [sc.status, sc._count])
    )
  };

  res.json({
    participants,
    summary,
    filter: status || 'all'
  });
};

/**
 * Helper function to verify session creator authorization for guest management
 * Returns the session and guest participant if authorization succeeds
 */
const verifyGuestManagementAuth = async (
  sessionId: string,
  guestId: string,
  userId: string
): Promise<{ session: unknown; guest: unknown } | { error: string; status: number }> => {
  // Check if user is the creator of the session
  const session = await prisma.session.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    return { error: 'Event not found', status: 404 };
  }
  // Use sessionService to check management permissions (creator or group admins)
  const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, userId);
  if (!isAuthorized) {
    return { error: 'Only the session creator or group admins can manage guest participants', status: 403 };
  }

  // Verify guest participant belongs to this session
  const guest = await prisma.guestParticipant.findFirst({
    where: {
      id: guestId,
      sessionId: sessionId
    }
  });

  if (!guest) {
    return { error: 'Guest participant not found', status: 404 };
  }

  return { session, guest };
};

/**
 * Update guest participant name
 * Allows the session creator to update a guest's name
 */
export const updateGuestParticipant = async (req: Request, res: Response) => {
  const { id, guestId } = req.params;
  const { name } = req.body;

  if (!name || name.trim().length === 0) {
    throw new BadRequestError('Name is required');
  }

  // Sanitize guest name
  const sanitizedName = sessionService.sanitizeGuestName(name);

  // Verify authorization and get guest
  const authResult = await verifyGuestManagementAuth(id, guestId, req.user!.id);
  if ('error' in authResult) {
    if (authResult.status === 404) {
      throw new NotFoundError(authResult.error);
    }
    throw new ForbiddenError(authResult.error);
  }

  // Update guest participant name
  const updatedGuest = await prisma.guestParticipant.update({
    where: { id: guestId },
    data: { name: sanitizedName }
  });

  // Invalidate events cache for all group members
  if (hasGroupId(authResult.session)) {
    await CacheService.deletePattern(`sessions:user:*:group:${authResult.session.groupId}:*`);
    await CacheService.deletePattern(`sessions:user:*:group:all:*`);
  }

  res.json(updatedGuest);
};

/**
 * Update guest participant status
 * Allows the session creator to update a guest's status (confirmed/declined)
 */
export const updateGuestParticipantStatus = async (req: Request, res: Response) => {
  const { id, guestId } = req.params;
  const { status } = req.body;

  // Validate status
  const validStatuses = Object.values(GuestParticipantStatus);
  if (!status || !validStatuses.includes(status as GuestParticipantStatus)) {
    throw new BadRequestError('Invalid status. Must be one of: confirmed, declined');
  }

  // Verify authorization and get guest
  const authResult = await verifyGuestManagementAuth(id, guestId, req.user!.id);
  if ('error' in authResult) {
    if (authResult.status === 404) {
      throw new NotFoundError(authResult.error);
    }
    throw new ForbiddenError(authResult.error);
  }

  // Update guest participant status
  // Cast to `any` for Prisma client compatibility with generated enum types
  const updatedGuest = await prisma.guestParticipant.update({
    where: { id: guestId },
    data: { status: status as any }
  });

  // Invalidate events cache for all group members
  if (hasGroupId(authResult.session)) {
    await CacheService.deletePattern(`sessions:user:*:group:${authResult.session.groupId}:*`);
    await CacheService.deletePattern(`sessions:user:*:group:all:*`);
  }

  res.json(updatedGuest);
};

/**
 * Remove guest participant from session
 * Allows the session creator to remove a guest participant
 */
export const removeGuestParticipant = async (req: Request, res: Response) => {
  const { id, guestId } = req.params;

  // Verify authorization and get guest
  const authResult = await verifyGuestManagementAuth(id, guestId, req.user!.id);
  if ('error' in authResult) {
    if (authResult.status === 404) {
      throw new NotFoundError(authResult.error);
    }
    throw new ForbiddenError(authResult.error);
  }

  // Delete guest participant
  await prisma.guestParticipant.delete({
    where: { id: guestId }
  });

  // Invalidate events cache for all group members
  if (hasGroupId(authResult.session)) {
    await CacheService.deletePattern(`sessions:user:*:group:${authResult.session.groupId}:*`);
    await CacheService.deletePattern(`sessions:user:*:group:all:*`);
  }

  res.json({ message: 'Guest participant removed successfully' });
};

/**
 * Get all guest participants for an session
 * Allows any group member to view guest participants with optional status filtering
 * Note: Uses group membership check (not session creator) to allow all group members to see guests
 */
export const getGuestParticipants = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.query;

  // Verify user is a member of the group that owns this session
  // This allows any group member to view guests, not just the creator
  const session = await prisma.session.findFirst({
    where: {
      id,
      group: {
        members: {
          some: {
            userId: req.user!.id
          }
        }
      }
    }
  });

  if (!session) {
    throw new NotFoundError('Event not found');
  }

  // Build where clause
  const where: Record<string, unknown> = { sessionId: id };
  const validStatuses = Object.values(GuestParticipantStatus);
  if (status && validStatuses.includes(status as GuestParticipantStatus)) {
    where.status = status;
  }

  // Get guest participants
  const guestParticipants = await prisma.guestParticipant.findMany({
    where,
    orderBy: {
      joinedAt: 'asc'  // Use joinedAt index for sorting
    }
  });

  // Get counts by status for summary
  const statusCounts = await prisma.guestParticipant.groupBy({
    by: ['status'],
    where: { sessionId: id },
    _count: true
  });

  const summary = {
    total: statusCounts.reduce((sum, sc) => sum + sc._count, 0),
    filtered: guestParticipants.length,
    byStatus: Object.fromEntries(
      statusCounts.map(sc => [sc.status, sc._count])
    )
  };

  res.json({
    guestParticipants,
    summary,
    filter: status || 'all'
  });
};

/**
 * Invite a user to an session
 */
export const inviteToEvent = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email, customMessage, expiresInDays } = req.body;

  if (!email) {
    throw new BadRequestError('Email is required');
  }

  // Check if user has permission to invite using proper permission system
  const hasPermission = await permissionService.hasEventPermission(
    req.user!.id,
    id,
    Permission.EVENT_INVITE_MEMBERS
  );
  
  if (!hasPermission) {
    throw new ForbiddenError('You do not have permission to invite members to this session');
  }

  // Find user to invite
  const userToInvite = await prisma.user.findUnique({
    where: { email }
  });

  if (!userToInvite) {
    throw new NotFoundError('User not found');
  }

  // Prevent inviting yourself
  if (userToInvite.id === req.user!.id) {
    throw new BadRequestError('You cannot invite yourself');
  }

  // Get session and inviter details first
  const [session, inviter] = await Promise.all([
    prisma.session.findUnique({ where: { id } }),
    prisma.user.findUnique({ where: { id: req.user!.id } })
  ]);

  if (!session || !inviter) {
    throw new NotFoundError('Event or inviter not found');
  }

  // Calculate expiration
  const expiresAt = expiresInDays 
    ? calculateExpirationDate(expiresInDays)
    : undefined;

  // Use transaction to prevent race conditions
  await prisma.$transaction(async (tx) => {
    // Check if user is already a participant
    const existingParticipant = await tx.sessionParticipant.findUnique({
      where: {
        sessionId_userId: {
          sessionId: id,
          userId: userToInvite.id
        }
      }
    });

    if (existingParticipant) {
      throw new BadRequestError('User is already a participant or has a pending invitation');
    }

    // Create session participant with pending status
    await tx.sessionParticipant.create({
      data: {
        sessionId: id,
        userId: userToInvite.id,
        status: 'pending'
      }
    });

    // Create invite log
    await InviteService.createInviteLog({
      inviterType: 'session',
      entityId: id,
      inviterId: req.user!.id,
      inviteeEmail: userToInvite.email,
      inviteeId: userToInvite.id,
      status: 'sent',
      message: customMessage,
      expiresAt
    });
  });

  // Send invitation email
  await InviteService.sendInvitationEmail({
    recipientName: userToInvite.name,
    recipientEmail: userToInvite.email,
    inviterName: inviter.name,
    resourceId: id,
    resourceName: session.title,
    resourceDescription: session.description || undefined,
    resourceType: 'session',
    actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/events/${id}`,
    customMessage,
    expiresAt
  });

  res.status(201).json({
    message: 'Invitation sent successfully'
  });
};

/**
 * Revoke an session invitation
 */
export const revokeEventInvitation = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email } = req.body;

  if (!email) {
    throw new BadRequestError('Email is required');
  }

  // Check if user has permission to revoke invites
  const hasPermission = await permissionService.hasEventPermission(
    req.user!.id, 
    id, 
    Permission.EVENT_REVOKE_INVITES
  );

  if (!hasPermission) {
    throw new ForbiddenError('You do not have permission to revoke session invitations');
  }

  const result = await InviteService.revokeInvitation('session', id, email, req.user!.id);

  if (!result.success) {
    throw new BadRequestError(result.error || 'Failed to revoke invitation');
  }

  res.json({
    message: 'Invitation revoked successfully'
  });
};

/**
 * Get invite analytics for an session
 */
export const getEventInviteAnalytics = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user has permission to view analytics
  const hasPermission = await permissionService.hasEventPermission(
    req.user!.id, 
    id, 
    Permission.EVENT_VIEW_INVITE_ANALYTICS
  );

  if (!hasPermission) {
    throw new ForbiddenError('You do not have permission to view session invite analytics');
  }

  const analytics = await InviteService.getInviteAnalytics('session', id);

  res.json({
    analytics
  });
};

/**
 * Generate a new invite token for the session
 */
export const generateEventInviteToken = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { expiresInDays = 30 } = req.body;

  // Check if user has permission to manage invites
  const hasPermission = await permissionService.hasEventPermission(
    req.user!.id, 
    id, 
    Permission.EVENT_INVITE_MEMBERS
  );

  if (!hasPermission) {
    throw new ForbiddenError('You do not have permission to generate invite tokens');
  }

  const result = await InviteService.generateInviteToken('session', id, expiresInDays);

  if (!result.success) {
    throw new BadRequestError(result.error || 'Failed to generate invite token');
  }

  res.json({
    message: 'Invite token generated successfully',
    token: result.token,
    expiresAt: result.expiresAt
  });
};
