import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Router } from 'express';
import { createAuthenticatedTestApp } from '../helpers/testApp';

// ─── Mock database ────────────────────────────────────────────────────────────

vi.mock('../../config/database', () => ({
  default: {
    session: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    sessionAttendance: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    sessionNotification: {
      create: vi.fn(),
    },
  },
}));

import prisma from '../../config/database';
import {
  markAttendance,
  getEventAttendance,
  getAttendanceStats,
  deleteAttendance,
} from '../../controllers/attendanceController';

// Build a minimal router that mirrors the session routes attendance paths
const attendanceRouter = Router({ mergeParams: true });
attendanceRouter.post('/:sessionId/attendance', markAttendance);
attendanceRouter.get('/:sessionId/attendance', getEventAttendance);
attendanceRouter.get('/:sessionId/attendance/stats', getAttendanceStats);
attendanceRouter.delete('/:sessionId/attendance/:userId', deleteAttendance);

const app = createAuthenticatedTestApp(attendanceRouter, 'test-user-id', '/api/events');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const pastTime = new Date(Date.now() - 3600 * 1000); // 1 hour ago
const futureTime = new Date(Date.now() + 3600 * 1000); // 1 hour from now

const mockSession = {
  id: 'session-1',
  title: 'Test Session',
  creatorId: 'test-user-id',
  startTime: pastTime,
  participants: [{ userId: 'test-user-id' }],
};

const mockAttendanceRecord = {
  id: 'att-1',
  sessionId: 'session-1',
  userId: 'test-user-id',
  status: 'on_time',
  user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com' },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('Attendance Controller', () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── POST /api/events/:sessionId/attendance ────────────────────────────

  describe('POST /api/events/:sessionId/attendance', () => {
    it('returns 400 when status is invalid', async () => {
      const res = await request(app)
        .post('/api/events/session-1/attendance')
        .send({ status: 'invalid-status' });

      expect(res.status).toBe(400);
    });

    it('returns 404 when session is not found', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/events/session-1/attendance')
        .send({ status: 'on-time' });

      expect(res.status).toBe(404);
    });

    it('returns 400 when user is not a participant', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        participants: [], // no participants
      } as any);

      const res = await request(app)
        .post('/api/events/session-1/attendance')
        .send({ status: 'on-time' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when event has not started yet', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        startTime: futureTime, // event is in the future
      } as any);

      const res = await request(app)
        .post('/api/events/session-1/attendance')
        .send({ status: 'on-time' });

      expect(res.status).toBe(400);
    });

    it('returns 200 when attendance is marked successfully', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.sessionAttendance.upsert).mockResolvedValue(mockAttendanceRecord as any);

      const res = await request(app)
        .post('/api/events/session-1/attendance')
        .send({ status: 'on-time' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'Attendance marked successfully' });
    });
  });

  // ─── GET /api/events/:sessionId/attendance ────────────────────────────

  describe('GET /api/events/:sessionId/attendance', () => {
    it('returns 404 when session is not found or user has no access', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

      const res = await request(app).get('/api/events/session-1/attendance');

      expect(res.status).toBe(404);
    });

    it('returns 200 with attendance records', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.sessionAttendance.findMany).mockResolvedValue([
        mockAttendanceRecord,
      ] as any);

      const res = await request(app).get('/api/events/session-1/attendance');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('attendance');
      expect(Array.isArray(res.body.attendance)).toBe(true);
    });
  });

  // ─── GET /api/events/:sessionId/attendance/stats ─────────────────────

  describe('GET /api/events/:sessionId/attendance/stats', () => {
    it('returns 200 with attendance stats', async () => {
      const sessionWithCount = {
        ...mockSession,
        _count: { participants: 5 },
      };
      vi.mocked(prisma.session.findFirst).mockResolvedValue(sessionWithCount as any);
      vi.mocked(prisma.sessionAttendance.count)
        .mockResolvedValueOnce(3) // on_time count
        .mockResolvedValueOnce(1); // late count

      const res = await request(app).get('/api/events/session-1/attendance/stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('stats');
      expect(res.body.stats).toMatchObject({
        totalParticipants: 5,
        onTime: 3,
        late: 1,
        noShow: 1,
      });
    });
  });

  // ─── DELETE /api/events/:sessionId/attendance/:userId ────────────────

  describe('DELETE /api/events/:sessionId/attendance/:userId', () => {
    it('returns 404 when session is not found', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

      const res = await request(app).delete(
        '/api/events/session-1/attendance/other-user-id'
      );

      expect(res.status).toBe(404);
    });

    it('returns 403 when user is not the session creator', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        ...mockSession,
        creatorId: 'someone-else', // not the authenticated user
      } as any);

      const res = await request(app).delete(
        '/api/events/session-1/attendance/other-user-id'
      );

      expect(res.status).toBe(403);
    });

    it('returns 200 when attendance record is deleted', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.sessionAttendance.findUnique).mockResolvedValue(
        mockAttendanceRecord as any
      );
      vi.mocked(prisma.sessionAttendance.delete).mockResolvedValue(
        mockAttendanceRecord as any
      );

      const res = await request(app).delete(
        '/api/events/session-1/attendance/test-user-id'
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'Attendance record deleted successfully' });
    });
  });
});
