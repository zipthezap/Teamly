import { Request, Response } from 'express';

import prisma from '../../../config/database';
import { logger } from '../../../utils/logger';
import { BadRequestError, ForbiddenError } from '../../../utils/errors';
import { ensureResourceExists } from '../../../utils/controllerHelpers';
import * as tournamentService from '../../../services/tournamentService';
import { NotificationFactory } from '../../../services/notificationFactory';
import { TournamentNotificationType } from '../../../../shared/types/tournament.types';
import {
  DEFAULT_PAGE_SIZE,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PAGE_SIZE,
} from './_constants';

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
    throw new ForbiddenError('You do not have access to this private tournament');
  }
};

export const createAnnouncement = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { title, body, isPinned } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new BadRequestError('Announcement title is required');
  }
  if (title.trim().length > MAX_NAME_LENGTH) {
    throw new BadRequestError(
      `Announcement title must be at most ${MAX_NAME_LENGTH} characters`
    );
  }
  if (!body || typeof body !== 'string' || !body.trim()) {
    throw new BadRequestError('Announcement body is required');
  }
  if (body.trim().length > MAX_DESCRIPTION_LENGTH) {
    throw new BadRequestError(
      `Announcement body must be at most ${MAX_DESCRIPTION_LENGTH} characters`
    );
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can post announcements');
  }

  const announcement = await prisma.tournamentAnnouncement.create({
    data: {
      tournamentId: id,
      authorId: userId,
      title: title.trim(),
      body: body.trim(),
      isPinned: isPinned === true,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId: id, captainUserId: { not: null } },
    select: { captainUserId: true },
  });

  if (teams.length > 0) {
    await NotificationFactory.createTournamentNotifications({
      tournamentId: id,
      type: TournamentNotificationType.announcement,
      userIds: teams.map((team) => team.captainUserId!),
      params: {
        tournamentName: tournament.name,
        announcementTitle: title.trim(),
      },
      metadata: {
        announcementId: announcement.id,
      },
      checkMutePreference: false,
    });
  }

  logger.info('Announcement created', 'TournamentController', {
    tournamentId: id,
    announcementId: announcement.id,
    userId,
  });

  res.status(201).json(announcement);
};

export const getAnnouncements = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { page, limit } = req.query;

  const parsedPage = Math.max(1, parseInt(page as string, 10) || 1);
  const parsedLimit = Math.min(
    Math.max(1, parseInt(limit as string, 10) || DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );
  const skip = (parsedPage - 1) * parsedLimit;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({
      where: { id },
      select: { id: true, organizerId: true, isPublic: true },
    }),
    'Tournament'
  );

  await assertCanViewTournament(tournament, userId);

  const [announcements, total] = await Promise.all([
    prisma.tournamentAnnouncement.findMany({
      where: { tournamentId: id },
      include: { author: { select: { id: true, name: true } } },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: parsedLimit,
    }),
    prisma.tournamentAnnouncement.count({ where: { tournamentId: id } }),
  ]);

  res.json({
    data: announcements,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  });
};
