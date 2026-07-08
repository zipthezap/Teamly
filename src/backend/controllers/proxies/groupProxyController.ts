import { Request, Response } from 'express';
import http, { IncomingMessage } from 'http';
import https from 'https';

import {
  getGroupByInviteToken as getGroupByInviteTokenLegacy,
  getGroupForInvite as getGroupForInviteLegacy,
  joinGroupByInvite as joinGroupByInviteLegacy,
  cancelMyJoinRequest as cancelMyJoinRequestLegacy,
  createGroup as createGroupLegacy,
  deleteGroup as deleteGroupLegacy,
  bulkInviteMembers as bulkInviteMembersLegacy,
  generateGroupInviteToken as generateGroupInviteTokenLegacy,
  generateInviteToken as generateInviteTokenLegacy,
  getInviteLink as getInviteLinkLegacy,
  getJoinRequests as getJoinRequestsLegacy,
  handleJoinRequest as handleJoinRequestLegacy,
  inviteMember as inviteMemberLegacy,
  joinGroupByInviteToken as joinGroupByInviteTokenLegacy,
  removeMember as removeMemberLegacy,
  removeMemberByUserId as removeMemberByUserIdLegacy,
  respondToInvitation as respondToInvitationLegacy,
  revokeInvitation as revokeInvitationLegacy,
  requestJoinGroup as requestJoinGroupLegacy,
  transferAdmin as transferAdminLegacy,
  updateGroup as updateGroupLegacy,
  updateMemberRole as updateMemberRoleLegacy,
  leaveGroup as leaveGroupLegacy,
  getInviteAnalytics as getInviteAnalyticsLegacy,
  getUserInvitations as getUserInvitationsLegacy,
  getMyJoinRequests as getMyJoinRequestsLegacy,
  getGroupMembers as getGroupMembersLegacy,
  getGroup as getGroupLegacy,
  getGroups as getGroupsLegacy,
  getNearbyGroups as getNearbyGroupsLegacy,
  deleteGroupPicture as deleteGroupPictureLegacy,
} from '../groupController';
import { logger } from '../../utils/logger';
import {
  getProxyFallbackReason,
  recordProxyFailClosed,
  recordProxyRemoteSuccess,
} from './proxyTelemetry';

const COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL;
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const COMMUNITY_SERVICE_TIMEOUT_MS = Number(process.env.COMMUNITY_SERVICE_TIMEOUT_MS || 8000);
const GROUP_FAIL_CLOSED_MESSAGE = 'Group routes are unavailable without community-service';

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

const proxyGroupRequest = async (
  req: Request,
  res: Response,
  next: (err?: unknown) => void,
  path: string,
  _fallback: (req: Request, res: Response, next?: (error?: unknown) => void) => unknown,
): Promise<void> => {
  if (!COMMUNITY_SERVICE_URL) {
    recordProxyFailClosed('GroupProxyController', 'community-service', 'service_url_missing');
    try {
      await Promise.resolve(_fallback(req, res, next));
    } catch (err) {
       
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
      recordProxyFailClosed('GroupProxyController', 'community-service', 'remote_html_error');
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
      recordProxyRemoteSuccess('GroupProxyController', 'community-service');
      return;
    }
    res.status(response.status).json(payload);
    recordProxyRemoteSuccess('GroupProxyController', 'community-service');
  } catch (error) {
    const reason = getProxyFallbackReason(error);
    recordProxyFailClosed('GroupProxyController', 'community-service', reason);
    logger.error('Community service unavailable for group endpoint (fail-closed)', 'GroupProxyController', {
      error,
      reason,
      method: req.method,
      path,
    });
    try {
      await Promise.resolve(_fallback(req, res, next));
    } catch (err) {
       
      console.error(err instanceof Error ? err.stack : err);
      return next(err);
    }
  }
};

