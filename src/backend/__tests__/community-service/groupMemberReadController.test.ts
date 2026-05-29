import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    group: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../config/database', () => ({
  default: mockPrisma,
}));

import { getGroupMembers } from '../../community-service/controllers/groupMemberReadController';

const createReq = (overrides: Partial<Request> = {}) =>
  ({
    params: { id: 'group-1' },
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    ...overrides,
  } as unknown as Request);

const createRes = () => {
  const res = {
    setHeader: vi.fn(),
    json: vi.fn(),
  } as unknown as Response;
  return res;
};

describe('community-service group member read controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns flattened member list for group members', async () => {
    vi.mocked(mockPrisma.group.findUnique).mockResolvedValueOnce({
      id: 'group-1',
      members: [
        {
          userId: 'user-1',
          role: 'admin',
          user: { id: 'user-1', name: 'Test User', email: 'test@example.com', profilePicture: null },
        },
      ],
    } as never);

    const req = createReq();
    const res = createRes();

    await getGroupMembers(req, res);

    expect(vi.mocked(res.setHeader)).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(vi.mocked(res.json)).toHaveBeenCalledWith([
      {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        profilePicture: null,
        role: 'admin',
      },
    ]);
  });

  it('rejects non-members', async () => {
    vi.mocked(mockPrisma.group.findUnique).mockResolvedValueOnce({
      id: 'group-1',
      members: [
        {
          userId: 'someone-else',
          role: 'member',
          user: { id: 'someone-else', name: 'Else', email: 'else@example.com', profilePicture: null },
        },
      ],
    } as never);

    const req = createReq();
    const res = createRes();

    await expect(getGroupMembers(req, res)).rejects.toThrow('Only group members can view the member list');
  });
});
