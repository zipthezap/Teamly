import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createAuthenticatedTestApp } from '../helpers/testApp';

// ─── All vi.mock calls hoisted before imports ─────────────────────────────────

vi.mock('../../middleware/auth', () => ({
  default: (_req: any, _res: any, next: any) => next(),
  optionalAuthMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/cacheControl', () => ({
  noCache: (_req: any, _res: any, next: any) => next(),
  cacheControl: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/etag', () => ({
  etagMiddleware: () => (_req: any, _res: any, next: any) => next(),
  generateWeakETag: vi.fn(),
  generateStrongETag: vi.fn(),
  generateETag: vi.fn(),
}));

vi.mock('../../middleware/rateLimiter', () => ({
  authenticatedLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/authorization', () => ({
  requireTournamentPermission: () => (_req: any, _res: any, next: any) => next(),
  requireTeamPermission: () => (_req: any, _res: any, next: any) => next(),
  requireGroupAdmin: (_req: any, _res: any, next: any) => next(),
  requireGroupRole: () => (_req: any, _res: any, next: any) => next(),
  requireGroupPermission: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../config/database', () => ({
  default: {
    tournament: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tournamentTeam: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    tournamentMatch: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    tournamentStanding: {
      findMany: vi.fn(),
    },
    tournamentPool: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tournamentPoolWaitlist: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    tournamentPlayer: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tournamentTeamInvitation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tournamentNotification: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    tournamentAdminRole: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    tournamentCategory: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    groupMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../services/tournamentService', () => ({
  sanitizeTournamentData: vi.fn((d: any) => d),
  validateTournamentDates: vi.fn(() => ({ valid: true })),
  isOrganizer: vi.fn(() => true),
  isOrganizerOrAdmin: vi.fn().mockResolvedValue(true),
  isTeamCaptain: vi.fn().mockResolvedValue(false),
  canSubmitScore: vi.fn().mockResolvedValue(true),
  canManageTeamInvitations: vi.fn().mockResolvedValue(true),
  computeAutoStatus: vi.fn(() => null),
  generateSingleEliminationBrackets: vi.fn().mockResolvedValue({ count: 4 }),
  generateRoundRobinBrackets: vi.fn().mockResolvedValue({ count: 6 }),
  generateGroupsKnockoutBrackets: vi.fn().mockResolvedValue({ count: 8 }),
  updateStandings: vi.fn().mockResolvedValue(undefined),
  advanceWinners: vi.fn().mockResolvedValue(undefined),
  calculateVolleyballWinner: vi.fn(() => ({ isValid: true, homeWins: 2, awayWins: 1 })),
  createTeamInvitation: vi.fn().mockResolvedValue({
    id: 'inv-1',
    teamId: 'team-1',
    inviteeEmail: 'invitee@example.com',
    inviteToken: 'token-abc',
    status: 'pending',
  }),
  getTeamInvitations: vi.fn().mockResolvedValue([]),
  getUserPendingInvitations: vi.fn().mockResolvedValue([]),
  acceptTeamInvitation: vi.fn().mockResolvedValue({
    id: 'inv-1',
    teamId: 'team-1',
    team: { id: 'team-1', name: 'Team Alpha' },
  }),
  cancelTeamInvitation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/emailService', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// ─── Imports after mocks ───────────────────────────────────────────────────────

import prisma from '../../config/database';
import tournamentRoutes from '../../routes/tournamentRoutes';
import * as tournamentService from '../../services/tournamentService';

// ─── Test app ─────────────────────────────────────────────────────────────────

const app = createAuthenticatedTestApp(tournamentRoutes, 'test-user-id', '/api/tournaments');

// ─── Shared mock data ─────────────────────────────────────────────────────────

const mockTournament = {
  id: 'tournament-1',
  name: 'Test Tournament',
  description: 'A test tournament',
  sportType: 'soccer',
  format: 'single_elimination',
  status: 'draft',
  startDate: new Date('2025-12-01T10:00:00Z'),
  endDate: null,
  maxTeams: 8,
  location: 'Test Venue',
  latitude: null,
  longitude: null,
  locationName: null,
  city: null,
  country: null,
  organizerId: 'test-user-id',
  groupId: null,
  isPublic: true,
  allowLateRegistration: false,
  autoGenerateBrackets: false,
  useManualBrackets: false,
  isRecurring: false,
  recurrenceRule: null,
  prizesDescription: null,
  rulesDescription: null,
  contactEmail: null,
  sportConfig: null,
  registrationDeadline: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  organizer: { id: 'test-user-id', name: 'Test User', email: 'test@example.com' },
  group: null,
};

const mockTeam = {
  id: 'team-1',
  name: 'Team Alpha',
  captainName: 'Alice',
  captainEmail: 'alice@example.com',
  captainUserId: null,
  tournamentId: 'tournament-1',
  poolId: null,
  poolNumber: null,
  poolName: null,
  seedNumber: null,
  registrationOrder: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  captainUser: null,
};

const mockMatch = {
  id: 'match-1',
  tournamentId: 'tournament-1',
  homeTeamId: 'team-1',
  awayTeamId: 'team-2',
  refereeTeamId: null,
  homeScore: null,
  awayScore: null,
  detailedScore: null,
  status: 'scheduled',
  stage: null,
  roundNumber: 1,
  groupName: null,
  scheduledAt: null,
  matchOrder: null,
  isManuallyCreated: false,
  completedAt: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  homeTeam: mockTeam,
  awayTeam: { ...mockTeam, id: 'team-2', name: 'Team Beta' },
  refereeTeam: null,
};

const mockPool = {
  id: 'pool-1',
  name: 'Pool A',
  description: null,
  maxTeams: 4,
  tournamentId: 'tournament-1',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockPlayer = {
  id: 'player-1',
  teamId: 'team-1',
  userId: null,
  playerName: 'John Doe',
  playerEmail: 'john@example.com',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  user: null,
};

const mockInvitation = {
  id: 'inv-1',
  teamId: 'team-1',
  invitedById: 'test-user-id',
  inviteeEmail: 'invitee@example.com',
  inviteeName: 'Invitee Person',
  message: null,
  inviteToken: 'token-abc',
  status: 'pending',
  expiresAt: new Date('2026-01-01'),
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

// ─── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(tournamentService.sanitizeTournamentData).mockImplementation((d: any) => d);
  vi.mocked(tournamentService.validateTournamentDates).mockReturnValue({ valid: true });
  vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
  vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
  vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(false);
  vi.mocked(tournamentService.canSubmitScore).mockResolvedValue(true);
  vi.mocked(tournamentService.canManageTeamInvitations).mockResolvedValue(true);
  vi.mocked(tournamentService.computeAutoStatus).mockReturnValue(null);
  vi.mocked(tournamentService.generateSingleEliminationBrackets).mockResolvedValue({ count: 4 });
  vi.mocked(tournamentService.generateRoundRobinBrackets).mockResolvedValue({ count: 6 });
  vi.mocked(tournamentService.generateGroupsKnockoutBrackets).mockResolvedValue({ count: 8 });
  vi.mocked(tournamentService.updateStandings).mockResolvedValue(undefined);
  vi.mocked(tournamentService.advanceWinners).mockResolvedValue(undefined);
  vi.mocked(tournamentService.getTeamInvitations).mockResolvedValue([]);
  vi.mocked(tournamentService.getUserPendingInvitations).mockResolvedValue([]);
  vi.mocked(tournamentService.acceptTeamInvitation).mockResolvedValue({
    id: 'inv-1',
    teamId: 'team-1',
    team: { id: 'team-1', name: 'Team Alpha' },
  } as any);
  vi.mocked(tournamentService.createTeamInvitation).mockResolvedValue(mockInvitation as any);
  vi.mocked(tournamentService.cancelTeamInvitation).mockResolvedValue(undefined);

  vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
    typeof fn === 'function' ? fn(prisma) : Promise.all(fn)
  );

  vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.tournament.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournament.count).mockResolvedValue(0);
  vi.mocked(prisma.tournament.create).mockResolvedValue(mockTournament as any);
  vi.mocked(prisma.tournament.update).mockResolvedValue(mockTournament as any);
  vi.mocked(prisma.tournament.delete).mockResolvedValue(mockTournament as any);

  vi.mocked(prisma.tournamentTeam.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentTeam.count).mockResolvedValue(0);
  vi.mocked(prisma.tournamentTeam.create).mockResolvedValue(mockTeam as any);
  vi.mocked(prisma.tournamentTeam.update).mockResolvedValue(mockTeam as any);
  vi.mocked(prisma.tournamentTeam.delete).mockResolvedValue(mockTeam as any);
  vi.mocked(prisma.tournamentTeam.deleteMany).mockResolvedValue({ count: 1 } as any);

  vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.tournamentMatch.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(0);
  vi.mocked(prisma.tournamentMatch.create).mockResolvedValue(mockMatch as any);
  vi.mocked(prisma.tournamentMatch.update).mockResolvedValue(mockMatch as any);
  vi.mocked(prisma.tournamentMatch.delete).mockResolvedValue(mockMatch as any);

  vi.mocked(prisma.tournamentStanding.findMany).mockResolvedValue([]);

  vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentPool.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentPool.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.tournamentPool.count).mockResolvedValue(0);
  vi.mocked(prisma.tournamentPool.create).mockResolvedValue(mockPool as any);
  vi.mocked(prisma.tournamentPool.update).mockResolvedValue(mockPool as any);
  vi.mocked(prisma.tournamentPool.delete).mockResolvedValue(mockPool as any);

  vi.mocked(prisma.tournamentPoolWaitlist.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentPoolWaitlist.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentPoolWaitlist.count).mockResolvedValue(0);
  vi.mocked(prisma.tournamentPoolWaitlist.create).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentPoolWaitlist.update).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentPoolWaitlist.delete).mockResolvedValue({} as any);

  vi.mocked(prisma.tournamentPlayer.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentPlayer.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentPlayer.create).mockResolvedValue(mockPlayer as any);
  vi.mocked(prisma.tournamentPlayer.update).mockResolvedValue(mockPlayer as any);
  vi.mocked(prisma.tournamentPlayer.delete).mockResolvedValue(mockPlayer as any);

  vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.tournamentTeamInvitation.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentTeamInvitation.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentTeamInvitation.create).mockResolvedValue(mockInvitation as any);
  vi.mocked(prisma.tournamentTeamInvitation.update).mockResolvedValue(mockInvitation as any);
  vi.mocked(prisma.tournamentTeamInvitation.delete).mockResolvedValue(mockInvitation as any);

  vi.mocked(prisma.tournamentNotification.create).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentNotification.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentNotification.count).mockResolvedValue(0);

  vi.mocked(prisma.tournamentAdminRole.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentAdminRole.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentAdminRole.create).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentAdminRole.delete).mockResolvedValue({} as any);

  vi.mocked(prisma.tournamentCategory.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentCategory.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentCategory.create).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentCategory.update).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentCategory.delete).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentCategory.count).mockResolvedValue(0);

  vi.mocked(prisma.groupMember.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.groupMember.findMany).mockResolvedValue([]);

  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.user.findMany).mockResolvedValue([]);
});

