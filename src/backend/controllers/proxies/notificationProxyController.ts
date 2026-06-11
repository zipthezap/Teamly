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
    return { message: text };
  }
};

const proxyNotificationRequest = async (
  req: Request,
  res: Response,
  path: string,
  _fallback: (req: Request, res: Response, next?: (error?: unknown) => void) => unknown,
): Promise<void> => {
  if (!NOTIFICATION_SERVICE_URL) {
    recordProxyFailClosed('NotificationProxyController', 'notification-service', 'service_url_missing');
    res.status(503).json({ error: NOTIFICATION_FAIL_CLOSED_MESSAGE });
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

    const payload = await parseResponsePayload(response);
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
    res.status(503).json({ error: NOTIFICATION_FAIL_CLOSED_MESSAGE });
  }
};

export const getNotifications = async (req: Request, res: Response) =>
  proxyNotificationRequest(req, res, '/api/notifications', getNotificationsLegacy);

export const markAsRead = async (req: Request, res: Response) =>
  proxyNotificationRequest(req, res, '/api/notifications/read', markAsReadLegacy);

export const getStats = async (req: Request, res: Response) =>
  proxyNotificationRequest(req, res, '/api/notifications/stats', getStatsLegacy);

export const getUnreadCount = async (req: Request, res: Response) =>
  proxyNotificationRequest(req, res, '/api/notifications/unread-count', getUnreadCountLegacy);

export const deleteNotificationsEndpoint = async (req: Request, res: Response) =>
  proxyNotificationRequest(req, res, '/api/notifications', deleteNotificationsEndpointLegacy);

export const deleteAllReadNotificationsEndpoint = async (req: Request, res: Response) =>
  proxyNotificationRequest(req, res, '/api/notifications/read', deleteAllReadNotificationsEndpointLegacy);

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
