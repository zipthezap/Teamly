import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    group: {
      findMany: vi.fn(),
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

import { getGroups } from '../../community-service/controllers/groupListReadController';
import { CacheService } from '../../services/cacheService';

const createReq = (overrides: Partial<Request> = {}) =>
  ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    query: {},
    ...overrides,
  } as unknown as Request);

const createRes = () => ({
  json: vi.fn(),
} as unknown as Response);

describe('community-service group list read controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(CacheService.get).mockResolvedValue(null as never);
  });

  it('returns flattened groups for member', async () => {
    vi.mocked(mockPrisma.group.findMany).mockResolvedValueOnce([
      {
        id: 'group-1',
        latitude: null,
        longitude: null,
        members: [
          {
            userId: 'user-1',
            role: 'admin',
            user: { id: 'user-1', name: 'Test User', email: 'test@example.com', profilePicture: null },
          },
        ],
      },
    ] as never);

    const req = createReq();
    const res = createRes();

    await getGroups(req, res);

    expect(vi.mocked(res.json)).toHaveBeenCalled();
    expect(vi.mocked(CacheService.set)).toHaveBeenCalled();
  });

  it('returns cached groups when cache hit exists', async () => {
    vi.mocked(CacheService.get).mockResolvedValueOnce([{ id: 'cached-group' }] as never);

    const req = createReq();
    const res = createRes();

    await getGroups(req, res);

    expect(vi.mocked(mockPrisma.group.findMany)).not.toHaveBeenCalled();
    expect(vi.mocked(res.json)).toHaveBeenCalledWith([{ id: 'cached-group' }]);
  });
});
