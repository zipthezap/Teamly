import { Request, Response } from 'express';

import { logger } from '../../utils/logger';
import {
  getProxyFallbackReason,
  recordProxyFailClosed,
  recordProxyRemoteSuccess,
} from './proxyTelemetry';

type FallbackHandler = (...args: any[]) => unknown;

type ProxyOptions = {
  failClosed?: boolean;
  failClosedStatus?: number;
  failClosedMessage?: string;
  proxyName?: string;
};

export const proxyJsonServiceRequest = async (
  req: Request,
  res: Response,
  serviceUrl: string | undefined,
  path: string,
  _fallback: FallbackHandler,
  serviceName: string,
  options?: ProxyOptions,
  next?: (err?: unknown) => void,
): Promise<void> => {
  const proxyName = options?.proxyName || 'ServiceProxy';

  if (!serviceUrl) {
    // Service URL not configured — attempt to run the local fallback handler
    // so unit tests and local development can continue to use legacy
    // implementations. Record a fallback metric for observability.
    recordProxyFailClosed(proxyName, serviceName, 'service_url_missing');
    try {
      // Pass `next` into the fallback so controllers can propagate errors
      // to Express error middleware for proper status mapping.
      await Promise.resolve(_fallback(req, res, next));
      return;
    } catch (err) {
      // Print stack for test visibility, then prefer delegating to next
      // when provided so Express error handlers can convert to 4xx/5xx.
      // eslint-disable-next-line no-console
      console.error(err instanceof Error ? err.stack : err);
      if (next) {
        return next(err);
      }
      // Otherwise log and return a fail-closed response.
      recordProxyFailClosed(proxyName, serviceName, 'passthrough_error');
      logger.error(`${serviceName} fallback handler failed`, proxyName, { error: err });
      res.status(options?.failClosedStatus || 503).json({
        error: options?.failClosedMessage || `${serviceName} is unavailable`,
      });
      return;
    }
  }

  const baseUrl = serviceUrl.replace(/\/$/, '');
  const queryIndex = req.originalUrl.indexOf('?');
  const querySuffix = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';

  try {
    const response = await fetch(`${baseUrl}${path}${querySuffix}`, {
      method: req.method,
      headers: {
        'content-type': 'application/json',
        ...(process.env.INTERNAL_SERVICE_TOKEN ? { 'x-internal-service-token': process.env.INTERNAL_SERVICE_TOKEN } : {}),
        ...(req.user?.id ? { 'x-user-id': req.user.id } : {}),
        ...(req.user?.name ? { 'x-user-name': req.user.name } : {}),
        ...(req.user?.email ? { 'x-user-email': req.user.email } : {}),
      },
      body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? JSON.stringify(req.body ?? {}) : undefined,
    });

    const text = await response.text();
    if (!text) {
      res.status(response.status).end();
      return;
    }

    try {
      res.status(response.status).json(JSON.parse(text));
    } catch {
      res.status(response.status).json({ message: text });
    }
    recordProxyRemoteSuccess(proxyName, serviceName);
  } catch (error) {
    const reason = getProxyFallbackReason(error);
    recordProxyFailClosed(proxyName, serviceName, reason);
    logger.error(`${serviceName} unavailable for proxied route (fail-closed)`, proxyName, {
      error,
      reason,
      method: req.method,
      path,
    });
    res.status(options?.failClosedStatus || 503).json({
      error: options?.failClosedMessage || `${serviceName} is unavailable`,
    });
  }
};