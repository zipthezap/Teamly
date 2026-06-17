import { Request, Response } from 'express';
import http from 'http';
import https from 'https';

import {
  deleteAccount as deleteAccountLegacy,
  deleteProfilePicture as deleteProfilePictureLegacy,
  getDashboard as getDashboardLegacy,
  getOAuthStatus as getOAuthStatusLegacy,
  getProfile as getProfileLegacy,
  getSessions as getSessionsLegacy,
  hardDeleteProfilePicture as hardDeleteProfilePictureLegacy,
  listProfilePictures as listProfilePicturesLegacy,
  login as loginLegacy,
  logout as logoutLegacy,
  logoutAll as logoutAllLegacy,
  mobileAppleLogin as mobileAppleLoginLegacy,
  mobileFacebookLogin as mobileFacebookLoginLegacy,
  mobileGoogleLogin as mobileGoogleLoginLegacy,
  refreshToken as refreshTokenLegacy,
  register as registerLegacy,
  requestPasswordReset as requestPasswordResetLegacy,
  resendVerificationEmail as resendVerificationEmailLegacy,
  resetPassword as resetPasswordLegacy,
  restoreProfilePicture as restoreProfilePictureLegacy,
  syncOAuthProfilePicture as syncOAuthProfilePictureLegacy,
  unlinkOAuthAccount as unlinkOAuthAccountLegacy,
  updatePassword as updatePasswordLegacy,
  updateProfile as updateProfileLegacy,
  verifyEmail as verifyEmailLegacy,
} from '../authController';
import { logger } from '../../utils/logger';
import {
  getProxyFallbackReason,
  recordProxyFailClosed,
  recordProxyRemoteSuccess,
} from './proxyTelemetry';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const AUTH_SERVICE_TIMEOUT_MS = Number(process.env.AUTH_SERVICE_TIMEOUT_MS || 8000);
const AUTH_FAIL_CLOSED_MESSAGE = 'Auth routes are unavailable without auth-service';

const parseResponsePayload = async (response: globalThis.Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { __parseError: true, text };  // Mark parse errors so we can detect non-JSON responses
  }
};

const proxyAuthPassthrough = (req: Request, res: Response, path: string): Promise<boolean> => {
  if (!AUTH_SERVICE_URL) {
    recordProxyFailClosed('AuthProxyController', 'auth-service', 'service_url_missing');
    return Promise.resolve(false);
  }

  const baseUrl = AUTH_SERVICE_URL.replace(/\/$/, '');
  const queryIndex = req.originalUrl.indexOf('?');
  const querySuffix = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
  const targetUrl = new URL(`${baseUrl}${path}${querySuffix}`);
  const client = targetUrl.protocol === 'https:' ? https : http;

  const headers: Record<string, string> = {};

  const rawCookie = req.headers.cookie;
  if (rawCookie) headers.cookie = rawCookie;
  const userAgent = req.headers['user-agent'];
  if (typeof userAgent === 'string') headers['user-agent'] = userAgent;
  const contentType = req.headers['content-type'];
  if (typeof contentType === 'string') headers['content-type'] = contentType;
  const contentLength = req.headers['content-length'];
  if (typeof contentLength === 'string') headers['content-length'] = contentLength;

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

  return new Promise((resolve) => {
    const upstreamReq = client.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? '443' : '80'),
        method: req.method,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        headers,
      },
      (upstreamRes) => {
        const statusCode = upstreamRes.statusCode || 502;
        res.status(statusCode);

        const setCookie = upstreamRes.headers['set-cookie'];
        if (setCookie) {
          res.setHeader('set-cookie', setCookie);
        }

        const location = upstreamRes.headers.location;
        if (location) {
          res.setHeader('location', location);
        }

        const responseContentType = upstreamRes.headers['content-type'];
        if (responseContentType) {
          res.setHeader('content-type', responseContentType);
        }

        const transferEncoding = upstreamRes.headers['transfer-encoding'];
        if (transferEncoding) {
          res.setHeader('transfer-encoding', transferEncoding);
        }

        const cacheControl = upstreamRes.headers['cache-control'];
        if (cacheControl) {
          res.setHeader('cache-control', cacheControl);
        }

        upstreamRes.pipe(res);
        upstreamRes.on('end', () => {
          recordProxyRemoteSuccess('AuthProxyController', 'auth-service');
          resolve(true);
        });
      }
    );

    upstreamReq.on('error', (error) => {
      const reason = getProxyFallbackReason(error);
      recordProxyFailClosed('AuthProxyController', 'auth-service', reason);
      logger.error('Auth service passthrough failed (fail-closed)', 'AuthProxyController', {
        error,
        reason,
        method: req.method,
        path,
      });
      resolve(false);
    });

    req.pipe(upstreamReq);
  });
};

