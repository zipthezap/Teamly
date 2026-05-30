import { Request, Response } from 'express';

import { getPublicGroups as getPublicGroupsLegacy } from '../groupController';
import { getEvents as getEventsLegacy } from '../sessionController';
import { getTeamUpRequests as getTeamUpRequestsLegacy } from '../teamUpController';
import { logger } from '../../utils/logger';
import {
  getProxyFallbackReason,
  recordProxyFallback,
  recordProxyRemoteSuccess,
} from './proxyTelemetry';

const COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL;
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const COMMUNITY_SERVICE_TIMEOUT_MS = Number(process.env.COMMUNITY_SERVICE_TIMEOUT_MS || 8000);

const buildQueryString = (query: Request['query']): string => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, String(item)));
      return;
    }
    params.append(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

const parseResponsePayload = async (response: globalThis.Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const proxyGet = async (
  req: Request,
  res: Response,
  servicePath: string,
  fallback: (req: Request, res: Response) => Promise<unknown>,
  options?: { includeUserId?: boolean; includeUserName?: boolean },
): Promise<void> => {
  if (!COMMUNITY_SERVICE_URL) {
    recordProxyFallback('CommunityProxyController', 'community-service', 'service_url_missing');
    await fallback(req, res);
    return;
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (INTERNAL_SERVICE_TOKEN) {
    headers['x-internal-service-token'] = INTERNAL_SERVICE_TOKEN;
  }

  if (options?.includeUserId !== false && req.user?.id) {
    headers['x-user-id'] = req.user.id;
  }
  if (options?.includeUserName && req.user?.name) {
    headers['x-user-name'] = req.user.name;
  }

  const url = `${COMMUNITY_SERVICE_URL.replace(/\/$/, '')}${servicePath}${buildQueryString(req.query)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), COMMUNITY_SERVICE_TIMEOUT_MS);

    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = await parseResponsePayload(response);
    if (payload === null) {
      res.status(response.status).end();
      recordProxyRemoteSuccess('CommunityProxyController', 'community-service');
      return;
    }

    res.status(response.status).json(payload);
    recordProxyRemoteSuccess('CommunityProxyController', 'community-service');
  } catch (error) {
    const reason = getProxyFallbackReason(error);
    recordProxyFallback('CommunityProxyController', 'community-service', reason);
    logger.warn('Community service unavailable, falling back to monolith endpoint', 'CommunityProxyController', {
      error,
      reason,
      method: req.method,
      path: req.path,
      proxiedPath: servicePath,
    });
    await fallback(req, res);
    return;
  }
};

export const getPublicGroups = async (req: Request, res: Response) =>
  proxyGet(req, res, '/api/groups/public', getPublicGroupsLegacy, { includeUserId: false });

export const getEvents = async (req: Request, res: Response) =>
  proxyGet(req, res, '/api/sessions', getEventsLegacy, { includeUserId: true, includeUserName: true });

export const getTeamUpRequests = async (req: Request, res: Response) =>
  proxyGet(req, res, '/api/teamup', getTeamUpRequestsLegacy, { includeUserId: true, includeUserName: true });
