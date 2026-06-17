import { Request, Response } from 'express';

import { getPublicGroups as getPublicGroupsLegacy } from '../groupController';
import { getEvents as getEventsLegacy } from '../sessionController';
import { getTeamUpRequests as getTeamUpRequestsLegacy } from '../teamUpController';
import { logger } from '../../utils/logger';
import {
  getProxyFallbackReason,
  recordProxyFailClosed,
  recordProxyRemoteSuccess,
} from './proxyTelemetry';

const COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL;
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const COMMUNITY_SERVICE_TIMEOUT_MS = Number(process.env.COMMUNITY_SERVICE_TIMEOUT_MS || 8000);
const COMMUNITY_FAIL_CLOSED_MESSAGE = 'Community routes are unavailable without community-service';

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
    return { __parseError: true, text };  // Mark parse errors so we can detect non-JSON responses
  }
};

const proxyGet = async (
  req: Request,
  res: Response,
  servicePath: string,
  _fallback: (req: Request, res: Response) => Promise<unknown>,
  options?: { includeUserId?: boolean; includeUserName?: boolean },
): Promise<void> => {
  if (!COMMUNITY_SERVICE_URL) {
    // No community service configured — attempt to run the local legacy
    // handler so unit tests and local dev can exercise the code path.
    recordProxyFailClosed('CommunityProxyController', 'community-service', 'service_url_missing');
    try {
      await Promise.resolve(_fallback(req, res));
      return;
    } catch (err) {
      const reason = getProxyFallbackReason(err);
      recordProxyFailClosed('CommunityProxyController', 'community-service', reason);
      logger.error('Community fallback handler failed', 'CommunityProxyController', { error: err });
      // eslint-disable-next-line no-console
      console.error(err instanceof Error ? err.stack : err);
      res.status(503).json({ error: COMMUNITY_FAIL_CLOSED_MESSAGE });
      return;
    }
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

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const payload = await parseResponsePayload(response);
    
    // If the remote returned a non-JSON error (HTML, text, etc.), prefer
    // to run the local fallback so our API returns structured JSON errors.
    const hasParseError = typeof payload === 'object' && payload !== null && '__parseError' in payload;
    const isBadStatus = response.status >= 400;
    const noContentType = !contentType || !contentType.trim();
    const notJsonContent = contentType && !contentType.includes('application/json');
    
    if (isBadStatus && (hasParseError || noContentType || notJsonContent)) {
      recordProxyFailClosed('CommunityProxyController', 'community-service', 'remote_html_error');
      try {
        await Promise.resolve(_fallback(req, res));
        return;
      } catch (err) {
        const reason = getProxyFallbackReason(err);
        recordProxyFailClosed('CommunityProxyController', 'community-service', reason);
        logger.error('Community fallback handler failed', 'CommunityProxyController', { error: err });
        // eslint-disable-next-line no-console
        console.error(err instanceof Error ? err.stack : err);
        res.status(503).json({ error: COMMUNITY_FAIL_CLOSED_MESSAGE });
        return;
      }
    }

    if (payload === null) {
      res.status(response.status).end();
      recordProxyRemoteSuccess('CommunityProxyController', 'community-service');
      return;
    }

    res.status(response.status).json(payload);
    recordProxyRemoteSuccess('CommunityProxyController', 'community-service');
  } catch (error) {
    const reason = getProxyFallbackReason(error);
    recordProxyFailClosed('CommunityProxyController', 'community-service', reason);
    logger.error('Community service unavailable for endpoint (fail-closed)', 'CommunityProxyController', {
      error,
      reason,
      method: req.method,
      path: req.path,
      proxiedPath: servicePath,
    });
    res.status(503).json({ error: COMMUNITY_FAIL_CLOSED_MESSAGE });
  }
};

export const getPublicGroups = async (req: Request, res: Response) =>
  proxyGet(req, res, '/api/groups/public', getPublicGroupsLegacy, { includeUserId: false });

export const getEvents = async (req: Request, res: Response) =>
  proxyGet(req, res, '/api/sessions', getEventsLegacy, { includeUserId: true, includeUserName: true });

export const getTeamUpRequests = async (req: Request, res: Response) =>
  proxyGet(req, res, '/api/teamup', getTeamUpRequestsLegacy, { includeUserId: true, includeUserName: true });
