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
    return { message: text };
  }
};

const proxyTeamUpRequest = async (
  req: Request,
  res: Response,
  path: string,
  _fallback: (req: Request, res: Response) => Promise<unknown>,
): Promise<void> => {
  if (!COMMUNITY_SERVICE_URL) {
    recordProxyFailClosed('TeamUpProxyController', 'community-service', 'service_url_missing');
    res.status(503).json({ error: TEAMUP_FAIL_CLOSED_MESSAGE });
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

    const payload = await parseResponsePayload(response);
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

export const respondToTeamUpRequest = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/${req.params.id}/respond`, respondToTeamUpRequestLegacy);

export const withdrawTeamUpResponse = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/${req.params.id}/respond`, withdrawTeamUpResponseLegacy);

export const updateTeamUpRsvp = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/${req.params.id}/respond/rsvp`, updateTeamUpRsvpLegacy);

export const bulkHandleTeamUpResponses = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/${req.params.id}/responses/bulk-handle`, bulkHandleTeamUpResponsesLegacy);

export const handleTeamUpResponse = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/${req.params.id}/responses/${req.params.responseId}`, handleTeamUpResponseLegacy);

export const markTeamUpAttendance = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/${req.params.id}/responses/${req.params.responseId}/attendance`, markTeamUpAttendanceLegacy);

export const sendTeamUpReminderNudges = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/${req.params.id}/reminders`, sendTeamUpReminderNudgesLegacy);

export const listTeamUpModerationCases = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, '/api/teamup/moderation/reports', listTeamUpModerationCasesLegacy);

export const updateTeamUpModerationCase = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/moderation/reports/${req.params.caseId}`, updateTeamUpModerationCaseLegacy);

export const addTeamUpComment = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/${req.params.id}/comments`, addTeamUpCommentLegacy);

export const deleteTeamUpComment = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/${req.params.id}/comments/${req.params.commentId}`, deleteTeamUpCommentLegacy);

export const reportTeamUpRequest = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/${req.params.id}/report`, reportTeamUpRequestLegacy);

export const createTeamUpRequest = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, '/api/teamup', createTeamUpRequestLegacy);

export const updateTeamUpRequest = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/${req.params.id}`, updateTeamUpRequestLegacy);

export const deleteTeamUpRequest = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/${req.params.id}`, deleteTeamUpRequestLegacy);

export const createTeamUpSavedSearch = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, '/api/teamup/saved-searches', createTeamUpSavedSearchLegacy);

export const deleteTeamUpSavedSearch = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/saved-searches/${req.params.searchId}`, deleteTeamUpSavedSearchLegacy);

export const getNearbyTeamUpRequests = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/nearby${getQuerySuffix(req.url)}`, getNearbyTeamUpRequestsLegacy);

export const getMyTeamUpRequests = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/my-requests${getQuerySuffix(req.url)}`, getMyTeamUpRequestsLegacy);

export const getMyTeamUpApplications = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/my-applications${getQuerySuffix(req.url)}`, getMyTeamUpApplicationsLegacy);

export const getMyTeamUpAttendanceHistory = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/attendance-history${getQuerySuffix(req.url)}`, getMyTeamUpAttendanceHistoryLegacy);

export const listTeamUpSavedSearches = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/saved-searches${getQuerySuffix(req.url)}`, listTeamUpSavedSearchesLegacy);

export const getTeamUpAnalytics = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/analytics${getQuerySuffix(req.url)}`, getTeamUpAnalyticsLegacy);

export const getMyTeamUpResponses = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/my-responses${getQuerySuffix(req.url)}`, getMyTeamUpResponsesLegacy);

export const getTeamUpRequest = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/${req.params.id}${getQuerySuffix(req.url)}`, getTeamUpRequestLegacy);

export const getTeamUpReplacementSuggestions = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/${req.params.id}/replacements/suggestions${getQuerySuffix(req.url)}`, getTeamUpReplacementSuggestionsLegacy);

export const getTeamUpComments = async (req: Request, res: Response) =>
  proxyTeamUpRequest(req, res, `/api/teamup/${req.params.id}/comments${getQuerySuffix(req.url)}`, getTeamUpCommentsLegacy);
