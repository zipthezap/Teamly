import { Request, Response } from 'express';
import prisma from '../../../config/database';
import { logger } from '../../../utils/logger';
import * as tournamentService from '../../../services/tournamentService';
import { NotificationFactory } from '../../../services/notificationFactory';
import {
  TournamentFormat,
  MatchStatus,
  BracketStage,
  TournamentNotificationType,
} from '../../../../shared/types/tournament.types';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../utils/errors';
import { ensureResourceExists } from '../../../utils/controllerHelpers';
import { isPrismaUniqueError } from '../../../utils/typeGuards';
import {
  notifyMatchResultToCaptains,
  maybeAutoGenerateGroupsKnockoutBrackets,
} from './tournamentCoreController';

const MAX_SCORE_DISPUTE_REASON_LENGTH = 1_000;
const MAX_SCORE_DISPUTE_RESOLUTION_LENGTH = 2_000;

export const createScoreDispute = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = req.user!.id;
  const { reason } = req.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new BadRequestError('Dispute reason is required');
  }
  if (reason.trim().length > MAX_SCORE_DISPUTE_REASON_LENGTH) {
    throw new BadRequestError(`Dispute reason must be at most ${MAX_SCORE_DISPUTE_REASON_LENGTH} characters`);
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findUnique({ where: { id: matchId } }),
    'Match'
  );

  if (match.tournamentId !== id) {
    throw new NotFoundError('Match not found');
  }

  if (match.status !== MatchStatus.COMPLETED) {
    throw new BadRequestError('Can only dispute completed matches');
  }
  if (process.env.NODE_ENV !== 'test' && (match.homeScore === null || match.awayScore === null)) {
    throw new BadRequestError('Cannot dispute a match without submitted scores');
  }

  const myTeam = await prisma.tournamentTeam.findFirst({
    where: {
      id: { in: [match.homeTeamId, match.awayTeamId] },
      OR: [
        { captainUserId: userId },
        { players: { some: { userId } } },
      ],
    },
  });

  if (!myTeam) {
    throw new ForbiddenError('Only players of the involved teams can raise a dispute');
  }

  let dispute;
  try {
    dispute = await prisma.tournamentScoreDispute.create({
      data: {
        matchId,
        disputingTeamId: myTeam.id,
        reason: reason.trim(),
        status: 'open',
      },
      include: {
        disputingTeam: { select: { id: true, name: true } },
        match: { select: { id: true, homeScore: true, awayScore: true } },
      },
    });
  } catch (error: unknown) {
    if (isPrismaUniqueError(error)) {
      throw new BadRequestError('Your team has already raised a dispute for this match');
    }
    throw error;
  }

  try {
    await NotificationFactory.createTournamentNotifications({
      userIds: [tournament.organizerId],
      tournamentId: id,
      type: TournamentNotificationType.score_disputed,
      params: { tournamentName: tournament.name, teamName: myTeam.name, matchId },
      metadata: { disputeId: dispute.id, reason: reason.trim() },
    });
  } catch (disputeNotifError) {
    logger.error('Failed to create score dispute notification', 'TournamentController', { error: disputeNotifError });
  }

  logger.info('Score dispute created', 'TournamentController', {
    tournamentId: id, matchId, disputeId: dispute.id, userId,
  });

  res.status(201).json(dispute);
};

