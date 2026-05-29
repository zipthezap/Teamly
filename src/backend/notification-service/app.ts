import express, { Application, NextFunction, Request, Response } from 'express';

import { requireInternalServiceAuth } from './internalAuth';
import notificationRoutes from './routes/notificationRoutes';

const app: Application = express();

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    service: 'notification-service',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/notifications', requireInternalServiceAuth, notificationRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Notification Service is running',
    endpoints: [
      'GET /health',
      'POST /api/notifications/group',
      'POST /api/notifications/session',
      'POST /api/notifications/teamup',
      'POST /api/notifications/tournament',
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
