import { Request, Response, NextFunction } from 'express';

import { AuthenticatedUser } from '../types/express';

const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;

const getHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

export const requireInternalServiceAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!INTERNAL_SERVICE_TOKEN) {
    next();
    return;
  }

  const token = getHeaderValue(req.headers['x-internal-service-token']);
  if (!token || token !== INTERNAL_SERVICE_TOKEN) {
    res.status(401).json({ error: 'Invalid internal service token' });
    return;
  }

  next();
};

export const optionalHeaderAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const userId = getHeaderValue(req.headers['x-user-id']);
  if (!userId) {
    next();
    return;
  }

  const userName = getHeaderValue(req.headers['x-user-name']) || 'Proxy User';
  const userEmail = getHeaderValue(req.headers['x-user-email']) || 'proxy-user@teamly.local';

  req.user = {
    id: userId,
    name: userName,
    email: userEmail,
  } as AuthenticatedUser;

  next();
};

export const requireHeaderAuth = (req: Request, res: Response, next: NextFunction): void => {
  const userId = getHeaderValue(req.headers['x-user-id']);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const userName = getHeaderValue(req.headers['x-user-name']) || 'Proxy User';
  const userEmail = getHeaderValue(req.headers['x-user-email']) || 'proxy-user@teamly.local';

  req.user = {
    id: userId,
    name: userName,
    email: userEmail,
  } as AuthenticatedUser;

  next();
};
