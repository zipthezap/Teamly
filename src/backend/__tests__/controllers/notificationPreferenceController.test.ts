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
  generateETag: vi.fn(),
}));

// ─── Mock database ────────────────────────────────────────────────────────────

vi.mock('../../config/database', () => ({
  default: {
    emailPreference: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import prisma from '../../config/database';
import notificationPreferenceRoutes from '../../routes/notificationPreferenceRoutes';

const app = createAuthenticatedTestApp(
  notificationPreferenceRoutes,
  'test-user-id',
  '/api/notification-preferences'
);

const mockPrefs = {
  id: 'pref-1',
  userId: 'test-user-id',
  sessionInvites: true,
  sessionReminders: true,
  sessionUpdates: true,
  sessionCancellations: true,
  groupInvites: true,
  commentMentions: true,
  nearbyTeamUps: true,
  muteSessionInvites: false,
  muteSessionReminders: false,
  muteSessionUpdates: false,
  muteSessionCancellations: false,
  muteGroupInvites: false,
  muteGroupRequests: false,
  muteNearbyGroups: false,
  muteSessionCreated: false,
  muteNearbyTeamUps: false,
  pushEnabled: true,
  pushSessions: true,
  pushGroups: true,
  pushTeamUp: true,
  pushTournaments: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('NotificationPreference Controller', () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── GET /api/notification-preferences ────────────────────────────────

  describe('GET /api/notification-preferences', () => {
    it('creates default preferences when none exist and returns them', async () => {
      vi.mocked(prisma.emailPreference.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.emailPreference.create).mockResolvedValue(mockPrefs as any);

      const res = await request(app).get('/api/notification-preferences');

      expect(res.status).toBe(200);
      expect(prisma.emailPreference.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { userId: 'test-user-id' } })
      );
      expect(res.body).toMatchObject({ userId: 'test-user-id' });
    });

    it('returns existing preferences without creating new ones', async () => {
      vi.mocked(prisma.emailPreference.findUnique).mockResolvedValue(mockPrefs as any);

      const res = await request(app).get('/api/notification-preferences');

      expect(res.status).toBe(200);
      expect(prisma.emailPreference.create).not.toHaveBeenCalled();
      expect(res.body).toMatchObject({ id: 'pref-1', userId: 'test-user-id' });
    });
  });

  // ─── PUT /api/notification-preferences ────────────────────────────────

  describe('PUT /api/notification-preferences', () => {
    it('upserts and returns updated preferences', async () => {
      const updated = { ...mockPrefs, sessionReminders: false };
      vi.mocked(prisma.emailPreference.upsert).mockResolvedValue(updated as any);

      const res = await request(app)
        .put('/api/notification-preferences')
        .send({ sessionReminders: false });

      expect(res.status).toBe(200);
      expect(prisma.emailPreference.upsert).toHaveBeenCalled();
    });

    it('upserts preferences with pushEnabled field', async () => {
      const updated = { ...mockPrefs, pushEnabled: false };
      vi.mocked(prisma.emailPreference.upsert).mockResolvedValue(updated as any);

      const res = await request(app)
        .put('/api/notification-preferences')
        .send({ pushEnabled: false });

      expect(res.status).toBe(200);
    });
  });
});
