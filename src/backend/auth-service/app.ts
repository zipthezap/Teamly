import express, { Application, NextFunction, Request, Response } from 'express';
import session from 'express-session';
import passport from '../config/passport';

import { requireInternalServiceAuth } from './internalAuth';
import authRoutes from './routes/authRoutes';

const app: Application = express();

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'auth-service-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.use((req: Request, _res: Response, next: NextFunction) => {
  const cookieHeader = req.headers.cookie;
  const cookies: Record<string, string> = {};

  if (cookieHeader) {
    for (const chunk of cookieHeader.split(';')) {
      const [rawName, ...rawValueParts] = chunk.split('=');
      if (!rawName) continue;
      const name = rawName.trim();
      const value = rawValueParts.join('=').trim();
      if (!name) continue;
      cookies[name] = decodeURIComponent(value);
    }
  }

  (req as Request & { cookies: Record<string, string> }).cookies = cookies;
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    service: 'auth-service',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', requireInternalServiceAuth, authRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Auth Service is running',
    endpoints: [
      'GET /health',
      'GET /api/auth/me/dashboard',
      'GET /api/auth/profile',
      'GET /api/auth/sessions',
      'GET /api/auth/oauth/status',
    ],
  });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode =
    typeof err === 'object' && err !== null && 'statusCode' in err
      ? Number((err as { statusCode?: number }).statusCode) || 500
      : 500;
  const message =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message?: string }).message)
      : 'Internal server error';

  res.status(statusCode).json({ error: message });
});

export default app;
