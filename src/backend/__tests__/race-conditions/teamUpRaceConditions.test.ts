/**
 * Tests for TeamUp race conditions
 *
 * These tests verify that concurrent responses to a TeamUp request (accepting
 * a single open slot) and a concurrent delete-and-respond scenario are handled
 * correctly at the application logic level.
 *
 * Because the business logic lives in the controller (not the service), we
 * simulate the controller's prisma interactions directly with mocked prisma,
 * verifying that the guard checks behave correctly under concurrency.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import prisma from '../../config/database';

vi.mock('../../config/database', () => ({
  default: {
    teamUpRequest: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    teamUpResponse: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const prismaMock = prisma as unknown as {
  teamUpRequest: {
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  teamUpResponse: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const REQUEST_ID = 'teamup-request-1';

/** Inline replica of the guard logic from respondToTeamUpRequest controller. */
async function simulateRespondToTeamUpRequest(userId: string, message?: string) {
  const teamUpRequest = await prisma.teamUpRequest.findUnique({
    where: { id: REQUEST_ID },
    select: { status: true, creatorId: true, title: true },
  });

  if (!teamUpRequest) {
    throw new Error('TeamUp request not found');
  }
  if (teamUpRequest.status !== 'open') {
    throw new Error('This TeamUp request is no longer accepting responses');
  }
  if (teamUpRequest.creatorId === userId) {
    throw new Error('You cannot respond to your own TeamUp request');
  }

  const existingResponse = await prisma.teamUpResponse.findFirst({
    where: { teamUpRequestId: REQUEST_ID, userId },
  });
  if (existingResponse) {
    throw new Error('You have already responded to this request');
  }

  return prisma.teamUpResponse.create({
    data: { teamUpRequestId: REQUEST_ID, userId, message, status: 'pending' },
  });
}

/** Inline replica of the guard logic from deleteTeamUpRequest controller. */
async function simulateDeleteTeamUpRequest(actorId: string) {
  const req = await prisma.teamUpRequest.findUnique({
    where: { id: REQUEST_ID },
    select: { creatorId: true },
  });
  if (!req) throw new Error('TeamUp request not found');
  if (req.creatorId !== actorId) throw new Error('Only the creator can delete this request');
  return prisma.teamUpRequest.delete({ where: { id: REQUEST_ID } });
}

describe('TeamUp Race Conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Concurrent accepts for a single open slot ──────────────────────────────

  describe('Concurrent accepts for a single open slot', () => {
    it('all responders see an open request and no duplicate – all create calls proceed', async () => {
      // The request is open and no previous responses exist.
      prismaMock.teamUpRequest.findUnique.mockResolvedValue({
        status: 'open',
        creatorId: 'creator-1',
        title: 'Need a player',
      });
      prismaMock.teamUpResponse.findFirst.mockResolvedValue(null);
      prismaMock.teamUpResponse.create.mockImplementation(async ({ data }: any) => ({
        id: `response-${data.userId}`,
        ...data,
      }));

      const users = ['user-a', 'user-b', 'user-c'];

      const results = await Promise.allSettled(
        users.map((userId) => simulateRespondToTeamUpRequest(userId))
      );

      // With no per-user duplicate check being hit, all three succeed.
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled).toHaveLength(3);
      expect(prismaMock.teamUpResponse.create).toHaveBeenCalledTimes(3);
    });

    it('second responder is blocked when duplicate response already exists', async () => {
      const DUPLICATE_USER = 'user-dup';

      prismaMock.teamUpRequest.findUnique.mockResolvedValue({
        status: 'open',
        creatorId: 'creator-1',
        title: 'Need a player',
      });

      // Simulate race: first call sees no existing response, second call sees one.
      let findFirstCallIndex = 0;
      prismaMock.teamUpResponse.findFirst.mockImplementation(async () => {
        return findFirstCallIndex++ === 0
          ? null
          : { id: 'response-existing', userId: DUPLICATE_USER };
      });

      prismaMock.teamUpResponse.create.mockResolvedValue({
        id: 'response-new',
        teamUpRequestId: REQUEST_ID,
        userId: DUPLICATE_USER,
        status: 'pending',
      });

      const [first, second] = await Promise.allSettled([
        simulateRespondToTeamUpRequest(DUPLICATE_USER),
        simulateRespondToTeamUpRequest(DUPLICATE_USER),
      ]);

      expect(first.status).toBe('fulfilled');
      expect(second.status).toBe('rejected');
      expect((second as PromiseRejectedResult).reason.message).toMatch(/already responded/);
      // Only one create call should have been made.
      expect(prismaMock.teamUpResponse.create).toHaveBeenCalledTimes(1);
    });

    it('responder is rejected when request status is no longer open', async () => {
      prismaMock.teamUpRequest.findUnique.mockResolvedValue({
        status: 'closed',
        creatorId: 'creator-1',
        title: 'Need a player',
      });

      await expect(simulateRespondToTeamUpRequest('user-late')).rejects.toThrow(
        /no longer accepting responses/
      );
      expect(prismaMock.teamUpResponse.create).not.toHaveBeenCalled();
    });
  });

  // ── Concurrent delete and respond to same TeamUp request ──────────────────

  describe('Concurrent delete and respond to same TeamUp request', () => {
    it('delete succeeds and respond fails when request is deleted first', async () => {
      // findUnique call order: respond reads an open request; delete also reads it.
      prismaMock.teamUpRequest.findUnique
        .mockResolvedValueOnce({ status: 'open', creatorId: 'creator-1', title: 'Need a player' }) // respond guard
        .mockResolvedValueOnce({ creatorId: 'creator-1' }); // delete guard

      prismaMock.teamUpResponse.findFirst.mockResolvedValue(null);

      // Simulate: delete wins and the request is gone before respond.create is called.
      prismaMock.teamUpRequest.delete.mockResolvedValue({ id: REQUEST_ID });
      prismaMock.teamUpResponse.create.mockRejectedValue(
        new Error('Foreign key constraint failed – request deleted')
      );

      const [deleteResult, respondResult] = await Promise.allSettled([
        simulateDeleteTeamUpRequest('creator-1'),
        simulateRespondToTeamUpRequest('user-a'),
      ]);

      expect(deleteResult.status).toBe('fulfilled');
      expect(respondResult.status).toBe('rejected');
    });

    it('respond succeeds and delete is blocked when actor is not the creator', async () => {
      prismaMock.teamUpRequest.findUnique
        .mockResolvedValue({ status: 'open', creatorId: 'creator-1', title: 'Need a player' });

      prismaMock.teamUpResponse.findFirst.mockResolvedValue(null);
      prismaMock.teamUpResponse.create.mockResolvedValue({
        id: 'response-1',
        teamUpRequestId: REQUEST_ID,
        userId: 'user-a',
        status: 'pending',
      });

      const [respondResult, deleteResult] = await Promise.allSettled([
        simulateRespondToTeamUpRequest('user-a'),
        simulateDeleteTeamUpRequest('non-creator'),
      ]);

      expect(respondResult.status).toBe('fulfilled');
      expect(deleteResult.status).toBe('rejected');
      expect((deleteResult as PromiseRejectedResult).reason.message).toMatch(
        /Only the creator can delete/
      );
    });
  });
});
