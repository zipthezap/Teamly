import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    event: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    eventParticipant: {
      findMany: vi.fn(),
    },
    eventAttendance: {
      findMany: vi.fn(),
    },
    groupMember: {
      findMany: vi.fn(),
    },
    group: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../services/eventService', () => ({
  buildEventFilters: vi.fn(() => ({})),
}));

vi.mock('../../services/cacheService', () => ({
  CacheService: {
    get: vi.fn(),
    set: vi.fn(),
    deletePattern: vi.fn(),
  },
}));

vi.mock('../../services/locationService', () => ({
  filterByLocation: vi.fn((items: unknown[]) => items),
  enrichWithLocationInfo: vi.fn((item: unknown) => item),
}));

vi.mock('../../services/metricsService', () => ({
  recordSearchQuery: vi.fn(),
}));

import prisma from '../../config/database';
import { getEvents, getNearbyEvents } from '../../controllers/eventController';
import { getNearbyGroups, getPublicGroups } from '../../controllers/groupController';
import { recordSearchQuery } from '../../services/metricsService';

const mockPrisma = vi.mocked(prisma);

describe('Discovery controllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies composite cursor filtering in getEvents', async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.event.count.mockResolvedValue(0);
    mockPrisma.eventParticipant.findMany.mockResolvedValue([]);
    mockPrisma.eventAttendance.findMany.mockResolvedValue([]);
    mockPrisma.groupMember.findMany.mockResolvedValue([]);

    const cursor = Buffer.from(
      JSON.stringify({ startTime: '2026-01-01T00:00:00.000Z', id: 'evt-123' }),
      'utf8'
    ).toString('base64url');

    const req = {
      query: { cursor, limit: '10', offset: '0' },
      user: { id: 'user-1' },
    };
    const json = vi.fn();
    const res = { setHeader: vi.fn(), json };

    await getEvents(req as never, res as never);

    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { startTime: { gt: new Date('2026-01-01T00:00:00.000Z') } },
                {
                  AND: [
                    { startTime: new Date('2026-01-01T00:00:00.000Z') },
                    { id: { gt: 'evt-123' } },
                  ],
                },
              ]),
            }),
          ]),
        }),
      })
    );
    expect(json).toHaveBeenCalled();
  });

  it('rejects invalid nearby event limit and validly bounds nearby event queries', async () => {
    const invalidReq = {
      query: { latitude: '1', longitude: '1', radius: '5', limit: '101' },
    };
    const invalidRes = { json: vi.fn() };
    await expect(getNearbyEvents(invalidReq as never, invalidRes as never)).rejects.toThrow(
      'Limit must be an integer between 1 and 100'
    );

    mockPrisma.event.findMany.mockResolvedValue([]);
    const req = {
      query: { latitude: '1', longitude: '1', radius: '5', limit: '10' },
    };
    const res = { json: vi.fn() };

    await getNearbyEvents(req as never, res as never);

    expect(recordSearchQuery).toHaveBeenCalledWith('events');
    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.any(Array),
        }),
        take: 100,
      })
    );
  });

  it('rejects invalid nearby group limit and omits creator email in public groups query', async () => {
    const invalidReq = {
      query: { latitude: '1', longitude: '1', radius: '5', limit: '0' },
      user: { id: 'user-1' },
    };
    const invalidRes = { json: vi.fn() };
    await expect(getNearbyGroups(invalidReq as never, invalidRes as never)).rejects.toThrow(
      'Limit must be an integer between 1 and 100'
    );

    mockPrisma.group.findMany.mockResolvedValue([]);
    const req = {
      query: {},
      user: { id: 'user-1' },
    };
    const res = { json: vi.fn() };

    await getPublicGroups(req as never, res as never);

    expect(mockPrisma.group.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          creator: {
            select: { id: true, name: true, profilePicture: true },
          },
        }),
      })
    );
  });
});