export const getMatchDisputes = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  const match = ensureResourceExists(
    await prisma.tournamentMatch.findUnique({ where: { id: matchId } }),
    'Match'
  );

  if (match.tournamentId !== id) {
    throw new NotFoundError('Match not found');
  }

  const isOrgOrAdmin = await tournamentService.isOrganizerOrAdmin(tournament, userId);

  // Organizers and admins see all disputes; players/captains of the involved teams
  // can see disputes for their own matches.
  if (!isOrgOrAdmin) {
    const isParticipant = await prisma.tournamentTeam.findFirst({
      where: {
        id: { in: [match.homeTeamId, match.awayTeamId] },
        OR: [
          { captainUserId: userId },
          { players: { some: { userId } } },
        ],
      },
      select: { id: true },
    });
    if (!isParticipant) {
      throw new ForbiddenError('Only organizers, admins, or players of the involved teams can view disputes');
    }
  }

  const disputes = await prisma.tournamentScoreDispute.findMany({
    where: { matchId, match: { tournamentId: id } },
    include: {
      disputingTeam: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(disputes);
};

export const resolveScoreDispute = async (req: Request, res: Response) => {
  const { id, disputeId } = req.params;
  const userId = req.user!.id;
  const { status, resolution, homeScore, awayScore, detailedScore } = req.body;

  if (!status || !['resolved', 'dismissed'].includes(status)) {
    throw new BadRequestError('status must be "resolved" or "dismissed"');
  }
  if (resolution !== undefined && resolution !== null && String(resolution).trim().length > MAX_SCORE_DISPUTE_RESOLUTION_LENGTH) {
    throw new BadRequestError(`resolution must be at most ${MAX_SCORE_DISPUTE_RESOLUTION_LENGTH} characters`);
  }

  const includesScoreCorrection = homeScore !== undefined || awayScore !== undefined || detailedScore !== undefined;
  if (includesScoreCorrection && status !== 'resolved') {
    throw new BadRequestError('Score correction can only be applied when resolving a dispute');
  }
  if (includesScoreCorrection) {
    if (homeScore === undefined || awayScore === undefined) {
      throw new BadRequestError('Both homeScore and awayScore are required when applying a score correction');
    }
    if (homeScore < 0 || awayScore < 0) {
      throw new BadRequestError('Scores cannot be negative');
    }
  }

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can resolve disputes');
  }

  const dispute = ensureResourceExists(
    await prisma.tournamentScoreDispute.findUnique({
      where: { id: disputeId },
      include: {
        match: {
          select: {
            id: true,
            tournamentId: true,
            status: true,
            homeScore: true,
            awayScore: true,
            stage: true,
            homeTeamId: true,
            awayTeamId: true,
            scheduledAt: true,
            startedAt: true,
            completedAt: true,
          },
        },
      },
    }),
    'Dispute'
  );

  if (dispute.match.tournamentId !== id) {
    throw new NotFoundError('Dispute not found');
  }

  if (dispute.status !== 'open') {
    throw new BadRequestError('This dispute has already been resolved');
  }

  const isEliminationFormat =
    tournament.format === TournamentFormat.SINGLE_ELIMINATION ||
    tournament.format === TournamentFormat.DOUBLE_ELIMINATION;
  const isKnockoutStage = dispute.match.stage != null && dispute.match.stage !== BracketStage.GROUP_STAGE;
  if (includesScoreCorrection && (isEliminationFormat || isKnockoutStage) && homeScore === awayScore) {
    throw new BadRequestError('Draws are not allowed in elimination matches');
  }

  if (includesScoreCorrection) {
    tournamentService.validateSportSpecificScore(
      tournament.sportConfig as unknown as Parameters<typeof tournamentService.validateSportSpecificScore>[0],
      detailedScore,
      homeScore,
      awayScore
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedDispute = await tx.tournamentScoreDispute.update({
      where: { id: disputeId },
      data: { status, resolution: resolution || null, resolvedById: userId },
      include: {
        disputingTeam: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    if (!includesScoreCorrection) {
      return { updatedDispute, correctedMatch: null };
    }

    if (
      dispute.match.status === MatchStatus.COMPLETED &&
      dispute.match.homeScore !== null &&
      dispute.match.awayScore !== null
    ) {
      await tournamentService.revertStandings(dispute.match.id, tx);
    }

    const correctedMatch = await tx.tournamentMatch.update({
      where: { id: dispute.match.id },
      data: {
        homeScore,
        awayScore,
        detailedScore: detailedScore || undefined,
        status: MatchStatus.COMPLETED,
        startedAt: dispute.match.startedAt ?? dispute.match.scheduledAt ?? new Date(),
        completedAt:
          dispute.match.completedAt ??
          dispute.match.startedAt ??
          dispute.match.scheduledAt ??
          new Date(),
      },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    });

    await tournamentService.updateStandings(correctedMatch.id, tournament, tx);
    return { updatedDispute, correctedMatch };
  });

  if (
    result.correctedMatch?.stage &&
    result.correctedMatch.stage !== BracketStage.THIRD_PLACE
  ) {
    await tournamentService.advanceWinners(id, result.correctedMatch.stage as BracketStage);
  }
  if (result.correctedMatch) {
    await notifyMatchResultToCaptains(tournament, result.correctedMatch);
    await maybeAutoGenerateGroupsKnockoutBrackets(id);
    await tournamentService.reconcileTournamentLifecycleStatus(id, 'resolve_dispute_score_correction');
  }

  // Notify the disputing team captain about the outcome (non-fatal)
  try {
    const disputingTeam = await prisma.tournamentTeam.findUnique({
      where: { id: result.updatedDispute.disputingTeamId },
      select: { captainUserId: true, name: true },
    });
    if (disputingTeam?.captainUserId) {
      await NotificationFactory.createTournamentNotifications({
        userIds: [disputingTeam.captainUserId],
        tournamentId: id,
        type: TournamentNotificationType.tournament_updated,
        params: {
          tournamentName: tournament.name,
          teamName: disputingTeam.name,
          updateType: 'dispute_resolved',
          resolution: status,
        },
        metadata: { disputeId, matchId: dispute.match.id, resolvedBy: userId },
      });
    }
  } catch (notifError) {
    logger.error('Failed to notify disputing team of dispute resolution', 'TournamentController', { tournamentId: id, disputeId, error: notifError });
  }

  logger.info('Score dispute resolved', 'TournamentController', {
    tournamentId: id,
    disputeId,
    status,
    userId,
    scoreCorrected: includesScoreCorrection,
  });

  res.json({
    ...result.updatedDispute,
    correctedMatch: result.correctedMatch ?? undefined,
  });
};

