import { Request, Response } from 'express';

import prisma from '../../../config/database';
import { logger } from '../../../utils/logger';
import { BadRequestError, ForbiddenError } from '../../../utils/errors';
import { ensureResourceExists } from '../../../utils/controllerHelpers';
import { isPrismaUniqueError } from '../../../utils/typeGuards';
import * as tournamentService from '../../../services/tournamentService';
import { clearUserPermissionCache } from '../../../services/permissionService';
import { isTerminalTournamentStatus } from '../../../services/tournamentLifecyclePolicy';
import { NotificationFactory } from '../../../services/notificationFactory';
import { TournamentNotificationType } from '../../../../shared/types/tournament.types';

const assertTournamentNotFinalized = (
  tournament: { status: string },
  message: string
): void => {
  if (isTerminalTournamentStatus(tournament.status)) {
    throw new BadRequestError(message);
  }
};

export const getAdmins = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(
    tournament!,
    userId
  );
  if (!isOrgOrAdmin) {
    throw new ForbiddenError('Only the organizer or a co-organizer can view admin roles');
  }

  const admins = await prisma.tournamentAdminRole.findMany({
    where: { tournamentId: id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      grantedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json(admins);
};

export const addAdmin = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { userId: targetUserId, email } = req.body;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  if (!tournamentService.isOrganizer(tournament!, userId)) {
    throw new ForbiddenError('Only the organizer can delegate admin roles');
  }

  assertTournamentNotFinalized(
    tournament!,
    'Admins can only be managed for active tournaments'
  );

  let resolvedUserId = targetUserId;
  if (!resolvedUserId && email) {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), deletedAt: null },
    });
    if (!user) {
      throw new BadRequestError('No user found with that email');
    }
    resolvedUserId = user.id;
  }

  if (!resolvedUserId) {
    throw new BadRequestError('userId or email is required');
  }

  if (resolvedUserId === userId) {
    throw new BadRequestError(
      'You cannot add yourself as a co-organizer (you are already the organizer)'
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: resolvedUserId },
    select: { id: true, emailVerified: true, deletedAt: true },
  });

  if (!targetUser || targetUser.deletedAt) {
    throw new BadRequestError('User not found');
  }

  if (!targetUser.emailVerified) {
    throw new BadRequestError(
      'Cannot grant admin role to a user with an unverified email address'
    );
  }

  const existingCaptainTeam = await prisma.tournamentTeam.findFirst({
    where: { tournamentId: id, captainUserId: resolvedUserId },
    select: { id: true },
  });
  if (existingCaptainTeam) {
    throw new BadRequestError(
      'This user already has a team registered in this tournament and cannot be a co-organizer'
    );
  }

  const existingPlayerRecord = await prisma.tournamentPlayer.findFirst({
    where: { userId: resolvedUserId, team: { tournamentId: id } },
    select: { id: true },
  });
  if (existingPlayerRecord) {
    throw new BadRequestError(
      'This user is already a registered player in this tournament and cannot be a co-organizer'
    );
  }

  try {
    const adminRole = await prisma.tournamentAdminRole.create({
      data: {
        tournamentId: id,
        userId: resolvedUserId,
        grantedById: userId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        grantedBy: { select: { id: true, name: true } },
      },
    });

    await clearUserPermissionCache(resolvedUserId);

    try {
      await NotificationFactory.createTournamentNotifications({
        tournamentId: id,
        type: TournamentNotificationType.tournament_updated,
        userIds: [resolvedUserId],
        params: {
          tournamentName: tournament!.name,
          updateType: 'admin_added',
        },
        metadata: {
          grantedBy: userId,
        },
        checkMutePreference: false,
      });
    } catch (notifError) {
      logger.error('Failed to notify new co-organizer', 'TournamentController', {
        tournamentId: id,
        resolvedUserId,
        error: notifError,
      });
    }

    logger.info('Co-organizer added', 'TournamentController', {
      tournamentId: id,
      addedUserId: resolvedUserId,
      grantedBy: userId,
    });
    res.status(201).json(adminRole);
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError('This user is already a co-organizer');
    }
    throw error;
  }
};

export const removeAdmin = async (req: Request, res: Response) => {
  const { id, adminUserId } = req.params;
  const userId = req.user!.id;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  ensureResourceExists(tournament, 'Tournament');

  if (!tournamentService.isOrganizer(tournament!, userId)) {
    throw new ForbiddenError('Only the organizer can remove admin roles');
  }

  assertTournamentNotFinalized(
    tournament!,
    'Admins can only be managed for active tournaments'
  );

  if (adminUserId === tournament!.organizerId) {
    throw new BadRequestError('Cannot remove the tournament organizer from admin roles');
  }

  const adminRole = await prisma.tournamentAdminRole.findFirst({
    where: { tournamentId: id, userId: adminUserId },
  });
  ensureResourceExists(adminRole, 'Admin role');

  await prisma.tournamentAdminRole.delete({ where: { id: adminRole!.id } });

  await clearUserPermissionCache(adminUserId);

  try {
    await NotificationFactory.createTournamentNotifications({
      tournamentId: id,
      type: TournamentNotificationType.tournament_updated,
      userIds: [adminUserId],
      params: {
        tournamentName: tournament!.name,
        updateType: 'admin_removed',
      },
      metadata: {
        removedBy: userId,
      },
      checkMutePreference: false,
    });
  } catch (notifError) {
    logger.error('Failed to notify removed co-organizer', 'TournamentController', {
      tournamentId: id,
      adminUserId,
      error: notifError,
    });
  }

  logger.info('Co-organizer removed', 'TournamentController', {
    tournamentId: id,
    removedUserId: adminUserId,
    removedBy: userId,
  });
  res.json({ message: 'Co-organizer removed successfully' });
};
