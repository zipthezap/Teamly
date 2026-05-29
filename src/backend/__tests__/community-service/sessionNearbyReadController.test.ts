import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    session: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../config/database', () => ({
  default: mockPrisma,
}));

vi.mock('../../services/locationService', () => ({
  calculateBoundingBox: vi.fn().mockReturnValue({ latDelta: 1, lonDelta: 1 }),
  filterByLocation: vi.fn().mockImplementation((sessions: unknown[]) => sessions),
  enrichWithLocationInfo: vi.fn((s: unknown) => s),
}));

vi.mock('../../services/metricsService', () => ({
  recordSearchQuery: vi.fn(),
}));

import { getNearbyEvents } from '../../community-service/controllers/sessionNearbyReadController';

const createReq = (overrides: Partial<Request> = {}) =>
  ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    query: { latitude: '45.5', longitude: '-73.5', radius: '10' },
    ...overrides,
  } as unknown as Request);

const createRes = () => ({
  json: vi.fn(),
} as unknown as Response);

describe('community-service session nearby read controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns nearby sessions', async () => {
    vi.mocked(mockPrisma.session.findMany).mockResolvedValueOnce([{ id: 'session-1' }] as never);

    const req = createReq();
    const res = createRes();

    await getNearbyEvents(req, res);

    expect(vi.mocked(res.json)).toHaveBeenCalled();
  });

  it('throws when coordinates are missing', async () => {
    const req = createReq({ query: {} as Request['query'] });
    const res = createRes();

    await expect(getNearbyEvents(req, res)).rejects.toThrow('Latitude and longitude are required');
  });
});
