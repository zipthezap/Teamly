import { Request, Response } from 'express';

import { logger } from '../../utils/logger';
import {
  getTournamentAnalytics,
  getPublicTournaments as getPublicTournamentsLegacy,
  getTournamentNotifications,
  getPlayerStats,
  upsertPlayerStat,
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

export const getPublicTournaments = async (req: Request, res: Response) => {
  if (!TOURNAMENT_SERVICE_URL) {
    return getPublicTournamentsLegacy(req, res);
  }

  const url = `${TOURNAMENT_SERVICE_URL.replace(/\/$/, '')}/api/tournaments/public${buildQueryString(req.query)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(payload);
    }

    return res.json(payload);
  } catch (error) {
    logger.warn('Tournament service unavailable for getPublicTournaments, falling back to legacy', 'TournamentController', {
      error,
    });
    return getPublicTournamentsLegacy(req, res);
  }
};

export {
  getTournamentAnalytics,
  getTournamentNotifications,
  getPlayerStats,
  upsertPlayerStat,
};
