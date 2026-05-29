import { Request, Response } from 'express';

import prisma from '../../config/database';
import * as tournamentService from '../../services/tournamentService';
import { BadRequestError, ForbiddenError } from '../../utils/errors';
import { MatchStatus } from '../../../shared/types/tournament.types';
import { logger } from '../../utils/logger';

const assertTournamentNotFinalized = (
  tournament: { status: string },
  message: string = 'Completed or cancelled tournaments cannot be edited'
): void => {
  if (
    tournament.status === 'completed' ||
    tournament.status === 'cancelled'
  ) {
    throw new BadRequestError(message);
  }
};

const requireUserId = (req: Request, res: Response): string | null => {
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ error: 'Missing x-user-id header' });
    return null;
  }
  return userId;
};

export const cancelMatch = async (req: Request, res: Response) => {
  const { id, matchId } = req.params;
  const userId = requireUserId(req, res);
  if (!userId) return;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }

  if (!await tournamentService.isOrganizerOrAdmin(tournament, userId)) {
    throw new ForbiddenError('Only organizers and admins can cancel matches');
  }

  assertTournamentNotFinalized(tournament, 'Cannot cancel matches for completed or cancelled tournaments');

  const match = await prisma.tournamentMatch.findFirst({ where: { id: matchId, tournamentId: id } });
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }

  if (match.status === MatchStatus.CANCELLED) {
    throw new BadRequestError('Match is already cancelled');
  }
  if (match.status === MatchStatus.COMPLETED) {
    throw new BadRequestError('Completed matches cannot be cancelled');
  }

  const updated = await prisma.tournamentMatch.update({
    where: { id: match.id },
    data: { status: MatchStatus.CANCELLED },
  });

  logger.info('Match cancelled', 'TournamentService', { tournamentId: id, matchId, userId });
  res.json(updated);
};
