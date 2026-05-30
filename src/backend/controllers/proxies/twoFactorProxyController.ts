import { Request, Response } from 'express';

import {
  disable2FA as disable2FALegacy,
  get2FAStatus as get2FAStatusLegacy,
  setup2FA as setup2FALegacy,
  verify2FA as verify2FALegacy,
} from '../twoFactorController';
import { proxyJsonServiceRequest } from './serviceProxy';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;

export const get2FAStatus = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(req, res, AUTH_SERVICE_URL, '/api/two-factor/status', get2FAStatusLegacy, 'auth-service', {
    failClosed: true,
    failClosedMessage: 'Two-factor authentication is unavailable without auth-service',
    proxyName: 'TwoFactorProxyController',
  });

export const setup2FA = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(req, res, AUTH_SERVICE_URL, '/api/two-factor/setup', setup2FALegacy, 'auth-service', {
    failClosed: true,
    failClosedMessage: 'Two-factor authentication is unavailable without auth-service',
    proxyName: 'TwoFactorProxyController',
  });

export const verify2FA = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(req, res, AUTH_SERVICE_URL, '/api/two-factor/verify', verify2FALegacy, 'auth-service', {
    failClosed: true,
    failClosedMessage: 'Two-factor authentication is unavailable without auth-service',
    proxyName: 'TwoFactorProxyController',
  });

export const disable2FA = async (req: Request, res: Response) =>
  proxyJsonServiceRequest(req, res, AUTH_SERVICE_URL, '/api/two-factor/disable', disable2FALegacy, 'auth-service', {
    failClosed: true,
    failClosedMessage: 'Two-factor authentication is unavailable without auth-service',
    proxyName: 'TwoFactorProxyController',
  });