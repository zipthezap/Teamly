import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import notificationRoutes from '../../routes/notificationRoutes';

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

vi.mock('../../services/notificationService', () => ({
  getUserNotifications: vi.fn(),
  markNotificationsAsRead: vi.fn(),
  getNotificationStats: vi.fn(),
  deleteNotifications: vi.fn(),
  deleteAllReadNotifications: vi.fn()
}));

vi.mock('../../services/sseService', () => ({
  registerSseClient: vi.fn(),
  removeSseClient: vi.fn()
}));

import * as notificationService from '../../services/notificationService';
import * as sseService from '../../services/sseService';

describe('Notification Controller', () => {
  const app = createTestApp(notificationRoutes, '/api/notifications');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/notifications', () => {
    it('returns 200 with notifications list', async () => {
      vi.mocked(notificationService.getUserNotifications).mockResolvedValue({
        notifications: [{ id: 'n1', title: 'Test', message: 'msg', isRead: false }],
        total: 1,
        hasMore: false,
        nextCursor: null
      } as any);

      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('notifications');
      expect(res.body.notifications).toHaveLength(1);
    });
  });

  describe('PUT /api/notifications/read', () => {
    it('returns 200 when marking notifications as read', async () => {
      vi.mocked(notificationService.markNotificationsAsRead).mockResolvedValue(undefined as any);

      const res = await request(app)
        .put('/api/notifications/read')
        .send({ notificationIds: ['n1', 'n2'] });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    it('returns 200 when marking all notifications as read (no body)', async () => {
      vi.mocked(notificationService.markNotificationsAsRead).mockResolvedValue(undefined as any);

      const res = await request(app).put('/api/notifications/read').send({});
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/notifications/stats', () => {
    it('returns 200 with stats', async () => {
      vi.mocked(notificationService.getNotificationStats).mockResolvedValue({
        total: 10,
        unread: 3,
        unreadEvent: 1,
        unreadGroup: 2
      } as any);

      const res = await request(app).get('/api/notifications/stats');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('unread');
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('returns 200 with unread count', async () => {
      vi.mocked(notificationService.getNotificationStats).mockResolvedValue({
        total: 10,
        unread: 5,
        unreadEvent: 2,
        unreadGroup: 3
      } as any);

      const res = await request(app).get('/api/notifications/unread-count');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('count', 5);
    });
  });

  describe('DELETE /api/notifications', () => {
    it('returns 200 when deleting specific notifications', async () => {
      vi.mocked(notificationService.deleteNotifications).mockResolvedValue({ deletedCount: 2 } as any);

      const res = await request(app)
        .delete('/api/notifications')
        .send({ notificationIds: ['n1', 'n2'] });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('deletedCount', 2);
    });

    it('returns 400 when notificationIds is missing', async () => {
      const res = await request(app).delete('/api/notifications').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/notifications/read', () => {
    it('returns 200 when deleting all read notifications', async () => {
      vi.mocked(notificationService.deleteAllReadNotifications).mockResolvedValue({ deletedCount: 4 } as any);

      const res = await request(app).delete('/api/notifications/read');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('deletedCount', 4);
    });
  });

  describe('GET /api/notifications/stream', () => {
    it('sets SSE headers and calls registerSseClient', async () => {
      // SSE is a long-lived connection so we test by calling the controller directly
      // rather than via supertest (which would hang waiting for the stream to close).
      const { streamNotifications } = await import('../../controllers/notificationController');

      const mockRes: any = {
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn(),
        on: vi.fn(),
      };
      const mockReq: any = {
        user: { id: 'test-user-id' },
        on: vi.fn(),
      };

      vi.mocked(sseService.registerSseClient).mockImplementation(() => {});

      streamNotifications(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.flushHeaders).toHaveBeenCalled();
      expect(sseService.registerSseClient).toHaveBeenCalledWith('test-user-id', mockRes);
    });
  });
});