// ═══════════════════════════════════════════════════════════════════════════════
// TOURNAMENT CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/tournaments (createTournament)', () => {
  const validBody = {
    name: 'Summer Cup',
    sportType: 'soccer',
    format: 'single_elimination',
    startDate: '2025-12-01T10:00:00Z',
  };

  it('returns 201 with valid payload', async () => {
    vi.mocked(prisma.tournament.create).mockResolvedValue(mockTournament as any);

    const res = await request(app).post('/api/tournaments').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'tournament-1', name: 'Test Tournament' });
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/api/tournaments').send({
      sportType: 'soccer',
      format: 'single_elimination',
      startDate: '2025-12-01T10:00:00Z',
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when sportType is missing', async () => {
    const res = await request(app).post('/api/tournaments').send({
      name: 'Cup',
      format: 'single_elimination',
      startDate: '2025-12-01T10:00:00Z',
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when date validation fails', async () => {
    vi.mocked(tournamentService.validateTournamentDates).mockReturnValue({
      valid: false,
      error: 'End date must be after start date',
    });

    const res = await request(app).post('/api/tournaments').send({
      ...validBody,
      endDate: '2025-11-01T10:00:00Z',
    });

    expect(res.status).toBe(400);
  });

  it('returns 403 when groupId is provided but user is not group admin', async () => {
    vi.mocked(prisma.groupMember.findUnique).mockResolvedValue(null);

    const res = await request(app).post('/api/tournaments').send({
      ...validBody,
      groupId: 'group-1',
    });

    expect(res.status).toBe(403);
  });

  it('returns 201 when user is group admin', async () => {
    vi.mocked(prisma.groupMember.findUnique).mockResolvedValue({
      userId: 'test-user-id',
      groupId: 'group-1',
      role: 'admin',
    } as any);
    vi.mocked(prisma.tournament.create).mockResolvedValue(mockTournament as any);

    const res = await request(app).post('/api/tournaments').send({
      ...validBody,
      groupId: 'group-1',
    });

    expect(res.status).toBe(201);
  });
});

