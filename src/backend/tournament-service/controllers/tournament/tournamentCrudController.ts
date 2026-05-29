import { Request, Response } from 'express';

import prisma from '../../../config/database';
import { logger } from '../../../utils/logger';
import * as tournamentService from '../../../services/tournamentService';
import { BadRequestError, ForbiddenError } from '../../../utils/errors';
import { ensureResourceExists } from '../../../utils/controllerHelpers';
import {
  TournamentStatus,
  TournamentPaymentTransactionStatus,
} from '../../../../shared/types/tournament.types';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './_constants';

export {
  createTournament,
  updateTournament,
} from './tournamentWriteController';

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

/**
 * Get a single tournament by ID
 */
export const getTournament = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      organizer: {
        select: { id: true, name: true, email: true },
      },
      group: {
        select: { id: true, name: true },
      },
      teams: {
        include: {
          captainUser: {
            select: { id: true, name: true, email: true },
          },
          players: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      },
      matches: {
        include: {
          homeTeam: true,
          awayTeam: true,
          court: { select: { id: true, name: true, location: true } },
          refereeTeam: { select: { id: true, name: true } },
          scorekeeper: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ stage: 'asc' }, { roundNumber: 'asc' }, { matchOrder: 'asc' }, { scheduledAt: 'asc' }],
      },
      standings: {
        include: {
          team: true,
        },
        orderBy: [{ points: 'desc' }],
      },
      categories: {
        orderBy: { sortOrder: 'asc' },
        include: {
          pools: {
            include: {
              teams: { select: { id: true, name: true } },
              waitlist: {
                orderBy: { position: 'asc' },
                include: { team: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
      pools: {
        include: {
          teams: {
            select: { id: true, name: true },
          },
          waitlist: {
            orderBy: { position: 'asc' },
            include: {
              team: { select: { id: true, name: true } },
            },
          },
          category: {
            select: { id: true, name: true, sortOrder: true },
          },
        },
      },
      adminRoles: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          grantedBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  ensureResourceExists(tournament, 'Tournament');

  if (userId) {
    await assertCanViewTournament(
      { id: tournament!.id, organizerId: tournament!.organizerId, isPublic: tournament!.isPublic },
      userId
    );
  } else if (!tournament!.isPublic) {
    throw new ForbiddenError('You do not have access to this private tournament');
  }

  const syncedTournament = await tournamentService.syncTournamentAutoStatus(tournament!, 'detail_read');

  const sortedStandings = tournamentService.sortStandingsByTiebreakerRules(
    syncedTournament.standings ?? [],
    (syncedTournament.tiebreakerRules as string[] | null | undefined) ?? null
  );

  res.json({ ...syncedTournament, standings: sortedStandings });
};

/**
 * Get all tournaments (with optional filters)
 */
export const getTournaments = async (req: Request, res: Response) => {
  const { groupId, status, sportType, search, page, limit } = req.query;
  const userId = req.user!.id;

  const parsedPage = Math.max(1, parseInt(page as string, 10) || 1);
  const parsedLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const skip = (parsedPage - 1) * parsedLimit;

  const where: Record<string, unknown> = {
    OR: [
      { isPublic: true },
      { organizerId: userId },
      { teams: { some: { captainUserId: userId } } },
      { teams: { some: { players: { some: { userId } } } } },
      { adminRoles: { some: { userId } } },
    ],
  };

  if (groupId) {
    where.groupId = groupId as string;
  }

  if (status) {
    where.status = status as TournamentStatus;
  }

  if (sportType) {
    where.sportType = sportType as string;
  }

  if (search) {
    where.name = { contains: search as string, mode: 'insensitive' };
  }

  const [tournaments, total] = await Promise.all([
    prisma.tournament.findMany({
      where,
      include: {
        organizer: {
          select: { id: true, name: true, email: true },
        },
        group: {
          select: { id: true, name: true },
        },
        teams: {
          where: {
            OR: [{ captainUserId: userId }, { players: { some: { userId } } }],
          },
          take: 1,
          select: {
            id: true,
            name: true,
            tournamentId: true,
            poolId: true,
            poolName: true,
            captainUserId: true,
            players: {
              where: { userId },
              select: { userId: true },
            },
          },
        },
        _count: {
          select: {
            teams: true,
            matches: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
      skip,
      take: parsedLimit,
    }),
    prisma.tournament.count({ where }),
  ]);

  const syncedTournaments = await Promise.all(
    tournaments.map((tournament) => tournamentService.syncTournamentAutoStatus(tournament, 'list_read'))
  );

  const payload = syncedTournaments.map((tournament) => {
    const teams = (tournament as unknown as { teams?: unknown[] }).teams ?? [];
    const myTeam = teams.length > 0 ? teams[0] : null;
    return { ...tournament, myTeam };
  });

  res.json({
    data: payload,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  });
};

/**
 * Delete a tournament
 */
export const deleteTournament = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
  });

  ensureResourceExists(tournament, 'Tournament');

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament!, userId);
  if (!isOrgOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can delete the tournament');
  }

  await prisma.tournament.delete({
    where: { id },
  });

  logger.info('Tournament deleted', 'TournamentController', {
    tournamentId: id,
    userId,
  });

  res.json({ message: 'Tournament deleted successfully' });
};

/**
 * Cancel a tournament (organizer only)
 */
export const cancelTournament = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only the organizer or a co-organizer can cancel the tournament');
  }

  if (tournament.status === TournamentStatus.CANCELLED) {
    throw new BadRequestError('Tournament is already cancelled');
  }

  if (tournament.status === TournamentStatus.COMPLETED) {
    throw new BadRequestError('Completed tournaments cannot be cancelled');
  }

  const confirmedPayments = await prisma.tournamentPaymentTransaction.count({
    where: {
      tournamentId: id,
      status: TournamentPaymentTransactionStatus.PAID,
    },
  });
  if (confirmedPayments > 0 && (!tournament.paymentInfo || !String(tournament.paymentInfo).trim())) {
    throw new BadRequestError('Cannot cancel tournament with confirmed payments unless refund policy is configured');
  }

  const updated = await prisma.tournament.update({
    where: { id },
    data: { status: TournamentStatus.CANCELLED },
    include: {
      organizer: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true } },
    },
  });

  // Invalidate TTL cache so subsequent reads reflect the cancellation immediately.
  tournamentService.invalidateSyncCache(id);

  logger.info('Tournament cancelled', 'TournamentController', { tournamentId: id, userId });
  res.json(updated);
};
