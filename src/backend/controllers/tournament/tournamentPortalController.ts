import { randomBytes } from 'crypto';
import { Request, Response } from 'express';

import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import { ensureResourceExists } from '../../utils/controllerHelpers';
import * as tournamentService from '../../services/tournamentService';
import { SHARE_TOKEN_BYTES } from './_constants';

export const generateShareToken = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers/admins can generate a share token');
  }

  const shareToken = randomBytes(SHARE_TOKEN_BYTES).toString('hex');
  const updated = await prisma.tournament.update({
    where: { id },
    data: { shareToken },
    select: { id: true, name: true, shareToken: true },
  });

  logger.info('Share token generated', 'TournamentController', {
    tournamentId: id,
    userId,
  });
  res.json(updated);
};

export const getPublicTournamentPortal = async (req: Request, res: Response) => {
  const { shareToken } = req.params;

  const tournament = await prisma.tournament.findFirst({
    where: {
      OR: [{ shareToken }, { id: shareToken }],
      isPublic: true,
    },
    include: {
      organizer: { select: { id: true, name: true } },
      courts: {
        where: { isActive: true },
        select: { id: true, name: true, location: true },
      },
      announcements: {
        where: { isPinned: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          body: true,
          isPinned: true,
          createdAt: true,
        },
      },
    },
  });

  if (!tournament) {
    throw new NotFoundError('Tournament not found or is not public');
  }

  const [teams, matches, standings] = await Promise.all([
    prisma.tournamentTeam.findMany({
      where: { tournamentId: tournament.id },
      select: {
        id: true,
        name: true,
        checkedIn: true,
        seedNumber: true,
        poolId: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.tournamentMatch.findMany({
      where: { tournamentId: tournament.id },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        court: { select: { id: true, name: true } },
      },
      orderBy: [{ stage: 'asc' }, { roundNumber: 'asc' }, { matchOrder: 'asc' }],
    }),
    prisma.tournamentStanding.findMany({
      where: { tournamentId: tournament.id },
      include: { team: { select: { id: true, name: true } } },
      orderBy: [{ points: 'desc' }, { groupName: 'asc' }],
    }),
  ]);

  const sortedStandings = tournamentService.sortStandingsByTiebreakerRules(
    standings,
    tournament.tiebreakerRules as string[] | null
  );

  res.json({
    tournament,
    teams,
    matches,
    standings: sortedStandings,
    courts: tournament.courts,
    announcements: tournament.announcements,
  });
};
