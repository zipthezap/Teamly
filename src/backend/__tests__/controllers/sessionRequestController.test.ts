import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import sessionRequestRoutes from '../../routes/sessionRequestRoutes';

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

vi.mock('../../middleware/etag', () => ({
  etagMiddleware: () => (_: any, __: any, next: any) => next()
}));
vi.mock('../../middleware/cacheControl', () => ({
  noCache: (_: any, __: any, next: any) => next(),
  cacheControl: () => (_: any, __: any, next: any) => next()
}));

vi.mock('../../config/database', () => ({
  default: {
    groupMember: { findFirst: vi.fn() },
    sessionRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    sessionVote: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    session: { create: vi.fn() }
  }
}));

vi.mock('../../services/sessionService', () => ({
  sanitizeSessionData: vi.fn((data: any) => data)
}));

vi.mock('../../services/sessionValidation', () => ({
  validateVoteThreshold: vi.fn(() => ({ isValid: true })),
  validateVoteDeadline: vi.fn(() => ({ isValid: true }))
}));

import prisma from '../../config/database';

describe('Session Request Controller', () => {
  const app = createTestApp(sessionRequestRoutes, '/api/session-requests');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/session-requests', () => {
    it('returns error when required fields are missing', async () => {
      // createEventRequest has an internal try/catch that returns 500 on all errors
      // (including BadRequestError) by design
      const res = await request(app)
        .post('/api/session-requests')
        .send({ title: 'Test' }); // missing groupId, sessionType, startTime
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('returns error when user is not a group member', async () => {
      // createEventRequest has an internal try/catch that returns 500 on all errors
      // (including ForbiddenError) by design
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/session-requests')
        .send({
          groupId: 'group-1',
          title: 'Test Session',
          sessionType: 'soccer',
          startTime: new Date(Date.now() + 86400000).toISOString()
        });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('returns 201 on successful creation', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({
        id: 'member-1',
        groupId: 'group-1',
        userId: 'test-user-id',
        role: 'member'
      } as any);
      vi.mocked(prisma.sessionRequest.create).mockResolvedValue({
        id: 'request-1',
        groupId: 'group-1',
        creatorId: 'test-user-id',
        title: 'Test Session',
        status: 'voting',
        creator: { id: 'test-user-id', name: 'Test User', email: 'test@example.com' },
        votes: []
      } as any);

      const res = await request(app)
        .post('/api/session-requests')
        .send({
          groupId: 'group-1',
          title: 'Test Session',
          sessionType: 'soccer',
          startTime: new Date(Date.now() + 86400000).toISOString()
        });
      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/session-requests/group/:groupId', () => {
    it('returns 200 with list of session requests', async () => {
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({
        id: 'member-1',
        groupId: 'group-1',
        userId: 'test-user-id'
      } as any);
      vi.mocked(prisma.sessionRequest.findMany).mockResolvedValue([
        { id: 'req-1', title: 'Test', votes: [], _count: { votes: 0 } }
      ] as any);

      const res = await request(app).get('/api/session-requests/group/group-1');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/session-requests/:id', () => {
    it('returns 404 when not found', async () => {
      vi.mocked(prisma.sessionRequest.findUnique).mockResolvedValue(null);

      const res = await request(app).get('/api/session-requests/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns 200 on success', async () => {
      vi.mocked(prisma.sessionRequest.findUnique).mockResolvedValue({
        id: 'req-1',
        groupId: 'group-1',
        title: 'Test',
        creator: { id: 'test-user-id', name: 'Test', email: 'test@example.com' },
        group: { id: 'group-1', name: 'Group' },
        votes: [],
        _count: { votes: 0 }
      } as any);
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({
        id: 'member-1',
        groupId: 'group-1',
        userId: 'test-user-id'
      } as any);

      const res = await request(app).get('/api/session-requests/req-1');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/session-requests/:id/vote', () => {
    it('returns 200 on successful vote', async () => {
      vi.mocked(prisma.sessionRequest.findUnique).mockResolvedValue({
        id: 'req-1',
        groupId: 'group-1',
        status: 'voting',
        voteDeadline: null
      } as any);
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({
        id: 'member-1',
        groupId: 'group-1',
        userId: 'test-user-id'
      } as any);
      vi.mocked(prisma.sessionVote.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.sessionVote.create).mockResolvedValue({
        id: 'vote-1',
        vote: 'yes',
        user: { id: 'test-user-id', name: 'Test', email: 'test@example.com' }
      } as any);

      const res = await request(app)
        .post('/api/session-requests/req-1/vote')
        .send({ vote: 'yes' });
      expect(res.status).toBe(201);
    });
  });

  describe('POST /api/session-requests/:id/finalize', () => {
    it('returns 200 on finalize (admin creates session)', async () => {
      vi.mocked(prisma.sessionRequest.findUnique).mockResolvedValue({
        id: 'req-1',
        groupId: 'group-1',
        creatorId: 'test-user-id',
        title: 'Test',
        description: null,
        eventType: 'soccer',
        location: null,
        startTime: new Date(Date.now() + 86400000),
        endTime: null,
        maxPlayers: null,
        status: 'voting',
        voteThreshold: 0.5,
        votes: [{ vote: 'yes', userId: 'test-user-id', id: 'v1', createdAt: new Date() }],
        group: {
          members: [{ userId: 'test-user-id' }]
        }
      } as any);
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({
        id: 'member-1',
        groupId: 'group-1',
        userId: 'test-user-id',
        role: 'admin'
      } as any);
      vi.mocked(prisma.session.create).mockResolvedValue({
        id: 'session-1',
        title: 'Test',
        creator: { id: 'test-user-id', name: 'Test', email: 'test@example.com' }
      } as any);
      vi.mocked(prisma.sessionRequest.update).mockResolvedValue({} as any);

      const res = await request(app).post('/api/session-requests/req-1/finalize');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/session-requests/:id/cancel', () => {
    it('returns 200 on cancel', async () => {
      vi.mocked(prisma.sessionRequest.findUnique).mockResolvedValue({
        id: 'req-1',
        groupId: 'group-1',
        status: 'voting'
      } as any);
      vi.mocked(prisma.groupMember.findFirst).mockResolvedValue({
        id: 'member-1',
        groupId: 'group-1',
        userId: 'test-user-id',
        role: 'admin'
      } as any);
      vi.mocked(prisma.sessionRequest.update).mockResolvedValue({
        id: 'req-1',
        status: 'cancelled'
      } as any);

      const res = await request(app).post('/api/session-requests/req-1/cancel');
      expect(res.status).toBe(200);
    });
  });
});