describe('GET /api/tournaments (getTournaments)', () => {
  it('returns 200 with paginated list of tournaments', async () => {
    vi.mocked(prisma.tournament.findMany).mockResolvedValue([mockTournament] as any);
    vi.mocked(prisma.tournament.count).mockResolvedValue(1);

    const res = await request(app).get('/api/tournaments');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1, total: 1 });
  });

  it('returns 200 with groupId filter', async () => {
    vi.mocked(prisma.tournament.findMany).mockResolvedValue([mockTournament] as any);
    vi.mocked(prisma.tournament.count).mockResolvedValue(1);

    const res = await request(app).get('/api/tournaments?groupId=group-1');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns empty data array when no tournaments found', async () => {
    vi.mocked(prisma.tournament.findMany).mockResolvedValue([]);
    vi.mocked(prisma.tournament.count).mockResolvedValue(0);

    const res = await request(app).get('/api/tournaments');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });
});

describe('GET /api/tournaments/:id (getTournament)', () => {
  it('returns 200 when tournament found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);

    const res = await request(app).get('/api/tournaments/tournament-1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'tournament-1' });
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/nonexistent');

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tournaments/:id (updateTournament)', () => {
  it('returns 200 when organizer updates tournament', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournament.update).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app).put('/api/tournaments/tournament-1').send({ name: 'Updated' });

    expect(res.status).toBe(200);
  });

  it('returns 403 when non-organizer tries to update', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app).put('/api/tournaments/tournament-1').send({ name: 'Updated' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app).put('/api/tournaments/nonexistent').send({ name: 'Updated' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/tournaments/:id (deleteTournament)', () => {
  it('returns 200 when organizer deletes tournament', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournament.delete).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app).delete('/api/tournaments/tournament-1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 403 when non-organizer tries to delete', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app).delete('/api/tournaments/tournament-1');

    expect(res.status).toBe(403);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app).delete('/api/tournaments/nonexistent');

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEAMS
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/tournaments/:id/teams (addTeam)', () => {
  it('returns 201 when team is added', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'draft',
      teams: [],
      maxTeams: null,
    } as any);
    vi.mocked(prisma.tournamentTeam.create).mockResolvedValue(mockTeam as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams')
      .send({ name: 'Team Alpha', captainName: 'Alice' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'team-1' });
  });

  it('returns 400 when team name is missing', async () => {
    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams')
      .send({ captainName: 'Alice' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams')
      .send({ name: 'Team Alpha' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when tournament has started', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
      teams: [],
    } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams')
      .send({ name: 'Team Alpha' });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/tournaments/:id/teams/:teamId (updateTeam)', () => {
  it('returns 200 when team is updated by organizer', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findUnique).mockResolvedValue(mockTeam as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.tournamentTeam.update).mockResolvedValue(mockTeam as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1')
      .send({ name: 'Updated Team' });

    expect(res.status).toBe(200);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1')
      .send({ name: 'Updated Team' });

    expect(res.status).toBe(404);
  });

  it('returns 404 when team not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1')
      .send({ name: 'Updated Team' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/tournaments/:id/teams/:teamId (deleteTeam)', () => {
  it('returns 200 when organizer deletes team', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'draft',
    } as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.tournamentTeam.delete).mockResolvedValue(mockTeam as any);

    const res = await request(app).delete('/api/tournaments/tournament-1/teams/team-1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app).delete('/api/tournaments/tournament-1/teams/team-1');

    expect(res.status).toBe(404);
  });

  it('returns 400 when tournament has started', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);

    const res = await request(app).delete('/api/tournaments/tournament-1/teams/team-1');

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BRACKETS
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/tournaments/:id/generate-brackets (generateBrackets)', () => {
  it('returns 200 on success for single_elimination format', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      format: 'single_elimination',
    } as any);
    vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(0);
    vi.mocked(tournamentService.generateSingleEliminationBrackets).mockResolvedValue({ count: 4 });
    vi.mocked(prisma.tournament.update).mockResolvedValue(mockTournament as any);

    const res = await request(app).post('/api/tournaments/tournament-1/generate-brackets').send({});

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('matchesCreated');
  });

  it('returns 400 when brackets already exist', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(4);

    const res = await request(app).post('/api/tournaments/tournament-1/generate-brackets').send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app).post('/api/tournaments/tournament-1/generate-brackets').send({});

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MATCHES
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/tournaments/:id/matches (createMatch)', () => {
  it('returns 201 when match is created', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst)
      .mockResolvedValueOnce(mockTeam as any)
      .mockResolvedValueOnce({ ...mockTeam, id: 'team-2' } as any);
    vi.mocked(prisma.tournamentMatch.create).mockResolvedValue(mockMatch as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches')
      .send({ homeTeamId: 'team-1', awayTeamId: 'team-2' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'match-1' });
  });

  it('returns 400 when home or away team is missing', async () => {
    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches')
      .send({ homeTeamId: 'team-1' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when home and away teams are the same', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches')
      .send({ homeTeamId: 'team-1', awayTeamId: 'team-1' });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/tournaments/:id/matches/:matchId (updateMatch)', () => {
  it('returns 200 when match is updated', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(mockMatch as any);
    vi.mocked(prisma.tournamentMatch.update).mockResolvedValue(mockMatch as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1')
      .send({ roundNumber: 2 });

    expect(res.status).toBe(200);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1')
      .send({ roundNumber: 2 });

    expect(res.status).toBe(404);
  });

  it('returns 404 when match not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1')
      .send({ roundNumber: 2 });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/tournaments/:id/matches/:matchId (deleteMatch)', () => {
  it('returns 200 when match is deleted', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(mockMatch as any);
    vi.mocked(prisma.tournamentMatch.delete).mockResolvedValue(mockMatch as any);

    const res = await request(app).delete('/api/tournaments/tournament-1/matches/match-1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app).delete('/api/tournaments/tournament-1/matches/match-1');

    expect(res.status).toBe(404);
  });

  it('returns 404 when match not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(null);

    const res = await request(app).delete('/api/tournaments/tournament-1/matches/match-1');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/tournaments/:id/matches/:matchId/score (submitScore)', () => {
  it('returns 200 on successful score submission', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(mockMatch as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      typeof fn === 'function' ? fn(prisma) : Promise.all(fn)
    );
    vi.mocked(prisma.tournamentMatch.update).mockResolvedValue({
      ...mockMatch,
      homeScore: 2,
      awayScore: 1,
      status: 'completed',
    } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2, awayScore: 1 });

    expect(res.status).toBe(200);
  });

  it('returns 409 when match is already completed with scores', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue({
      ...mockMatch,
      status: 'completed',
      homeScore: 2,
      awayScore: 1,
    } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 3, awayScore: 0 });

    expect(res.status).toBe(409);
  });

  it('returns 400 when scores are missing', async () => {
    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 1 });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/tournaments/:id/matches/:matchId/referee (assignReferee)', () => {
  it('returns 200 when referee is assigned', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(mockMatch as any);
    vi.mocked(prisma.tournamentMatch.update).mockResolvedValue(mockMatch as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/referee')
      .send({ refereeTeamId: null });

    expect(res.status).toBe(200);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/referee')
      .send({});

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STANDINGS
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/tournaments/:id/standings (getStandings)', () => {
  it('returns 200 with standings list', async () => {
    vi.mocked(prisma.tournamentStanding.findMany).mockResolvedValue([
      {
        id: 'standing-1',
        tournamentId: 'tournament-1',
        teamId: 'team-1',
        points: 9,
        goalsFor: 10,
        goalsAgainst: 3,
        team: mockTeam,
      } as any,
    ]);

    const res = await request(app).get('/api/tournaments/tournament-1/standings');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 200 with empty list when no standings', async () => {
    vi.mocked(prisma.tournamentStanding.findMany).mockResolvedValue([]);

    const res = await request(app).get('/api/tournaments/tournament-1/standings');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POOLS
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/tournaments/:id/pools (getPools)', () => {
  it('returns 200 with paginated pools list', async () => {
    vi.mocked(prisma.tournamentPool.findMany).mockResolvedValue([mockPool] as any);
    vi.mocked(prisma.tournamentPool.count).mockResolvedValue(1);

    const res = await request(app).get('/api/tournaments/tournament-1/pools');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1, total: 1 });
  });
});

