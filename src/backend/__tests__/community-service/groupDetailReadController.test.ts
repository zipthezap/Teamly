import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    groupMember: {
      findUnique: vi.fn(),
    },
    group: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../../config/database', () => ({
  default: mockPrisma,
}));

vi.mock('../../services/cacheService', () => ({
  CacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/locationService', () => ({
  enrichWithLocationInfo: vi.fn((g: unknown) => g),
}));

import { getGroup } from '../../community-service/controllers/groupDetailReadController';
import { CacheService } from '../../services/cacheService';

const createReq = (overrides: Partial<Request> = {}) =>
  ({
    params: { id: 'group-1' },
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    ...overrides,
  } as unknown as Request);

const createRes = () => {
  const res = {
    json: vi.fn(),
  } as unknown as Response;
  return res;
};

describe('community-service group detail read controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(CacheService.get).mockResolvedValue(null as never);
  });

  it('returns member view for a group member', async () => {
    vi.mocked(mockPrisma.groupMember.findUnique).mockResolvedValueOnce({ role: 'admin' } as never);
    vi.mocked(mockPrisma.group.findFirst).mockResolvedValueOnce({
      id: 'group-1',
      members: [
        {
          userId: 'user-1',
          role: 'admin',
          user: { id: 'user-1', name: 'Test User', email: 'test@example.com', profilePicture: null },
        },
      ],
      sessions: [],
      creator: { id: 'user-1', name: 'Test User', email: 'test@example.com', profilePicture: null },
      _count: { sessions: 0, members: 1 },
    } as never);

    const req = createReq();
    const res = createRes();

    await getGroup(req, res);

    expect(vi.mocked(res.json)).toHaveBeenCalled();
    expect(vi.mocked(CacheService.set)).toHaveBeenCalled();
  });

  it('returns public view for a non-member', async () => {
    vi.mocked(mockPrisma.groupMember.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(mockPrisma.group.findFirst).mockResolvedValueOnce({
      id: 'group-1',
      isPublic: true,
      members: [
        {
          userId: 'user-2',
          role: 'member',
          user: { id: 'user-2', name: 'Other User', profilePicture: null },
        },
      ],
      creator: { id: 'user-1', name: 'Creator', profilePicture: null },
      _count: { sessions: 0, members: 1 },
    } as never);

    const req = createReq();
    const res = createRes();

    await getGroup(req, res);

    expect(vi.mocked(res.json)).toHaveBeenCalled();
    expect(vi.mocked(CacheService.set)).toHaveBeenCalled();
  });
});
