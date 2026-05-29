import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    tournament: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    tournamentTeam: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    tournamentNotification: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    tournamentPlayerStat: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    tournamentPlayer: {
      findFirst: vi.fn(),
    },
    tournamentStanding: {
      findMany: vi.fn(),
    },
    tournamentMatch: {
      findMany: vi.fn(),
    },
    tournamentScoreDispute: {
      findMany: vi.fn(),
    },
    tournamentMatchIncident: {
      findMany: vi.fn(),
    },
    tournamentPaymentTransaction: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../config/database', () => ({
  default: mockPrisma,
}));

vi.mock('../../services/tournamentService', () => ({
  isOrganizerOrAdmin: vi.fn(),
  isTeamCaptain: vi.fn(),
  sortStandingsByTiebreakerRules: vi.fn((standings) => standings),
  syncTournamentAutoStatus: vi.fn(async (tournament) => tournament),
  reconcileTournamentLifecycleStatus: vi.fn(async (_id, status) => status),
}));

import prisma from '../../config/database';
import * as tournamentService from '../../services/tournamentService';
import {
  getPublicTournamentPortal,
  getTournamentAnalytics,
  getTournamentNotifications,
  getPlayerStats,
  upsertPlayerStat,
} from '../../tournament-service/controllers/tournament';

const createRes = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    end: vi.fn(),
  } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
};

const createReq = (overrides: Partial<Request> = {}) =>
  ({
    params: {},
    query: {},
    body: {},
    header: vi.fn(),
    user: { id: 'u1', email: 'u1@example.com', name: 'User One' },
    ...overrides,
  } as unknown as Request);

describe('tournament-service analytics controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({ id: 't1', organizerId: 'u1', isPublic: false } as never);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true as never);
    vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(false as never);
  });

  it('returns paginated tournament notifications for organizers', async () => {
    vi.mocked(prisma.tournamentNotification.findMany).mockResolvedValue([{ id: 'n1' }] as never);
    vi.mocked(prisma.tournamentNotification.count).mockResolvedValue(1 as never);

    const req = createReq({
      params: { id: 't1' },
      query: { page: '1', limit: '20' },
      header: (name: string) => (name === 'x-user-id' ? 'u1' : null),
    });
    const res = createRes();

    await getTournamentNotifications(req, res);

    expect(vi.mocked(res.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ id: 'n1' }],
        pagination: expect.objectContaining({ total: 1, page: 1, limit: 20 }),
      })
    );
  });

  it('returns player stats for an accessible team', async () => {
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({ id: 'team-1' } as never);
    vi.mocked(prisma.tournamentPlayerStat.findMany).mockResolvedValue([{ statKey: 'goals', value: 2 }] as never);

    const req = createReq({
      params: { id: 't1', teamId: 'team-1' },
      header: (name: string) => (name === 'x-user-id' ? 'u1' : null),
    });
    const res = createRes();

    await getPlayerStats(req, res);

    expect(vi.mocked(res.json)).toHaveBeenCalledWith([{ statKey: 'goals', value: 2 }]);
  });

  it('returns public tournament portal payload for a valid token', async () => {
    vi.mocked(prisma.tournament.findFirst).mockResolvedValue({
      id: 't-public',
      isPublic: true,
      tiebreakerRules: ['points'],
      courts: [{ id: 'c1', name: 'Court 1', location: 'Main' }],
      announcements: [{ id: 'a1', title: 'Welcome' }],
    } as never);
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([{ id: 'team-1', name: 'Falcons' }] as never);
    vi.mocked(prisma.tournamentMatch.findMany).mockResolvedValue([{ id: 'match-1' }] as never);
    vi.mocked(prisma.tournamentStanding.findMany).mockResolvedValue([{ id: 'standing-1' }] as never);

    const req = createReq({
      params: { shareToken: 'token-123' },
    });
    const res = createRes();

    await getPublicTournamentPortal(req, res);

    expect(vi.mocked(res.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        tournament: expect.objectContaining({ id: 't-public' }),
        teams: [{ id: 'team-1', name: 'Falcons' }],
        matches: [{ id: 'match-1' }],
        standings: [{ id: 'standing-1' }],
      })
    );
  });

  it('upserts player stats for captains', async () => {
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({ id: 'team-1' } as never);
    vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValue({ id: 'player-1' } as never);
    vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(true as never);
    vi.mocked(prisma.tournamentPlayerStat.upsert).mockResolvedValue({ id: 'stat-1' } as never);

    const req = createReq({
      params: { id: 't1', teamId: 'team-1', playerId: 'player-1' },
      body: { statKey: 'goals', value: 3 },
      header: (name: string) => (name === 'x-user-id' ? 'u1' : null),
    });
    const res = createRes();

    await upsertPlayerStat(req, res);

    expect(vi.mocked(prisma.tournamentPlayerStat.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ statKey: 'goals', value: 3 }),
        update: { value: 3 },
      })
    );
  });

  it('returns tournament analytics summary for organizers', async () => {
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([
      { checkedIn: true, paymentStatus: 'paid', waiverAcceptedAt: new Date() },
      { checkedIn: false, paymentStatus: 'unpaid', waiverAcceptedAt: null },
    ] as never);
    vi.mocked(prisma.tournamentMatch.findMany).mockResolvedValue([
      { status: 'completed', scheduledAt: new Date('2026-05-29T10:00:00Z'), startedAt: new Date('2026-05-29T10:15:00Z'), completedAt: new Date('2026-05-29T11:05:00Z') },
      { status: 'scheduled', scheduledAt: new Date('2026-05-29T12:00:00Z'), startedAt: null, completedAt: null },
    ] as never);
    vi.mocked(prisma.tournamentScoreDispute.findMany).mockResolvedValue([{ status: 'open' }] as never);
    vi.mocked(prisma.tournamentMatchIncident.findMany).mockResolvedValue([{ status: 'open', slaDeadline: new Date(Date.now() - 1000) }] as never);
    vi.mocked(prisma.tournamentPaymentTransaction.findMany).mockResolvedValue([
      { status: 'paid', amount: 25 },
      { status: 'refunded', amount: 10 },
    ] as never);

    const req = createReq({
      params: { id: 't1' },
      header: (name: string) => (name === 'x-user-id' ? 'u1' : null),
    });
    const res = createRes();

    await getTournamentAnalytics(req, res);

    expect(vi.mocked(res.json)).toHaveBeenCalledWith(
      expect.objectContaining({
        registration: expect.objectContaining({ totalTeams: 2, checkedIn: 1, paid: 1, unpaid: 1 }),
        matches: expect.objectContaining({ total: 2, completed: 1, scheduled: 1 }),
        disputes: expect.objectContaining({ total: 1, open: 1 }),
        payments: expect.objectContaining({ totalRevenue: 25, transactionsRefunded: 1 }),
      })
    );
  });
});
