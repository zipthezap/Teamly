import { Request, Response } from 'express';
import prisma from '../../../config/database';
import * as tournamentService from '../../../services/tournamentService';
import { computeTournamentAnalytics } from '../../../services/tournament/analyticsService';
import { ForbiddenError } from '../../../utils/errors';
import { ensureResourceExists } from '../../../utils/controllerHelpers';

export {
  getPublicTournaments,
  getTournamentNotifications,
  getPlayerStats,
  upsertPlayerStat,
} from './tournamentCoreController';

/**
 * Organizer analytics dashboard.
 * Returns registration funnel, match throughput, payment revenue, and incident SLA stats.
 */
export const getTournamentAnalytics = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const tournament = ensureResourceExists(
    await prisma.tournament.findUnique({ where: { id } }),
    'Tournament'
  );
  if (!(await tournamentService.isOrganizerOrAdmin(tournament, userId))) {
    throw new ForbiddenError('Only organizers/admins can view analytics');
  }

  const analytics = await computeTournamentAnalytics(id);
  res.json(analytics);
};
