import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    groupJoinRequest: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../config/database', () => ({
  default: mockPrisma,
}));

import { getMyJoinRequests, getUserInvitations } from '../../community-service/controllers/groupInviteReadController';

const createReq = (overrides: Partial<Request> = {}) =>
  ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    ...overrides,
  } as unknown as Request);

const createRes = () => {
  const res = {
    json: vi.fn(),
  } as unknown as Response;
  return res;
};

describe('community-service group invite read controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pending user invitations ordered by newest first', async () => {
    const invitations = [
      {
        id: 'req-2',
        userId: 'user-1',
        status: 'pending',
        createdBy: 'INVITE',
        group: { id: 'group-1', name: 'Group 1' },
        inviter: { id: 'inviter-1', name: 'Inviter 1' },
      },
    ];
    vi.mocked(mockPrisma.groupJoinRequest.findMany).mockResolvedValueOnce(invitations as never);

    const req = createReq();
    const res = createRes();

    await getUserInvitations(req, res);

    expect(vi.mocked(mockPrisma.groupJoinRequest.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          status: 'pending',
          createdBy: 'INVITE',
        },
        orderBy: { createdAt: 'desc' },
      })
    );
    expect(vi.mocked(res.json)).toHaveBeenCalledWith(invitations);
  });

  it('returns my pending join requests ordered by newest first', async () => {
    const requests = [
      {
        id: 'req-3',
        userId: 'user-1',
        status: 'pending',
        createdBy: 'USER',
        group: { id: 'group-2', name: 'Group 2' },
      },
    ];
    vi.mocked(mockPrisma.groupJoinRequest.findMany).mockResolvedValueOnce(requests as never);

    const req = createReq();
    const res = createRes();

    await getMyJoinRequests(req, res);

    expect(vi.mocked(mockPrisma.groupJoinRequest.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          status: 'pending',
          createdBy: 'USER',
        },
        orderBy: { createdAt: 'desc' },
      })
    );
    expect(vi.mocked(res.json)).toHaveBeenCalledWith(requests);
  });
});
