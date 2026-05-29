import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    inviteLog: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../config/database', () => ({
  default: mockPrisma,
}));

vi.mock('../../services/inviteService', () => ({
  InviteService: {
    getInviteAnalytics: vi.fn().mockResolvedValue({
      total: 2,
      sent: 1,
      accepted: 1,
      declined: 0,
      expired: 0,
      revoked: 0,
      pending: 1,
    }),
  },
}));

vi.mock('../../services/permissionService', () => ({
  hasGroupPermission: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getInviteAnalytics } from '../../community-service/controllers/groupAnalyticsController';
import * as permissionService from '../../services/permissionService';
import { InviteService } from '../../services/inviteService';

const createReq = (overrides: Partial<Request> = {}) =>
  ({
    params: { id: 'group-1' },
    query: {},
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    ...overrides,
  } as unknown as Request);

const createRes = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
};

describe('community-service group analytics controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns invite analytics for authorized users', async () => {
    const req = createReq();
    const res = createRes();

    await getInviteAnalytics(req, res);

    expect(vi.mocked(InviteService.getInviteAnalytics)).toHaveBeenCalledWith('group', 'group-1', { from: undefined, to: undefined });
    expect(vi.mocked(res.json)).toHaveBeenCalledWith({
      analytics: {
        total: 2,
        sent: 1,
        accepted: 1,
        declined: 0,
        expired: 0,
        revoked: 0,
        pending: 1,
      },
    });
  });

  it('rejects unauthorized users', async () => {
    vi.mocked(permissionService.hasGroupPermission).mockResolvedValueOnce(false as never);
    const req = createReq();
    const res = createRes();

    await expect(getInviteAnalytics(req, res)).rejects.toThrow('You do not have permission to view invite analytics');
  });
});
