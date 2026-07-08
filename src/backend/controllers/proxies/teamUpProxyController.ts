import { Request, Response } from 'express';

import {
  addTeamUpComment as addTeamUpCommentLegacy,
  bulkHandleTeamUpResponses as bulkHandleTeamUpResponsesLegacy,
  createTeamUpRequest as createTeamUpRequestLegacy,
  createTeamUpSavedSearch as createTeamUpSavedSearchLegacy,
  deleteTeamUpRequest as deleteTeamUpRequestLegacy,
  deleteTeamUpSavedSearch as deleteTeamUpSavedSearchLegacy,
  deleteTeamUpComment as deleteTeamUpCommentLegacy,
  getNearbyTeamUpRequests as getNearbyTeamUpRequestsLegacy,
  getMyTeamUpRequests as getMyTeamUpRequestsLegacy,
  getMyTeamUpApplications as getMyTeamUpApplicationsLegacy,
  getMyTeamUpAttendanceHistory as getMyTeamUpAttendanceHistoryLegacy,
  listTeamUpSavedSearches as listTeamUpSavedSearchesLegacy,
  getTeamUpAnalytics as getTeamUpAnalyticsLegacy,
  getMyTeamUpResponses as getMyTeamUpResponsesLegacy,
  getTeamUpRequest as getTeamUpRequestLegacy,
  getTeamUpReplacementSuggestions as getTeamUpReplacementSuggestionsLegacy,
  getTeamUpComments as getTeamUpCommentsLegacy,
  handleTeamUpResponse as handleTeamUpResponseLegacy,
  listTeamUpModerationCases as listTeamUpModerationCasesLegacy,
  markTeamUpAttendance as markTeamUpAttendanceLegacy,
  reportTeamUpRequest as reportTeamUpRequestLegacy,
  respondToTeamUpRequest as respondToTeamUpRequestLegacy,
  sendTeamUpReminderNudges as sendTeamUpReminderNudgesLegacy,
  updateTeamUpRequest as updateTeamUpRequestLegacy,
  updateTeamUpModerationCase as updateTeamUpModerationCaseLegacy,
  updateTeamUpRsvp as updateTeamUpRsvpLegacy,
  withdrawTeamUpResponse as withdrawTeamUpResponseLegacy,
} from '../teamUpController';
import { logger } from '../../utils/logger';
import {
  getProxyFallbackReason,
  recordProxyFailClosed,
  recordProxyRemoteSuccess,
} from './proxyTelemetry';

const COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL;
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const COMMUNITY_SERVICE_TIMEOUT_MS = Number(process.env.COMMUNITY_SERVICE_TIMEOUT_MS || 8000);
const TEAMUP_FAIL_CLOSED_MESSAGE = 'TeamUp routes are unavailable without community-service';

const getQuerySuffix = (url: string): string => (url.includes('?') ? url.slice(url.indexOf('?')) : '');

const parseResponsePayload = async (response: globalThis.Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { __parseError: true, text };  // Mark parse errors so we can detect non-JSON responses
  }
};

const proxyTeamUpRequest = async (
  req: Request,
  res: Response,
  next: (err?: unknown) => void,
  path: string,
  _fallback: (req: Request, res: Response, next?: (err?: unknown) => void) => Promise<unknown>,
): Promise<void> => {
  if (!COMMUNITY_SERVICE_URL) {
    // No community service configured — run the local legacy handler so
    // unit tests and local dev can exercise the code path. Record fail-closed
    // for observability, but allow the fallback to handle the request.
    recordProxyFailClosed('TeamUpProxyController', 'community-service', 'service_url_missing');
    try {
      await Promise.resolve(_fallback(req, res, next));
      return;
    } catch (err) {
      // Print stack so test runner can capture the trace, then delegate
      // to next when available so Express error handlers map statuses.
       
      console.error(err instanceof Error ? err.stack : err);
      if (next) return next(err);
      recordProxyFailClosed('TeamUpProxyController', 'community-service', 'passthrough_error');
      logger.error('TeamUp fallback handler failed', 'TeamUpProxyController', { error: err });
      res.status(503).json({ error: TEAMUP_FAIL_CLOSED_MESSAGE });
      return;
    }
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

  const baseUrl = COMMUNITY_SERVICE_URL.replace(/\/$/, '');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), COMMUNITY_SERVICE_TIMEOUT_MS);

    let response: globalThis.Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
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
      recordProxyFailClosed('TeamUpProxyController', 'community-service', 'remote_html_error');
      try {
        await Promise.resolve(_fallback(req, res, next));
        return;
      } catch (err) {
         
        console.error(err instanceof Error ? err.stack : err);
        return next(err);
      }
    }
    
    if (payload === null) {
      res.status(response.status).end();
      recordProxyRemoteSuccess('TeamUpProxyController', 'community-service');
      return;
    }

    res.status(response.status).json(payload);
    recordProxyRemoteSuccess('TeamUpProxyController', 'community-service');
  } catch (error) {
    const reason = getProxyFallbackReason(error);
    recordProxyFailClosed('TeamUpProxyController', 'community-service', reason);
    logger.error('Community service unavailable for teamup endpoint (fail-closed)', 'TeamUpProxyController', {
      error,
      reason,
      method: req.method,
      path,
    });
    res.status(503).json({ error: TEAMUP_FAIL_CLOSED_MESSAGE });
  }
};

