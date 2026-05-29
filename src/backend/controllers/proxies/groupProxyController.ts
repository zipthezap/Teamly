import { Request, Response } from 'express';

import {
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
} from '../groupController';
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

const proxyGroupRequest = async (
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
    logger.warn('Community service unavailable for group endpoint, falling back to monolith', 'GroupProxyController', {
      error,
      method: req.method,
      path,
    });
    await fallback(req, res);
  }
};

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
