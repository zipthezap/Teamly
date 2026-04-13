import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createAuthenticatedTestApp } from '../helpers/testApp';

// ─── Mock middleware ──────────────────────────────────────────────────────────

vi.mock('../../middleware/auth', () => ({
  default: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/cacheControl', () => ({
  noCache: (_req: any, _res: any, next: any) => next(),
  cacheControl: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/etag', () => ({
  etagMiddleware: () => (_req: any, _res: any, next: any) => next(),
  generateWeakETag: vi.fn(),
  generateStrongETag: vi.fn(),
  generateETag: vi.fn(),
}));

// ─── Mock database ────────────────────────────────────────────────────────────

vi.mock('../../config/database', () => ({
  default: {
    sessionNotification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    groupNotification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    groupMember: {
      findUnique: vi.fn(),
    },
    groupMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    sessionAttendance: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../utils/validation', () => ({
  sanitizeUserInput: vi.fn((v: string) => v),
  sanitizeString: vi.fn((v: string) => v),
  isRequired: vi.fn(() => true),
  validateEmail: vi.fn(() => ({ valid: true })),
  validateStrongPassword: vi.fn(() => ({ valid: true })),
}));

import prisma from '../../config/database';
import groupChatRoutes from '../../routes/groupChatRoutes';

const USER_ID = 'test-user-id';
const app = createAuthenticatedTestApp(groupChatRoutes, USER_ID, '/api/chat');

describe('GroupChat Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── GET /api/chat/notifications ──────────────────────────────────────

  describe('GET /api/chat/notifications', () => {
    it('returns 200 with session and group notifications', async () => {
      const sessionNotifs = [{ id: 'sn-1', userId: USER_ID, type: 'late' }];
      const groupNotifs = [{ id: 'gn-1', userId: USER_ID, type: 'message' }];

      vi.mocked(prisma.sessionNotification.findMany).mockResolvedValue(sessionNotifs as any);
      vi.mocked(prisma.groupNotification.findMany).mockResolvedValue(groupNotifs as any);

      const res = await request(app).get('/api/chat/notifications');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ sessionNotifications: sessionNotifs, groupNotifications: groupNotifs });
    });

    it('returns empty arrays when no notifications exist', async () => {
      vi.mocked(prisma.sessionNotification.findMany).mockResolvedValue([]);
      vi.mocked(prisma.groupNotification.findMany).mockResolvedValue([]);

      const res = await request(app).get('/api/chat/notifications');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ sessionNotifications: [], groupNotifications: [] });
    });
  });

  // ─── POST /api/chat/session/unmark-late ───────────────────────────────

  describe('POST /api/chat/session/unmark-late', () => {
    it('returns 200 with updated attendance when status is late', async () => {
      const attendance = { sessionId: 'sess-1', userId: USER_ID, status: 'late' };
      const updated = { ...attendance, status: 'on_time' };

      vi.mocked(prisma.sessionAttendance.findUnique).mockResolvedValue(attendance as any);
      vi.mocked(prisma.sessionAttendance.update).mockResolvedValue(updated as any);
      vi.mocked(prisma.sessionNotification.findFirst).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/chat/session/unmark-late')
        .send({ sessionId: 'sess-1' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'on_time' });
    });

    it('deletes the late notification if one exists', async () => {
      const attendance = { sessionId: 'sess-1', userId: USER_ID, status: 'late' };
      const notification = { id: 'notif-1' };
      const updated = { ...attendance, status: 'on_time' };

      vi.mocked(prisma.sessionAttendance.findUnique).mockResolvedValue(attendance as any);
      vi.mocked(prisma.sessionAttendance.update).mockResolvedValue(updated as any);
      vi.mocked(prisma.sessionNotification.findFirst).mockResolvedValue(notification as any);
      vi.mocked(prisma.sessionNotification.delete).mockResolvedValue(notification as any);

      const res = await request(app)
        .post('/api/chat/session/unmark-late')
        .send({ sessionId: 'sess-1' });

      expect(res.status).toBe(200);
      expect(prisma.sessionNotification.delete).toHaveBeenCalledWith({ where: { id: 'notif-1' } });
    });

    it('returns 400 when attendance record is not found', async () => {
      vi.mocked(prisma.sessionAttendance.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/chat/session/unmark-late')
        .send({ sessionId: 'sess-1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not marked as late/i);
    });

    it('returns 400 when attendance status is not late', async () => {
      vi.mocked(prisma.sessionAttendance.findUnique).mockResolvedValue({
        sessionId: 'sess-1',
        userId: USER_ID,
        status: 'on_time',
      } as any);

      const res = await request(app)
        .post('/api/chat/session/unmark-late')
        .send({ sessionId: 'sess-1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not marked as late/i);
    });
  });

  // ─── POST /api/chat/message ───────────────────────────────────────────

  describe('POST /api/chat/message', () => {
    it('returns 201 with created message when user is a group member', async () => {
      const membership = { id: 'mem-1' };
      const message = {
        id: 'msg-1',
        groupId: 'grp-1',
        userId: USER_ID,
        content: 'Hello',
        user: { id: USER_ID, name: 'Test User', profilePicture: null, email: 'test@example.com' },
      };

      vi.mocked(prisma.groupMember.findUnique).mockResolvedValue(membership as any);
      vi.mocked(prisma.groupMessage.create).mockResolvedValue(message as any);

      const res = await request(app)
        .post('/api/chat/message')
        .send({ groupId: 'grp-1', content: 'Hello' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 'msg-1', content: 'Hello' });
    });

    it('returns 403 when user is not a group member', async () => {
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/chat/message')
        .send({ groupId: 'grp-1', content: 'Hello' });

      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/chat/:groupId/messages ──────────────────────────────────

  describe('GET /api/chat/:groupId/messages', () => {
    it('returns 403 when user is not a group member', async () => {
      vi.mocked(prisma.groupMember.findUnique).mockResolvedValue(null);

      const res = await request(app).get('/api/chat/grp-1/messages');

      expect(res.status).toBe(403);
    });

    it('returns 200 with messages array when user is a member', async () => {
      const membership = { id: 'mem-1' };
      const messages = [
        { id: 'msg-1', content: 'Hello', createdAt: new Date('2024-01-01').toISOString() },
        { id: 'msg-2', content: 'World', createdAt: new Date('2024-01-02').toISOString() },
      ];

      vi.mocked(prisma.groupMember.findUnique).mockResolvedValue(membership as any);
      vi.mocked(prisma.groupMessage.findMany).mockResolvedValue([...messages].reverse() as any);

      const res = await request(app).get('/api/chat/grp-1/messages');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });
  });

  // ─── POST /api/chat/session/late ──────────────────────────────────────

  describe('POST /api/chat/session/late', () => {
    it('returns 404 when session is not found', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/chat/session/late')
        .send({ sessionId: 'nonexistent' });

      expect(res.status).toBe(404);
    });

    it('returns 400 when user is already marked as late', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({ creatorId: 'creator-1' } as any);
      vi.mocked(prisma.sessionAttendance.findUnique).mockResolvedValue({ status: 'late' } as any);

      const res = await request(app)
        .post('/api/chat/session/late')
        .send({ sessionId: 'sess-1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already marked as late/i);
    });

    it('returns 200 with attendance on success', async () => {
      const attendance = { sessionId: 'sess-1', userId: USER_ID, status: 'late' };

      vi.mocked(prisma.session.findUnique)
        .mockResolvedValueOnce({ creatorId: 'creator-1' } as any)
        .mockResolvedValueOnce({ title: 'Test Session' } as any);
      vi.mocked(prisma.sessionAttendance.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.sessionAttendance.upsert).mockResolvedValue(attendance as any);
      vi.mocked(prisma.sessionNotification.create).mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/chat/session/late')
        .send({ sessionId: 'sess-1' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'late' });
    });
  });

  // ─── POST /api/chat/notifications/mark-read ───────────────────────────

  describe('POST /api/chat/notifications/mark-read', () => {
    it('calls updateMany when there are unread notifications', async () => {
      vi.mocked(prisma.sessionNotification.count).mockResolvedValue(3);
      vi.mocked(prisma.groupNotification.count).mockResolvedValue(2);
      vi.mocked(prisma.sessionNotification.updateMany).mockResolvedValue({ count: 3 } as any);
      vi.mocked(prisma.groupNotification.updateMany).mockResolvedValue({ count: 2 } as any);

      const res = await request(app).post('/api/chat/notifications/mark-read');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'Notifications marked as read' });
      expect(prisma.sessionNotification.updateMany).toHaveBeenCalled();
      expect(prisma.groupNotification.updateMany).toHaveBeenCalled();
    });

    it('skips updateMany when there are no unread notifications', async () => {
      vi.mocked(prisma.sessionNotification.count).mockResolvedValue(0);
      vi.mocked(prisma.groupNotification.count).mockResolvedValue(0);

      const res = await request(app).post('/api/chat/notifications/mark-read');

      expect(res.status).toBe(200);
      expect(prisma.sessionNotification.updateMany).not.toHaveBeenCalled();
      expect(prisma.groupNotification.updateMany).not.toHaveBeenCalled();
    });
  });
});
