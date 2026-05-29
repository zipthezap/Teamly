import { Request, Response } from 'express';

import prisma from '../../config/database';
import { logger } from '../../utils/logger';
import * as tournamentService from '../../services/tournamentService';
import { NotificationFactory } from '../../services/notificationFactory';
import { TournamentNotificationType } from '../../../shared/types/tournament.types';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { isValidEmail } from '../../utils/validation';
import { ensureResourceExists } from '../../utils/controllerHelpers';

const TOURNAMENT_SERVICE_URL = process.env.TOURNAMENT_SERVICE_URL;

const parseResponsePayload = async (response: globalThis.Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const proxyToTournamentService = async (
  req: Request,
  res: Response,
  path: string,
  options?: { includeUserName?: boolean; includeUserId?: boolean }
): Promise<boolean> => {
  if (!TOURNAMENT_SERVICE_URL) {
    return false;
  }

  const includeUserId = options?.includeUserId !== false;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (includeUserId && req.user?.id) {
    headers['x-user-id'] = req.user.id;
  }
  if (options?.includeUserName && req.user?.name) {
    headers['x-user-name'] = req.user.name;
  }

  try {
    const response = await fetch(`${TOURNAMENT_SERVICE_URL.replace(/\/$/, '')}${path}`, {
      method: req.method,
      headers,
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body ?? {}) : undefined,
    });

    const payload = await parseResponsePayload(response);
    if (payload === null) {
      return res.status(response.status).end(), true;
    }
    return res.status(response.status).json(payload), true;
  } catch (error) {
    logger.warn('Tournament service unavailable for invitation endpoint, falling back to legacy', 'TournamentController', {
      error,
      method: req.method,
      path,
    });
    return false;
  }
};

/**
 * Get invitation details by token (public — no auth required)
 * Used by the mobile invite page to show context before accept/decline.
 */
export const getInvitationDetails = async (req: Request, res: Response) => {
  const { inviteToken } = req.params;

  const proxied = await proxyToTournamentService(
    req,
    res,
    `/api/tournaments/invitations/preview/${inviteToken}`,
    { includeUserId: false }
  );
  if (proxied) return;

  const invitation = await prisma.tournamentTeamInvitation.findUnique({
    where: { inviteToken },
    include: {
      team: {
        include: {
          tournament: {
            select: { id: true, name: true, sportType: true },
          },
        },
      },
      inviter: {
        select: { id: true, name: true },
      },
    },
  });

  if (!invitation) {
    throw new NotFoundError('Invitation not found');
  }

  if (invitation.status === 'expired' || (invitation.expiresAt && new Date() > new Date(invitation.expiresAt))) {
    throw new BadRequestError('Invitation has expired');
  }

  res.json({
    inviteToken: invitation.inviteToken,
    status: invitation.status,
    inviteeName: invitation.inviteeName,
    inviteeEmail: invitation.inviteeEmail,
    message: invitation.message,
    expiresAt: invitation.expiresAt,
    team: {
      id: invitation.team.id,
      name: invitation.team.name,
    },
    tournament: {
      id: invitation.team.tournament.id,
      name: invitation.team.tournament.name,
      sportType: invitation.team.tournament.sportType,
    },
    inviter: {
      id: invitation.inviter.id,
      name: invitation.inviter.name,
    },
  });
};

/**
 * Send a team invitation
 */
