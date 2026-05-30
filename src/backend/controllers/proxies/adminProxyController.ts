import { Request, Response } from 'express';

import {
  deleteTeamUpRequestAdmin as deleteTeamUpRequestAdminLegacy,
  resendInviteNotifications as resendInviteNotificationsLegacy,
  updateTeamUpStatusAdmin as updateTeamUpStatusAdminLegacy,
} from '../adminController';
import { proxyJsonServiceRequest } from './serviceProxy';

const COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL;

export const resendInviteNotifications = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(
    req,
    res,
    COMMUNITY_SERVICE_URL,
    '/api/admin/invite-resend',
    resendInviteNotificationsLegacy,
    'community-service',
    {
      failClosed: true,
      failClosedMessage: 'Admin utility route unavailable without community-service',
      proxyName: 'AdminProxyController',
    }
  );

export const deleteTeamUpRequestAdmin = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(
    req,
    res,
    COMMUNITY_SERVICE_URL,
    `/api/admin/teamup/${req.params.id}`,
    deleteTeamUpRequestAdminLegacy,
    'community-service',
    {
      failClosed: true,
      failClosedMessage: 'Admin utility route unavailable without community-service',
      proxyName: 'AdminProxyController',
    }
  );

export const updateTeamUpStatusAdmin = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(
    req,
    res,
    COMMUNITY_SERVICE_URL,
    `/api/admin/teamup/${req.params.id}/status`,
    updateTeamUpStatusAdminLegacy,
    'community-service',
    {
      failClosed: true,
      failClosedMessage: 'Admin utility route unavailable without community-service',
      proxyName: 'AdminProxyController',
    }
  );