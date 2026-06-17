import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createAuthenticatedTestApp } from '../helpers/testApp';

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

vi.mock('../../middleware/authorization', () => ({
  requireTeamUpPermission: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../services/notificationFactory', () => ({
  NotificationFactory: {
    createTeamUpNotifications: vi.fn().mockResolvedValue(undefined),
  }
}));

// Provide a hoisted mock implementation for the Prisma client. We keep the
// jest-style `vi.fn()` functions here so tests can mutate/mock them per-case.
vi.mock('../../config/database', () => ({
  default: {
    teamUpRequest: { findUnique: vi.fn(), update: vi.fn() },
    teamUpResponse: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    user: { findUnique: vi.fn() },
    emailQueue: { create: vi.fn() },
    $transaction: vi.fn(),
  }
}));

import db from '../../config/database';
import * as controller from '../../controllers/teamUp/teamUpApplicationController';

describe('TeamUp application controller', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    // Reset mock implementations on the hoisted mocked prisma client
    const prismaModule: any = (db as any)?.default ?? db;
    for (const key of Object.keys(prismaModule)) {
      const obj = prismaModule[key];
      if (obj && typeof obj === 'object') {
        for (const fn of Object.keys(obj)) {
          if (obj[fn] && typeof obj[fn].mockReset === 'function') obj[fn].mockReset();
        }
      } else if (obj && typeof obj.mockReset === 'function') {
        obj.mockReset();
      }
    }
  });

  it('rejects re-apply when an existing pending/accepted response exists', async () => {
    const prisma = (db as any).default ?? db;
    prisma.teamUpRequest.findUnique.mockResolvedValue({ id: 'r1', status: 'open', dateTime: new Date(Date.now() + 3600000), creatorId: 'creator-1', title: 'T', sportType: 'soccer', playersNeeded: 4, city: 'X', country: 'Y', skillLevel: null, positions: [], creator: { email: 'a@b.com', name: 'Creator' } });
    prisma.teamUpResponse.findFirst.mockResolvedValue({ id: 'resp-1', status: 'pending' });
    prisma.user.findUnique.mockResolvedValue({ city: null, country: null });

    const req: any = { params: { id: 'r1' }, body: { message: 'Hi' }, user: { id: 'test-user-id', name: 'Test User' } };
    let statusCode: number | null = null;
    let payload: any = null;
    const res: any = {
      status: (code: number) => { statusCode = code; return res; },
      json: (p: any) => { payload = p; return res; },
    };

    await expect(controller.respondToTeamUpRequest(req, res)).rejects.toThrow(/already responded/i);
  });

  it('bulk accept validation prevents exceeding available slots inside transaction', async () => {
    // request record fetched outside transaction
    const requestRecord = { creatorId: 'creator-1', playersNeeded: 4, positions: [] };

    // responses to process
    const responses = [ { id: 'r1', status: 'pending' }, { id: 'r2', status: 'pending' } ];

    // mock tx to simulate counts inside transaction
    const prisma = (db as any).default ?? db;
    prisma.teamUpRequest.findUnique.mockResolvedValue(requestRecord);
    prisma.teamUpResponse.findMany.mockResolvedValue(responses);
    const tx = {
      teamUpResponse: {
        count: vi.fn().mockResolvedValue(3), // already accepted
        findMany: vi.fn().mockResolvedValue(responses),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      teamUpRequest: { update: vi.fn() },
    };
    prisma.$transaction.mockImplementation((cb: any) => cb(tx));

    const validIds = ['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'];
    const req: any = { params: { id: 'req-1' }, body: { action: 'accept', responseIds: validIds }, user: { id: 'creator-1' } };
    let statusCode2: number | null = null;
    let payload2: any = null;
    const res2: any = {
      status: (code: number) => { statusCode2 = code; return res2; },
      json: (p: any) => { payload2 = p; return res2; },
    };

    await expect(controller.bulkHandleTeamUpResponses(req, res2)).rejects.toThrow(/exceeds available slots/i);
  });
});
