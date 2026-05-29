import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    groupNotification: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    sessionNotification: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    teamUpNotification: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    tournamentNotification: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock('../../config/database', () => ({
  default: mockPrisma,
}));

vi.mock('../../utils/notificationHelper', () => ({
  filterUnmutedUsers: vi.fn(async (userIds: string[]) => userIds),
}));

vi.mock('../../services/pushNotificationService', () => ({
  dispatchPushNotifications: vi.fn(),
}));

vi.mock('../../services/sseService', () => ({
  pushNotificationToUser: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

let app: Awaited<ReturnType<typeof import('../../notification-service/app')>>['default'];

describe('Notification Service Routes', () => {
  beforeAll(async () => {
    vi.resetModules();
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
    ({ default: app } = await import('../../notification-service/app'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.groupNotification.findMany.mockResolvedValue([]);
    mockPrisma.groupNotification.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.sessionNotification.findMany.mockResolvedValue([]);
    mockPrisma.sessionNotification.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.teamUpNotification.findMany.mockResolvedValue([]);
    mockPrisma.teamUpNotification.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.tournamentNotification.findMany.mockResolvedValue([]);
    mockPrisma.tournamentNotification.createMany.mockResolvedValue({ count: 0 });
  });

  it('rejects missing internal token on protected endpoint', async () => {
    const response = await request(app)
      .post('/api/notifications/group')
      .send({ groupId: 'g1', type: 'invited', userIds: ['u1'] });

    expect(response.status).toBe(401);
  });

  it('returns 400 when required payload fields are missing', async () => {
    const response = await request(app)
      .post('/api/notifications/group')
      .set('x-internal-service-token', 'test-internal-token')
      .send({ type: 'invited', userIds: ['u1'] });

    expect(response.status).toBe(400);
  });

  it('deduplicates group notifications inside the window', async () => {
    mockPrisma.groupNotification.findMany.mockResolvedValue([{ userId: 'u1' }]);

    const response = await request(app)
      .post('/api/notifications/group')
      .set('x-internal-service-token', 'test-internal-token')
      .send({
        groupId: 'g1',
        type: 'invited',
        userIds: ['u1', 'u2'],
        deduplicateWindow: 60000,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ created: 1, skipped: 1 });
    expect(mockPrisma.groupNotification.createMany).toHaveBeenCalledTimes(1);
    const createManyArg = mockPrisma.groupNotification.createMany.mock.calls[0][0];
    expect(createManyArg.data).toHaveLength(1);
    expect(createManyArg.data[0].userId).toBe('u2');
  });

  it('deduplicates tournament notifications with idempotencyKey across retries', async () => {
    mockPrisma.tournamentNotification.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: 'u1' }]);

    const payload = {
      tournamentId: 't1',
      type: 'team_registered',
      userIds: ['u1'],
      idempotencyKey: 'tn_retry_1',
    };

    const firstResponse = await request(app)
      .post('/api/notifications/tournament')
      .set('x-internal-service-token', 'test-internal-token')
      .send(payload);

    const secondResponse = await request(app)
      .post('/api/notifications/tournament')
      .set('x-internal-service-token', 'test-internal-token')
      .send(payload);

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toEqual({ created: 1, skipped: 0 });
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body).toEqual({ created: 0, skipped: 1 });
    expect(mockPrisma.tournamentNotification.createMany).toHaveBeenCalledTimes(1);
  });

  it('deduplicates session notifications with idempotencyKey across retries', async () => {
    mockPrisma.sessionNotification.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: 'u1' }]);

    const payload = {
      sessionId: 's1',
      type: 'join',
      userIds: ['u1'],
      idempotencyKey: 'sn_retry_1',
    };

    const firstResponse = await request(app)
      .post('/api/notifications/session')
      .set('x-internal-service-token', 'test-internal-token')
      .send(payload);

    const secondResponse = await request(app)
      .post('/api/notifications/session')
      .set('x-internal-service-token', 'test-internal-token')
      .send(payload);

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toEqual({ created: 1, skipped: 0 });
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body).toEqual({ created: 0, skipped: 1 });
    expect(mockPrisma.sessionNotification.createMany).toHaveBeenCalledTimes(1);
  });

  it('deduplicates group notifications with idempotencyKey across retries', async () => {
    mockPrisma.groupNotification.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: 'u1' }]);

    const payload = {
      groupId: 'g1',
      type: 'invited',
      userIds: ['u1'],
      idempotencyKey: 'gn_retry_1',
    };

    const firstResponse = await request(app)
      .post('/api/notifications/group')
      .set('x-internal-service-token', 'test-internal-token')
      .send(payload);

    const secondResponse = await request(app)
      .post('/api/notifications/group')
      .set('x-internal-service-token', 'test-internal-token')
      .send(payload);

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toEqual({ created: 1, skipped: 0 });
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body).toEqual({ created: 0, skipped: 1 });
    expect(mockPrisma.groupNotification.createMany).toHaveBeenCalledTimes(1);
  });
});
