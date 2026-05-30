import express, { Application, NextFunction, Request, Response } from 'express';

import groupRoutes from './routes/groupRoutes';
import { requireInternalServiceAuth } from './headerAuth';
import sessionRoutes from './routes/sessionRoutes';
import teamUpRoutes from './routes/teamUpRoutes';
import reminderRoutes from './routes/reminderRoutes';
import sessionRequestRoutes from './routes/sessionRequestRoutes';
import adminRoutes from './routes/adminRoutes';

const app: Application = express();

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    service: 'community-service',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', requireInternalServiceAuth);
app.use('/api/groups', groupRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/teamup', teamUpRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/session-requests', sessionRequestRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Community Service is running',
    endpoints: [
      'GET /health',
      'GET /api/groups/public',
        'GET /api/groups',
        'GET /api/groups/nearby',
        'GET /api/groups/:id',
      'POST /api/groups',
      'PUT /api/groups/:id',
      'DELETE /api/groups/:id',
      'POST /api/groups/:id/invite',
      'POST /api/groups/:id/invitations/bulk',
      'POST /api/groups/:id/invitations/revoke',
      'GET /api/groups/:id/invitations/analytics',
      'POST /api/groups/:id/invitations/generate-token',
      'GET /api/groups/:id/invite-link',
      'POST /api/groups/:id/invite-token',
      'POST /api/groups/join-by-token/:token',
      'POST /api/groups/:id/join-request',
      'GET /api/groups/:id/join-requests',
      'GET /api/groups/:id/members',
      'POST /api/groups/:id/join-requests/:requestId',
      'DELETE /api/groups/:id/join-requests/:requestId',
      'DELETE /api/groups/:id/members/:memberId',
      'DELETE /api/groups/:id/members/user/:userId',
      'PUT /api/groups/:id/members/:memberId/role',
      'POST /api/groups/:id/transfer-admin',
      'DELETE /api/groups/:id/leave',
      'POST /api/groups/:id/invitations/:requestId/respond',
      'GET /api/groups/invitations/pending',
      'GET /api/groups/my-join-requests',
      'GET /api/sessions',
      'GET /api/sessions/nearby',
      'GET /api/sessions/statistics',
      'GET /api/sessions/:id/activity',
      'POST /api/sessions/:id/join',
      'DELETE /api/sessions/:id/leave',
      'PUT /api/sessions/:id/status',
      'PUT /api/sessions/:id/guests/:guestId',
      'PUT /api/sessions/:id/guests/:guestId/status',
      'DELETE /api/sessions/:id/guests/:guestId',
      'POST /api/sessions/:id/invite',
      'POST /api/sessions/:id/invitations/revoke',
      'POST /api/sessions/:id/invitations/generate-token',
      'POST /api/sessions/:id/generate-invite',
      'PUT /api/sessions/:id/session-status',
      'POST /api/sessions/:id/archive',
      'POST /api/sessions/:id/unarchive',
      'GET /api/teamup',
      'POST /api/teamup',
      'POST /api/teamup/saved-searches',
      'DELETE /api/teamup/saved-searches/:searchId',
      'PUT /api/teamup/:id',
      'DELETE /api/teamup/:id',
      'POST /api/teamup/:id/respond',
      'DELETE /api/teamup/:id/respond',
      'PUT /api/teamup/:id/respond/rsvp',
      'POST /api/teamup/:id/responses/bulk-handle',
      'POST /api/teamup/:id/responses/:responseId',
      'PUT /api/teamup/:id/responses/:responseId/attendance',
      'POST /api/teamup/:id/reminders',
      'GET /api/teamup/moderation/reports',
      'PUT /api/teamup/moderation/reports/:caseId',
      'POST /api/teamup/:id/comments',
      'DELETE /api/teamup/:id/comments/:commentId',
      'POST /api/teamup/:id/report',
      'GET /api/reminders',
      'PUT /api/reminders/:reminderId',
      'DELETE /api/reminders/:reminderId',
      'POST /api/session-requests',
      'GET /api/session-requests/group/:groupId',
      'GET /api/session-requests/:id',
      'GET /api/session-requests/:id/statistics',
      'POST /api/session-requests/:id/vote',
      'POST /api/session-requests/:id/finalize',
      'POST /api/session-requests/:id/cancel',
      'POST /api/admin/invite-resend',
      'DELETE /api/admin/teamup/:id',
      'PUT /api/admin/teamup/:id/status',
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