export const sendTeamInvitation = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const proxied = await proxyToTournamentService(
    req,
    res,
    `/api/tournaments/${id}/teams/${teamId}/invitations`,
    { includeUserName: true }
  );
  if (proxied) return;

  const userId = req.user!.id;
  const { inviteeEmail, inviteeName, message } = req.body;

  if (!inviteeEmail) {
    throw new BadRequestError('Invitee email is required');
  }

  if (!isValidEmail(inviteeEmail)) {
    throw new BadRequestError('Invalid email format');
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const team = ensureResourceExists(
    await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id },
    }),
    'Team'
  );

  const canManage = await tournamentService.canManageTeamInvitations(teamId, id, userId);
  if (!canManage) {
    throw new ForbiddenError('Only the organizer or team captain can send invitations');
  }

  const existingPlayer = await prisma.tournamentPlayer.findFirst({
    where: {
      OR: [{ playerEmail: inviteeEmail }, { user: { email: inviteeEmail } }],
      team: { tournamentId: id },
    },
  });

  if (existingPlayer) {
    throw new BadRequestError('This user is already a player in a team for this tournament');
  }

  const inviteeUserRecord = await prisma.user.findFirst({
    where: { email: inviteeEmail.toLowerCase() },
    select: { id: true },
  });
  if (inviteeUserRecord) {
    const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, inviteeUserRecord.id);
    if (isOrgOrAdmin) {
      throw new BadRequestError('Tournament organizers and co-organizers cannot be invited as players');
    }
    const existingCaptainTeam = await prisma.tournamentTeam.findFirst({
      where: { tournamentId: id, captainUserId: inviteeUserRecord.id },
      select: { id: true },
    });
    if (existingCaptainTeam) {
      throw new BadRequestError('This user is already a team captain in this tournament');
    }
  }

  const existingInvitation = await prisma.tournamentTeamInvitation.findFirst({
    where: {
      teamId,
      inviteeEmail,
      status: 'pending',
    },
  });

  if (existingInvitation) {
    throw new BadRequestError('An invitation has already been sent to this email');
  }

  const invitation = await tournamentService.createTeamInvitation(
    teamId,
    userId,
    inviteeEmail,
    inviteeName,
    message
  );

  try {
    const inviteUrl = `${process.env.FRONTEND_URL}/tournaments/invite/${invitation.inviteToken}`;
    const { sendEmail } = await import('../../utils/emailService');
    await sendEmail(
      inviteeEmail,
      'tournamentTeamInvitation',
      inviteeName || inviteeEmail,
      req.user!.name,
      team.name,
      tournament.name,
      inviteUrl,
      message
    );
  } catch (emailError) {
    logger.error('Failed to send team invitation email', 'TournamentController', {
      tournamentId: id,
      teamId,
      inviteeEmail,
      error: emailError,
    });
  }

  try {
    const inviteeUser = invitation.inviteeUser || await prisma.user.findUnique({ where: { email: inviteeEmail } });
    if (inviteeUser) {
      await NotificationFactory.createTournamentNotifications({
        tournamentId: id,
        type: TournamentNotificationType.team_invited,
        userIds: [inviteeUser.id],
        params: {
          teamName: team.name,
          inviterName: req.user!.name,
          tournamentName: tournament.name,
          inviteToken: invitation.inviteToken,
        },
        metadata: {
          actionUrl: `${process.env.FRONTEND_URL}/tournaments/${id}/teams/${teamId}/invitations/${invitation.inviteToken}/accept`,
          actionText: 'View invitation',
          category: 'tournament',
        },
        deduplicateWindow: 1000 * 60 * 5,
      });
    }
  } catch (notifError) {
    logger.error('Failed to create in-app notification for team invitation', 'TournamentController', {
      tournamentId: id,
      teamId,
      inviteeEmail,
      error: notifError,
    });
  }

  logger.info('Team invitation sent', 'TournamentController', {
    tournamentId: id,
    teamId,
    inviteeEmail,
    userId,
  });

  res.status(201).json(invitation);
};

/**
 * Get team invitations
 */
export const getTeamInvitations = async (req: Request, res: Response) => {
  const { id, teamId } = req.params;
  const proxied = await proxyToTournamentService(
    req,
    res,
    `/api/tournaments/${id}/teams/${teamId}/invitations`
  );
  if (proxied) return;

  const userId = req.user!.id;

  await ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  await ensureResourceExists(
    await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id },
    }),
    'Team'
  );

  const canManage = await tournamentService.canManageTeamInvitations(teamId, id, userId!);
  if (!canManage) {
    throw new ForbiddenError('Only the organizer or team captain can view invitations');
  }
  const invitations = await tournamentService.getTeamInvitations(teamId);
  res.json(invitations);
};

/**
 * Get user's pending invitations
 */
export const getUserInvitations = async (req: Request, res: Response) => {
  const proxied = await proxyToTournamentService(
    req,
    res,
    '/api/tournaments/invitations/my'
  );
  if (proxied) return;

  const userId = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const invitations = await tournamentService.getUserPendingInvitations(user.email);

  res.json(invitations);
};

/**
 * Get invitation details by token (authenticated — invitee or team captain/organizer only)
 */
