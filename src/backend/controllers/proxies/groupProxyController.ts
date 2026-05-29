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

const COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL;
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const COMMUNITY_SERVICE_TIMEOUT_MS = Number(process.env.COMMUNITY_SERVICE_TIMEOUT_MS || 8000);

const getQuerySuffix = (url: string): string => (url.includes('?') ? url.slice(url.indexOf('?')) : '');

const getFallbackReason = (error: unknown): 'timeout' | 'network' | 'unknown' => {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'timeout';
  }
  if (error instanceof Error) {
    return 'network';
  }
  return 'unknown';
};

const parseResponsePayload = async (response: globalThis.Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const proxyGroupRequest = async (
  req: Request,
  res: Response,
  path: string,
  fallback: (req: Request, res: Response) => Promise<unknown>,
): Promise<void> => {
  if (!COMMUNITY_SERVICE_URL) {
    logger.warn('Community service URL missing for group endpoint, falling back to monolith', 'GroupProxyController', {
      reason: 'service_url_missing',
      method: req.method,
      path,
    });
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
    const reason = getFallbackReason(error);
    logger.warn('Community service unavailable for group endpoint, falling back to monolith', 'GroupProxyController', {
      error,
      reason,
      method: req.method,
      path,
    });
    await fallback(req, res);
  }
};

const proxyGroupPassthrough = (req: Request, res: Response, path: string): Promise<boolean> => {
  if (!COMMUNITY_SERVICE_URL) {
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
        upstreamRes.on('end', () => resolve(true));
      }
    );

    upstreamReq.on('error', (error: unknown) => {
      logger.warn('Community service passthrough failed, falling back to monolith', 'GroupProxyController', {
        error,
        reason: getFallbackReason(error),
        method: req.method,
        path,
      });
      resolve(false);
    });

    req.pipe(upstreamReq);
  });
};

export const getGroupByInviteToken = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/join/${req.params.token}`, getGroupByInviteTokenLegacy);

export const getGroupForInvite = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/invite/${req.params.groupId}`, getGroupForInviteLegacy);

export const joinGroupByInvite = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/join/${req.params.groupId}`, joinGroupByInviteLegacy);

export const generateInviteToken = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/invitations/generate-token`, generateInviteTokenLegacy);

export const getInviteLink = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/invite-link`, getInviteLinkLegacy);

export const generateGroupInviteToken = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/invite-token`, generateGroupInviteTokenLegacy);

export const joinGroupByInviteToken = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/join-by-token/${req.params.token}`, joinGroupByInviteTokenLegacy);

export const requestJoinGroup = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/join-request`, requestJoinGroupLegacy);

export const getJoinRequests = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/join-requests`, getJoinRequestsLegacy);

export const handleJoinRequest = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/join-requests/${req.params.requestId}`, handleJoinRequestLegacy);

export const cancelMyJoinRequest = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/join-requests/${req.params.requestId}`, cancelMyJoinRequestLegacy);

export const removeMember = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/members/${req.params.memberId}`, removeMemberLegacy);

export const removeMemberByUserId = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/members/user/${req.params.userId}`, removeMemberByUserIdLegacy);

export const updateMemberRole = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/members/${req.params.memberId}/role`, updateMemberRoleLegacy);

export const transferAdmin = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/transfer-admin`, transferAdminLegacy);

export const createGroup = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, '/api/groups', createGroupLegacy);

export const updateGroup = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}`, updateGroupLegacy);

export const deleteGroup = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}`, deleteGroupLegacy);

export const inviteMember = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/invite`, inviteMemberLegacy);

export const bulkInviteMembers = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/invitations/bulk`, bulkInviteMembersLegacy);

export const revokeInvitation = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/invitations/revoke`, revokeInvitationLegacy);

export const leaveGroup = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/leave`, leaveGroupLegacy);

export const respondToInvitation = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/invitations/${req.params.requestId}/respond`, respondToInvitationLegacy);

export const getInviteAnalytics = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/invitations/analytics${getQuerySuffix(req.url)}`, getInviteAnalyticsLegacy);

export const getUserInvitations = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, '/api/groups/invitations/pending', getUserInvitationsLegacy);

export const getMyJoinRequests = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, '/api/groups/my-join-requests', getMyJoinRequestsLegacy);

export const getGroupMembers = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/members`, getGroupMembersLegacy);

export const getGroup = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}`, getGroupLegacy);

export const getGroups = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups${getQuerySuffix(req.url)}`, getGroupsLegacy);

export const getNearbyGroups = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/nearby${getQuerySuffix(req.url)}`, getNearbyGroupsLegacy);

export const uploadGroupPicture = async (req: Request, res: Response): Promise<void> => {
  const proxied = await proxyGroupPassthrough(req, res, `/api/groups/${req.params.id}/picture`);
  if (!proxied) {
    res.status(503).json({ error: 'Group picture upload is unavailable without community-service' });
  }
};

export const deleteGroupPicture = async (req: Request, res: Response) =>
  proxyGroupRequest(req, res, `/api/groups/${req.params.id}/picture`, deleteGroupPictureLegacy);
