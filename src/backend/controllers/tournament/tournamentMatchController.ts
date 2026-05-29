import { Request, Response } from 'express';

import { logger } from '../../utils/logger';
import {
  getTournamentMatches as getTournamentMatchesLegacy,
  getStandings as getStandingsLegacy,
  generateGroupMatches,
  generateBrackets,
  submitScore,
  adminUpdateScore,
  createMatch,
  updateMatch,
  deleteMatch,
  assignReferee,
  autoAssignReferees,
  getRefereeDuties,
} from './_legacyController';

const TOURNAMENT_SERVICE_URL = process.env.TOURNAMENT_SERVICE_URL;

const buildQueryString = (query: Request['query']): string => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, String(v)));
      return;
    }
    params.append(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

export const getTournamentMatches = async (req: Request, res: Response) => {
  if (!TOURNAMENT_SERVICE_URL) {
    return getTournamentMatchesLegacy(req, res);
  }

  const url = `${TOURNAMENT_SERVICE_URL.replace(/\/$/, '')}/api/tournaments/${req.params.id}/matches${buildQueryString(req.query)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        'x-user-id': req.user?.id ?? '',
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(payload);
    }

    return res.json(payload);
  } catch (error) {
    logger.warn('Tournament service unavailable for getTournamentMatches, falling back to legacy', 'TournamentController', {
      error,
      tournamentId: req.params.id,
    });
    return getTournamentMatchesLegacy(req, res);
  }
};

export const getStandings = async (req: Request, res: Response) => {
  if (!TOURNAMENT_SERVICE_URL) {
    return getStandingsLegacy(req, res);
  }

  const url = `${TOURNAMENT_SERVICE_URL.replace(/\/$/, '')}/api/tournaments/${req.params.id}/standings${buildQueryString(req.query)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        'x-user-id': req.user?.id ?? '',
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(payload);
    }

    return res.json(payload);
  } catch (error) {
    logger.warn('Tournament service unavailable for getStandings, falling back to legacy', 'TournamentController', {
      error,
      tournamentId: req.params.id,
    });
    return getStandingsLegacy(req, res);
  }
};

export {
  generateGroupMatches,
  generateBrackets,
  submitScore,
  adminUpdateScore,
  createMatch,
  updateMatch,
  deleteMatch,
  assignReferee,
  autoAssignReferees,
  getRefereeDuties,
};