export const getInvitationByToken = async (req: Request, res: Response) => {
  const { inviteToken } = req.params;
  const proxied = await proxyToTournamentService(
    req,
    res,
    `/api/tournaments/invitations/${inviteToken}`
  );
  if (proxied) return;

  const userId = req.user!.id;

  const invitation = await prisma.tournamentTeamInvitation.findUnique({
    where: { inviteToken },
    include: {
      team: { include: { tournament: true } },
      inviter: { select: { id: true, name: true, email: true } },
      inviteeUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (!invitation) {
    return res.status(404).json({ error: 'Invitation not found' });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const isInvitee = user?.email === invitation.inviteeEmail;
  const canManage = await tournamentService.canManageTeamInvitations(
    invitation.teamId,
    invitation.team.tournamentId,
    userId
  );

  if (!isInvitee && !canManage) {
    throw new ForbiddenError('You do not have permission to view this invitation');
  }

  res.json(invitation);
};

/**
 * Accept a team invitation
 */
export const acceptTeamInvitation = async (req: Request, res: Response) => {
  const { inviteToken } = req.params;
  const proxied = await proxyToTournamentService(
    req,
    res,
    `/api/tournaments/invitations/${inviteToken}/accept`
  );
  if (proxied) return;

  const userId = req.user!.id;

  const invitation = await tournamentService.acceptTeamInvitation(inviteToken, userId);

  logger.info('Team invitation accepted', 'TournamentController', {
    invitationId: invitation.id,
    teamId: invitation.teamId,
    userId,
  });

  try {
    const joinedUser = invitation.inviteeUser ?? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    const teamWithCaptain = invitation.team
      ? await prisma.tournamentTeam.findUnique({
          where: { id: invitation.team.id },
          include: {
            captainUser: { select: { id: true, name: true, email: true } },
            tournament: { select: { id: true, name: true } },
          },
        })
      : null;
    if (teamWithCaptain && teamWithCaptain.captainUser && joinedUser) {
      await NotificationFactory.createTournamentNotifications({
        tournamentId: teamWithCaptain.tournament?.id ?? invitation.team?.tournament?.id ?? invitation.team?.tournamentId ?? '',
        type: TournamentNotificationType.team_registered,
        userIds: [teamWithCaptain.captainUser.id],
        params: {
          teamName: teamWithCaptain.name,
          playerName: joinedUser.name,
          tournamentName: teamWithCaptain.tournament?.name ?? invitation.team?.tournament?.name,
        },
        metadata: {
          actionUrl: `${process.env.FRONTEND_URL}/tournaments/${teamWithCaptain.tournament?.id ?? invitation.team?.tournament?.id}/teams/${teamWithCaptain.id}`,
          actionText: 'View team roster',
          category: 'tournament',
        },
      });
    }
  } catch (notifError) {
    logger.error('Failed to notify captain about accepted invitation', 'TournamentController', {
      error: notifError,
      invitationId: invitation.id,
    });
  }

  res.json({
    message: 'Invitation accepted successfully',
    team: invitation.team,
  });
};

/**
 * Decline a team invitation
 */
export const declineTeamInvitation = async (req: Request, res: Response) => {
  const { inviteToken } = req.params;
  const proxied = await proxyToTournamentService(
    req,
    res,
    `/api/tournaments/invitations/${inviteToken}/decline`
  );
  if (proxied) return;

  const userId = req.user!.id;

  const invitation = await prisma.tournamentTeamInvitation.findUnique({
    where: { inviteToken },
  });

  if (!invitation) {
    throw new NotFoundError('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new BadRequestError('Invitation has already been processed');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.email !== invitation.inviteeEmail) {
    throw new ForbiddenError('This invitation is for a different email address');
  }

  await prisma.tournamentTeamInvitation.update({
    where: { id: invitation.id },
    data: { status: 'declined' },
  });

  logger.info('Team invitation declined', 'TournamentController', {
    invitationId: invitation.id,
    teamId: invitation.teamId,
    userId,
  });

  try {
    const teamWithCaptain = await prisma.tournamentTeam.findUnique({
      where: { id: invitation.teamId },
      include: {
        captainUser: { select: { id: true, name: true, email: true } },
        tournament: { select: { id: true, name: true } },
      },
    });
    const declinedUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    if (teamWithCaptain && teamWithCaptain.captainUser && declinedUser) {
      await NotificationFactory.createTournamentNotifications({
        tournamentId: teamWithCaptain.tournament?.id ?? '',
        type: TournamentNotificationType.tournament_updated,
        userIds: [teamWithCaptain.captainUser.id],
        params: {
          teamName: teamWithCaptain.name,
          playerName: declinedUser.name,
          tournamentName: teamWithCaptain.tournament?.name,
        },
        metadata: {
          actionUrl: `${process.env.FRONTEND_URL}/tournaments/${teamWithCaptain.tournament?.id ?? ''}/teams/${teamWithCaptain.id}`,
          actionText: 'View team roster',
          category: 'tournament',
        },
      });
    }
  } catch (notifError) {
    logger.error('Failed to notify captain about declined invitation', 'TournamentController', {
      error: notifError,
      invitationId: invitation.id,
    });
  }

  res.json({ message: 'Invitation declined' });
};

/**
 * Cancel a team invitation (captain only)
 */
export const cancelTeamInvitation = async (req: Request, res: Response) => {
  const { id, teamId, invitationId } = req.params;
  const proxied = await proxyToTournamentService(
    req,
    res,
    `/api/tournaments/${id}/teams/${teamId}/invitations/${invitationId}`
  );
  if (proxied) return;

  const userId = req.user!.id;

  await ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  await ensureResourceExists(
    await prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id },
    }),
    'Team'
  );

  const invitation = ensureResourceExists(
    await prisma.tournamentTeamInvitation.findUnique({
      where: { id: invitationId },
    }),
    'Invitation'
  );

  if (invitation.teamId !== teamId) {
    throw new BadRequestError('Invitation does not belong to this team');
  }

  const canManage = await tournamentService.canManageTeamInvitations(teamId, id, userId);
  if (!canManage) {
    throw new ForbiddenError('Only the organizer or team captain can cancel invitations');
  }

  await tournamentService.cancelTeamInvitation(invitationId);

  logger.info('Team invitation cancelled', 'TournamentController', {
    tournamentId: id,
    teamId,
    invitationId,
    userId,
  });

  res.json({ message: 'Invitation cancelled successfully' });
};
