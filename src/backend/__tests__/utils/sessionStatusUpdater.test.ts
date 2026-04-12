/**
 * Session Status Updater Utility Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateSessionStatuses,
  archiveOldEvents,
  expireOldEventRequests,
  runEventMaintenance,
} from '../../utils/sessionStatusUpdater';
import prisma from '../../config/database';

vi.mock('../../config/database', () => ({
  default: {
    session: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    sessionRequest: {
      updateMany: vi.fn(),
    },
  },
}));

const mockPrisma = prisma as {
  session: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  sessionRequest: {
    updateMany: ReturnType<typeof vi.fn>;
  };
};

// ─── updateSessionStatuses ──────────────────────────────────────────────────

describe('updateSessionStatuses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.session.update.mockResolvedValue({});
  });

  it('marks a session as completed when endTime is in the past', async () => {
    const now = new Date();
    mockPrisma.session.findMany.mockResolvedValue([
      {
        id: 'session-1',
        status: 'ongoing',
        startTime: new Date(now.getTime() - 3 * 60 * 60 * 1000), // -3h
        endTime: new Date(now.getTime() - 1 * 60 * 60 * 1000),   // -1h
      },
    ]);

    const result = await updateSessionStatuses();

    expect(mockPrisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'completed' } })
    );
    expect(result.updated).toBe(1);
    expect(result.errors).toBe(0);
  });

  it('marks a session as ongoing when startTime is past and endTime is future', async () => {
    const now = new Date();
    mockPrisma.session.findMany.mockResolvedValue([
      {
        id: 'session-2',
        status: 'upcoming',
        startTime: new Date(now.getTime() - 1 * 60 * 60 * 1000), // -1h
        endTime: new Date(now.getTime() + 1 * 60 * 60 * 1000),   // +1h
      },
    ]);

    const result = await updateSessionStatuses();

    expect(mockPrisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ongoing' } })
    );
    expect(result.updated).toBe(1);
  });

  it('keeps a future session as upcoming', async () => {
    const now = new Date();
    mockPrisma.session.findMany.mockResolvedValue([
      {
        id: 'session-3',
        status: 'ongoing',
        startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // +2h
        endTime: new Date(now.getTime() + 4 * 60 * 60 * 1000),   // +4h
      },
    ]);

    await updateSessionStatuses();

    expect(mockPrisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'upcoming' } })
    );
  });

  it('does not update a session that already has the correct status', async () => {
    const now = new Date();
    mockPrisma.session.findMany.mockResolvedValue([
      {
        id: 'session-4',
        status: 'upcoming',
        startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      },
    ]);

    const result = await updateSessionStatuses();

    expect(mockPrisma.session.update).not.toHaveBeenCalled();
    expect(result.updated).toBe(0);
  });

  it('marks a session with no endTime as ongoing when started less than 24h ago', async () => {
    const now = new Date();
    mockPrisma.session.findMany.mockResolvedValue([
      {
        id: 'session-5',
        status: 'upcoming',
        startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000), // -2h (< 24h)
        endTime: null,
      },
    ]);

    await updateSessionStatuses();

    expect(mockPrisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ongoing' } })
    );
  });

  it('marks a session with no endTime as completed when started more than 24h ago', async () => {
    const now = new Date();
    mockPrisma.session.findMany.mockResolvedValue([
      {
        id: 'session-6',
        status: 'upcoming',
        startTime: new Date(now.getTime() - 25 * 60 * 60 * 1000), // -25h (> 24h)
        endTime: null,
      },
    ]);

    await updateSessionStatuses();

    expect(mockPrisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'completed' } })
    );
  });

  it('increments errors and continues when an individual update fails', async () => {
    const now = new Date();
    mockPrisma.session.findMany.mockResolvedValue([
      {
        id: 'session-fail',
        status: 'upcoming',
        startTime: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() + 1 * 60 * 60 * 1000),
      },
      {
        id: 'session-ok',
        status: 'upcoming',
        startTime: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() + 1 * 60 * 60 * 1000),
      },
    ]);
    mockPrisma.session.update
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({});

    const result = await updateSessionStatuses();

    expect(result.errors).toBe(1);
    expect(result.updated).toBe(1);
  });

  it('returns { updated, errors } shape', async () => {
    mockPrisma.session.findMany.mockResolvedValue([]);
    const result = await updateSessionStatuses();
    expect(result).toHaveProperty('updated');
    expect(result).toHaveProperty('errors');
  });
});

// ─── archiveOldEvents ───────────────────────────────────────────────────────

describe('archiveOldEvents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls updateMany with the correct where clause and returns archived count', async () => {
    mockPrisma.session.updateMany.mockResolvedValue({ count: 5 });

    const result = await archiveOldEvents(30);

    expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          archived: false,
          status: 'completed',
          endTime: expect.objectContaining({ lt: expect.any(Date) }),
        }),
        data: { archived: true },
      })
    );
    expect(result).toEqual({ archived: 5, errors: 0 });
  });

  it('returns { archived: 0, errors: 1 } without rethrowing on DB error', async () => {
    mockPrisma.session.updateMany.mockRejectedValue(new Error('DB failure'));

    const result = await archiveOldEvents();

    expect(result).toEqual({ archived: 0, errors: 1 });
  });
});

// ─── expireOldEventRequests ─────────────────────────────────────────────────

describe('expireOldEventRequests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls updateMany with correct where clause and returns expired count', async () => {
    mockPrisma.sessionRequest.updateMany.mockResolvedValue({ count: 3 });

    const result = await expireOldEventRequests();

    expect(mockPrisma.sessionRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'voting',
          voteDeadline: expect.objectContaining({ lt: expect.any(Date) }),
        }),
        data: { status: 'expired' },
      })
    );
    expect(result).toEqual({ expired: 3, errors: 0 });
  });

  it('returns { expired: 0, errors: 1 } without rethrowing on DB error', async () => {
    mockPrisma.sessionRequest.updateMany.mockRejectedValue(new Error('DB failure'));

    const result = await expireOldEventRequests();

    expect(result).toEqual({ expired: 0, errors: 1 });
  });
});

// ─── runEventMaintenance ────────────────────────────────────────────────────

describe('runEventMaintenance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls all three underlying functions and aggregates results', async () => {
    mockPrisma.session.findMany.mockResolvedValue([]);
    mockPrisma.session.updateMany.mockResolvedValue({ count: 4 });
    mockPrisma.sessionRequest.updateMany.mockResolvedValue({ count: 2 });

    const result = await runEventMaintenance();

    expect(mockPrisma.session.findMany).toHaveBeenCalled();
    expect(mockPrisma.session.updateMany).toHaveBeenCalled();
    expect(mockPrisma.sessionRequest.updateMany).toHaveBeenCalled();

    expect(result).toMatchObject({
      statusesUpdated: expect.any(Number),
      eventsArchived: 4,
      requestsExpired: 2,
      errors: expect.any(Number),
    });
  });

  it('correctly sums errors from all three operations', async () => {
    // findMany throws so updateSessionStatuses re-throws; to keep it simple,
    // return empty array so statusResult.errors = 0, then make the other two succeed.
    mockPrisma.session.findMany.mockResolvedValue([]);
    mockPrisma.session.updateMany.mockRejectedValue(new Error('archive error'));
    mockPrisma.sessionRequest.updateMany.mockRejectedValue(new Error('expire error'));

    const result = await runEventMaintenance();

    // archiveOldEvents + expireOldEventRequests each contribute 1 error
    expect(result.errors).toBe(2);
  });
});
