import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as controller from '../../controllers/group/groupInviteController';

vi.mock('../../config/database', () => ({
  default: {
    group: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    groupMember: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
    groupJoinRequest: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  }
}));

import db from '../../config/database';

describe('GroupInviteController.joinGroupByInvite', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    const prisma = (db as any).default ?? db;
    for (const k of Object.keys(prisma)) {
      const obj = prisma[k];
      if (obj && typeof obj === 'object') {
        for (const fn of Object.keys(obj)) {
          if (obj[fn] && typeof obj[fn].mockReset === 'function') obj[fn].mockReset();
        }
      }
    }
  });

  it('throws when group at capacity inside transaction', async () => {
    const group = { id: 'g1', isPublic: true, maxMembers: 1 };
    const prisma = (db as any).default ?? db;
    prisma.group.findUnique.mockResolvedValue(group);
    prisma.groupMember.findFirst.mockResolvedValue(null);
    // $transaction will call provided cb with tx where count returns 1
    prisma.$transaction.mockImplementation(async (cb: any) => cb({
      groupMember: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(1) },
      groupJoinRequest: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'jr' }) }
    }));

    const req: any = { params: { groupId: 'g1' }, user: { id: 'u1' }, body: {} };
    const res: any = { status: (_: number) => res, json: (_: any) => res };

    await expect(controller.joinGroupByInvite(req, res)).rejects.toThrow(/maximum member capacity/i);
  });

  it('creates join request when capacity available', async () => {
    const group = { id: 'g2', isPublic: true, maxMembers: 5 };
    const prisma = (db as any).default ?? db;
    prisma.group.findUnique.mockResolvedValue(group);
    prisma.groupMember.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (cb: any) => cb({
      groupMember: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({ id: 'm1' }) },
      groupJoinRequest: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'jr2' }) }
    }));

    const req: any = { params: { groupId: 'g2' }, user: { id: 'u2' }, body: {} };
    let status = 0; let payload: any = null;
    const res: any = { status: (s: number) => { status = s; return res; }, json: (p: any) => { payload = p; return res; } };

    await controller.joinGroupByInvite(req, res);

    expect(status === 201 || status === 200 || status === 201).toBeTruthy();
    expect(payload).toHaveProperty('message');
  });
});
