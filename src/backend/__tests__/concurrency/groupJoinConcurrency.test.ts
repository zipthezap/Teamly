import { describe, it, expect, vi, beforeEach } from 'vitest';

// We'll mock prisma with a transactional simulation that enforces commit-time checks
vi.mock('../../config/database', () => {
  const shared = { memberCount: 0 };

  const createTx = () => {
    const local = { creates: 0 };
    return {
      group: {
        findUnique: vi.fn(async ({ where }: any) => ({ id: where.id, maxMembers: 1, isPublic: true })),
      },
      groupMember: {
        findFirst: vi.fn(async () => null),
        count: vi.fn(async () => shared.memberCount + local.creates),
        create: vi.fn(async () => { local.creates += 1; return { id: `m-${Date.now()}` }; }),
      },
      groupJoinRequest: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: `jr-${Date.now()}` })),
      },
      // When transaction function completes, the test-level $transaction mock will commit
      _local: local,
    };
  };

  // Keep track of pending txs to simulate commit ordering and detect conflicts
  const committed = [] as any[];

  const $transaction = async (cb: any, opts?: any) => {
    const tx = createTx();
    // Run the callback and capture the returned promise
    const result = await cb(tx);
    // Simulate commit: if applying local creates would exceed maxMembers=1, reject
    const totalAfter = shared.memberCount + tx._local.creates;
    if (totalAfter > 1) {
      const err: any = new Error('Group has reached maximum member capacity');
      err.name = 'ConflictError';
      throw err;
    }
    // apply
    shared.memberCount = totalAfter;
    committed.push(tx);
    return result;
  };

  return {
    default: {
      group: { findUnique: vi.fn(async ({ where }: any) => ({ id: where.id, maxMembers: 1, isPublic: true })) },
      groupMember: { findFirst: vi.fn(async () => null), count: vi.fn(async () => shared.memberCount), create: vi.fn() },
      groupJoinRequest: { findFirst: vi.fn(async () => null), create: vi.fn() },
      user: { findUnique: vi.fn(async ({ where }: any) => ({ id: where.id, name: 'Test' })) },
      $transaction,
    }
  };
});

import prisma from '../../config/database';
import * as controller from '../../controllers/group/groupInviteController';

const makeReq = (groupId: string, userId: string) => ({ params: { groupId }, user: { id: userId }, body: {} });

const makeRes = () => {
  let status = 0; let payload: any = null;
  return {
    status: (s: number) => { status = s; return resObj; },
    json: (p: any) => { payload = p; return resObj; },
    _get: () => ({ status, payload })
  };
   
  const resObj: any = {};
}

describe('Concurrency: joinGroupByInvite', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('allows only one of two concurrent joins when maxMembers=1', async () => {
    const req1: any = makeReq('g1', 'u1');
    const req2: any = makeReq('g1', 'u2');

    const res1: any = { status: (s: number) => { res1._s = s; return res1; }, json: (p: any) => { res1._p = p; return res1; } };
    const res2: any = { status: (s: number) => { res2._s = s; return res2; }, json: (p: any) => { res2._p = p; return res2; } };

    // Start both joins nearly simultaneously
    const p1 = controller.joinGroupByInvite(req1, res1);
    const p2 = controller.joinGroupByInvite(req2, res2);

    const results = await Promise.allSettled([p1, p2]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // Debug: show results
     
    console.log('concurrency results', results.map(r => ({ status: r.status, reason: (r as any).reason ? String((r as any).reason) : undefined })));

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Ensure the rejection is due to capacity
    const reason = (rejected[0] as any).reason;
    expect(reason).toBeDefined();
    expect(String(reason)).toMatch(/maximum member capacity|GROUP_AT_CAPACITY/i);
  });
});
