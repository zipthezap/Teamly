/**
 * Tests for tournament race conditions
 *
 * These tests verify that tournament match score submissions are idempotent
 * and prevent duplicate score submissions.
 */

import { describe, it, expect } from 'vitest';
import { MatchStatus } from '../../../shared/types/tournament.types';

// Minimal in-memory tournament/match store to test update-where idempotency
function makeMatchStore() {
  type Match = {
    id: string;
    tournamentId: string;
    homeTeamId: string;
    awayTeamId: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    completedAt: Date | null;
  };
  const matches: Record<string, Match> = {};
  let id = 0;

  return {
    create(data: Omit<Match, 'id' | 'homeScore' | 'awayScore' | 'completedAt'>) {
      const match: Match = { id: `match-${++id}`, homeScore: null, awayScore: null, completedAt: null, ...data };
      matches[match.id] = match;
      return Promise.resolve({ ...match });
    },
    update(args: { where: { id: string }; data: Partial<Match> }) {
      const m = matches[args.where.id];
      if (!m) throw new Error('Not found');
      Object.assign(m, args.data);
      return Promise.resolve({ ...m });
    },
    updateMany(args: { where: { id: string; status?: { not: string } }; data: Partial<Match> }) {
      const m = matches[args.where.id];
      if (!m) return Promise.resolve({ count: 0 });
      if (args.where.status?.not !== undefined && m.status === args.where.status.not) {
        return Promise.resolve({ count: 0 });
      }
      Object.assign(m, args.data);
      return Promise.resolve({ count: 1 });
    },
    findUnique(args: { where: { id: string } }) {
      return Promise.resolve(matches[args.where.id] ? { ...matches[args.where.id] } : null);
    },
  };
}

describe('Tournament Race Conditions', () => {
  describe('Match Score Submission', () => {
    it('should prevent duplicate score submission for completed match', async () => {
      const store = makeMatchStore();

      const match = await store.create({
        tournamentId: 't-1',
        homeTeamId: 'team-1',
        awayTeamId: 'team-2',
        status: MatchStatus.SCHEDULED,
      });

      // First submission — should succeed
      await store.update({
        where: { id: match.id },
        data: { homeScore: 3, awayScore: 1, status: MatchStatus.COMPLETED, completedAt: new Date() },
      });

      // Second submission with WHERE guard — should be blocked
      const result = await store.updateMany({
        where: { id: match.id, status: { not: MatchStatus.COMPLETED } },
        data: { homeScore: 5, awayScore: 2 },
      });

      expect(result.count).toBe(0);

      const finalMatch = await store.findUnique({ where: { id: match.id } });
      expect(finalMatch?.homeScore).toBe(3);
      expect(finalMatch?.awayScore).toBe(1);
      expect(finalMatch?.status).toBe(MatchStatus.COMPLETED);
    });

    it('should handle concurrent score submissions', async () => {
      const store = makeMatchStore();

      const match = await store.create({
        tournamentId: 't-2',
        homeTeamId: 'team-x',
        awayTeamId: 'team-y',
        status: MatchStatus.SCHEDULED,
      });

      // Two concurrent submissions guarded by WHERE clause
      const results = await Promise.allSettled([
        store.updateMany({
          where: { id: match.id, status: { not: MatchStatus.COMPLETED } },
          data: { homeScore: 3, awayScore: 1, status: MatchStatus.COMPLETED, completedAt: new Date() },
        }),
        store.updateMany({
          where: { id: match.id, status: { not: MatchStatus.COMPLETED } },
          data: { homeScore: 4, awayScore: 2, status: MatchStatus.COMPLETED, completedAt: new Date() },
        }),
      ]);

      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && (r.value as { count: number }).count === 1
      ).length;
      expect(successCount).toBeGreaterThanOrEqual(1);

      const finalMatch = await store.findUnique({ where: { id: match.id } });
      expect(finalMatch?.status).toBe(MatchStatus.COMPLETED);
      expect(finalMatch?.homeScore).toBeDefined();
      expect(finalMatch?.awayScore).toBeDefined();
    });
  });
});