export const respondToTeamUpRequest = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/${req.params.id}/respond`, respondToTeamUpRequestLegacy);

export const withdrawTeamUpResponse = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/${req.params.id}/respond`, withdrawTeamUpResponseLegacy);

export const updateTeamUpRsvp = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/${req.params.id}/respond/rsvp`, updateTeamUpRsvpLegacy);

export const bulkHandleTeamUpResponses = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/${req.params.id}/responses/bulk-handle`, bulkHandleTeamUpResponsesLegacy);

export const handleTeamUpResponse = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/${req.params.id}/responses/${req.params.responseId}`, handleTeamUpResponseLegacy);

export const markTeamUpAttendance = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/${req.params.id}/responses/${req.params.responseId}/attendance`, markTeamUpAttendanceLegacy);

export const sendTeamUpReminderNudges = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/${req.params.id}/reminders`, sendTeamUpReminderNudgesLegacy);

export const listTeamUpModerationCases = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, '/api/teamup/moderation/reports', listTeamUpModerationCasesLegacy);

export const updateTeamUpModerationCase = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/moderation/reports/${req.params.caseId}`, updateTeamUpModerationCaseLegacy);

export const addTeamUpComment = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/${req.params.id}/comments`, addTeamUpCommentLegacy);

export const deleteTeamUpComment = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/${req.params.id}/comments/${req.params.commentId}`, deleteTeamUpCommentLegacy);

export const reportTeamUpRequest = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/${req.params.id}/report`, reportTeamUpRequestLegacy);

export const createTeamUpRequest = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, '/api/teamup', createTeamUpRequestLegacy);

export const updateTeamUpRequest = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/${req.params.id}`, updateTeamUpRequestLegacy);

export const deleteTeamUpRequest = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/${req.params.id}`, deleteTeamUpRequestLegacy);

export const createTeamUpSavedSearch = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, '/api/teamup/saved-searches', createTeamUpSavedSearchLegacy);

export const deleteTeamUpSavedSearch = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/saved-searches/${req.params.searchId}`, deleteTeamUpSavedSearchLegacy);

export const getNearbyTeamUpRequests = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/nearby${getQuerySuffix(req.url)}`, getNearbyTeamUpRequestsLegacy);

export const getMyTeamUpRequests = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/my-requests${getQuerySuffix(req.url)}`, getMyTeamUpRequestsLegacy);

export const getMyTeamUpApplications = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/my-applications${getQuerySuffix(req.url)}`, getMyTeamUpApplicationsLegacy);

export const getMyTeamUpAttendanceHistory = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/attendance-history${getQuerySuffix(req.url)}`, getMyTeamUpAttendanceHistoryLegacy);

export const listTeamUpSavedSearches = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/saved-searches${getQuerySuffix(req.url)}`, listTeamUpSavedSearchesLegacy);

export const getTeamUpAnalytics = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/analytics${getQuerySuffix(req.url)}`, getTeamUpAnalyticsLegacy);

export const getMyTeamUpResponses = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/my-responses${getQuerySuffix(req.url)}`, getMyTeamUpResponsesLegacy);

export const getTeamUpRequest = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/${req.params.id}${getQuerySuffix(req.url)}`, getTeamUpRequestLegacy);

export const getTeamUpReplacementSuggestions = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/${req.params.id}/replacements/suggestions${getQuerySuffix(req.url)}`, getTeamUpReplacementSuggestionsLegacy);

export const getTeamUpComments = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyTeamUpRequest(req, res, next, `/api/teamup/${req.params.id}/comments${getQuerySuffix(req.url)}`, getTeamUpCommentsLegacy);
