import { Request, Response } from 'express';

import {
  addRecurringEventException as addRecurringEventExceptionLegacy,
  createEvent as createEventLegacy,
  deleteEvent as deleteEventLegacy,
  exportEvents as exportEventsLegacy,
  getEvent as getEventLegacy,
  getEventByInviteToken as getEventByInviteTokenLegacy,
  getEventInviteAnalytics as getEventInviteAnalyticsLegacy,
  getEventParticipantsByStatus as getEventParticipantsByStatusLegacy,
  getGuestParticipants as getGuestParticipantsLegacy,
  archiveEvent as archiveEventLegacy,
  generateEventInviteToken as generateEventInviteTokenLegacy,
  generateInviteToken as generateInviteTokenLegacy,
  getRecurringEventInstances as getRecurringEventInstancesLegacy,
  inviteToEvent as inviteToEventLegacy,
  joinEvent as joinEventLegacy,
  joinEventAsGuest as joinEventAsGuestLegacy,
  leaveEvent as leaveEventLegacy,
  removeRecurringEventException as removeRecurringEventExceptionLegacy,
  removeGuestParticipant as removeGuestParticipantLegacy,
  revokeEventInvitation as revokeEventInvitationLegacy,
  unarchiveEvent as unarchiveEventLegacy,
  getUserStatistics as getUserStatisticsLegacy,
  getEventActivityFeed as getEventActivityFeedLegacy,
  updateEvent as updateEventLegacy,
  updateGuestParticipant as updateGuestParticipantLegacy,
  updateGuestParticipantStatus as updateGuestParticipantStatusLegacy,
  updateParticipationStatus as updateParticipationStatusLegacy,
  updateSessionStatus as updateSessionStatusLegacy,
  getNearbyEvents as getNearbyEventsLegacy,
} from '../sessionController';
import {
  createReminder as createReminderLegacy,
  getEventReminders as getEventRemindersLegacy,
} from '../reminderController';
import {
  deleteAttendance as deleteAttendanceLegacy,
  getAttendanceStats as getAttendanceStatsLegacy,
  getEventAttendance as getEventAttendanceLegacy,
  markAttendance as markAttendanceLegacy,
} from '../attendanceController';
import { logger } from '../../utils/logger';
import {
  getProxyFallbackReason,
  recordProxyFailClosed,
  recordProxyRemoteSuccess,
} from './proxyTelemetry';

const COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL;
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const COMMUNITY_SERVICE_TIMEOUT_MS = Number(process.env.COMMUNITY_SERVICE_TIMEOUT_MS || 8000);
const SESSION_FAIL_CLOSED_MESSAGE = 'Session routes are unavailable without community-service';

const parseResponsePayload = async (response: globalThis.Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const proxySessionRequest = async (
  req: Request,
  res: Response,
  path: string,
  _fallback: (req: Request, res: Response, next?: (error?: unknown) => void) => unknown,
): Promise<void> => {
  if (!COMMUNITY_SERVICE_URL) {
    recordProxyFailClosed('SessionProxyController', 'community-service', 'service_url_missing');
    res.status(503).json({ error: SESSION_FAIL_CLOSED_MESSAGE });
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
  const queryIndex = req.originalUrl.indexOf('?');
  const querySuffix = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), COMMUNITY_SERVICE_TIMEOUT_MS);

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
      recordProxyRemoteSuccess('SessionProxyController', 'community-service');
      return;
    }

    res.status(response.status).json(payload);
    recordProxyRemoteSuccess('SessionProxyController', 'community-service');
  } catch (error) {
    const reason = getProxyFallbackReason(error);
    recordProxyFailClosed('SessionProxyController', 'community-service', reason);
    logger.error('Community service unavailable for session endpoint (fail-closed)', 'SessionProxyController', {
      error,
      reason,
      method: req.method,
      path,
    });
    res.status(503).json({ error: SESSION_FAIL_CLOSED_MESSAGE });
  }
};

export const joinEvent = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/join`, joinEventLegacy);

export const leaveEvent = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/leave`, leaveEventLegacy);

export const updateParticipationStatus = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/status`, updateParticipationStatusLegacy);

export const updateGuestParticipant = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/guests/${req.params.guestId}`, updateGuestParticipantLegacy);

export const updateGuestParticipantStatus = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/guests/${req.params.guestId}/status`, updateGuestParticipantStatusLegacy);

export const removeGuestParticipant = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/guests/${req.params.guestId}`, removeGuestParticipantLegacy);

export const inviteToEvent = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/invite`, inviteToEventLegacy);

export const revokeEventInvitation = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/invitations/revoke`, revokeEventInvitationLegacy);

export const generateEventInviteToken = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/invitations/generate-token`, generateEventInviteTokenLegacy);

export const generateInviteToken = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/generate-invite`, generateInviteTokenLegacy);

export const updateSessionStatus = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/session-status`, updateSessionStatusLegacy);

export const archiveEvent = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/archive`, archiveEventLegacy);

export const unarchiveEvent = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/unarchive`, unarchiveEventLegacy);

export const getUserStatistics = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, '/api/sessions/statistics', getUserStatisticsLegacy);

export const getEventActivityFeed = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/activity`, getEventActivityFeedLegacy);

export const getNearbyEvents = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, '/api/sessions/nearby', getNearbyEventsLegacy);

export const getEventByInviteToken = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/invite/${req.params.token}`, getEventByInviteTokenLegacy);

export const joinEventAsGuest = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/invite/${req.params.token}/join`, joinEventAsGuestLegacy);

export const createEvent = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, '/api/sessions', createEventLegacy);

export const getEvent = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}`, getEventLegacy);

export const getEventParticipantsByStatus = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/participants`, getEventParticipantsByStatusLegacy);

export const getGuestParticipants = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/guests`, getGuestParticipantsLegacy);

export const updateEvent = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}`, updateEventLegacy);

export const deleteEvent = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}`, deleteEventLegacy);

export const getEventInviteAnalytics = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/invitations/analytics`, getEventInviteAnalyticsLegacy);

export const getRecurringEventInstances = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/instances`, getRecurringEventInstancesLegacy);

export const addRecurringEventException = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/exceptions`, addRecurringEventExceptionLegacy);

export const removeRecurringEventException = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.id}/exceptions`, removeRecurringEventExceptionLegacy);

export const exportEvents = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, '/api/sessions/export', exportEventsLegacy);

export const createReminder = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.sessionId}/reminders`, createReminderLegacy);

export const getEventReminders = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.sessionId}/reminders`, getEventRemindersLegacy);

export const markAttendance = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.sessionId}/attendance`, markAttendanceLegacy);

export const getEventAttendance = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.sessionId}/attendance`, getEventAttendanceLegacy);

export const getAttendanceStats = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.sessionId}/attendance/stats`, getAttendanceStatsLegacy);

export const deleteAttendance = async (req: Request, res: Response) =>
  proxySessionRequest(req, res, `/api/sessions/${req.params.sessionId}/attendance/${req.params.userId}`, deleteAttendanceLegacy);
