import { Request, Response } from 'express';

import { logger } from '../../utils/logger';
import {
  getCourts,
  createCourt,
  updateCourt,
  createCourtAvailability,
  deleteCourtAvailability,
  scheduleMatchOnCourt,
  bulkShiftScheduledMatches,
  deleteCourt,
  assignMatchScorekeeper,
  startMatch,
  cancelMatch as cancelMatchLegacy,
  getMatchIncidents,
  createMatchIncident,
  resolveMatchIncident,
} from './_legacyController';

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

export const cancelMatch = async (req: Request, res: Response) => {
  if (!TOURNAMENT_SERVICE_URL) {
    return cancelMatchLegacy(req, res);
  }

  const url = `${TOURNAMENT_SERVICE_URL.replace(/\/$/, '')}/api/tournaments/${req.params.id}/matches/${req.params.matchId}/cancel`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': req.user?.id ?? '',
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const payload = await parseResponsePayload(response);
    if (payload === null) {
      return res.status(response.status).end();
    }
    return res.status(response.status).json(payload);
  } catch (error) {
    logger.warn('Tournament service unavailable for cancelMatch, falling back to legacy', 'TournamentController', {
      error,
      tournamentId: req.params.id,
      matchId: req.params.matchId,
    });
    return cancelMatchLegacy(req, res);
  }
};

export {
  getCourts,
  createCourt,
  updateCourt,
  createCourtAvailability,
  deleteCourtAvailability,
  scheduleMatchOnCourt,
  bulkShiftScheduledMatches,
  deleteCourt,
  assignMatchScorekeeper,
  startMatch,
  getMatchIncidents,
  createMatchIncident,
  resolveMatchIncident,
};
