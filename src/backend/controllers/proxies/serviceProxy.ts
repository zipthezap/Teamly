import { Request, Response } from 'express';

import { logger } from '../../utils/logger';
import {
  getProxyFallbackReason,
  recordProxyFallback,
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
  fallback: FallbackHandler,
  serviceName: string,
  options?: ProxyOptions,
): Promise<void> => {
  const proxyName = options?.proxyName || 'ServiceProxy';

  if (!serviceUrl) {
    if (options?.failClosed) {
      recordProxyFailClosed(proxyName, serviceName, 'service_url_missing');
      res.status(options.failClosedStatus || 503).json({
        error: options.failClosedMessage || `${serviceName} is unavailable`,
      });
      return;
    }

    recordProxyFallback(proxyName, serviceName, 'service_url_missing');
    await fallback(req, res);
    return;
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
    if (options?.failClosed) {
      recordProxyFailClosed(proxyName, serviceName, reason);
      logger.error(`${serviceName} unavailable for proxied route (fail-closed)`, proxyName, {
        error,
        reason,
        method: req.method,
        path,
      });
      res.status(options.failClosedStatus || 503).json({
        error: options.failClosedMessage || `${serviceName} is unavailable`,
      });
      return;
    }

    recordProxyFallback(proxyName, serviceName, reason);
    logger.warn(`${serviceName} unavailable for proxied route, falling back to monolith`, 'ServiceProxy', {
      error,
      reason,
      method: req.method,
      path,
    });
    await fallback(req, res);
  }
};