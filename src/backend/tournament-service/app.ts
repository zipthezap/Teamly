import express, { Application, NextFunction, Request, Response } from 'express';

import { requireHeaderAuth } from './headerAuth';
import tournamentRoutes from './routes/tournamentRoutes';
import leagueRoutes from './routes/leagueRoutes';

const app: Application = express();

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    service: 'tournament-service',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/tournaments', requireHeaderAuth, tournamentRoutes);
app.use('/api/leagues', requireHeaderAuth, leagueRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Tournament Service is running',
    endpoints: [
      'GET /health',
      'All /api/tournaments/* endpoints (mirrored from monolith tournament router)',
      'All /api/leagues/* endpoints (mirrored from monolith league router)',
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
