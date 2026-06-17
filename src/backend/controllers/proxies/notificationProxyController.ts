import { Request, Response } from 'express';

import {
  deleteAllReadNotificationsEndpoint as deleteAllReadNotificationsEndpointLegacy,
  deleteNotificationsEndpoint as deleteNotificationsEndpointLegacy,
  getNotifications as getNotificationsLegacy,
  getStats as getStatsLegacy,
  getUnreadCount as getUnreadCountLegacy,
  markAsRead as markAsReadLegacy,
} from '../notificationController';
import { logger } from '../../utils/logger';
import {
  getProxyFallbackReason,
  recordProxyFailClosed,
  recordProxyRemoteSuccess,
} from './proxyTelemetry';

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL;
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const NOTIFICATION_SERVICE_TIMEOUT_MS = Number(process.env.NOTIFICATION_SERVICE_TIMEOUT_MS || 8000);
const NOTIFICATION_FAIL_CLOSED_MESSAGE = 'Notification routes are unavailable without notification-service';

const parseResponsePayload = async (response: globalThis.Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { __parseError: true, text };  // Mark parse errors so we can detect non-JSON responses
  }
};

const proxyNotificationRequest = async (
  req: Request,
  res: Response,
  next: (err?: unknown) => void,
  path: string,
  _fallback: (req: Request, res: Response, next?: (error?: unknown) => void) => unknown,
): Promise<void> => {
  if (!NOTIFICATION_SERVICE_URL) {
    recordProxyFailClosed('NotificationProxyController', 'notification-service', 'service_url_missing');
    try {
      await Promise.resolve(_fallback(req, res, next));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err instanceof Error ? err.stack : err);
      return next(err);
    }
    return;
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

  const baseUrl = NOTIFICATION_SERVICE_URL.replace(/\/$/, '');
  const queryIndex = req.originalUrl.indexOf('?');
  const querySuffix = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NOTIFICATION_SERVICE_TIMEOUT_MS);

    let response: globalThis.Response;
    try {
      response = await fetch(`${baseUrl}${path}${querySuffix}`, {
        method: req.method,
        headers,
        body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? JSON.stringify(req.body ?? {}) : undefined,
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
      recordProxyFailClosed('NotificationProxyController', 'notification-service', 'remote_html_error');
      try {
        await Promise.resolve(_fallback(req, res, next));
        return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err instanceof Error ? err.stack : err);
        return next(err);
      }
    }
    
    if (payload === null) {
      res.status(response.status).end();
      recordProxyRemoteSuccess('NotificationProxyController', 'notification-service');
      return;
    }

    res.status(response.status).json(payload);
    recordProxyRemoteSuccess('NotificationProxyController', 'notification-service');
  } catch (error) {
    const reason = getProxyFallbackReason(error);
    recordProxyFailClosed('NotificationProxyController', 'notification-service', reason);
    logger.error('Notification service unavailable for endpoint (fail-closed)', 'NotificationProxyController', {
      error,
      reason,
      method: req.method,
      path,
    });
    try {
      await Promise.resolve(_fallback(req, res, next));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err instanceof Error ? err.stack : err);
      return next(err);
    }
  }
};

export const getNotifications = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyNotificationRequest(req, res, next, '/api/notifications', getNotificationsLegacy);

export const markAsRead = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyNotificationRequest(req, res, next, '/api/notifications/read', markAsReadLegacy);

export const getStats = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyNotificationRequest(req, res, next, '/api/notifications/stats', getStatsLegacy);

export const getUnreadCount = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyNotificationRequest(req, res, next, '/api/notifications/unread-count', getUnreadCountLegacy);

export const deleteNotificationsEndpoint = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyNotificationRequest(req, res, next, '/api/notifications', deleteNotificationsEndpointLegacy);

export const deleteAllReadNotificationsEndpoint = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyNotificationRequest(req, res, next, '/api/notifications/read', deleteAllReadNotificationsEndpointLegacy);

export const streamNotifications = async (req: Request, res: Response): Promise<void> => {
  if (!NOTIFICATION_SERVICE_URL) {
    recordProxyFailClosed('NotificationProxyController', 'notification-service', 'service_url_missing');
    res.status(503).json({ error: NOTIFICATION_FAIL_CLOSED_MESSAGE });
    return;
  }

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
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

  const baseUrl = NOTIFICATION_SERVICE_URL.replace(/\/$/, '');
  const queryIndex = req.originalUrl.indexOf('?');
  const querySuffix = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
  const controller = new AbortController();

  req.on('close', () => {
    controller.abort();
  });

  try {
    const upstream = await fetch(`${baseUrl}/api/notifications/stream${querySuffix}`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      throw new Error(`Upstream SSE request failed with status ${upstream.status}`);
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        res.write(Buffer.from(value));
      }
    }

    res.end();
    recordProxyRemoteSuccess('NotificationProxyController', 'notification-service');
  } catch (error) {
    const reason = getProxyFallbackReason(error);
    recordProxyFailClosed('NotificationProxyController', 'notification-service', reason);
    logger.error('Notification service SSE unavailable (fail-closed)', 'NotificationProxyController', {
      error,
      reason,
      path: '/api/notifications/stream',
    });
    if (!res.headersSent) {
      res.status(503).json({ error: NOTIFICATION_FAIL_CLOSED_MESSAGE });
      return;
    }
    res.end();
  }
};
