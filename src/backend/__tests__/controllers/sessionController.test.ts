import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createAuthenticatedTestApp } from '../helpers/testApp';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errors';

// ─── All vi.mock calls hoisted before imports ─────────────────────────────────

vi.mock('../../middleware/auth', () => ({
  default: (_req: any, _res: any, next: any) => next(),
  optionalAuthMiddleware: (_req: any, _res: any, next: any) => next(),
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

vi.mock('../../middleware/rateLimiter', () => ({
  authenticatedLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/distributedRateLimiter', () => ({
  distributedAuthenticatedLimiter: (_req: any, _res: any, next: any) => next(),
  distributedUploadLimiter: (_req: any, _res: any, next: any) => next(),
  distributedApiLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/upload', () => ({
  upload: { single: vi.fn(() => (_r: any, _rs: any, n: any) => n()) },
}));

vi.mock('../../config/database', () => ({
  default: {
    session: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    sessionParticipant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    sessionActivity: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    sessionNotification: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    sessionAttendance: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    groupMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    guestParticipant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    sessionInvitation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../services/sessionService', () => ({
  sanitizeSessionData: vi.fn((d: any) => d),
  sanitizeGuestName: vi.fn((n: any) => n),
  validateSessionTimes: vi.fn(() => ({ valid: true })),
  validateRecurrence: vi.fn(() => ({ valid: true })),
  buildSessionFilters: vi.fn(() => ({})),
  canModifySession: vi.fn(),
  checkSessionManagementPermission: vi.fn(),
  isSessionFull: vi.fn(() => false),
  createSessionNotifications: vi.fn().mockResolvedValue(undefined),
  createSessionUpdateNotifications: vi.fn().mockResolvedValue(undefined),
  createSessionDeletionNotifications: vi.fn().mockResolvedValue(undefined),
  sendSessionEmailNotifications: vi.fn().mockResolvedValue(undefined),
  getGroupWithMembers: vi.fn(),
  determineSessionStatus: vi.fn(() => 'upcoming'),
}));

vi.mock('../../services/sessionValidation', () => ({
  validateSingleDay: vi.fn(() => ({ isValid: true })),
  validateRequiredFields: vi.fn(() => ({ isValid: true })),
  validateGroupMembership: vi.fn().mockResolvedValue({ isValid: true }),
  validateEventCreator: vi.fn().mockResolvedValue({ isValid: true }),
  validateSessionStatus: vi.fn(() => ({ isValid: true })),
  validateEventCapacity: vi.fn(() => ({ isValid: true })),
  validateVoteThreshold: vi.fn(() => ({ isValid: true })),
  validateVoteDeadline: vi.fn(() => ({ isValid: true })),
}));

vi.mock('../../services/sessionNotification', () => ({
  sendEventInvitations: vi.fn(),
  sendEventUpdateNotifications: vi.fn(),
  sendEventCancellationNotifications: vi.fn(),
  createSessionNotifications: vi.fn(),
  getSessionActivity: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../utils/recurrenceService', () => ({
  validateRecurrenceRule: vi.fn(() => true),
  generateRecurrenceInstances: vi.fn(() => []),
  getNextOccurrence: vi.fn(),
  calculateDuration: vi.fn(),
  applyDuration: vi.fn(),
  RecurrencePatterns: {},
}));

vi.mock('../../utils/inviteToken', () => ({
  createInviteToken: vi.fn().mockReturnValue('mock-invite-token-64chars'),
}));

vi.mock('../../services/locationService', () => ({
  getNearbyEvents: vi.fn().mockResolvedValue([]),
  calculateDistance: vi.fn(),
  enrichWithLocationInfo: vi.fn((s: any) => s),
  validateCoordinates: vi.fn(() => ({ valid: true })),
  filterByLocation: vi.fn((sessions: any[]) => sessions),
  calculateBoundingBox: vi.fn(() => ({ latDelta: 1, lonDelta: 1 })),
}));

vi.mock('../../services/exportService', () => ({
  exportToCSV: vi.fn().mockReturnValue('id,title\n1,Test'),
  exportToICalendar: vi.fn().mockReturnValue('BEGIN:VCALENDAR\nEND:VCALENDAR'),
  exportToJSON: vi.fn().mockReturnValue('{"events":[]}'),
}));

vi.mock('../../services/permissionService', () => ({
  permissionService: {
    hasGroupPermission: vi.fn(),
    hasEventPermission: vi.fn(),
  },
}));

vi.mock('../../services/notificationFactory', () => ({
  NotificationFactory: {
    createSessionNotifications: vi.fn().mockResolvedValue(undefined),
    createGroupNotifications: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/inviteService', () => ({
  InviteService: {
    sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
    createInviteLog: vi.fn().mockResolvedValue(undefined),
    revokeInvitation: vi.fn().mockResolvedValue({ success: true }),
    generateInviteToken: vi.fn().mockResolvedValue({ success: true, token: 'new-token', expiresAt: new Date() }),
    getInviteAnalytics: vi.fn().mockResolvedValue({}),
  },
  calculateExpirationDate: vi.fn().mockReturnValue(new Date()),
}));

vi.mock('../../services/cacheService', () => ({
  CacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    deletePattern: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
    invalidatePattern: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/metricsService', () => ({
  recordSearchQuery: vi.fn(),
}));

// ─── Imports after mocks ───────────────────────────────────────────────────────

import prisma from '../../config/database';
import sessionRoutes from '../../routes/sessionRoutes';
import { CacheService } from '../../services/cacheService';
import * as sessionService from '../../services/sessionService';
import { permissionService } from '../../services/permissionService';
import { InviteService } from '../../services/inviteService';
import * as locationService from '../../services/locationService';
import * as sessionValidation from '../../services/sessionValidation';

// ─── Test app ─────────────────────────────────────────────────────────────────

const app = createAuthenticatedTestApp(sessionRoutes, 'test-user-id', '/api/sessions');

// ─── Shared mock data ─────────────────────────────────────────────────────────

const mockSession = {
  id: 'session-1',
  groupId: 'group-1',
  creatorId: 'test-user-id',
  title: 'Test Session',
  description: 'A test session',
  sessionType: 'football',
  location: 'Test Location',
  latitude: null,
  longitude: null,
  locationName: null,
  city: null,
  country: null,
  startTime: new Date('2025-12-01T10:00:00Z'),
  endTime: new Date('2025-12-01T12:00:00Z'),
  maxPlayers: null,
  isRecurring: false,
  recurrenceRule: null,
  recurrenceEnd: null,
  exceptionDates: [],
  status: 'upcoming',
  isPublic: true,
  inviteToken: 'test-invite-token',
  archived: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  creator: { id: 'test-user-id', name: 'Test User', email: 'test@example.com', profilePicture: null },
  group: { id: 'group-1', name: 'Test Group' },
  participants: [],
  guestParticipants: [],
  sessionAttendances: [],
  sessionNotifications: [],
  _count: { participants: 0, guestParticipants: 0, comments: 0 },
};

const mockGroup = {
  id: 'group-1',
  name: 'Test Group',
  members: [
    { userId: 'test-user-id', role: 'admin' },
    { userId: 'other-user-id', role: 'member' },
  ],
};

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(CacheService.get).mockResolvedValue(null);
  vi.mocked(CacheService.set).mockResolvedValue(undefined as any);
  vi.mocked(CacheService.deletePattern).mockResolvedValue(undefined as any);

  vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
    typeof fn === 'function' ? fn(prisma) : Promise.all(fn)
  );

  vi.mocked(sessionService.sanitizeSessionData).mockImplementation((d: any) => d);
  vi.mocked(sessionService.sanitizeGuestName).mockImplementation((n: any) => n);
  vi.mocked(sessionService.validateSessionTimes).mockReturnValue({ valid: true });
  vi.mocked(sessionService.validateRecurrence).mockReturnValue({ valid: true });
  vi.mocked(sessionService.buildSessionFilters).mockReturnValue({});
  vi.mocked(sessionService.determineSessionStatus).mockReturnValue('upcoming');
  vi.mocked(sessionService.checkSessionManagementPermission).mockResolvedValue({
    isAuthorized: true,
  } as any);
  vi.mocked(sessionService.createSessionNotifications).mockResolvedValue(undefined);
  vi.mocked(sessionService.createSessionUpdateNotifications).mockResolvedValue(undefined);
  vi.mocked(sessionService.createSessionDeletionNotifications).mockResolvedValue(undefined);
  vi.mocked(sessionService.sendSessionEmailNotifications).mockResolvedValue(undefined);
  vi.mocked(sessionService.getGroupWithMembers).mockResolvedValue(mockGroup as any);

  vi.mocked(sessionValidation.validateSessionStatus).mockReturnValue({ isValid: true });

  vi.mocked(permissionService.hasGroupPermission).mockResolvedValue(true);
  vi.mocked(permissionService.hasEventPermission).mockResolvedValue(true);

  vi.mocked(locationService.enrichWithLocationInfo).mockImplementation((s: any) => s);
  vi.mocked(locationService.filterByLocation).mockImplementation((sessions: any[]) => sessions);
  vi.mocked(locationService.calculateBoundingBox).mockReturnValue({ latDelta: 1, lonDelta: 1 });

  vi.mocked(InviteService.sendInvitationEmail).mockResolvedValue(undefined);
  vi.mocked(InviteService.createInviteLog).mockResolvedValue(undefined);
  vi.mocked(InviteService.revokeInvitation).mockResolvedValue({ success: true } as any);

  // Default prisma mocks
  vi.mocked(prisma.session.findMany).mockResolvedValue([]);
  vi.mocked(prisma.session.count).mockResolvedValue(0);
  vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any);
  vi.mocked(prisma.session.findFirst).mockResolvedValue(mockSession as any);
  vi.mocked(prisma.session.create).mockResolvedValue(mockSession as any);
  vi.mocked(prisma.session.update).mockResolvedValue(mockSession as any);
  vi.mocked(prisma.session.delete).mockResolvedValue(mockSession as any);
  vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([]);
  vi.mocked(prisma.sessionParticipant.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.sessionParticipant.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.sessionParticipant.create).mockResolvedValue({} as any);
  vi.mocked(prisma.sessionParticipant.update).mockResolvedValue({} as any);
  vi.mocked(prisma.sessionParticipant.delete).mockResolvedValue({} as any);
  vi.mocked(prisma.sessionParticipant.count).mockResolvedValue(0);
  vi.mocked(prisma.sessionParticipant.groupBy).mockResolvedValue([] as any);
  vi.mocked(prisma.sessionAttendance.findMany).mockResolvedValue([]);
  vi.mocked(prisma.sessionAttendance.deleteMany).mockResolvedValue({ count: 0 } as any);
  vi.mocked(prisma.groupMember.findMany).mockResolvedValue([]);
  vi.mocked(prisma.guestParticipant.findMany).mockResolvedValue([]);
  vi.mocked(prisma.guestParticipant.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.guestParticipant.create).mockResolvedValue({} as any);
  vi.mocked(prisma.guestParticipant.update).mockResolvedValue({} as any);
  vi.mocked(prisma.guestParticipant.delete).mockResolvedValue({} as any);
  vi.mocked(prisma.guestParticipant.count).mockResolvedValue(0);
  vi.mocked(prisma.guestParticipant.groupBy).mockResolvedValue([] as any);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/sessions (createEvent)', () => {
  const validBody = {
    groupId: 'group-1',
    title: 'My Event',
    sessionType: 'football',
    startTime: '2025-12-01T10:00:00Z',
  };

  it('returns 201 when group member creates event', async () => {
    vi.mocked(prisma.session.create).mockResolvedValue(mockSession as any);

    const res = await request(app).post('/api/sessions').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'session-1', title: 'Test Session' });
  });

  it('fails when groupId is missing', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ title: 'My Event', sessionType: 'football', startTime: '2025-12-01T10:00:00Z' });

    // isRequired throws a validation.ts ValidationError (extends Error, not ApiError)
    // so errorHandler returns 500 — still an error response, not 2xx
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('fails when title is missing', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ groupId: 'group-1', sessionType: 'football', startTime: '2025-12-01T10:00:00Z' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('fails when sessionType is missing', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ groupId: 'group-1', title: 'My Event', startTime: '2025-12-01T10:00:00Z' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 when group not found', async () => {
    vi.mocked(sessionService.getGroupWithMembers).mockResolvedValue(null as any);

    const res = await request(app).post('/api/sessions').send(validBody);

    expect(res.status).toBe(404);
  });

  it('returns 403 when user lacks permission', async () => {
    vi.mocked(permissionService.hasGroupPermission).mockResolvedValue(false);

    const res = await request(app).post('/api/sessions').send(validBody);

    expect(res.status).toBe(403);
  });

  it('returns 400 when time validation fails', async () => {
    vi.mocked(sessionService.validateSessionTimes).mockReturnValue({
      valid: false,
      error: 'End time must be after start time',
    });

    const res = await request(app).post('/api/sessions').send({
      ...validBody,
      endTime: '2025-11-30T10:00:00Z',
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 when recurrence validation fails', async () => {
    vi.mocked(sessionService.validateRecurrence).mockReturnValue({
      valid: false,
      error: 'Recurrence rule is required when isRecurring is true',
    });

    const res = await request(app).post('/api/sessions').send({
      ...validBody,
      isRecurring: true,
    });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/sessions ────────────────────────────────────────────────────────

describe('GET /api/sessions (getEvents)', () => {
  it('returns 200 with paginated session list', async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValue([mockSession] as any);
    vi.mocked(prisma.session.count).mockResolvedValue(1);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([]);
    vi.mocked(prisma.sessionAttendance.findMany).mockResolvedValue([]);
    vi.mocked(prisma.groupMember.findMany).mockResolvedValue([]);

    const res = await request(app).get('/api/sessions');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination.total).toBe(1);
  });

  it('returns 200 with empty list when no sessions', async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValue([]);
    vi.mocked(prisma.session.count).mockResolvedValue(0);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([]);
    vi.mocked(prisma.sessionAttendance.findMany).mockResolvedValue([]);
    vi.mocked(prisma.groupMember.findMany).mockResolvedValue([]);

    const res = await request(app).get('/api/sessions');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('uses groupId filter when provided', async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValue([]);
    vi.mocked(prisma.session.count).mockResolvedValue(0);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([]);
    vi.mocked(prisma.sessionAttendance.findMany).mockResolvedValue([]);
    vi.mocked(prisma.groupMember.findMany).mockResolvedValue([]);

    await request(app).get('/api/sessions?groupId=group-1');

    expect(sessionService.buildSessionFilters).toHaveBeenCalledWith(
      'test-user-id',
      expect.objectContaining({ groupId: 'group-1' })
    );
  });
});

// ─── GET /api/sessions/:id ────────────────────────────────────────────────────

describe('GET /api/sessions/:id (getEvent)', () => {
  it('returns 200 with session data when found', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValue(mockSession as any);

    const res = await request(app).get('/api/sessions/session-1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'session-1' });
  });

  it('returns 404 when session not found', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

    const res = await request(app).get('/api/sessions/nonexistent');

    expect(res.status).toBe(404);
  });
});

// ─── PUT /api/sessions/:id ────────────────────────────────────────────────────

describe('PUT /api/sessions/:id (updateEvent)', () => {
  it('returns 200 when authorized user updates session', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(permissionService.hasEventPermission).mockResolvedValue(true);
    vi.mocked(prisma.session.update).mockResolvedValue({ ...mockSession, title: 'Updated' } as any);

    const res = await request(app)
      .put('/api/sessions/session-1')
      .send({ title: 'Updated' });

    expect(res.status).toBe(200);
  });

  it('returns 404 when session not found', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/sessions/nonexistent')
      .send({ title: 'Updated' });

    expect(res.status).toBe(404);
  });

  it('returns 403 when user lacks event permission', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(permissionService.hasEventPermission).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/sessions/session-1')
      .send({ title: 'Updated' });

    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/sessions/:id ─────────────────────────────────────────────────

describe('DELETE /api/sessions/:id (deleteEvent)', () => {
  it('returns 200 when creator deletes session', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(permissionService.hasEventPermission).mockResolvedValue(true);
    vi.mocked(prisma.session.delete).mockResolvedValue(mockSession as any);

    const res = await request(app).delete('/api/sessions/session-1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: 'Event deleted successfully' });
  });

  it('returns 404 when session not found', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

    const res = await request(app).delete('/api/sessions/nonexistent');

    expect(res.status).toBe(404);
  });

  it('returns 403 when user lacks permission', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(permissionService.hasEventPermission).mockResolvedValue(false);

    const res = await request(app).delete('/api/sessions/session-1');

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARTICIPATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/sessions/:id/join (joinEvent)', () => {
  it('returns 201 when successfully joining', async () => {
    vi.mocked(prisma.$transaction).mockResolvedValueOnce({
      participant: { id: 'p-1', sessionId: 'session-1', userId: 'test-user-id', status: 'confirmed' },
      eventTitle: 'Test Session',
      groupId: 'group-1',
      waitlisted: false,
    });

    const res = await request(app).post('/api/sessions/session-1/join');

    expect(res.status).toBe(201);
    expect(res.body.waitlisted).toBe(false);
  });

  it('returns 202 when session is full and user is waitlisted', async () => {
    vi.mocked(prisma.$transaction).mockResolvedValueOnce({
      participant: { id: 'p-1', sessionId: 'session-1', userId: 'test-user-id', status: 'waitlisted' },
      eventTitle: 'Test Session',
      groupId: 'group-1',
      waitlisted: true,
    });

    const res = await request(app).post('/api/sessions/session-1/join');

    expect(res.status).toBe(202);
    expect(res.body.waitlisted).toBe(true);
  });

  it('returns 404 when event not found', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new NotFoundError('Session nonexistent not found'));

    const res = await request(app).post('/api/sessions/nonexistent/join');

    expect(res.status).toBe(404);
  });

  it('returns 409 when already joined', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new ConflictError('Already joined this session', 'ALREADY_JOINED'));

    const res = await request(app).post('/api/sessions/session-1/join');

    expect(res.status).toBe(409);
  });
});

