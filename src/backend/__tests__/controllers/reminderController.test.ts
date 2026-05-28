import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Router } from 'express';
import * as reminderController from '../../controllers/reminderController';

vi.mock('../../middleware/auth', () => ({
  default: (req: any, _res: any, next: any) => { req.user = { id: 'test-user-id', email: 'test@example.com', name: 'Test User' }; next(); },
  optionalAuthMiddleware: (req: any, _res: any, next: any) => { req.user = { id: 'test-user-id' }; next(); }
}));
vi.mock('../../middleware/rateLimiter', () => ({
  authenticatedLimiter: (_: any, __: any, next: any) => next(),
  apiLimiter: (_: any, __: any, next: any) => next(),
  authLimiter: (_: any, __: any, next: any) => next()
}));
vi.mock('../../middleware/distributedRateLimiter', () => ({
  distributedAuthLimiter: (_: any, __: any, next: any) => next(),
  distributedAuthenticatedLimiter: (_: any, __: any, next: any) => next(),
  distributedUploadLimiter: (_: any, __: any, next: any) => next(),
  distributedApiLimiter: (_: any, __: any, next: any) => next(),
  distributedPasswordResetLimiter: (_: any, __: any, next: any) => next(),
  distributedEmailVerificationLimiter: (_: any, __: any, next: any) => next()
}));
vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../config/database', () => ({
  default: {
    session: { findFirst: vi.fn(), findUnique: vi.fn() },
    sessionReminder: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

import prisma from '../../config/database';

// Build a minimal router mounting the reminder endpoints
function buildReminderRouter(): Router {
  const router = Router({ mergeParams: true });

  router.post('/api/events/:sessionId/reminders', reminderController.createReminder);
  router.get('/api/events/:sessionId/reminders', reminderController.getEventReminders);
  router.get('/api/reminders', reminderController.getUserReminders);
  router.put('/api/reminders/:reminderId', reminderController.updateReminder);
  router.delete('/api/reminders/:reminderId', reminderController.deleteReminder);

  return router;
}

function createApp() {
  const app = express();
  app.use(express.json());
  // Inject mock user
  app.use((req: any, _res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com', name: 'Test User' };
    next();
  });
  app.use(buildReminderRouter());
  return app;
}

describe('Reminder Controller', () => {
  const app = createApp();
  const futureDate = new Date(Date.now() + 3600 * 1000 * 24).toISOString();
  const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/events/:sessionId/reminders - createReminder', () => {
    it('returns 400 when remindAt is missing', async () => {
      const res = await request(app)
        .post('/api/events/session-1/reminders')
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 when remindAt is a past date', async () => {
      const res = await request(app)
        .post('/api/events/session-1/reminders')
        .send({ remindAt: pastDate });
      expect(res.status).toBe(400);
    });

    it('returns 404 when session not found', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/events/session-1/reminders')
        .send({ remindAt: futureDate });
      expect(res.status).toBe(404);
    });

    it('returns 400 when a duplicate reminder exists', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValue({
        id: 'session-1',
        startTime: new Date(Date.now() + 3600 * 1000 * 48)
      } as any);
      vi.mocked(prisma.sessionReminder.findUnique).mockResolvedValue({
        id: 'existing-reminder'
      } as any);

      const res = await request(app)
        .post('/api/events/session-1/reminders')
        .send({ remindAt: futureDate });
      expect(res.status).toBe(400);
    });

    it('returns 201 on successful creation', async () => {
      const remindAt = new Date(Date.now() + 3600 * 1000 * 24);
      vi.mocked(prisma.session.findFirst).mockResolvedValue({
        id: 'session-1',
        startTime: new Date(Date.now() + 3600 * 1000 * 48)
      } as any);
      vi.mocked(prisma.sessionReminder.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.sessionReminder.create).mockResolvedValue({
        id: 'reminder-1',
        sessionId: 'session-1',
        userId: 'test-user-id',
        remindAt,
        sent: false,
        session: { id: 'session-1', title: 'Test', startTime: new Date() }
      } as any);

      const res = await request(app)
        .post('/api/events/session-1/reminders')
        .send({ remindAt: remindAt.toISOString() });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('reminder');
    });
  });

  describe('GET /api/events/:sessionId/reminders - getEventReminders', () => {
    it('returns 404 when user has no session access', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

      const res = await request(app).get('/api/events/session-1/reminders');
      expect(res.status).toBe(404);
    });

    it('returns 200 with reminders list', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValue({ id: 'session-1' } as any);
      vi.mocked(prisma.sessionReminder.findMany).mockResolvedValue([
        { id: 'r1', remindAt: new Date() }
      ] as any);

      const res = await request(app).get('/api/events/session-1/reminders');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reminders');
    });
  });

  describe('GET /api/reminders - getUserReminders', () => {
    it('returns 200 with all user reminders', async () => {
      vi.mocked(prisma.sessionReminder.findMany).mockResolvedValue([
        { id: 'r1', remindAt: new Date(), session: { id: 's1', title: 'Test' } }
      ] as any);

      const res = await request(app).get('/api/reminders');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reminders');
    });
  });

  describe('PUT /api/reminders/:reminderId - updateReminder', () => {
    it('returns 400 when remindAt is missing', async () => {
      const res = await request(app)
        .put('/api/reminders/reminder-1')
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 404 when reminder not found', async () => {
      vi.mocked(prisma.sessionReminder.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/reminders/reminder-1')
        .send({ remindAt: futureDate });
      expect(res.status).toBe(404);
    });

    it('returns 403 when user is not the owner', async () => {
      vi.mocked(prisma.sessionReminder.findUnique).mockResolvedValue({
        id: 'reminder-1',
        userId: 'other-user-id',
        sessionId: 'session-1',
        session: { startTime: new Date(Date.now() + 3600 * 1000 * 48) }
      } as any);

      const res = await request(app)
        .put('/api/reminders/reminder-1')
        .send({ remindAt: futureDate });
      expect(res.status).toBe(403);
    });

    it('returns 200 on successful update', async () => {
      const newRemindAt = new Date(Date.now() + 3600 * 1000 * 24);
      vi.mocked(prisma.sessionReminder.findUnique).mockResolvedValue({
        id: 'reminder-1',
        userId: 'test-user-id',
        sessionId: 'session-1',
        session: { startTime: new Date(Date.now() + 3600 * 1000 * 48) }
      } as any);
      // No duplicate
      vi.mocked(prisma.sessionReminder.findUnique).mockResolvedValueOnce({
        id: 'reminder-1',
        userId: 'test-user-id',
        sessionId: 'session-1',
        session: { startTime: new Date(Date.now() + 3600 * 1000 * 48) }
      } as any).mockResolvedValueOnce(null);

      const updatedReminder = {
        id: 'reminder-2',
        sessionId: 'session-1',
        userId: 'test-user-id',
        remindAt: newRemindAt,
        session: { id: 'session-1', title: 'Test', startTime: new Date() }
      };
      vi.mocked(prisma.$transaction).mockResolvedValue([undefined, updatedReminder] as any);

      const res = await request(app)
        .put('/api/reminders/reminder-1')
        .send({ remindAt: newRemindAt.toISOString() });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('reminder');
    });
  });

  describe('DELETE /api/reminders/:reminderId - deleteReminder', () => {
    it('returns 404 when reminder not found', async () => {
      vi.mocked(prisma.sessionReminder.findUnique).mockResolvedValue(null);

      const res = await request(app).delete('/api/reminders/reminder-1');
      expect(res.status).toBe(404);
    });

    it('returns 403 when user is not the owner', async () => {
      vi.mocked(prisma.sessionReminder.findUnique).mockResolvedValue({
        id: 'reminder-1',
        userId: 'other-user-id'
      } as any);

      const res = await request(app).delete('/api/reminders/reminder-1');
      expect(res.status).toBe(403);
    });

    it('returns 200 on successful deletion', async () => {
      vi.mocked(prisma.sessionReminder.findUnique).mockResolvedValue({
        id: 'reminder-1',
        userId: 'test-user-id'
      } as any);
      vi.mocked(prisma.sessionReminder.delete).mockResolvedValue({} as any);

      const res = await request(app).delete('/api/reminders/reminder-1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
  });
});