describe('GET /api/tournaments/:id/pools/:poolId (getPoolDetails)', () => {
  it('returns 200 when pool found', async () => {
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue({
      ...mockPool,
      teams: [],
      waitlist: [],
    } as any);

    const res = await request(app).get('/api/tournaments/tournament-1/pools/pool-1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'pool-1' });
  });

  it('returns 404 when pool not found', async () => {
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/tournament-1/pools/nonexistent');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/tournaments/:id/pools (createPool)', () => {
  it('returns 201 when pool is created', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentPool.create).mockResolvedValue(mockPool as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/pools')
      .send({ name: 'Pool A', maxTeams: 4 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'pool-1', name: 'Pool A' });
  });

  it('returns 400 when name or maxTeams is missing', async () => {
    const res = await request(app)
      .post('/api/tournaments/tournament-1/pools')
      .send({ name: 'Pool A' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when maxTeams is less than 2', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/pools')
      .send({ name: 'Pool A', maxTeams: 1 });

    expect(res.status).toBe(400);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/pools')
      .send({ name: 'Pool A', maxTeams: 4 });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/tournaments/:id/pools/:poolId/teams/:teamId (registerTeamToPool)', () => {
  it('returns 200 when team is registered to pool', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'registration',
    } as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({
      ...mockTeam,
      poolId: null,
    } as any);
    vi.mocked(prisma.tournamentPoolWaitlist.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue({
      ...mockPool,
      teams: [],
      maxTeams: 4,
    } as any);
    vi.mocked(prisma.tournamentTeam.update).mockResolvedValue(mockTeam as any);

    const res = await request(app).post(
      '/api/tournaments/tournament-1/pools/pool-1/teams/team-1'
    );

    expect(res.status).toBe(200);
  });

  it('returns 201 when pool is full and team is added to waitlist', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'registration',
    } as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({
      ...mockTeam,
      poolId: null,
    } as any);
    vi.mocked(prisma.tournamentPoolWaitlist.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue({
      ...mockPool,
      teams: [mockTeam, mockTeam, mockTeam, mockTeam],
      maxTeams: 4,
    } as any);
    vi.mocked(prisma.tournamentPoolWaitlist.count).mockResolvedValue(0);
    vi.mocked(prisma.tournamentPoolWaitlist.create).mockResolvedValue({
      id: 'waitlist-1',
      poolId: 'pool-1',
      teamId: 'team-1',
      position: 1,
      pool: mockPool,
      team: mockTeam,
    } as any);

    const res = await request(app).post(
      '/api/tournaments/tournament-1/pools/pool-1/teams/team-1'
    );

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('waitlist');
  });

  it('returns 400 when tournament registration is closed', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);

    const res = await request(app).post(
      '/api/tournaments/tournament-1/pools/pool-1/teams/team-1'
    );

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/tournaments/:id/pools/:poolId/teams/:teamId (removeTeamFromPool)', () => {
  it('returns 200 when team is removed from pool', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({
      ...mockTeam,
      poolId: 'pool-1',
    } as any);
    vi.mocked(prisma.tournamentTeam.update).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPoolWaitlist.findFirst).mockResolvedValue(null);

    const res = await request(app).delete(
      '/api/tournaments/tournament-1/pools/pool-1/teams/team-1'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 404 when team not found in pool', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app).delete(
      '/api/tournaments/tournament-1/pools/pool-1/teams/team-1'
    );

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/tournaments/:id/pools/:poolId/waitlist/:teamId (removeTeamFromWaitlist)', () => {
  it('returns 200 when team is removed from waitlist', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPoolWaitlist.findFirst).mockResolvedValue({
      id: 'waitlist-1',
      poolId: 'pool-1',
      teamId: 'team-1',
      position: 1,
    } as any);
    vi.mocked(prisma.tournamentPoolWaitlist.delete).mockResolvedValue({} as any);
    vi.mocked(prisma.tournamentPoolWaitlist.findMany).mockResolvedValue([]);

    const res = await request(app).delete(
      '/api/tournaments/tournament-1/pools/pool-1/waitlist/team-1'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 404 when team not in waitlist', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPoolWaitlist.findFirst).mockResolvedValue(null);

    const res = await request(app).delete(
      '/api/tournaments/tournament-1/pools/pool-1/waitlist/team-1'
    );

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tournaments/:id/teams/:teamId/pool (assignTeamToPool)', () => {
  it('returns 200 when team is assigned to pool', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentTeam.update).mockResolvedValue(mockTeam as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/pool')
      .send({ poolNumber: 1, poolName: 'Pool A' });

    expect(res.status).toBe(200);
  });

  it('returns 403 when non-organizer tries to assign', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/pool')
      .send({ poolNumber: 1 });

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/tournaments/:id/teams/:teamId/players (addPlayer)', () => {
  it('returns 201 when player is added', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.tournamentPlayer.create).mockResolvedValue(mockPlayer as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/team-1/players')
      .send({ playerName: 'John Doe', playerEmail: 'john@example.com' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'player-1' });
  });

  it('returns 400 when playerName is missing', async () => {
    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/team-1/players')
      .send({ playerEmail: 'john@example.com' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/team-1/players')
      .send({ playerName: 'John Doe' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/tournaments/:id/teams/:teamId/players (getPlayers)', () => {
  it('returns 200 with players list', async () => {
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPlayer.findMany).mockResolvedValue([mockPlayer] as any);

    const res = await request(app).get('/api/tournaments/tournament-1/teams/team-1/players');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 404 when team not found', async () => {
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/tournament-1/teams/team-1/players');

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tournaments/:id/teams/:teamId/players/:playerId (updatePlayer)', () => {
  it('returns 200 when player is updated', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPlayer.findUnique).mockResolvedValue(mockPlayer as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.tournamentPlayer.update).mockResolvedValue(mockPlayer as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/players/player-1')
      .send({ playerName: 'Jane Doe' });

    expect(res.status).toBe(200);
  });

  it('returns 404 when player not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPlayer.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/players/player-1')
      .send({ playerName: 'Jane Doe' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/tournaments/:id/teams/:teamId/players/:playerId (removePlayer)', () => {
  it('returns 200 when player is removed', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPlayer.findUnique).mockResolvedValue(mockPlayer as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.tournamentPlayer.delete).mockResolvedValue(mockPlayer as any);

    const res = await request(app).delete(
      '/api/tournaments/tournament-1/teams/team-1/players/player-1'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 404 when player not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPlayer.findUnique).mockResolvedValue(null);

    const res = await request(app).delete(
      '/api/tournaments/tournament-1/teams/team-1/players/player-1'
    );

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INVITATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/tournaments/:id/teams/:teamId/invitations (sendTeamInvitation)', () => {
  it('returns 201 when invitation is sent', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(tournamentService.canManageTeamInvitations).mockResolvedValue(true);
    vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentTeamInvitation.findFirst).mockResolvedValue(null);
    vi.mocked(tournamentService.createTeamInvitation).mockResolvedValue(mockInvitation as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/team-1/invitations')
      .send({ inviteeEmail: 'invitee@example.com', inviteeName: 'Invitee Person' });

    expect(res.status).toBe(201);
  });

  it('returns 400 when inviteeEmail is missing', async () => {
    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/team-1/invitations')
      .send({ inviteeName: 'Invitee Person' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when invitation already exists for email', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(tournamentService.canManageTeamInvitations).mockResolvedValue(true);
    vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentTeamInvitation.findFirst).mockResolvedValue(mockInvitation as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/team-1/invitations')
      .send({ inviteeEmail: 'invitee@example.com' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/tournaments/:id/teams/:teamId/invitations (getTeamInvitations)', () => {
  it('returns 200 with invitations list', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(tournamentService.canManageTeamInvitations).mockResolvedValue(true);
    vi.mocked(tournamentService.getTeamInvitations).mockResolvedValue([mockInvitation] as any);

    const res = await request(app).get(
      '/api/tournaments/tournament-1/teams/team-1/invitations'
    );

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/tournaments/invitations/my (getUserInvitations)', () => {
  it('returns 200 with user invitations', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
    } as any);
    vi.mocked(tournamentService.getUserPendingInvitations).mockResolvedValue([mockInvitation] as any);

    const res = await request(app).get('/api/tournaments/invitations/my');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 404 when user not found', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/invitations/my');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/tournaments/invitations/:inviteToken/accept (acceptTeamInvitation)', () => {
  it('returns 200 when invitation is accepted', async () => {
    vi.mocked(tournamentService.acceptTeamInvitation).mockResolvedValue({
      id: 'inv-1',
      teamId: 'team-1',
      team: { id: 'team-1', name: 'Team Alpha' },
    } as any);

    const res = await request(app).post('/api/tournaments/invitations/token-abc/accept');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });
});

describe('POST /api/tournaments/invitations/:inviteToken/decline (declineTeamInvitation)', () => {
  it('returns 200 when invitation is declined', async () => {
    vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValue({
      ...mockInvitation,
      status: 'pending',
      inviteeEmail: 'test@example.com',
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
    } as any);
    vi.mocked(prisma.tournamentTeamInvitation.update).mockResolvedValue(mockInvitation as any);

    const res = await request(app).post('/api/tournaments/invitations/token-abc/decline');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 404 when invitation not found', async () => {
    vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValue(null);

    const res = await request(app).post('/api/tournaments/invitations/token-abc/decline');

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/tournaments/:id/teams/:teamId/invitations/:invitationId (cancelTeamInvitation)', () => {
  it('returns 200 when invitation is cancelled', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValue({
      ...mockInvitation,
      teamId: 'team-1',
    } as any);
    vi.mocked(tournamentService.canManageTeamInvitations).mockResolvedValue(true);
    vi.mocked(tournamentService.cancelTeamInvitation).mockResolvedValue(undefined);

    const res = await request(app).delete(
      '/api/tournaments/tournament-1/teams/team-1/invitations/inv-1'
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 403 when user cannot manage invitations', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValue({
      ...mockInvitation,
      teamId: 'team-1',
    } as any);
    vi.mocked(tournamentService.canManageTeamInvitations).mockResolvedValue(false);

    const res = await request(app).delete(
      '/api/tournaments/tournament-1/teams/team-1/invitations/inv-1'
    );

    expect(res.status).toBe(403);
  });

  it('returns 404 when invitation not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValue(null);

    const res = await request(app).delete(
      '/api/tournaments/tournament-1/teams/team-1/invitations/inv-1'
    );

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NEW ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/tournaments/:id/status (updateTournamentStatus)', () => {
  it('returns 200 on valid transition (draft → registration)', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournament.update).mockResolvedValue({ ...mockTournament, status: 'registration' } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentPool.count).mockResolvedValue(1); // pre-condition: at least 1 pool

    const res = await request(app)
      .put('/api/tournaments/tournament-1/status')
      .send({ status: 'registration' });

    expect(res.status).toBe(200);
  });

  it('returns 200 when transitioning draft → registration without pools', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournament.update).mockResolvedValue({ ...mockTournament, status: 'registration' } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/status')
      .send({ status: 'registration' });

    expect(res.status).toBe(200);
  });

  it('returns 200 on valid transition (registration → in_progress)', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({ ...mockTournament, status: 'registration' } as any);
    vi.mocked(prisma.tournament.update).mockResolvedValue({ ...mockTournament, status: 'in_progress' } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentTeam.count).mockResolvedValue(4); // pre-condition: at least 2 teams

    const res = await request(app)
      .put('/api/tournaments/tournament-1/status')
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
  });

  it('returns 400 when transitioning registration → in_progress with fewer than 2 teams', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({ ...mockTournament, status: 'registration' } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentTeam.count).mockResolvedValue(1);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/status')
      .send({ status: 'in_progress' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('at least 2 teams');
  });

  it('returns 400 for invalid status value', async () => {
    const res = await request(app)
      .put('/api/tournaments/tournament-1/status')
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for invalid transition', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({ ...mockTournament, status: 'completed' } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/status')
      .send({ status: 'registration' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Cannot transition');
  });

  it('returns 403 when non-organizer tries to update status', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/status')
      .send({ status: 'registration' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/nonexistent/status')
      .send({ status: 'registration' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/tournaments/:id/notifications (getTournamentNotifications)', () => {
  it('returns 200 with paginated notifications', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentNotification.findMany).mockResolvedValue([
      { id: 'notif-1', tournamentId: 'tournament-1', message: 'Test', createdAt: new Date() } as any,
    ]);
    vi.mocked(prisma.tournamentNotification.count).mockResolvedValue(1);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app).get('/api/tournaments/tournament-1/notifications');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1, total: 1 });
  });

  it('returns 403 when not organizer or admin', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app).get('/api/tournaments/tournament-1/notifications');

    expect(res.status).toBe(403);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/nonexistent/notifications');

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tournaments/:id/pools/:poolId (updatePool)', () => {
  it('returns 200 on success', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(mockPool as any);
    vi.mocked(prisma.tournamentPool.update).mockResolvedValue(mockPool as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/pools/pool-1')
      .send({ name: 'Updated Pool' });

    expect(res.status).toBe(200);
  });

  it('returns 403 when non-organizer', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/pools/pool-1')
      .send({ name: 'Updated Pool' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when pool not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/pools/nonexistent')
      .send({ name: 'Updated Pool' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/tournaments/:id/pools/:poolId (deletePool)', () => {
  it('returns 200 on success when pool is empty', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue({
      ...mockPool,
      _count: { teams: 0 },
    } as any);
    vi.mocked(prisma.tournamentPool.delete).mockResolvedValue(mockPool as any);

    const res = await request(app).delete('/api/tournaments/tournament-1/pools/pool-1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 400 when pool has teams', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue({
      ...mockPool,
      _count: { teams: 2 },
    } as any);

    const res = await request(app).delete('/api/tournaments/tournament-1/pools/pool-1');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('teams');
  });

  it('returns 403 when non-organizer', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app).delete('/api/tournaments/tournament-1/pools/pool-1');

    expect(res.status).toBe(403);
  });
});

describe('POST /api/tournaments/:id/teams/self-register (selfRegisterTeam)', () => {
  it('returns 201 on successful registration', async () => {
    const registeredTournament = { ...mockTournament, status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentTeam.create).mockResolvedValue({ ...mockTeam, captainUser: null } as any);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team' });

    expect(res.status).toBe(201);
  });

  it('returns 201 when registering with a category selection', async () => {
    const registeredTournament = { ...mockTournament, status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentCategory.findFirst).mockResolvedValue({
      id: 'cat-1',
      name: 'Category B',
    } as any);
    vi.mocked(prisma.tournamentTeam.create).mockResolvedValue({ ...mockTeam, captainUser: null } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team', categoryId: 'cat-1' });

    expect(res.status).toBe(201);
    expect(prisma.tournamentTeam.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          poolName: 'Category B',
        }),
      })
    );
  });

  it('returns 400 when both pool and category are provided', async () => {
    const registeredTournament = { ...mockTournament, status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team', poolId: 'pool-1', categoryId: 'cat-1' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when tournament is not in registration status', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({ ...mockTournament, status: 'in_progress' } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team' });

    expect(res.status).toBe(400);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/nonexistent/teams/self-register')
      .send({ name: 'New Team' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/tournaments/:id/teams/self-register (selfUnregisterTeam)', () => {
  it('returns 200 on successful unregister', async () => {
    const registeredTournament = { ...mockTournament, status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([mockTeam] as any);
    vi.mocked(prisma.tournamentTeam.deleteMany).mockResolvedValue({ count: 1 } as any);

    const res = await request(app)
      .delete('/api/tournaments/tournament-1/teams/self-register');

    expect(res.status).toBe(200);
    expect(prisma.tournamentTeam.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [mockTeam.id] } }
    });
  });

  it('returns 400 when user has no registered team', async () => {
    const registeredTournament = { ...mockTournament, status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([] as any);

    const res = await request(app)
      .delete('/api/tournaments/tournament-1/teams/self-register');

    expect(res.status).toBe(400);
  });

  it('removes all legacy duplicate captain teams in one unregister call', async () => {
    const registeredTournament = { ...mockTournament, status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([
      { ...mockTeam, id: 'team-1' },
      { ...mockTeam, id: 'team-2' },
    ] as any);
    vi.mocked(prisma.tournamentTeam.deleteMany).mockResolvedValue({ count: 2 } as any);

    const res = await request(app)
      .delete('/api/tournaments/tournament-1/teams/self-register');

    expect(res.status).toBe(200);
    expect(res.body.removedTeamCount).toBe(2);
    expect(prisma.tournamentTeam.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['team-1', 'team-2'] } }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

const mockCategory = {
  id: 'cat-1',
  name: 'Elite',
  description: null,
  sortOrder: 0,
  tournamentId: 'tournament-1',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('GET /api/tournaments/:id/categories (getCategories)', () => {
  it('returns 200 with paginated categories', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentCategory.findMany).mockResolvedValue([mockCategory] as any);
    vi.mocked(prisma.tournamentCategory.count).mockResolvedValue(1);

    const res = await request(app).get('/api/tournaments/tournament-1/categories');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1, total: 1 });
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/nonexistent/categories');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/tournaments/:id/categories (createCategory)', () => {
  it('returns 201 when category is created', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentCategory.create).mockResolvedValue(mockCategory as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/categories')
      .send({ name: 'Elite' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'cat-1', name: 'Elite' });
  });

  it('returns 400 when name exceeds max length', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/categories')
      .send({ name: 'A'.repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('100 characters');
  });

  it('returns 403 when user is not organizer or admin', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/categories')
      .send({ name: 'Elite' });

    expect(res.status).toBe(403);
  });

  it('returns 400 on duplicate category name', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentCategory.create).mockRejectedValue(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' })
    );

    const res = await request(app)
      .post('/api/tournaments/tournament-1/categories')
      .send({ name: 'Elite' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already exists');
  });
});

describe('PUT /api/tournaments/:id/categories/:categoryId (updateCategory)', () => {
  it('returns 200 when category is updated', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentCategory.findFirst).mockResolvedValue(mockCategory as any);
    vi.mocked(prisma.tournamentCategory.update).mockResolvedValue({ ...mockCategory, name: 'Pro' } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/categories/cat-1')
      .send({ name: 'Pro' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Pro' });
  });

  it('returns 404 when category not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentCategory.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/categories/nonexistent')
      .send({ name: 'Pro' });

    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not organizer or admin', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/categories/cat-1')
      .send({ name: 'Pro' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/tournaments/:id/categories/:categoryId (deleteCategory)', () => {
  it('returns 200 when category is deleted', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentCategory.findFirst).mockResolvedValue(mockCategory as any);
    vi.mocked(prisma.tournamentCategory.delete).mockResolvedValue(mockCategory as any);

    const res = await request(app).delete('/api/tournaments/tournament-1/categories/cat-1');

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');
  });

  it('returns 404 when category not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentCategory.findFirst).mockResolvedValue(null);

    const res = await request(app).delete('/api/tournaments/tournament-1/categories/nonexistent');

    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not organizer or admin', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app).delete('/api/tournaments/tournament-1/categories/cat-1');

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMINS
// ═══════════════════════════════════════════════════════════════════════════════

const mockAdminRole = {
  id: 'admin-role-1',
  tournamentId: 'tournament-1',
  userId: 'other-user-id',
  role: 'co_organizer',
  grantedById: 'test-user-id',
  createdAt: new Date('2025-01-01'),
  user: { id: 'other-user-id', name: 'Other User', email: 'other@example.com' },
  grantedBy: { id: 'test-user-id', name: 'Test User' },
};

const mockVerifiedUser = {
  id: 'other-user-id',
  name: 'Other User',
  email: 'other@example.com',
  emailVerified: true,
  deletedAt: null,
};

describe('GET /api/tournaments/:id/admins (getAdmins)', () => {
  it('returns 200 with admins list', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentAdminRole.findMany).mockResolvedValue([mockAdminRole] as any);

    const res = await request(app).get('/api/tournaments/tournament-1/admins');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ id: 'admin-role-1' });
  });

  it('returns 403 when not organizer or co-organizer', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app).get('/api/tournaments/tournament-1/admins');

    expect(res.status).toBe(403);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/nonexistent/admins');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/tournaments/:id/admins (addAdmin)', () => {
  it('returns 201 when admin is added by userId', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockVerifiedUser as any);
    vi.mocked(prisma.tournamentAdminRole.create).mockResolvedValue(mockAdminRole as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/admins')
      .send({ userId: 'other-user-id' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'admin-role-1' });
  });

  it('returns 201 when admin is added by email', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(mockVerifiedUser as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockVerifiedUser as any);
    vi.mocked(prisma.tournamentAdminRole.create).mockResolvedValue(mockAdminRole as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/admins')
      .send({ email: 'other@example.com' });

    expect(res.status).toBe(201);
  });

  it('returns 400 when user email is not verified', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...mockVerifiedUser, emailVerified: false } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/admins')
      .send({ userId: 'other-user-id' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('unverified email');
  });

  it('returns 400 when no userId or email provided', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/admins')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 403 when not organizer', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(false);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/admins')
      .send({ userId: 'other-user-id' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/tournaments/:id/admins/:adminUserId (removeAdmin)', () => {
  it('returns 200 when admin is removed', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.tournamentAdminRole.findFirst).mockResolvedValue(mockAdminRole as any);
    vi.mocked(prisma.tournamentAdminRole.delete).mockResolvedValue(mockAdminRole as any);

    const res = await request(app).delete('/api/tournaments/tournament-1/admins/other-user-id');

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('removed');
  });

  it('returns 400 when trying to remove organizer from admin roles', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);

    // Attempting to remove the organizer themselves (organizerId === test-user-id)
    const res = await request(app).delete('/api/tournaments/tournament-1/admins/test-user-id');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('organizer');
  });

  it('returns 404 when admin role not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.tournamentAdminRole.findFirst).mockResolvedValue(null);

    const res = await request(app).delete('/api/tournaments/tournament-1/admins/other-user-id');

    expect(res.status).toBe(404);
  });

  it('returns 403 when not organizer', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(false);

    const res = await request(app).delete('/api/tournaments/tournament-1/admins/other-user-id');

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC TOURNAMENTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/tournaments/public (getPublicTournaments)', () => {
  it('returns 200 with paginated public tournaments', async () => {
    vi.mocked(prisma.tournament.findMany).mockResolvedValue([{ ...mockTournament, isPublic: true }] as any);
    vi.mocked(prisma.tournament.count).mockResolvedValue(1);

    const res = await request(app).get('/api/tournaments/public');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1, total: 1 });
  });

  it('respects page and limit query params', async () => {
    vi.mocked(prisma.tournament.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.tournament.count).mockResolvedValue(25);

    const res = await request(app).get('/api/tournaments/public?page=2&limit=10');

    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 2, limit: 10, total: 25 });
  });

  it('returns empty data array when no public tournaments found', async () => {
    vi.mocked(prisma.tournament.findMany).mockResolvedValue([]);
    vi.mocked(prisma.tournament.count).mockResolvedValue(0);

    const res = await request(app).get('/api/tournaments/public');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('filters by sportType when provided', async () => {
    vi.mocked(prisma.tournament.findMany).mockResolvedValue([mockTournament] as any);
    vi.mocked(prisma.tournament.count).mockResolvedValue(1);

    const res = await request(app).get('/api/tournaments/public?sportType=soccer');

    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGN POOL TO CATEGORY
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/tournaments/:id/pools/:poolId/category (assignPoolToCategory)', () => {
  it('returns 200 when pool is assigned to a category', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(mockPool as any);
    vi.mocked(prisma.tournamentCategory.findFirst).mockResolvedValue(mockCategory as any);
    vi.mocked(prisma.tournamentPool.update).mockResolvedValue({
      ...mockPool,
      categoryId: 'cat-1',
      category: { id: 'cat-1', name: 'Elite' },
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/pools/pool-1/category')
      .send({ categoryId: 'cat-1' });

    expect(res.status).toBe(200);
    expect(res.body.categoryId).toBe('cat-1');
  });

  it('returns 200 when pool category is cleared (null categoryId)', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(mockPool as any);
    vi.mocked(prisma.tournamentPool.update).mockResolvedValue({
      ...mockPool,
      categoryId: null,
      category: null,
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/pools/pool-1/category')
      .send({ categoryId: null });

    expect(res.status).toBe(200);
  });

  it('returns 404 when pool not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/pools/nonexistent/category')
      .send({ categoryId: 'cat-1' });

    expect(res.status).toBe(404);
  });

  it('returns 404 when category not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(mockPool as any);
    vi.mocked(prisma.tournamentCategory.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/pools/pool-1/category')
      .send({ categoryId: 'nonexistent-cat' });

    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not organizer or admin', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/pools/pool-1/category')
      .send({ categoryId: 'cat-1' });

    expect(res.status).toBe(403);
  });
});