const proxyGroupPassthrough = (req: Request, res: Response, path: string): Promise<boolean> => {
  if (!COMMUNITY_SERVICE_URL) {
    recordProxyFailClosed('GroupProxyController', 'community-service', 'service_url_missing');
    return Promise.resolve(false);
  }

  const baseUrl = COMMUNITY_SERVICE_URL.replace(/\/$/, '');
  const targetUrl = new URL(`${baseUrl}${path}${getQuerySuffix(req.originalUrl)}`);
  const isHttps = targetUrl.protocol === 'https:';

  return new Promise((resolve) => {
    const transport = isHttps ? https : http;
    const headers: Record<string, string> = {};

    const contentType = req.headers['content-type'];
    if (typeof contentType === 'string') headers['content-type'] = contentType;
    const contentLength = req.headers['content-length'];
    if (typeof contentLength === 'string') headers['content-length'] = contentLength;
    if (INTERNAL_SERVICE_TOKEN) headers['x-internal-service-token'] = INTERNAL_SERVICE_TOKEN;
    if (req.user?.id) headers['x-user-id'] = req.user.id;
    if (req.user?.name) headers['x-user-name'] = req.user.name;
    if (req.user?.email) headers['x-user-email'] = req.user.email;

    const upstreamReq = transport.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (isHttps ? '443' : '80'),
        method: req.method,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        headers,
      },
      (upstreamRes: IncomingMessage) => {
        res.status(upstreamRes.statusCode || 502);

        const responseContentType = upstreamRes.headers['content-type'];
        if (responseContentType) res.setHeader('content-type', responseContentType);

        upstreamRes.pipe(res);
        upstreamRes.on('end', () => {
          recordProxyRemoteSuccess('GroupProxyController', 'community-service');
          resolve(true);
        });
      }
    );

    upstreamReq.on('error', (error: unknown) => {
      const reason = getProxyFallbackReason(error);
      recordProxyFailClosed('GroupProxyController', 'community-service', reason);
      logger.error('Community service passthrough failed (fail-closed)', 'GroupProxyController', {
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

export const getGroupByInviteToken = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/join/${req.params.token}`, getGroupByInviteTokenLegacy);

export const getGroupForInvite = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/invite/${req.params.groupId}`, getGroupForInviteLegacy);

export const joinGroupByInvite = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/join/${req.params.groupId}`, joinGroupByInviteLegacy);

export const generateInviteToken = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/invitations/generate-token`, generateInviteTokenLegacy);

export const getInviteLink = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/invite-link`, getInviteLinkLegacy);

export const generateGroupInviteToken = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/invite-token`, generateGroupInviteTokenLegacy);

export const joinGroupByInviteToken = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/join-by-token/${req.params.token}`, joinGroupByInviteTokenLegacy);

export const requestJoinGroup = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/join-request`, requestJoinGroupLegacy);

export const getJoinRequests = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/join-requests`, getJoinRequestsLegacy);

export const handleJoinRequest = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/join-requests/${req.params.requestId}`, handleJoinRequestLegacy);

export const cancelMyJoinRequest = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/join-requests/${req.params.requestId}`, cancelMyJoinRequestLegacy);

export const removeMember = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/members/${req.params.memberId}`, removeMemberLegacy);

export const removeMemberByUserId = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/members/user/${req.params.userId}`, removeMemberByUserIdLegacy);

export const updateMemberRole = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/members/${req.params.memberId}/role`, updateMemberRoleLegacy);

export const transferAdmin = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/transfer-admin`, transferAdminLegacy);

export const createGroup = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, '/api/groups', createGroupLegacy);

export const updateGroup = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}`, updateGroupLegacy);

export const deleteGroup = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}`, deleteGroupLegacy);

export const inviteMember = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/invite`, inviteMemberLegacy);

export const bulkInviteMembers = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/invitations/bulk`, bulkInviteMembersLegacy);

export const revokeInvitation = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/invitations/revoke`, revokeInvitationLegacy);

export const leaveGroup = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/leave`, leaveGroupLegacy);

export const respondToInvitation = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/invitations/${req.params.requestId}/respond`, respondToInvitationLegacy);

export const getInviteAnalytics = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/invitations/analytics${getQuerySuffix(req.url)}`, getInviteAnalyticsLegacy);

export const getUserInvitations = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, '/api/groups/invitations/pending', getUserInvitationsLegacy);

export const getMyJoinRequests = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, '/api/groups/my-join-requests', getMyJoinRequestsLegacy);

export const getGroupMembers = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/members`, getGroupMembersLegacy);

export const getGroup = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}`, getGroupLegacy);

export const getGroups = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups${getQuerySuffix(req.url)}`, getGroupsLegacy);

export const getNearbyGroups = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/nearby${getQuerySuffix(req.url)}`, getNearbyGroupsLegacy);

export const uploadGroupPicture = async (req: Request, res: Response): Promise<void> => {
  const proxied = await proxyGroupPassthrough(req, res, `/api/groups/${req.params.id}/picture`);
  if (!proxied) {
    res.status(503).json({ error: GROUP_FAIL_CLOSED_MESSAGE });
  }
};

export const deleteGroupPicture = (req: Request, res: Response, next: (err?: unknown) => void) =>
  proxyGroupRequest(req, res, next, `/api/groups/${req.params.id}/picture`, deleteGroupPictureLegacy);
