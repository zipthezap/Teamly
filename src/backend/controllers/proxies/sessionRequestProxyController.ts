import { Request, Response } from 'express';

import {
  cancelEventRequest as cancelEventRequestLegacy,
  createEventRequest as createEventRequestLegacy,
  finalizeEventRequest as finalizeEventRequestLegacy,
  getEventRequest as getEventRequestLegacy,
  getEventRequestStatistics as getEventRequestStatisticsLegacy,
  getEventRequests as getEventRequestsLegacy,
  voteOnEventRequest as voteOnEventRequestLegacy,
} from '../sessionRequestController';
import { proxyJsonServiceRequest } from './serviceProxy';

const COMMUNITY_SERVICE_URL = process.env.COMMUNITY_SERVICE_URL;

export const createEventRequest = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(req, res, COMMUNITY_SERVICE_URL, '/api/session-requests', createEventRequestLegacy, 'community-service', {
    failClosed: true,
    failClosedMessage: 'Session request routes are unavailable without community-service',
    proxyName: 'SessionRequestProxyController',
  });

export const getEventRequests = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(
    req,
    res,
    COMMUNITY_SERVICE_URL,
    `/api/session-requests/group/${req.params.groupId}`,
    getEventRequestsLegacy,
    'community-service',
    {
      failClosed: true,
      failClosedMessage: 'Session request routes are unavailable without community-service',
      proxyName: 'SessionRequestProxyController',
    }
  );

export const getEventRequest = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(
    req,
    res,
    COMMUNITY_SERVICE_URL,
    `/api/session-requests/${req.params.id}`,
    getEventRequestLegacy,
    'community-service',
    {
      failClosed: true,
      failClosedMessage: 'Session request routes are unavailable without community-service',
      proxyName: 'SessionRequestProxyController',
    }
  );

export const getEventRequestStatistics = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(
    req,
    res,
    COMMUNITY_SERVICE_URL,
    `/api/session-requests/${req.params.id}/statistics`,
    getEventRequestStatisticsLegacy,
    'community-service',
    {
      failClosed: true,
      failClosedMessage: 'Session request routes are unavailable without community-service',
      proxyName: 'SessionRequestProxyController',
    }
  );

export const voteOnEventRequest = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(
    req,
    res,
    COMMUNITY_SERVICE_URL,
    `/api/session-requests/${req.params.id}/vote`,
    voteOnEventRequestLegacy,
    'community-service',
    {
      failClosed: true,
      failClosedMessage: 'Session request routes are unavailable without community-service',
      proxyName: 'SessionRequestProxyController',
    }
  );

export const finalizeEventRequest = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(
    req,
    res,
    COMMUNITY_SERVICE_URL,
    `/api/session-requests/${req.params.id}/finalize`,
    finalizeEventRequestLegacy,
    'community-service',
    {
      failClosed: true,
      failClosedMessage: 'Session request routes are unavailable without community-service',
      proxyName: 'SessionRequestProxyController',
    }
  );

export const cancelEventRequest = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(
    req,
    res,
    COMMUNITY_SERVICE_URL,
    `/api/session-requests/${req.params.id}/cancel`,
    cancelEventRequestLegacy,
    'community-service',
    {
      failClosed: true,
      failClosedMessage: 'Session request routes are unavailable without community-service',
      proxyName: 'SessionRequestProxyController',
    }
  );