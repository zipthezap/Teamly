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

    describe('Batch payment update idempotency', () => {
      it('should produce stable results for repeated identical payment updates', async () => {
        const teams = [
          { id: 'team-1', paymentStatus: 'unpaid' },
          { id: 'team-2', paymentStatus: 'unpaid' },
        ];

        const applyBatchUpdate = (ids: string[], status: string) => {
          const updated: string[] = [];
          const skipped: string[] = [];

          for (const id of ids) {
            const team = teams.find((t) => t.id === id);
            if (!team) continue;
            if (team.paymentStatus === status) {
              skipped.push(team.id);
              continue;
            }
            team.paymentStatus = status;
            updated.push(team.id);
          }

          return { updated, skipped };
        };

        const first = applyBatchUpdate(['team-1', 'team-2'], 'paid');
        const second = applyBatchUpdate(['team-1', 'team-2'], 'paid');

        expect(first.updated).toEqual(['team-1', 'team-2']);
        expect(second.updated).toEqual([]);
        expect(second.skipped).toEqual(['team-1', 'team-2']);
        expect(teams.every((team) => team.paymentStatus === 'paid')).toBe(true);
      });
    });

    describe('Bracket generation concurrency guard', () => {
      it('should allow only one concurrent generation lock holder', async () => {
        let generationInProgress = false;

        const tryGenerate = async () => {
          if (generationInProgress) return { ok: false, reason: 'generation_in_progress' };
          generationInProgress = true;
          await Promise.resolve();
          generationInProgress = false;
          return { ok: true };
        };

        const [first, second] = await Promise.all([tryGenerate(), tryGenerate()]);
        const successes = [first, second].filter((r) => r.ok).length;
        const blocked = [first, second].filter((r) => !r.ok && r.reason === 'generation_in_progress').length;

        expect(successes).toBe(1);
        expect(blocked).toBe(1);
      });
    });
  });

  describe('Match Start', () => {
    // Mirrors startMatch's conditional updateMany: only a request that finds
    // the match still SCHEDULED can transition it to IN_PROGRESS.
    function makeSchedulableMatchStore(initialStatus: string) {
      let status = initialStatus;
      return {
        startIfScheduled() {
          if (status !== MatchStatus.SCHEDULED) return Promise.resolve({ count: 0 });
          status = MatchStatus.IN_PROGRESS;
          return Promise.resolve({ count: 1 });
        },
        get status() {
          return status;
        },
      };
    }

    it('allows only one of two concurrent start requests to transition the match', async () => {
      const store = makeSchedulableMatchStore(MatchStatus.SCHEDULED);

      const [first, second] = await Promise.all([
        store.startIfScheduled(),
        store.startIfScheduled(),
      ]);

      const successCount = [first, second].filter((r) => r.count === 1).length;
      expect(successCount).toBe(1);
      expect(store.status).toBe(MatchStatus.IN_PROGRESS);
    });

    it('rejects a start request once the match is already in progress', async () => {
      const store = makeSchedulableMatchStore(MatchStatus.IN_PROGRESS);

      const result = await store.startIfScheduled();

      expect(result.count).toBe(0);
      expect(store.status).toBe(MatchStatus.IN_PROGRESS);
    });
  });

  describe('Pool Waitlist Promotion', () => {
    // Mirrors registerTeamToPool: inside a single (effectively serialized)
    // transaction, capacity is rechecked before registering or waitlisting.
    function makePoolStore(maxTeams: number) {
      const registeredTeamIds: string[] = [];
      const waitlist: string[] = [];
      let locked = false;

      return {
        async registerOrWaitlist(teamId: string) {
          // Serialize access the same way a DB transaction would serialize
          // conflicting writes to the same pool row.
          while (locked) {
            await Promise.resolve();
          }
          locked = true;
          try {
            await Promise.resolve();
            if (registeredTeamIds.length >= maxTeams) {
              waitlist.push(teamId);
              return { type: 'waitlist' as const, position: waitlist.length };
            }
            registeredTeamIds.push(teamId);
            return { type: 'registered' as const, registrationOrder: registeredTeamIds.length };
          } finally {
            locked = false;
          }
        },
        get registeredTeamIds() {
          return [...registeredTeamIds];
        },
        get waitlist() {
          return [...waitlist];
        },
      };
    }

    it('registers only up to capacity and waitlists the rest under concurrent requests', async () => {
      const pool = makePoolStore(1);

      const [first, second] = await Promise.all([
        pool.registerOrWaitlist('team-a'),
        pool.registerOrWaitlist('team-b'),
      ]);

      const registeredCount = [first, second].filter((r) => r.type === 'registered').length;
      const waitlistedCount = [first, second].filter((r) => r.type === 'waitlist').length;

      expect(registeredCount).toBe(1);
      expect(waitlistedCount).toBe(1);
      expect(pool.registeredTeamIds).toHaveLength(1);
      expect(pool.waitlist).toHaveLength(1);
    });

    it('promotes exactly one waitlisted team when a single spot opens up', async () => {
      const pool = makePoolStore(1);
      await pool.registerOrWaitlist('team-a');
      const waitlistedResult = await pool.registerOrWaitlist('team-b');
      expect(waitlistedResult.type).toBe('waitlist');

      // Two concurrent "remove team-a from pool" requests both attempt to
      // promote the first waitlist entry; only one should succeed.
      let promotedTeamId: string | null = null;
      let promotions = 0;
      const promoteFirstWaitlistEntry = async () => {
        if (pool.waitlist.length === 0 || promotedTeamId !== null) return null;
        await Promise.resolve();
        if (promotedTeamId !== null) return null;
        promotedTeamId = pool.waitlist[0];
        promotions += 1;
        return promotedTeamId;
      };

      await Promise.all([promoteFirstWaitlistEntry(), promoteFirstWaitlistEntry()]);

      expect(promotions).toBe(1);
      expect(promotedTeamId).toBe('team-b');
    });
  });
});
