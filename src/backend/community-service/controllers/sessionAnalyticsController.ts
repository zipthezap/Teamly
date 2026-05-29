import { Request, Response } from 'express';

import prisma from '../../config/database';
import { getSessionActivity } from '../../services/sessionNotification';
import { validateSessionStatus } from '../../services/sessionValidation';
import { logger } from '../../utils/logger';
import * as sessionService from '../../services/sessionService';
import { SessionNotificationType } from '../../../shared/types/event.types';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { ensureResourceExists } from '../../utils/controllerHelpers';
import { NotificationFactory } from '../../services/notificationFactory';

export const getUserStatistics = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const now = new Date();

    const userParticipations = await prisma.sessionParticipant.findMany({
      where: { userId },
      include: {
        session: {
          include: {
            group: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    const createdEvents = await prisma.session.findMany({
      where: { creatorId: userId },
      include: {
        participants: true,
        group: {
          select: { id: true, name: true },
        },
      },
    });

    const totalEventsJoined = userParticipations.length;
    const totalEventsCreated = createdEvents.length;
    const upcomingEvents = userParticipations.filter((participation) => new Date(participation.session.startTime) > now).length;
    const pastEvents = userParticipations.filter((participation) => new Date(participation.session.startTime) <= now).length;
    const confirmedEvents = userParticipations.filter((participation) => participation.status === 'confirmed').length;

    const eventTypeBreakdown: Record<string, number> = {};
    userParticipations.forEach((participation) => {
      const type = participation.session.sessionType;
      eventTypeBreakdown[type] = (eventTypeBreakdown[type] || 0) + 1;
    });

    const upcomingEventsDetails = userParticipations
      .filter((participation) => new Date(participation.session.startTime) > now)
      .sort((a, b) => new Date(a.session.startTime).getTime() - new Date(b.session.startTime).getTime())
      .slice(0, 5)
      .map((participation) => ({
        id: participation.session.id,
        title: participation.session.title,
        sessionType: participation.session.sessionType,
        startTime: participation.session.startTime,
        group: participation.session.group,
        status: participation.status,
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
        totalParticipants: createdEvents.reduce((sum, event) => sum + event.participants.length, 0),
        avgParticipantsPerEvent: createdEvents.length > 0
          ? createdEvents.reduce((sum, event) => sum + event.participants.length, 0) / createdEvents.length
          : 0,
      },
    };

    res.json(statistics);
  } catch (error) {
    logger.error('Get user statistics error', 'CommunityService', { error });
    return res.status(500).json({ error: 'Failed to get statistics' });
  }
};

export const archiveEvent = async (req: Request, res: Response) => {
  const { id } = req.params;

  const session = ensureResourceExists(await prisma.session.findUnique({ where: { id } }), 'Event');

  const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the session creator or group admins can archive it');
  }

  const updatedSession = await prisma.session.update({
    where: { id },
    data: { archived: true },
  });

  res.json({ message: 'Event archived successfully', session: updatedSession });
};

export const unarchiveEvent = async (req: Request, res: Response) => {
  const { id } = req.params;

  const session = ensureResourceExists(await prisma.session.findUnique({ where: { id } }), 'Event');

  const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the session creator or group admins can unarchive it');
  }

  const updatedSession = await prisma.session.update({
    where: { id },
    data: { archived: false },
  });

  res.json({ message: 'Event unarchived successfully', session: updatedSession });
};

export const updateSessionStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const statusValidation = validateSessionStatus(status);
  if (!statusValidation.isValid) {
    throw new BadRequestError(statusValidation.error!);
  }

  const session = ensureResourceExists(
    await prisma.session.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, profilePicture: true },
            },
          },
        },
      },
    }),
    'Event'
  );

  const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
  if (!isAuthorized) {
    throw new ForbiddenError('Only the session creator or group admins can update session status');
  }

  const updatedSession = await prisma.session.update({
    where: { id },
    data: { status },
  });

  const participantIds = session.participants
    .filter((participant) => participant.userId !== req.user!.id)
    .map((participant) => participant.userId);

  if (participantIds.length > 0) {
    await NotificationFactory.createSessionNotifications({
      sessionId: id,
      type: SessionNotificationType.status_change,
      userIds: participantIds,
      params: {
        name: req.user!.name,
        eventTitle: session.title,
        newStatus: status,
        oldStatus: session.status,
      },
      metadata: {
        newStatus: status,
        oldStatus: session.status,
      },
      checkMutePreference: true,
      deduplicateWindow: 60000,
    });
  }

  res.json({ message: 'Event status updated successfully', session: updatedSession });
};

export const getEventActivityFeed = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, limit, startDate, endDate } = req.query;

  const session = await prisma.session.findFirst({
    where: {
      id,
      group: {
        members: {
          some: {
            userId: req.user!.id,
          },
        },
      },
    },
  });

  if (!session) {
    throw new NotFoundError('Event not found or access denied');
  }

  const options: Record<string, unknown> = {
    limit: limit ? parseInt(limit as string) : 50,
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
    activity,
  });
};