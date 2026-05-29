import { Request, Response } from 'express';

import {
  archiveEvent as archiveEventLegacy,
  generateEventInviteToken as generateEventInviteTokenLegacy,
  generateInviteToken as generateInviteTokenLegacy,
  inviteToEvent as inviteToEventLegacy,
  joinEvent as joinEventLegacy,
  leaveEvent as leaveEventLegacy,
  removeGuestParticipant as removeGuestParticipantLegacy,
  revokeEventInvitation as revokeEventInvitationLegacy,
  unarchiveEvent as unarchiveEventLegacy,
  updateGuestParticipant as updateGuestParticipantLegacy,
  updateGuestParticipantStatus as updateGuestParticipantStatusLegacy,
  updateParticipationStatus as updateParticipationStatusLegacy,
  updateSessionStatus as updateSessionStatusLegacy,
} from '../sessionController';
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

const proxySessionRequest = async (
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
    logger.warn('Community service unavailable for session endpoint, falling back to monolith', 'SessionProxyController', {
      error,
      method: req.method,
      path,
    });
    await fallback(req, res);
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
