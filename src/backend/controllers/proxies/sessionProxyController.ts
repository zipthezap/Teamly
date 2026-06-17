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
  joinEventViaInvite as joinEventViaInviteLegacy,
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
    return { __parseError: true, text };  // Mark parse errors so we can detect non-JSON responses
  }
};

const proxySessionRequest = async (
  req: Request,
  res: Response,
  next: (err?: unknown) => void,
  path: string,
  _fallback: (req: Request, res: Response, next?: (error?: unknown) => void) => unknown,
): Promise<void> => {
  if (!COMMUNITY_SERVICE_URL) {
    // When the community service URL is not configured, prefer calling the
    // local fallback handler so unit tests and local dev can exercise the
    // legacy community-service implementation. Keep telemetry for visibility.
    recordProxyFailClosed('SessionProxyController', 'community-service', 'service_url_missing');
    try {
      // _fallback is the legacy handler (e.g., sessionController.joinEvent)
      // Forward the `next` callback so controller-thrown errors are handled
      // by Express error middleware (producing 403/400 as intended).
      await Promise.resolve(_fallback(req, res, next));
    } catch (err) {
      // Print stack to stderr so test runner captures the trace, then
      // pass error to next so Express error middleware maps it correctly.
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

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const payload = await parseResponsePayload(response);
    
    // If the remote returned a non-JSON error (HTML, text, etc.), prefer
    // to run the local fallback so our API returns structured JSON errors.
    const hasParseError = typeof payload === 'object' && payload !== null && '__parseError' in payload;
    const isBadStatus = response.status >= 400;
    const noContentType = !contentType || !contentType.trim();
    const notJsonContent = contentType && !contentType.includes('application/json');
    
    if (isBadStatus && (hasParseError || noContentType || notJsonContent)) {
      recordProxyFailClosed('SessionProxyController', 'community-service', 'remote_html_error');
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

export const joinEvent = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/join`, joinEventLegacy);

export const joinEventViaInvite = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/join-invite`, joinEventViaInviteLegacy);

export const leaveEvent = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/leave`, leaveEventLegacy);

export const updateParticipationStatus = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/status`, updateParticipationStatusLegacy);

export const updateGuestParticipant = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/guests/${req.params.guestId}`, updateGuestParticipantLegacy);

export const updateGuestParticipantStatus = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/guests/${req.params.guestId}/status`, updateGuestParticipantStatusLegacy);

export const removeGuestParticipant = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/guests/${req.params.guestId}`, removeGuestParticipantLegacy);

export const inviteToEvent = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/invite`, inviteToEventLegacy);

export const revokeEventInvitation = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/invitations/revoke`, revokeEventInvitationLegacy);

export const generateEventInviteToken = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/invitations/generate-token`, generateEventInviteTokenLegacy);

export const generateInviteToken = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/generate-invite`, generateInviteTokenLegacy);

export const updateSessionStatus = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/session-status`, updateSessionStatusLegacy);

export const archiveEvent = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/archive`, archiveEventLegacy);

export const unarchiveEvent = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/unarchive`, unarchiveEventLegacy);

export const getUserStatistics = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, '/api/sessions/statistics', getUserStatisticsLegacy);

export const getEventActivityFeed = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/activity`, getEventActivityFeedLegacy);

export const getNearbyEvents = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, '/api/sessions/nearby', getNearbyEventsLegacy);

export const getEventByInviteToken = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/invite/${req.params.token}`, getEventByInviteTokenLegacy);

export const joinEventAsGuest = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/invite/${req.params.token}/join`, joinEventAsGuestLegacy);

export const createEvent = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, '/api/sessions', createEventLegacy);

export const getEvent = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}`, getEventLegacy);

export const getEventParticipantsByStatus = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/participants`, getEventParticipantsByStatusLegacy);

export const getGuestParticipants = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/guests`, getGuestParticipantsLegacy);

export const updateEvent = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}`, updateEventLegacy);

export const deleteEvent = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}`, deleteEventLegacy);

export const getEventInviteAnalytics = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/invitations/analytics`, getEventInviteAnalyticsLegacy);

export const getRecurringEventInstances = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/instances`, getRecurringEventInstancesLegacy);

export const addRecurringEventException = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/exceptions`, addRecurringEventExceptionLegacy);

export const removeRecurringEventException = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.id}/exceptions`, removeRecurringEventExceptionLegacy);

export const exportEvents = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, '/api/sessions/export', exportEventsLegacy);

export const createReminder = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.sessionId}/reminders`, createReminderLegacy);

export const getEventReminders = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.sessionId}/reminders`, getEventRemindersLegacy);

export const markAttendance = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.sessionId}/attendance`, markAttendanceLegacy);

export const getEventAttendance = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.sessionId}/attendance`, getEventAttendanceLegacy);

export const getAttendanceStats = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.sessionId}/attendance/stats`, getAttendanceStatsLegacy);

export const deleteAttendance = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxySessionRequest(req, res, next, `/api/sessions/${req.params.sessionId}/attendance/${req.params.userId}`, deleteAttendanceLegacy);
