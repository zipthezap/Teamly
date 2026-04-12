import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createAuthenticatedTestApp } from './src/backend/__tests__/helpers/testApp';

vi.mock('./src/backend/middleware/auth', () => ({
  default: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('./src/backend/middleware/cacheControl', () => ({
  noCache: (_req: any, _res: any, next: any) => next(),
  cacheControl: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock('./src/backend/middleware/etag', () => ({
  etagMiddleware: () => (_req: any, _res: any, next: any) => next(),
  generateWeakETag: vi.fn(), generateStrongETag: vi.fn(), generateETag: vi.fn(),
}));
vi.mock('./src/backend/middleware/rateLimiter', () => ({
  authenticatedLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('./src/backend/middleware/distributedRateLimiter', () => ({
  distributedAuthenticatedLimiter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('./src/backend/config/database', () => ({ default: { session: { create: vi.fn() }, $transaction: vi.fn() } }));
vi.mock('./src/backend/services/sessionService', () => ({
  sanitizeSessionData: vi.fn((d: any) => d),
  validateSessionTimes: vi.fn(() => ({ valid: true })),
  validateRecurrence: vi.fn(() => ({ valid: true })),
  buildSessionFilters: vi.fn(() => ({})),
  getGroupWithMembers: vi.fn(),
  determineSessionStatus: vi.fn(() => 'upcoming'),
  createSessionNotifications: vi.fn(),
  sendSessionEmailNotifications: vi.fn(),
  createSessionUpdateNotifications: vi.fn(),
  createSessionDeletionNotifications: vi.fn(),
  checkSessionManagementPermission: vi.fn(),
  sanitizeGuestName: vi.fn((n: any) => n),
  isSessionFull: vi.fn(),
  canModifySession: vi.fn(),
}));
vi.mock('./src/backend/services/locationService', () => ({
  enrichWithLocationInfo: vi.fn((s: any) => s),
  calculateBoundingBox: vi.fn(),
  filterByLocation: vi.fn(),
}));
vi.mock('./src/backend/services/permissionService', () => ({
  permissionService: { hasGroupPermission: vi.fn(), hasEventPermission: vi.fn() }
}));
vi.mock('./src/backend/services/notificationFactory', () => ({
  NotificationFactory: { createSessionNotifications: vi.fn(), createGroupNotifications: vi.fn() }
}));
vi.mock('./src/backend/utils/inviteToken', () => ({ createInviteToken: vi.fn() }));
vi.mock('./src/backend/services/cacheService', () => ({
  CacheService: { get: vi.fn(), set: vi.fn(), deletePattern: vi.fn() }
}));
vi.mock('./src/backend/services/sessionNotification', () => ({ getSessionActivity: vi.fn() }));
vi.mock('./src/backend/utils/recurrenceService', () => ({
  generateRecurrenceInstances: vi.fn(() => []),
  calculateDuration: vi.fn(),
  applyDuration: vi.fn(),
  validateRecurrenceRule: vi.fn(),
}));
vi.mock('./src/backend/services/exportService', () => ({
  exportToCSV: vi.fn(), exportToICalendar: vi.fn(), exportToJSON: vi.fn()
}));
vi.mock('./src/backend/services/inviteService', () => ({
  InviteService: { sendInvitationEmail: vi.fn(), createInviteLog: vi.fn(), revokeInvitation: vi.fn() },
  calculateExpirationDate: vi.fn(),
}));
vi.mock('./src/backend/services/metricsService', () => ({ recordSearchQuery: vi.fn() }));
vi.mock('./src/backend/services/sessionValidation', () => ({
  validateSessionStatus: vi.fn(() => ({ isValid: true })),
}));

import sessionRoutes from './src/backend/routes/sessionRoutes';

const app = createAuthenticatedTestApp(sessionRoutes, 'test-user-id', '/api/sessions');

describe('debug', () => {
  it('shows the actual response for missing groupId', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ title: 'My Event', sessionType: 'soccer', startTime: '2025-12-01T10:00:00Z' });
    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(res.body));
    expect(true).toBe(true);
  });
});