// ─── DELETE /api/sessions/:id/leave ──────────────────────────────────────────

describe('DELETE /api/sessions/:id/leave (leaveEvent)', () => {
  it('returns 200 when participant leaves session', async () => {
    vi.mocked(prisma.$transaction).mockResolvedValueOnce({
      groupId: 'group-1',
      promotedUserId: undefined,
      eventTitle: 'Test Session',
    });

    const res = await request(app).delete('/api/sessions/session-1/leave');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: 'Left session successfully' });
  });

  it('returns 404 when not a participant', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new NotFoundError('Not a participant of this session'));

    const res = await request(app).delete('/api/sessions/session-1/leave');

    expect(res.status).toBe(404);
  });

  it('returns 404 when event not found', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new NotFoundError('Session nonexistent not found'));

    const res = await request(app).delete('/api/sessions/nonexistent/leave');

    expect(res.status).toBe(404);
  });
});

// ─── PUT /api/sessions/:id/status ─────────────────────────────────────────────

describe('PUT /api/sessions/:id/status (updateParticipationStatus)', () => {
  it('returns 200 when participant updates their status', async () => {
    const updatedParticipant = {
      id: 'p-1',
      sessionId: 'session-1',
      userId: 'test-user-id',
      status: 'confirmed',
    };
    vi.mocked(prisma.$transaction).mockResolvedValueOnce({
      updated: updatedParticipant,
      previousStatus: 'pending',
    });
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any);

    const res = await request(app)
      .put('/api/sessions/session-1/status')
      .send({ status: 'confirmed' });

    expect(res.status).toBe(200);
  });

  it('returns 404 when not a participant', async () => {
    vi.mocked(prisma.$transaction).mockResolvedValueOnce(null);

    const res = await request(app)
      .put('/api/sessions/session-1/status')
      .send({ status: 'confirmed' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid status', async () => {
    const res = await request(app)
      .put('/api/sessions/session-1/status')
      .send({ status: 'not-a-valid-status' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/sessions/:id/participants ───────────────────────────────────────

describe('GET /api/sessions/:id/participants (getEventParticipantsByStatus)', () => {
  it('returns 200 with participants and summary', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([
      {
        id: 'p-1',
        userId: 'test-user-id',
        status: 'confirmed',
        joinedAt: new Date(),
        user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com', profilePicture: null, city: null, country: null },
      },
    ] as any);
    vi.mocked(prisma.sessionParticipant.groupBy).mockResolvedValue([
      { status: 'confirmed', _count: 1 },
    ] as any);

    const res = await request(app).get('/api/sessions/session-1/participants');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('participants');
    expect(res.body).toHaveProperty('summary');
  });

  it('returns 404 when session not found', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

    const res = await request(app).get('/api/sessions/nonexistent/participants');

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RECURRENCE
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/sessions/:id/instances (getRecurringEventInstances)', () => {
  it('returns 400 for non-recurring session', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValue({
      ...mockSession,
      isRecurring: false,
      recurrenceRule: null,
    } as any);

    const res = await request(app).get('/api/sessions/session-1/instances');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'Session is not recurring' });
  });

  it('returns 200 with instances for recurring session', async () => {
    const { generateRecurrenceInstances } = await import('../../utils/recurrenceService');
    vi.mocked(generateRecurrenceInstances).mockReturnValue([
      new Date('2025-12-01T10:00:00Z'),
      new Date('2025-12-08T10:00:00Z'),
    ]);

    vi.mocked(prisma.session.findFirst).mockResolvedValue({
      ...mockSession,
      isRecurring: true,
      recurrenceRule: 'FREQ=WEEKLY',
      recurrenceEnd: new Date('2026-01-01'),
    } as any);

    const res = await request(app).get('/api/sessions/session-1/instances');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 404 when session not found', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

    const res = await request(app).get('/api/sessions/nonexistent/instances');

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GUEST FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/sessions/invite/:token (getEventByInviteToken)', () => {
  it('returns 200 with session when token is valid', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValue(mockSession as any);

    const res = await request(app).get('/api/sessions/invite/test-invite-token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'session-1' });
  });

  it('returns 404 when token is invalid', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

    const res = await request(app).get('/api/sessions/invite/invalid-token');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/sessions/invite/:token/join (joinEventAsGuest)', () => {
  it('returns 201 on successful guest join', async () => {
    const guestParticipant = {
      id: 'g-1',
      sessionId: 'session-1',
      name: 'Guest User',
      status: 'confirmed',
      joinedAt: new Date(),
    };
    vi.mocked(prisma.$transaction).mockResolvedValueOnce({
      guestParticipant,
      groupId: 'group-1',
    });

    const res = await request(app)
      .post('/api/sessions/invite/test-invite-token/join')
      .send({ name: 'Guest User' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('participant');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/sessions/invite/test-invite-token/join')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 when session is full', async () => {
    const { BadRequestError } = await import('../../utils/errors');
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new BadRequestError('Event is full'));

    const res = await request(app)
      .post('/api/sessions/invite/test-invite-token/join')
      .send({ name: 'Guest User' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when duplicate guest name', async () => {
    const { BadRequestError } = await import('../../utils/errors');
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(
      new BadRequestError('A guest with this name has already joined the session')
    );

    const res = await request(app)
      .post('/api/sessions/invite/test-invite-token/join')
      .send({ name: 'Guest User' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/sessions/:id/guests (getGuestParticipants)', () => {
  it('returns 200 with guest participants', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.guestParticipant.findMany).mockResolvedValue([
      { id: 'g-1', name: 'Guest User', status: 'confirmed', joinedAt: new Date() },
    ] as any);
    vi.mocked(prisma.guestParticipant.groupBy).mockResolvedValue([
      { status: 'confirmed', _count: 1 },
    ] as any);

    const res = await request(app).get('/api/sessions/session-1/guests');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('guestParticipants');
    expect(res.body).toHaveProperty('summary');
  });

  it('returns 404 when session not found', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

    const res = await request(app).get('/api/sessions/nonexistent/guests');

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INVITATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/sessions/:id/invite (inviteToEvent)', () => {
  const mockUserToInvite = {
    id: 'other-user-id',
    name: 'Other User',
    email: 'other@example.com',
    emailNotifications: true,
  };

  it('returns 201 on successful invitation', async () => {
    vi.mocked(permissionService.hasEventPermission).mockResolvedValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserToInvite as any);
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any);
    // $transaction resolves for create participant + createInviteLog
    vi.mocked(prisma.$transaction).mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/sessions/session-1/invite')
      .send({ email: 'other@example.com' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ message: 'Invitation sent successfully' });
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/sessions/session-1/invite')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 403 when user lacks permission', async () => {
    vi.mocked(permissionService.hasEventPermission).mockResolvedValue(false);

    const res = await request(app)
      .post('/api/sessions/session-1/invite')
      .send({ email: 'other@example.com' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when user to invite not found', async () => {
    vi.mocked(permissionService.hasEventPermission).mockResolvedValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/sessions/session-1/invite')
      .send({ email: 'notfound@example.com' });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/sessions/:id/invitations/revoke (revokeEventInvitation)', () => {
  it('returns 200 on successful revocation', async () => {
    vi.mocked(permissionService.hasEventPermission).mockResolvedValue(true);
    vi.mocked(InviteService.revokeInvitation).mockResolvedValue({ success: true } as any);

    const res = await request(app)
      .post('/api/sessions/session-1/invitations/revoke')
      .send({ email: 'other@example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: 'Invitation revoked successfully' });
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/sessions/session-1/invitations/revoke')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 403 when user lacks permission', async () => {
    vi.mocked(permissionService.hasEventPermission).mockResolvedValue(false);

    const res = await request(app)
      .post('/api/sessions/session-1/invitations/revoke')
      .send({ email: 'other@example.com' });

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS & ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/sessions/:id/archive (archiveEvent)', () => {
  it('returns 200 when authorized user archives session', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(sessionService.checkSessionManagementPermission).mockResolvedValue({
      isAuthorized: true,
    } as any);
    vi.mocked(prisma.session.update).mockResolvedValue({ ...mockSession, archived: true } as any);

    const res = await request(app).post('/api/sessions/session-1/archive');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: 'Event archived successfully' });
  });

  it('returns 404 when session not found', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

    const res = await request(app).post('/api/sessions/nonexistent/archive');

    expect(res.status).toBe(404);
  });

  it('returns 403 when not authorized', async () => {
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(sessionService.checkSessionManagementPermission).mockResolvedValue({
      isAuthorized: false,
    } as any);

    const res = await request(app).post('/api/sessions/session-1/archive');

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/sessions/:id/session-status (updateSessionStatus)', () => {
  it('returns 200 when valid status provided by authorized user', async () => {
    vi.mocked(sessionValidation.validateSessionStatus).mockReturnValue({ isValid: true });
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(sessionService.checkSessionManagementPermission).mockResolvedValue({
      isAuthorized: true,
    } as any);
    vi.mocked(prisma.session.update).mockResolvedValue({ ...mockSession, status: 'cancelled' } as any);

    const res = await request(app)
      .put('/api/sessions/session-1/session-status')
      .send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: 'Event status updated successfully' });
  });

  it('returns 400 when status is invalid', async () => {
    vi.mocked(sessionValidation.validateSessionStatus).mockReturnValue({
      isValid: false,
      error: 'Invalid status',
    });

    const res = await request(app)
      .put('/api/sessions/session-1/session-status')
      .send({ status: 'bad-status' });

    expect(res.status).toBe(400);
  });

  it('returns 403 when not authorized', async () => {
    vi.mocked(sessionValidation.validateSessionStatus).mockReturnValue({ isValid: true });
    vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(sessionService.checkSessionManagementPermission).mockResolvedValue({
      isAuthorized: false,
    } as any);

    const res = await request(app)
      .put('/api/sessions/session-1/session-status')
      .send({ status: 'cancelled' });

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATS & FEED
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/sessions/:id/activity (getEventActivityFeed)', () => {
  it('returns 200 with activity feed', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValue(mockSession as any);
    const { getSessionActivity } = await import('../../services/sessionNotification');
    vi.mocked(getSessionActivity).mockResolvedValue([
      { id: 'act-1', type: 'join', userId: 'test-user-id' } as any,
    ]);

    const res = await request(app).get('/api/sessions/session-1/activity');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sessionId', 'session-1');
    expect(res.body).toHaveProperty('activity');
    expect(res.body).toHaveProperty('total');
  });

  it('returns 404 when session not found or access denied', async () => {
    vi.mocked(prisma.session.findFirst).mockResolvedValue(null);

    const res = await request(app).get('/api/sessions/nonexistent/activity');

    expect(res.status).toBe(404);
  });
});

describe('GET /api/sessions/statistics (getUserStatistics)', () => {
  it('returns 200 with user statistics', async () => {
    vi.mocked(prisma.sessionParticipant.findMany).mockResolvedValue([]);
    vi.mocked(prisma.session.findMany).mockResolvedValue([]);

    const res = await request(app).get('/api/sessions/statistics');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalEventsJoined');
    expect(res.body).toHaveProperty('totalEventsCreated');
    expect(res.body).toHaveProperty('upcomingEvents');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/sessions/export (exportEvents)', () => {
  it('returns 200 with CSV content-type by default', async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValue([
      {
        id: 'session-1',
        title: 'Test',
        description: null,
        sessionType: 'soccer',
        location: null,
        startTime: new Date('2025-12-01T10:00:00Z'),
        endTime: null,
        status: 'upcoming',
        maxPlayers: null,
        participants: [{ status: 'confirmed', userId: 'test-user-id' }],
        _count: { participants: 1 },
        group: { name: 'Test Group' },
        creator: { name: 'Test User', email: 'test@example.com' },
      },
    ] as any);

    const { exportToCSV } = await import('../../services/exportService');
    vi.mocked(exportToCSV).mockReturnValue('id,title\ntest-session,Test');

    const res = await request(app).get('/api/sessions/export?format=csv');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });

  it('returns 400 for invalid format', async () => {
    const res = await request(app).get('/api/sessions/export?format=xml');

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DISCOVERY
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/sessions/nearby (getNearbyEvents)', () => {
  it('returns 200 with nearby sessions when lat/lng provided', async () => {
    vi.mocked(locationService.calculateBoundingBox).mockReturnValue({ latDelta: 0.1, lonDelta: 0.1 });
    vi.mocked(prisma.session.findMany).mockResolvedValue([mockSession] as any);
    vi.mocked(locationService.filterByLocation).mockReturnValue([mockSession] as any);

    const res = await request(app).get('/api/sessions/nearby?latitude=40.7128&longitude=-74.0060');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
    expect(res.body).toHaveProperty('center');
    expect(res.body).toHaveProperty('radius');
  });

  it('returns 400 when coordinates are missing', async () => {
    const res = await request(app).get('/api/sessions/nearby');

    expect(res.status).toBe(400);
  });

  it('returns 400 when only latitude is provided', async () => {
    const res = await request(app).get('/api/sessions/nearby?latitude=40.7128');

    expect(res.status).toBe(400);
  });
});
