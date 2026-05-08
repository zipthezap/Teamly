import { Request, Response } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { NotificationFactory } from '../services/notificationFactory';
import { TournamentNotificationType } from '../../shared/types/tournament.types';
import { ForbiddenError, NotFoundError, BadRequestError } from '../utils/errors';
import { auditLog } from '../utils/prismaExtended';
import { Prisma } from '@prisma/client';

/**
 * Admin controller helpers
 */
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

export const resendInviteNotifications = async (req: Request, res: Response) => {
  requireSystemAdmin(req);
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Missing email in request body' });

  try {
    const logs = await prisma.inviteLog.findMany({ where: { inviteeEmail: email, status: 'sent' } });
    if (logs.length === 0) return res.json({ resent: 0 });

    let resent = 0;

    for (const log of logs) {
      // For tournament invites we expect metadata.teamId
      const metadata = (log.metadata || {}) as Record<string, unknown>;
      const teamIdCandidate = metadata.teamId ?? metadata.team_id;
      const teamId =
        typeof teamIdCandidate === 'string' && teamIdCandidate.trim()
          ? teamIdCandidate
          : null;
      if (!teamId) {
        logger.warn('InviteLog missing teamId in metadata, skipping', 'AdminController', { inviteLogId: log.id });
        continue;
      }

      // Resolve team and tournament
      const team = await prisma.tournamentTeam.findUnique({ where: { id: teamId }, include: { tournament: true } });
      if (!team) {
        logger.warn('Team not found for InviteLog', 'AdminController', { inviteLogId: log.id, teamId });
        continue;
      }

      // Ensure we have an invitee user id
      let inviteeId = log.inviteeId;
      if (!inviteeId) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
          inviteeId = user.id;
          try {
            await prisma.inviteLog.update({ where: { id: log.id }, data: { inviteeId: user.id } });
          } catch (error) {
            logger.warn('Failed to backfill inviteeId on InviteLog during resend', 'AdminController', {
              error,
              inviteLogId: log.id,
            });
          }
        } else {
          // Can't create in-app notification for non-registered user
          continue;
        }
      }

      // Create tournament notification for the invitee
      try {
        await NotificationFactory.createTournamentNotifications({
          tournamentId: team.tournament.id,
          type: TournamentNotificationType.team_invited,
          userIds: [inviteeId],
          params: {
            teamName: team.name,
            inviterName: (await prisma.user.findUnique({ where: { id: log.inviterId } }))?.name || undefined,
            tournamentName: team.tournament.name,
            inviteLogId: log.id
          },
          metadata: {
            actionUrl: `${process.env.FRONTEND_URL}/tournaments/${team.tournament.id}/teams/${team.id}/invitations`,
            actionText: 'View invitation',
            category: 'tournament'
          }
        });
        resent++;
      } catch (e) {
        logger.error('Failed to resend invite notification', 'AdminController', { error: e, inviteLogId: log.id });
      }
    }

    return res.json({ resent });
  } catch (error) {
    logger.error('Failed to process invite-resend request', 'AdminController', { error, email });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTeamUpRequestAdmin = async (req: Request, res: Response) => {
  requireSystemAdmin(req);
  const { id } = req.params;

  const requestRecord = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { id: true, title: true },
  });

  if (!requestRecord) {
    throw new NotFoundError('TeamUp request not found');
  }

  await prisma.teamUpRequest.delete({ where: { id } });
  await auditLog(prisma).create({
    data: {
      entityType: 'teamup',
      entityId: id,
      actorId: req.user!.id,
      action: 'admin_deleted',
      metadata: { title: requestRecord.title },
    },
  });

  res.json({ message: 'TeamUp request deleted' });
};

export const updateTeamUpStatusAdmin = async (req: Request, res: Response) => {
  requireSystemAdmin(req);
  const { id } = req.params;
  const { status } = req.body ?? {};

  if (!status || !['cancelled', 'expired'].includes(status)) {
    throw new BadRequestError('status must be cancelled or expired');
  }

  const updated = await prisma.teamUpRequest.update({
    where: { id },
    data: { status },
    select: { id: true, status: true, title: true },
  }).catch((error): null => {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return null;
    }
    throw error;
  });

  if (!updated) {
    throw new NotFoundError('TeamUp request not found');
  }

  await auditLog(prisma).create({
    data: {
      entityType: 'teamup',
      entityId: id,
      actorId: req.user!.id,
      action: 'admin_status_updated',
      metadata: { status, title: updated.title },
    },
  });

  res.json(updated);
};

export default {
  resendInviteNotifications,
  deleteTeamUpRequestAdmin,
  updateTeamUpStatusAdmin,
};
