import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
    },
    group: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../config/database', () => ({
  default: mockPrisma,
}));

vi.mock('../../services/locationService', () => ({
  validateCoordinates: vi.fn().mockReturnValue({ valid: true }),
  calculateBoundingBox: vi.fn().mockReturnValue({ latDelta: 1, lonDelta: 1 }),
  filterByLocation: vi.fn().mockImplementation((groups: unknown[]) => groups),
  enrichWithLocationInfo: vi.fn((g: unknown) => g),
}));

vi.mock('../../services/metricsService', () => ({
  recordSearchQuery: vi.fn(),
}));

import { getNearbyGroups } from '../../community-service/controllers/groupNearbyReadController';

const createReq = (overrides: Partial<Request> = {}) =>
  ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    query: { latitude: '45.5', longitude: '-73.5' },
    ...overrides,
  } as unknown as Request);

const createRes = () => ({
  json: vi.fn(),
} as unknown as Response);

describe('community-service group nearby read controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns nearby groups using user preference when radius is absent', async () => {
    vi.mocked(mockPrisma.user.findUnique).mockResolvedValueOnce({ discoveryRadius: 25 } as never);
    vi.mocked(mockPrisma.group.findMany).mockResolvedValueOnce([{ id: 'group-1' }] as never);

    const req = createReq();
    const res = createRes();

    await getNearbyGroups(req, res);

    expect(vi.mocked(res.json)).toHaveBeenCalled();
  });

  it('throws when latitude and longitude are missing', async () => {
    const req = createReq({ query: {} as Request['query'] });
    const res = createRes();

    await expect(getNearbyGroups(req, res)).rejects.toThrow('Latitude and longitude are required');
  });
});