const proxyAuthRequest = async (
  req: Request,
  res: Response,
  next: (err?: unknown) => void,
  path: string,
  _fallback: (req: Request, res: Response, next?: (error?: unknown) => void) => unknown,
): Promise<void> => {
  if (!AUTH_SERVICE_URL) {
    recordProxyFailClosed('AuthProxyController', 'auth-service', 'service_url_missing');
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
  if (req.headers.cookie) {
    headers.cookie = req.headers.cookie;
  }
  if (req.headers['user-agent']) {
    headers['user-agent'] = req.headers['user-agent'];
  }

  const baseUrl = AUTH_SERVICE_URL.replace(/\/$/, '');
  const queryIndex = req.originalUrl.indexOf('?');
  const querySuffix = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AUTH_SERVICE_TIMEOUT_MS);

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

    const setCookie = (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.();
    if (setCookie && setCookie.length > 0) {
      res.setHeader('set-cookie', setCookie);
    } else {
      const singleSetCookie = response.headers.get('set-cookie');
      if (singleSetCookie) {
        res.setHeader('set-cookie', singleSetCookie);
      }
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
      recordProxyFailClosed('AuthProxyController', 'auth-service', 'remote_html_error');
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
      recordProxyRemoteSuccess('AuthProxyController', 'auth-service');
      return;
    }

    res.status(response.status).json(payload);
    recordProxyRemoteSuccess('AuthProxyController', 'auth-service');
  } catch (error) {
    const reason = getProxyFallbackReason(error);
    recordProxyFailClosed('AuthProxyController', 'auth-service', reason);
    logger.error('Auth service unavailable for endpoint (fail-closed)', 'AuthProxyController', {
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

export const register = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/register', registerLegacy);

export const login = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/login', loginLegacy);

export const logout = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/logout', logoutLegacy);

export const logoutAll = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/logout-all', logoutAllLegacy);

export const refreshToken = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/refresh-token', refreshTokenLegacy);

export const verifyEmail = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/verify-email', verifyEmailLegacy);

export const resendVerificationEmail = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/resend-verification', resendVerificationEmailLegacy);

export const mobileGoogleLogin = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/google/mobile', mobileGoogleLoginLegacy);

export const mobileFacebookLogin = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/facebook/mobile', mobileFacebookLoginLegacy);

export const mobileAppleLogin = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/apple/mobile', mobileAppleLoginLegacy);

export const getDashboard = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/me/dashboard', getDashboardLegacy);

export const getProfile = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/profile', getProfileLegacy);

export const getSessions = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/sessions', getSessionsLegacy);

export const getOAuthStatus = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/oauth/status', getOAuthStatusLegacy);

export const updateProfile = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/profile', updateProfileLegacy);

export const updatePassword = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/password', updatePasswordLegacy);

export const deleteProfilePicture = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/profile/picture', deleteProfilePictureLegacy);

export const listProfilePictures = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/profile/pictures', listProfilePicturesLegacy);

export const restoreProfilePicture = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/profile/picture/restore', restoreProfilePictureLegacy);

export const hardDeleteProfilePicture = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/profile/picture/hard-delete', hardDeleteProfilePictureLegacy);

export const unlinkOAuthAccount = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/oauth/unlink', unlinkOAuthAccountLegacy);

export const syncOAuthProfilePicture = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/oauth/sync-picture', syncOAuthProfilePictureLegacy);

export const requestPasswordReset = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/forgot-password', requestPasswordResetLegacy);

export const resetPassword = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/reset-password', resetPasswordLegacy);

export const deleteAccount = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyAuthRequest(req, res, next, '/api/auth/account', deleteAccountLegacy);

export const startGoogleOAuth = async (req: Request, res: Response): Promise<void> => {
  const proxied = await proxyAuthPassthrough(req, res, '/api/auth/google');
  if (!proxied) {
    res.status(503).json({ error: AUTH_FAIL_CLOSED_MESSAGE });
  }
};

export const handleGoogleOAuthCallback = async (req: Request, res: Response): Promise<void> => {
  const proxied = await proxyAuthPassthrough(req, res, '/api/auth/google/callback');
  if (!proxied) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/login?error=google_auth_unavailable`);
  }
};

export const startFacebookOAuth = async (req: Request, res: Response): Promise<void> => {
  const proxied = await proxyAuthPassthrough(req, res, '/api/auth/facebook');
  if (!proxied) {
    res.status(503).json({ error: AUTH_FAIL_CLOSED_MESSAGE });
  }
};

export const handleFacebookOAuthCallback = async (req: Request, res: Response): Promise<void> => {
  const proxied = await proxyAuthPassthrough(req, res, '/api/auth/facebook/callback');
  if (!proxied) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/login?error=facebook_auth_unavailable`);
  }
};

export const uploadProfilePicture = async (req: Request, res: Response): Promise<void> => {
  const proxied = await proxyAuthPassthrough(req, res, '/api/auth/profile/picture');
  if (!proxied) {
    res.status(503).json({ error: AUTH_FAIL_CLOSED_MESSAGE });
  }
};
