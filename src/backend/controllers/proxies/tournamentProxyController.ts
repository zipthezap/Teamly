import { NextFunction, Request, Response } from 'express';

import { logger } from '../../utils/logger';
import {
  getProxyFallbackReason,
  recordProxyFailClosed,
  recordProxyRemoteSuccess,
} from './proxyTelemetry';

const TOURNAMENT_SERVICE_URL = process.env.TOURNAMENT_SERVICE_URL;
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const TOURNAMENT_SERVICE_TIMEOUT_MS = Number(process.env.TOURNAMENT_SERVICE_TIMEOUT_MS || 8000);

type AsyncProxyHandler = (req: Request, res: Response, next: NextFunction) => Promise<void | Response>;

const parseResponsePayload = async (response: globalThis.Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { __parseError: true, text };  // Mark parse errors so we can detect non-JSON responses
  }
};

const buildTournamentProxyPath = (req: Request): string => {
  const marker = '/api/tournaments';
  const fromOriginal = req.originalUrl || req.url;
  const markerIndex = fromOriginal.indexOf(marker);
  if (markerIndex >= 0) {
    return fromOriginal.slice(markerIndex + marker.length) || '';
  }
  return req.url || '';
};

export const proxyTournamentHandler = (_fallback: AsyncProxyHandler): AsyncProxyHandler => {
  return async (req: Request, res: Response, _next: NextFunction): Promise<void | Response> => {
    if (!TOURNAMENT_SERVICE_URL) {
      recordProxyFailClosed('TournamentProxyController', 'tournament-service', 'service_url_missing');
      logger.error('Tournament service URL is not configured', 'TournamentProxyController', {
        method: req.method,
        originalUrl: req.originalUrl,
      });
      return res.status(503).json({ error: 'Tournament service is unavailable' });
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (INTERNAL_SERVICE_TOKEN) {
      headers['x-internal-service-token'] = INTERNAL_SERVICE_TOKEN;
    }
    if (req.user?.id) {
      headers['x-user-id'] = req.user.id;
    }
    if (req.user?.name) {
      headers['x-user-name'] = req.user.name;
    }
    if (req.user?.email) {
      headers['x-user-email'] = req.user.email;
    }

    const baseUrl = TOURNAMENT_SERVICE_URL.replace(/\/$/, '');
    const pathSuffix = buildTournamentProxyPath(req);
    const targetUrl = `${baseUrl}/api/tournaments${pathSuffix}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TOURNAMENT_SERVICE_TIMEOUT_MS);

      let response: globalThis.Response;
      try {
        response = await fetch(targetUrl, {
          method: req.method,
          headers,
          body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
            ? JSON.stringify(req.body ?? {})
            : undefined,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const payload = await parseResponsePayload(response);
      if (payload === null) {
        res.status(response.status).end();
        recordProxyRemoteSuccess('TournamentProxyController', 'tournament-service');
        return;
      }
      recordProxyRemoteSuccess('TournamentProxyController', 'tournament-service');
      return res.status(response.status).json(payload);
    } catch (error) {
      const reason = getProxyFallbackReason(error);
      recordProxyFailClosed('TournamentProxyController', 'tournament-service', reason);
      logger.error('Tournament service request failed', 'TournamentProxyController', {
        error,
        reason,
        method: req.method,
        targetUrl,
      });
      return res.status(503).json({ error: 'Tournament service is unavailable' });
    }
  };
};
