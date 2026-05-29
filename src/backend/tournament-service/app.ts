import express, { Application, NextFunction, Request, Response } from 'express';

import tournamentRoutes from './routes/tournamentRoutes';

const app: Application = express();

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    service: 'tournament-service',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/tournaments', tournamentRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Tournament Service is running',
    endpoints: [
      'GET /health',
      'GET /api/tournaments/public',
      'GET /api/tournaments/invitations/preview/:inviteToken',
      'GET /api/tournaments/invitations/my',
      'POST /api/tournaments/invitations/:inviteToken/accept',
      'POST /api/tournaments/invitations/:inviteToken/decline',
      'GET /api/tournaments/invitations/:inviteToken',
      'POST /api/tournaments/:id/teams/:teamId/invitations',
      'GET /api/tournaments/:id/teams/:teamId/invitations',
      'DELETE /api/tournaments/:id/teams/:teamId/invitations/:invitationId',
      'POST /api/tournaments/:id/matches/:matchId/cancel',
      'GET /api/tournaments/:id/summary',
      'GET /api/tournaments/:id/matches',
      'GET /api/tournaments/:id/standings',
      'GET /api/tournaments/:id/match-count',
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
