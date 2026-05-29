import { Request, Response } from 'express';

import {
  addTeamUpComment as addTeamUpCommentLegacy,
  bulkHandleTeamUpResponses as bulkHandleTeamUpResponsesLegacy,
  createTeamUpRequest as createTeamUpRequestLegacy,
  createTeamUpSavedSearch as createTeamUpSavedSearchLegacy,
  deleteTeamUpRequest as deleteTeamUpRequestLegacy,
  deleteTeamUpSavedSearch as deleteTeamUpSavedSearchLegacy,
  deleteTeamUpComment as deleteTeamUpCommentLegacy,
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

const COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL;
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const COMMUNITY_SERVICE_TIMEOUT_MS = Number(process.env.COMMUNITY_SERVICE_TIMEOUT_MS || 8000);

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
  fallback: (req: Request, res: Response) => Promise<unknown>,
): Promise<void> => {
  if (!COMMUNITY_SERVICE_URL) {
    await fallback(req, res);
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
      return;
    }

    res.status(response.status).json(payload);
  } catch (error) {
    logger.warn('Community service unavailable for teamup endpoint, falling back to monolith', 'TeamUpProxyController', {
      error,
      method: req.method,
      path,
    });
    await fallback(req, res);
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
