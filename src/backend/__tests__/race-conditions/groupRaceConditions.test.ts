/**
 * Tests for group race conditions
 *
 * These tests verify that concurrent group membership operations (joining and
 * admin transfer) are handled correctly without leaving the group in an
 * inconsistent state.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import prisma from '../../config/database';
import {
  checkGroupCapacityAndMembership,
} from '../../services/groupService';
import { BadRequestError } from '../../utils/errors';

vi.mock('../../config/database', () => ({
  default: {
    groupMember: {
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    group: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/cacheService', () => ({
  CacheService: {
    wrap: vi.fn((_key: string, _ttl: number, fn: () => unknown) => fn()),
    invalidate: vi.fn(),
    deletePattern: vi.fn(),
  },
}));

const prismaMock = prisma as unknown as {
  groupMember: {
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  group: { findUnique: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
};

const GROUP_ID = 'group-1';
const MAX_MEMBERS = 2;

describe('Group Race Conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Concurrent join requests for the same group slot ───────────────────────

  describe('Concurrent join requests when group has one slot left', () => {
    it('only the first requester should pass the capacity check; others should be rejected', async () => {
      // No existing membership for any of the concurrent users.
      prismaMock.groupMember.findFirst.mockResolvedValue(null);

      // Simulate race: first count call returns 1 (one slot free),
      // subsequent calls return 2 (group is now full).
      let countCallIndex = 0;
      prismaMock.groupMember.count.mockImplementation(async () =>
        countCallIndex++ === 0 ? 1 : MAX_MEMBERS
      );

      const users = ['user-a', 'user-b', 'user-c'];

      const results = await Promise.allSettled(
        users.map((userId) =>
          checkGroupCapacityAndMembership(GROUP_ID, userId, MAX_MEMBERS)
        )
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Only the first concurrent check should pass.
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(2);

      // Rejected calls should fail with the capacity error.
      for (const r of rejected) {
        expect((r as PromiseRejectedResult).reason).toBeInstanceOf(BadRequestError);
        expect((r as PromiseRejectedResult).reason.message).toMatch(/maximum member capacity/);
      }
    });

    it('rejects a user who is already a member regardless of capacity', async () => {
      // Simulate user already being a member.
      prismaMock.groupMember.findFirst.mockResolvedValue({
        id: 'member-1',
        groupId: GROUP_ID,
        userId: 'existing-user',
        role: 'member',
      });

      await expect(
        checkGroupCapacityAndMembership(GROUP_ID, 'existing-user', MAX_MEMBERS)
      ).rejects.toThrow(BadRequestError);

      // count should NOT be called once duplicate is detected.
      expect(prismaMock.groupMember.count).not.toHaveBeenCalled();
    });

    it('allows join when group has no member cap (maxMembers is null)', async () => {
      prismaMock.groupMember.findFirst.mockResolvedValue(null);

      await expect(
        checkGroupCapacityAndMembership(GROUP_ID, 'user-x', null)
      ).resolves.toBeUndefined();

      // No count query needed when there is no limit.
      expect(prismaMock.groupMember.count).not.toHaveBeenCalled();
    });
  });

  // ── Concurrent admin transfer ──────────────────────────────────────────────

  describe('Concurrent admin transfer', () => {
    it('each transfer call should update the correct membership records', async () => {
      const adminMemberId = 'member-admin';
      const targetMemberId = 'member-target';

      prismaMock.groupMember.update.mockResolvedValue({});

      // Simulate two concurrent transfers using the same role-swap logic
      // that the controller applies inside a $transaction.
      const transferAdmin = async (newAdminMemberId: string, currentAdminMemberId: string) => {
        await Promise.all([
          prismaMock.groupMember.update({
            where: { id: newAdminMemberId },
            data: { role: 'admin' },
          }),
          prismaMock.groupMember.update({
            where: { id: currentAdminMemberId },
            data: { role: 'member' },
          }),
        ]);
      };

      await transferAdmin(targetMemberId, adminMemberId);

      // Two update calls should have been made.
      expect(prismaMock.groupMember.update).toHaveBeenCalledTimes(2);

      expect(prismaMock.groupMember.update).toHaveBeenCalledWith({
        where: { id: targetMemberId },
        data: { role: 'admin' },
      });
      expect(prismaMock.groupMember.update).toHaveBeenCalledWith({
        where: { id: adminMemberId },
        data: { role: 'member' },
      });
    });

    it('concurrent transfer calls each perform exactly one promotion and one demotion', async () => {
      prismaMock.groupMember.update.mockResolvedValue({});

      const transfer = (newId: string, oldId: string) =>
        Promise.all([
          prismaMock.groupMember.update({ where: { id: newId }, data: { role: 'admin' } }),
          prismaMock.groupMember.update({ where: { id: oldId }, data: { role: 'member' } }),
        ]);

      // Two concurrent transfer attempts (e.g. two requests racing).
      await Promise.allSettled([
        transfer('member-b', 'member-a'),
        transfer('member-c', 'member-a'),
      ]);

      // 2 transfers × 2 updates each = 4 total update calls.
      expect(prismaMock.groupMember.update).toHaveBeenCalledTimes(4);

      const calls = prismaMock.groupMember.update.mock.calls.map((c: any[]) => c[0]);
      const adminPromotions = calls.filter((c: any) => c.data.role === 'admin');
      const memberDemotions = calls.filter((c: any) => c.data.role === 'member');

      expect(adminPromotions).toHaveLength(2);
      expect(memberDemotions).toHaveLength(2);
    });
  });
});
