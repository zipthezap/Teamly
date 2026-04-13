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
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tournamentTeam: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
    },
    tournamentAdminRole: {
      findFirst: vi.fn(),
    },
    groupMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
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
  vi.mocked(prisma.tournament.create).mockResolvedValue(mockTournament as any);
  vi.mocked(prisma.tournament.update).mockResolvedValue(mockTournament as any);
  vi.mocked(prisma.tournament.delete).mockResolvedValue(mockTournament as any);

  vi.mocked(prisma.tournamentTeam.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentTeam.create).mockResolvedValue(mockTeam as any);
  vi.mocked(prisma.tournamentTeam.update).mockResolvedValue(mockTeam as any);
  vi.mocked(prisma.tournamentTeam.delete).mockResolvedValue(mockTeam as any);

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
  vi.mocked(prisma.tournamentAdminRole.findFirst).mockResolvedValue(null);

  vi.mocked(prisma.groupMember.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.groupMember.findMany).mockResolvedValue([]);

  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
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
  it('returns 200 with list of tournaments', async () => {
    vi.mocked(prisma.tournament.findMany).mockResolvedValue([mockTournament] as any);

    const res = await request(app).get('/api/tournaments');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 200 with groupId filter', async () => {
    vi.mocked(prisma.tournament.findMany).mockResolvedValue([mockTournament] as any);

    const res = await request(app).get('/api/tournaments?groupId=group-1');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns empty array when no tournaments found', async () => {
    vi.mocked(prisma.tournament.findMany).mockResolvedValue([]);

    const res = await request(app).get('/api/tournaments');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
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
  it('returns 200 with pools list', async () => {
    vi.mocked(prisma.tournamentPool.findMany).mockResolvedValue([mockPool] as any);

    const res = await request(app).get('/api/tournaments/tournament-1/pools');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
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
  it('returns 200 on valid transition', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournament.update).mockResolvedValue({ ...mockTournament, status: 'registration' } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/status')
      .send({ status: 'registration' });

    expect(res.status).toBe(200);
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
  it('returns 200 with notifications list', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentNotification.findMany).mockResolvedValue([
      { id: 'notif-1', tournamentId: 'tournament-1', message: 'Test', createdAt: new Date() } as any,
    ]);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app).get('/api/tournaments/tournament-1/notifications');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
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
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(false);

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
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(false);

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
