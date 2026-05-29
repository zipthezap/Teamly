import { NextFunction, Request, Response } from 'express';

const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;

const getHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0];
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
