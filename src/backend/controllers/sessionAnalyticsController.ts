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
import { getSessionActivity } from '../services/sessionNotification';
import { validateSessionStatus } from '../services/sessionValidation';
import { logger } from '../utils/logger';
import { Request, Response } from 'express';
import * as sessionService from '../services/sessionService';
import { SessionNotificationType } from '../../shared/types/event.types';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { ensureResourceExists } from '../utils/controllerHelpers';
import { NotificationFactory } from '../services/notificationFactory';

export const getUserStatistics = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const now = new Date();

    // Get all events where user is a participant
    const userParticipations = await prisma.sessionParticipant.findMany({
      where: { userId },
      include: {
        session: {
          include: {
            group: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    // Get events created by user
    const createdEvents = await prisma.session.findMany({
      where: { creatorId: userId },
      include: {
        participants: true,
        group: {
          select: { id: true, name: true }
        }
      }
    });

    // Calculate statistics
    const totalEventsJoined = userParticipations.length;
    const totalEventsCreated = createdEvents.length;
    
    const upcomingEvents = userParticipations.filter(
      p => new Date(p.session.startTime) > now
    ).length;
    
    const pastEvents = userParticipations.filter(
      p => new Date(p.session.startTime) <= now
    ).length;

    const confirmedEvents = userParticipations.filter(
      p => p.status === 'confirmed'
    ).length;

    // Get session type breakdown
    const eventTypeBreakdown: Record<string, number> = {};
    userParticipations.forEach(p => {
      const type = p.session.sessionType;
      eventTypeBreakdown[type] = (eventTypeBreakdown[type] || 0) + 1;
    });

    // Get upcoming events details (next 5)
    const upcomingEventsDetails = userParticipations
      .filter(p => new Date(p.session.startTime) > now)
      .sort((a, b) => new Date(a.session.startTime).getTime() - new Date(b.session.startTime).getTime())
      .slice(0, 5)
      .map(p => ({
        id: p.session.id,
        title: p.session.title,
        sessionType: p.session.sessionType,
        startTime: p.session.startTime,
        group: p.session.group,
        status: p.status
      }));

    const statistics = {
      totalEventsJoined,
      totalEventsCreated,
      upcomingEvents,
      pastEvents,
      confirmedEvents,
      eventTypeBreakdown,
      upcomingEventsDetails,
      createdEventsStats: {
        total: createdEvents.length,
        totalParticipants: createdEvents.reduce((sum, e) => sum + e.participants.length, 0),
        avgParticipantsPerEvent: createdEvents.length > 0 
          ? createdEvents.reduce((sum, e) => sum + e.participants.length, 0) / createdEvents.length
          : 0
      }
    };

    res.json(statistics);
  } catch (error) {
    logger.error('Get user statistics error', 'EventController', { error });
    return res.status(500).json({ error: 'Failed to get statistics' });
  }
};

// Archive an session
export const archiveEvent = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user is the creator of the session or a group admin
  const session = ensureResourceExists(
    await prisma.session.findUnique({ where: { id } }),
    'Event'
  );

  // Check if user has permission to manage this session
  const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the session creator or group admins can archive it');
  }

  const updatedSession = await prisma.session.update({
    where: { id },
    data: { archived: true }
  });

  res.json({ message: 'Event archived successfully', session: updatedSession });
};

// Unarchive an session
export const unarchiveEvent = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if user is the creator of the session or a group admin
  const session = ensureResourceExists(
    await prisma.session.findUnique({ where: { id } }),
    'Event'
  );

  // Check if user has permission to manage this session
  const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the session creator or group admins can unarchive it');
  }

  const updatedSession = await prisma.session.update({
    where: { id },
    data: { archived: false }
  });

  res.json({ message: 'Event unarchived successfully', session: updatedSession });
};

// Update session status
export const updateSessionStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  // Validate status using the centralized validation function
  const statusValidation = validateSessionStatus(status);
  if (!statusValidation.isValid) {
    throw new BadRequestError(statusValidation.error!);
  }

  // Check if user is the creator of the session or a group admin
  const session = ensureResourceExists(
    await prisma.session.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, profilePicture: true }
            }
          }
        }
      }
    }),
    'Event'
  );

  // Check if user has permission to manage this session
  const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the session creator or group admins can update session status');
  }

  const updatedSession = await prisma.session.update({
    where: { id },
    data: { status }
  });

  // Create notifications for participants about status change using NotificationFactory
  const participantIds = session.participants
    .filter(p => p.userId !== req.user!.id)
    .map(p => p.userId);
  
  if (participantIds.length > 0) {
    await NotificationFactory.createSessionNotifications({
      sessionId: id,
      type: SessionNotificationType.status_change,
      userIds: participantIds,
      params: {
        name: req.user!.name,
        eventTitle: session.title,
        newStatus: status,
        oldStatus: session.status
      },
      metadata: { 
        newStatus: status, 
        oldStatus: session.status 
      },
      checkMutePreference: true,
      deduplicateWindow: 60000 // 1 minute deduplication window
    });
  }

  res.json({ message: 'Event status updated successfully', session: updatedSession });
};

// Get session activity with optional filtering
export const getEventActivityFeed = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, limit, startDate, endDate } = req.query;

  // Check if user has access to the session
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
    throw new NotFoundError('Event not found or access denied');
  }

  const options: Record<string, unknown> = {
    limit: limit ? parseInt(limit as string) : 50
  };

  if (type && typeof type === 'string') {
    options.type = type;
  }

  if (startDate && typeof startDate === 'string') {
    options.startDate = new Date(startDate);
  }

  if (endDate && typeof endDate === 'string') {
    options.endDate = new Date(endDate);
  }

  const activity = await getSessionActivity(id, prisma, options);

  res.json({
    sessionId: id,
    total: activity.length,
    activity
  });
};

// ==================== GUEST PARTICIPANT MANAGEMENT ====================

// Get session by invite token (no authentication required)
// Note: This endpoint allows access to both public AND private events via invite token.
// This is intentional - private events with invite tokens are shared privately via the link,
// which provides controlled access without making the session publicly discoverable.
