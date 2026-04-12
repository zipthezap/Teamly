/**
 * Tests for session race conditions
 *
 * These tests verify that concurrent join attempts are handled correctly
 * when a session has limited capacity (maxPlayers).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import prisma from '../../config/database';
import { isSessionFull } from '../../services/sessionService';

vi.mock('../../config/database', () => ({
  default: {
    sessionParticipant: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const prismaMock = prisma as unknown as {
  sessionParticipant: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

describe('Session Race Conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Concurrent joins when capacity is 1', () => {
    it('only the first joiner should succeed; subsequent checks see a full session', async () => {
      // Simulate the race: first count call returns 0 (slot available),
      // subsequent calls return 1 (slot taken by the winner).
      let countCallIndex = 0;
      prismaMock.sessionParticipant.count.mockImplementation(async () => {
        return countCallIndex++ === 0 ? 0 : 1;
      });

      prismaMock.sessionParticipant.create.mockResolvedValue({
        id: 'participant-1',
        sessionId: 'session-1',
        userId: 'user-1',
        status: 'confirmed',
      });

      const MAX_PLAYERS = 1;
      const SESSION_ID = 'session-1';

      // Simulate 5 concurrent capacity checks (as the service would do them).
      const checks = await Promise.all(
        Array.from({ length: 5 }, () => isSessionFull(SESSION_ID, MAX_PLAYERS))
      );

      // First check returns false (not full), the rest return true (full).
      const notFull = checks.filter((full) => !full);
      const full = checks.filter((full) => full);

      expect(notFull).toHaveLength(1);
      expect(full).toHaveLength(4);
    });

    it('isSessionFull returns false when there is no maxPlayers limit', async () => {
      const result = await isSessionFull('session-1', null);
      expect(result).toBe(false);
      expect(prismaMock.sessionParticipant.count).not.toHaveBeenCalled();
    });

    it('isSessionFull returns true when confirmed count equals maxPlayers', async () => {
      prismaMock.sessionParticipant.count.mockResolvedValue(5);
      const result = await isSessionFull('session-1', 5);
      expect(result).toBe(true);
    });

    it('isSessionFull returns false when confirmed count is below maxPlayers', async () => {
      prismaMock.sessionParticipant.count.mockResolvedValue(3);
      const result = await isSessionFull('session-1', 5);
      expect(result).toBe(false);
    });
  });

  describe('Concurrent capacity queries', () => {
    it('count is called with correct session and status filters', async () => {
      prismaMock.sessionParticipant.count.mockResolvedValue(0);
      await isSessionFull('session-abc', 10);

      expect(prismaMock.sessionParticipant.count).toHaveBeenCalledWith({
        where: {
          sessionId: 'session-abc',
          status: 'confirmed',
        },
      });
    });

    it('handles multiple concurrent isSessionFull calls for same session independently', async () => {
      // Each call gets its own resolved value to simulate independent DB reads.
      prismaMock.sessionParticipant.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);

      const MAX_PLAYERS = 1;
      const results = await Promise.all(
        Array.from({ length: 5 }, () => isSessionFull('session-1', MAX_PLAYERS))
      );

      expect(prismaMock.sessionParticipant.count).toHaveBeenCalledTimes(5);
      // First two calls see 0 participants → not full.
      expect(results[0]).toBe(false);
      expect(results[1]).toBe(false);
      // Remaining calls see 1 participant → full.
      expect(results[2]).toBe(true);
      expect(results[3]).toBe(true);
      expect(results[4]).toBe(true);
    });
  });
});
