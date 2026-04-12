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
    session: {
      findFirst: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    commentMention: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// ─── Mock email / notification helpers ───────────────────────────────────────

vi.mock('../../utils/emailService', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/notificationHelper', () => ({
  batchShouldSendEmailNotification: vi.fn().mockResolvedValue(new Map()),
}));

import prisma from '../../config/database';
import commentRoutes from '../../routes/commentRoutes';
import { NotFoundError } from '../../utils/errors';

const app = createAuthenticatedTestApp(commentRoutes, 'test-user-id', '/api/comments');

const mockSession = {
  id: 'session-1',
  title: 'Test Session',
  group: {
    members: [
      { user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com' } },
    ],
  },
};

const mockComment = {
  id: 'comment-1',
  content: 'Hello',
  sessionId: 'session-1',
  userId: 'test-user-id',
  parentId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com' },
  replies: [],
};

describe('Comment Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default $transaction implementation passes prisma as tx
    vi.mocked((prisma as any).$transaction).mockImplementation(async (cb: any) => cb(prisma));
  });

  // ─── POST /api/comments ────────────────────────────────────────────────

  describe('POST /api/comments', () => {
    it('returns 400 when sessionId or content is missing', async () => {
      const res = await request(app).post('/api/comments').send({ content: 'Hi' }); // no sessionId
      expect(res.status).toBe(400);

      const res2 = await request(app).post('/api/comments').send({ sessionId: 'session-1' }); // no content
      expect(res2.status).toBe(400);
    });

    it('returns 404 when session is not found', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/comments')
        .send({ sessionId: 'nonexistent', content: 'Hello' });

      expect(res.status).toBe(404);
    });

    it('returns 201 when comment is created successfully', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.comment.create).mockResolvedValue(mockComment as any);

      const res = await request(app)
        .post('/api/comments')
        .send({ sessionId: 'session-1', content: 'Hello' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 'comment-1', content: 'Hello' });
    });
  });

  // ─── GET /api/comments/session/:sessionId ─────────────────────────────

  describe('GET /api/comments/session/:sessionId', () => {
    it('returns 404 when session is not found', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

      const res = await request(app).get('/api/comments/session/nonexistent');

      expect(res.status).toBe(404);
    });

    it('returns 200 with comments', async () => {
      vi.mocked(prisma.session.findFirst).mockResolvedValue(mockSession as any);
      vi.mocked(prisma.comment.findMany).mockResolvedValue([mockComment] as any);

      const res = await request(app).get('/api/comments/session/session-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toMatchObject({ id: 'comment-1' });
    });
  });

  // ─── PUT /api/comments/:commentId ─────────────────────────────────────

  describe('PUT /api/comments/:commentId', () => {
    it('returns 400 when content is missing', async () => {
      const res = await request(app)
        .put('/api/comments/comment-1')
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 404 when comment is not found', async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/comments/nonexistent')
        .send({ content: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('returns 403 when user is not the author', async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        ...mockComment,
        userId: 'other-user-id',
      } as any);

      const res = await request(app)
        .put('/api/comments/comment-1')
        .send({ content: 'Updated' });

      expect(res.status).toBe(403);
    });

    it('returns 200 when comment is updated', async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any);
      const updated = { ...mockComment, content: 'Updated content' };
      vi.mocked(prisma.comment.update).mockResolvedValue(updated as any);

      const res = await request(app)
        .put('/api/comments/comment-1')
        .send({ content: 'Updated content' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ content: 'Updated content' });
    });
  });

  // ─── DELETE /api/comments/:commentId ──────────────────────────────────

  describe('DELETE /api/comments/:commentId', () => {
    it('returns 404 when comment is not found', async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(null);

      const res = await request(app).delete('/api/comments/nonexistent');

      expect(res.status).toBe(404);
    });

    it('returns 403 when user is not the author', async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        ...mockComment,
        userId: 'other-user-id',
      } as any);

      const res = await request(app).delete('/api/comments/comment-1');

      expect(res.status).toBe(403);
    });

    it('returns 200 when comment is deleted', async () => {
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any);
      vi.mocked(prisma.comment.delete).mockResolvedValue(mockComment as any);

      const res = await request(app).delete('/api/comments/comment-1');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: 'Comment deleted successfully' });
    });
  });
});
