import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createAuthenticatedTestApp, createTestApp } from '../helpers/testApp';

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

vi.mock('../../services/notificationFactory', () => ({
  NotificationFactory: {
    createTournamentNotifications: vi.fn().mockResolvedValue(undefined),
  }
}));

vi.mock('../../services/permissionService', () => ({
  clearUserPermissionCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config/database', () => ({
  default: {
    tournament: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    tournamentMatch: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    tournamentStanding: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
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
      updateMany: vi.fn(),
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
      createMany: vi.fn(),
      findFirst: vi.fn(),
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
    tournamentRegistrationWaitlist: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    tournamentScoreDispute: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    tournamentAnnouncement: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    tournamentRegistrationField: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tournamentTeamAnswer: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    tournamentPlayerStat: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    tournamentCourt: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tournamentCourtAvailability: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    tournamentMatchIncident: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tournamentPaymentTransaction: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../services/tournamentService', () => ({
  sanitizeTournamentData: vi.fn((d: any) => d),
  validateTournamentDates: vi.fn(() => ({ valid: true })),
  validateTournamentEnums: vi.fn(),
  validateTournamentBusinessRules: vi.fn(),
  validateRegistrationEligibility: vi.fn((tournament: any) => {
    if (tournament?.status !== 'draft' && tournament?.status !== 'registration') {
      throw new BadRequestError('Tournament registration is closed');
    }
  }),
  isOrganizer: vi.fn(() => true),
  isOrganizerOrAdmin: vi.fn().mockResolvedValue(true),
  isTeamCaptain: vi.fn().mockResolvedValue(false),
  canSubmitScore: vi.fn().mockResolvedValue(true),
  canManageTeamInvitations: vi.fn().mockResolvedValue(true),
  computeAutoStatus: vi.fn(() => null),
  generateSingleEliminationBrackets: vi.fn().mockResolvedValue({ count: 4 }),
  generateDoubleEliminationBrackets: vi.fn().mockResolvedValue({ count: 7 }),
  generateRandomizedSingleEliminationBracketsFromPools: vi.fn().mockResolvedValue({ count: 4 }),
  generateRoundRobinBrackets: vi.fn().mockResolvedValue({ count: 6 }),
  generateGroupsKnockoutBrackets: vi.fn().mockResolvedValue({ count: 8 }),
  generateKnockoutFromStandings: vi.fn().mockResolvedValue({ count: 4 }),
  updateStandings: vi.fn().mockResolvedValue(undefined),
  revertStandings: vi.fn().mockResolvedValue(undefined),
  advanceWinners: vi.fn().mockResolvedValue(undefined),
  calculateVolleyballWinner: vi.fn(() => ({ isValid: true, homeWins: 2, awayWins: 1 })),
  validateSportSpecificScore: vi.fn(),
  buildRosterWithCaptain: vi.fn((team: any, players: any[]) => players),
  syncTournamentAutoStatus: vi.fn((t: any) => Promise.resolve(t)),
  reconcileTournamentLifecycleStatus: vi.fn().mockResolvedValue(undefined),
  sendTournamentCompletionNotifications: vi.fn().mockResolvedValue(undefined),
  invalidateSyncCache: vi.fn(),
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
  sortStandingsByTiebreakerRules: vi.fn((standings: any[], _rules?: string[] | null) => standings),
}));

vi.mock('../../utils/emailService', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// ─── Imports after mocks ───────────────────────────────────────────────────────

import prisma from '../../config/database';
import tournamentRoutes from '../../routes/tournamentRoutes';
import * as tournamentService from '../../services/tournamentService';
import { NotificationFactory } from '../../services/notificationFactory';
import { BadRequestError } from '../../utils/errors';

// ─── Test app ─────────────────────────────────────────────────────────────────

const app = createAuthenticatedTestApp(tournamentRoutes, 'test-user-id', '/api/tournaments');
const unauthenticatedApp = createTestApp(tournamentRoutes, '/api/tournaments');

// ─── Shared mock data ─────────────────────────────────────────────────────────

const futureTournamentStartDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const mockTournament = {
  id: 'tournament-1',
  name: 'Test Tournament',
  description: 'A test tournament',
  sportType: 'football',
  format: 'single_elimination',
  status: 'draft',
  startDate: futureTournamentStartDate,
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
  vi.mocked(tournamentService.validateTournamentEnums).mockImplementation(() => undefined);
  vi.mocked(tournamentService.validateTournamentBusinessRules).mockImplementation(() => undefined);
  vi.mocked(tournamentService.validateRegistrationEligibility).mockImplementation((tournament: any) => {
    if (tournament?.status !== 'draft' && tournament?.status !== 'registration') {
      throw new BadRequestError('Tournament registration is closed');
    }
  });
  vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
  vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
  vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(false);
  vi.mocked(tournamentService.canSubmitScore).mockResolvedValue(true);
  vi.mocked(tournamentService.canManageTeamInvitations).mockResolvedValue(true);
  vi.mocked(tournamentService.computeAutoStatus).mockReturnValue(null);
  vi.mocked(tournamentService.generateSingleEliminationBrackets).mockResolvedValue({ count: 4 });
  vi.mocked(tournamentService.generateRoundRobinBrackets).mockResolvedValue({ count: 6 });
  vi.mocked(tournamentService.generateGroupsKnockoutBrackets).mockResolvedValue({ count: 8 });
  vi.mocked(tournamentService.generateKnockoutFromStandings).mockResolvedValue({ count: 4 });
  vi.mocked(tournamentService.updateStandings).mockResolvedValue(undefined);
  vi.mocked(tournamentService.revertStandings).mockResolvedValue(undefined);
  vi.mocked(tournamentService.advanceWinners).mockResolvedValue(undefined);
  vi.mocked(tournamentService.validateSportSpecificScore).mockImplementation(() => undefined);
  vi.mocked(tournamentService.buildRosterWithCaptain).mockImplementation((team: any, players: any[]) => {
    // Implement the real captain-prepend logic so tests can assert on it
    if (team.captainUser && !players.some((p: any) => p.user?.id === team.captainUser!.id)) {
      const captain = team.captainUser;
      const synthetic = {
        id: `captain:${captain.id}`,
        teamId: team.id,
        playerName: captain.name ?? null,
        createdAt: team.createdAt,
        user: { id: captain.id, name: captain.name, email: captain.email },
      };
      return [synthetic, ...players];
    }
    return players;
  });
  vi.mocked(tournamentService.syncTournamentAutoStatus).mockImplementation((t: any) => Promise.resolve(t));
  vi.mocked(tournamentService.reconcileTournamentLifecycleStatus).mockResolvedValue(undefined);
  vi.mocked(tournamentService.invalidateSyncCache).mockImplementation(() => undefined);
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
  vi.mocked(prisma.tournament.findFirst).mockResolvedValue(null);
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
  vi.mocked(prisma.tournamentTeam.updateMany).mockResolvedValue({ count: 1 } as any);
  vi.mocked(prisma.tournamentTeam.delete).mockResolvedValue(mockTeam as any);
  vi.mocked(prisma.tournamentTeam.deleteMany).mockResolvedValue({ count: 1 } as any);

  vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.tournamentMatch.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(0);
  vi.mocked(prisma.tournamentMatch.create).mockResolvedValue(mockMatch as any);
  vi.mocked(prisma.tournamentMatch.updateMany).mockResolvedValue({ count: 1 } as any);
  vi.mocked(prisma.tournamentMatch.update).mockResolvedValue(mockMatch as any);
  vi.mocked(prisma.tournamentMatch.delete).mockResolvedValue(mockMatch as any);
  vi.mocked(prisma.tournamentMatch.deleteMany).mockResolvedValue({ count: 0 } as any);

  vi.mocked(prisma.tournamentStanding.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentStanding.deleteMany).mockResolvedValue({ count: 0 } as any);

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
  vi.mocked(prisma.tournamentPoolWaitlist.updateMany).mockResolvedValue({ count: 0 } as any);
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
  vi.mocked(prisma.tournamentNotification.createMany).mockResolvedValue({ count: 0 } as any);
  vi.mocked(prisma.tournamentNotification.findFirst).mockResolvedValue(null);
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

  vi.mocked(prisma.tournamentRegistrationWaitlist.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentRegistrationWaitlist.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentRegistrationWaitlist.count).mockResolvedValue(0);
  vi.mocked(prisma.tournamentRegistrationWaitlist.create).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentRegistrationWaitlist.delete).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentRegistrationWaitlist.updateMany).mockResolvedValue({ count: 0 } as any);

  vi.mocked(prisma.tournamentScoreDispute.create).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentScoreDispute.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentScoreDispute.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.tournamentScoreDispute.update).mockResolvedValue({} as any);

  vi.mocked(prisma.tournamentAnnouncement.create).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentAnnouncement.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentAnnouncement.count).mockResolvedValue(0);

  vi.mocked(prisma.tournamentRegistrationField.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentRegistrationField.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentRegistrationField.create).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentRegistrationField.update).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentRegistrationField.delete).mockResolvedValue({} as any);

  vi.mocked(prisma.tournamentTeamAnswer.upsert).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentTeamAnswer.findMany).mockResolvedValue([]);

  vi.mocked(prisma.tournamentPlayerStat.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentPlayerStat.upsert).mockResolvedValue({} as any);

  vi.mocked(prisma.tournamentCourt.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentCourt.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentCourt.create).mockResolvedValue({ id: 'court-1', name: 'Court 1', tournamentId: 'tournament-1', isActive: true } as any);
  vi.mocked(prisma.tournamentCourt.update).mockResolvedValue({ id: 'court-1', name: 'Court 1', tournamentId: 'tournament-1', isActive: true } as any);
  vi.mocked(prisma.tournamentCourt.delete).mockResolvedValue({ id: 'court-1', name: 'Court 1', tournamentId: 'tournament-1', isActive: true } as any);

  vi.mocked(prisma.tournamentCourtAvailability.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentCourtAvailability.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentCourtAvailability.create).mockResolvedValue({ id: 'availability-1', courtId: 'court-1' } as any);
  vi.mocked(prisma.tournamentCourtAvailability.delete).mockResolvedValue({ id: 'availability-1', courtId: 'court-1' } as any);

  vi.mocked(prisma.tournamentMatchIncident.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentMatchIncident.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentMatchIncident.create).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentMatchIncident.update).mockResolvedValue({} as any);

  vi.mocked(prisma.tournamentPaymentTransaction.findMany).mockResolvedValue([]);
  vi.mocked(prisma.tournamentPaymentTransaction.create).mockResolvedValue({} as any);
  vi.mocked(prisma.tournamentPaymentTransaction.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.tournamentPaymentTransaction.update).mockResolvedValue({} as any);
});

// ═══════════════════════════════════════════════════════════════════════════════
// TOURNAMENT CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/tournaments (createTournament)', () => {
  const validBody = {
    name: 'Summer Cup',
    sportType: 'football',
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
      sportType: 'football',
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

  it('returns 400 when enum validation fails', async () => {
    vi.mocked(tournamentService.validateTournamentEnums).mockImplementationOnce(() => {
      throw new BadRequestError('Invalid format');
    });

    const res = await request(app).post('/api/tournaments').send({
      ...validBody,
      format: 'not_a_real_format',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid format');
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

  it('accepts zero coordinates (0,0)', async () => {
    vi.mocked(prisma.tournament.create).mockResolvedValue({
      ...mockTournament,
      latitude: 0,
      longitude: 0,
    } as any);

    const res = await request(app).post('/api/tournaments').send({
      ...validBody,
      latitude: 0,
      longitude: 0,
    });

    expect(res.status).toBe(201);
    expect(prisma.tournament.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          latitude: 0,
          longitude: 0,
        }),
      })
    );
  });

  it('ignores partial coordinates when only latitude is provided', async () => {
    vi.mocked(prisma.tournament.create).mockResolvedValue(mockTournament as any);

    const res = await request(app).post('/api/tournaments').send({
      ...validBody,
      latitude: 10,
    });

    expect(res.status).toBe(201);
    expect(prisma.tournament.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          latitude: undefined,
          longitude: undefined,
        }),
      })
    );
  });

  it('accepts tennis sportConfig type', async () => {
    vi.mocked(prisma.tournament.create).mockResolvedValue(mockTournament as any);

    const res = await request(app).post('/api/tournaments').send({
      ...validBody,
      sportConfig: {
        type: 'tennis',
        bestOfSets: 3,
        gamesPerSet: 6,
        tiebreakPoints: 7,
        decidingSetType: 'advantage',
      },
    });

    expect(res.status).toBe(201);
  });

  it('persists advanced tournament policy settings', async () => {
    vi.mocked(prisma.tournament.create).mockResolvedValue(mockTournament as any);

    const res = await request(app).post('/api/tournaments').send({
      ...validBody,
      timezone: 'Europe/Berlin',
      noShowGraceMinutes: 10,
      noShowAutoForfeit: true,
      forfeitScoreFor: 3,
      forfeitScoreAgainst: 0,
      minTeamRestMinutes: 20,
      autoPromoteRegistrationWaitlist: true,
      rescheduleCutoffMinutes: 30,
      allowRescheduleAfterStart: true,
      seedingPolicy: 'random',
      enableThirdPlaceMatch: false,
      allowByes: false,
      contingencyMode: 'delayed',
      contingencyDelayMinutes: 15,
    });

    expect(res.status).toBe(201);
    expect(prisma.tournament.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          timezone: 'Europe/Berlin',
          noShowGraceMinutes: 10,
          noShowAutoForfeit: true,
          forfeitScoreFor: 3,
          forfeitScoreAgainst: 0,
          minTeamRestMinutes: 20,
          seedingPolicy: 'random',
          allowByes: false,
          contingencyMode: 'delayed',
        }),
      })
    );
  });

  it('returns 400 for invalid timezone policy value', async () => {
    const res = await request(app).post('/api/tournaments').send({
      ...validBody,
      timezone: 'Not/A Timezone',
    });

    expect(res.status).toBe(400);
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

  it('auto-updates tournament status when computeAutoStatus returns a new status', async () => {
    vi.mocked(prisma.tournament.findMany).mockResolvedValue([mockTournament] as any);
    vi.mocked(prisma.tournament.count).mockResolvedValue(1);
    vi.mocked(tournamentService.syncTournamentAutoStatus).mockResolvedValue({
      ...mockTournament,
      status: 'registration',
    } as any);

    const res = await request(app).get('/api/tournaments');

    expect(res.status).toBe(200);
    expect(vi.mocked(tournamentService.syncTournamentAutoStatus)).toHaveBeenCalled();
    expect(res.body.data[0].status).toBe('registration');
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

  it('auto-updates tournament status for single tournament when needed', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.syncTournamentAutoStatus).mockResolvedValue({
      ...mockTournament,
      status: 'registration',
    } as any);

    const res = await request(app).get('/api/tournaments/tournament-1');

    expect(res.status).toBe(200);
    expect(vi.mocked(tournamentService.syncTournamentAutoStatus)).toHaveBeenCalled();
    expect(res.body.status).toBe('registration');
  });

  it('returns 403 when non-participant accesses a private tournament', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      isPublic: false,
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/tournament-1');

    expect(res.status).toBe(403);
  });

  it('applies configured tournament tiebreaker rules when returning detail standings', async () => {
    const rawStandings = [
      { teamId: 'team-1', points: 3, wins: 1, goalsFor: 2, goalsAgainst: 1 },
      { teamId: 'team-2', points: 3, wins: 2, goalsFor: 2, goalsAgainst: 1 },
    ];
    const sortedStandings = [rawStandings[1], rawStandings[0]];
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      tiebreakerRules: ['wins', 'goal_difference'],
      standings: rawStandings,
    } as any);
    vi.mocked(tournamentService.sortStandingsByTiebreakerRules).mockReturnValueOnce(sortedStandings as any);

    const res = await request(app).get('/api/tournaments/tournament-1');

    expect(res.status).toBe(200);
    expect(res.body.standings).toEqual(sortedStandings);
    expect(tournamentService.sortStandingsByTiebreakerRules).toHaveBeenCalledWith(
      expect.any(Array),
      ['wins', 'goal_difference']
    );
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

  it('returns 400 when trying to update status via generic update endpoint', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1')
      .send({ status: 'registration' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('system-managed');
  });

  it('returns 400 when trying to edit a completed tournament', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'completed',
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1')
      .send({ name: 'Updated' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cannot be edited');
    expect(vi.mocked(prisma.tournament.update)).not.toHaveBeenCalled();
  });

  it('returns 400 when trying to edit a tournament that has already started', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'registration',
      startDate: new Date(Date.now() - 60_000),
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1')
      .send({ name: 'Updated' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('before they start');
    expect(vi.mocked(prisma.tournament.update)).not.toHaveBeenCalled();
  });

  it('returns 400 when forfeit scores are invalid', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1')
      .send({ forfeitScoreFor: 0, forfeitScoreAgainst: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('forfeitScoreFor');
  });

  it('updates advanced seeding and contingency settings', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournament.update).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1')
      .send({
        seedingPolicy: 'random',
        allowByes: false,
        contingencyMode: 'delayed',
        contingencyDelayMinutes: 20,
      });

    expect(res.status).toBe(200);
    expect(prisma.tournament.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          seedingPolicy: 'random',
          allowByes: false,
          contingencyMode: 'delayed',
          contingencyDelayMinutes: 20,
        }),
      })
    );
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

  it('returns 400 when categories exist and addTeam request omits categoryId', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'draft',
      teams: [],
      maxTeams: null,
    } as any);
    vi.mocked(prisma.tournamentCategory.count).mockResolvedValue(1 as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams')
      .send({ name: 'Team Alpha', captainName: 'Alice' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Category selection is required');
  });
});

describe('PUT /api/tournaments/:id/teams/:teamId (updateTeam)', () => {
  it('returns 200 when team is updated by organizer', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentTeam.update).mockResolvedValue(mockTeam as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1')
      .send({ name: 'Updated Team' });

    expect(res.status).toBe(200);
  });

  it('returns 400 when captainEmail is invalid', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1')
      .send({ captainEmail: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('email');
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
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

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
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
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

  it('returns 404 when team does not belong to this tournament', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'draft',
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

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

  it('uses randomized pool teams for single_elimination when usePoolAssignments is true', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      format: 'single_elimination',
    } as any);
    vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(0);
    vi.mocked(tournamentService.generateRandomizedSingleEliminationBracketsFromPools).mockResolvedValue({ count: 4 });

    const res = await request(app)
      .post('/api/tournaments/tournament-1/generate-brackets')
      .send({ usePoolAssignments: true });

    expect(res.status).toBe(200);
    expect(vi.mocked(tournamentService.generateRandomizedSingleEliminationBracketsFromPools))
      .toHaveBeenCalledWith('tournament-1');
    expect(vi.mocked(tournamentService.generateSingleEliminationBrackets)).not.toHaveBeenCalled();
  });

  it('regenerates brackets when matches already exist and the tournament has not started', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(4);
    vi.mocked(prisma.tournamentStanding.deleteMany).mockResolvedValue({ count: 4 } as any);
    vi.mocked(prisma.tournamentMatch.deleteMany).mockResolvedValue({ count: 4 } as any);

    const res = await request(app).post('/api/tournaments/tournament-1/generate-brackets').send({});

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('regenerated');
    expect(vi.mocked(prisma.tournamentStanding.deleteMany)).toHaveBeenCalledWith({
      where: { tournamentId: 'tournament-1' },
    });
    expect(vi.mocked(prisma.tournamentMatch.deleteMany)).toHaveBeenCalledWith({
      where: { tournamentId: 'tournament-1' },
    });
  });

  it('returns 200 for double_elimination generation', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      format: 'double_elimination',
    } as any);
    vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(0);
    vi.mocked(tournamentService.generateDoubleEliminationBrackets).mockResolvedValue({ count: 7 });

    const res = await request(app).post('/api/tournaments/tournament-1/generate-brackets').send({});

    expect(res.status).toBe(200);
    expect(vi.mocked(tournamentService.generateDoubleEliminationBrackets)).toHaveBeenCalledWith(
      'tournament-1',
      expect.objectContaining({
        playoffSize: mockTournament.playoffSize,
      })
    );
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app).post('/api/tournaments/tournament-1/generate-brackets').send({});

    expect(res.status).toBe(404);
  });

  it('reconciles lifecycle status after bracket generation', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      startDate: new Date(Date.now() + 60_000),
      status: 'registration',
      format: 'single_elimination',
    } as any);
    vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(0);
    vi.mocked(tournamentService.generateSingleEliminationBrackets).mockResolvedValue({ count: 4 });

    const res = await request(app).post('/api/tournaments/tournament-1/generate-brackets').send({});

    expect(res.status).toBe(200);
    expect(vi.mocked(tournamentService.reconcileTournamentLifecycleStatus)).toHaveBeenCalledWith(
      'tournament-1',
      expect.any(String)
    );
  });

  it('allows bracket generation for an in_progress tournament (admin regeneration)', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
      startDate: new Date(Date.now() - 60_000),
      format: 'single_elimination',
    } as any);
    vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(4);
    vi.mocked(prisma.tournamentStanding.deleteMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.tournamentMatch.deleteMany).mockResolvedValue({ count: 4 } as any);
    vi.mocked(tournamentService.generateSingleEliminationBrackets).mockResolvedValue({ count: 4 });

    const res = await request(app).post('/api/tournaments/tournament-1/generate-brackets').send({});

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('regenerated');
  });

  it('returns 400 when trying to generate brackets for a completed tournament', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'completed',
      startDate: new Date(Date.now() - 60_000),
    } as any);

    const res = await request(app).post('/api/tournaments/tournament-1/generate-brackets').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('active tournaments');
    expect(vi.mocked(tournamentService.generateSingleEliminationBrackets)).not.toHaveBeenCalled();
  });

  it('returns 400 when trying to generate brackets for a cancelled tournament', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'cancelled',
      startDate: new Date(Date.now() - 60_000),
    } as any);

    const res = await request(app).post('/api/tournaments/tournament-1/generate-brackets').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('active tournaments');
    expect(vi.mocked(tournamentService.generateSingleEliminationBrackets)).not.toHaveBeenCalled();
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

  it('reconciles lifecycle status after match creation', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      startDate: new Date(Date.now() + 60_000),
      status: 'registration',
    } as any);
    vi.mocked(prisma.tournamentTeam.findFirst)
      .mockResolvedValueOnce(mockTeam as any)
      .mockResolvedValueOnce({ ...mockTeam, id: 'team-2' } as any);
    vi.mocked(prisma.tournamentMatch.create).mockResolvedValue(mockMatch as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches')
      .send({ homeTeamId: 'team-1', awayTeamId: 'team-2' });

    expect(res.status).toBe(201);
    expect(vi.mocked(tournamentService.reconcileTournamentLifecycleStatus)).toHaveBeenCalledWith(
      'tournament-1',
      expect.any(String)
    );
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

  it('reconciles lifecycle status after match update', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'registration',
      startDate: new Date(Date.now() + 60_000),
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue({
      ...mockMatch,
      status: 'completed',
      homeScore: 2,
      awayScore: 1,
    } as any);
    vi.mocked(prisma.tournamentMatch.update).mockResolvedValue({
      ...mockMatch,
      status: 'completed',
      homeScore: 2,
      awayScore: 1,
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1')
      .send({ roundNumber: 2 });

    expect(res.status).toBe(200);
    expect(vi.mocked(tournamentService.reconcileTournamentLifecycleStatus)).toHaveBeenCalledWith(
      'tournament-1',
      expect.any(String)
    );
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

  it('reconciles lifecycle status after match deletion', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'registration',
      startDate: new Date(Date.now() + 60_000),
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(mockMatch as any);
    vi.mocked(prisma.tournamentMatch.delete).mockResolvedValue(mockMatch as any);

    const res = await request(app).delete('/api/tournaments/tournament-1/matches/match-1');

    expect(res.status).toBe(200);
    expect(vi.mocked(tournamentService.reconcileTournamentLifecycleStatus)).toHaveBeenCalledWith(
      'tournament-1',
      expect.any(String)
    );
  });
});

describe('POST /api/tournaments/:id/matches/:matchId/score (submitScore)', () => {
  it('returns 200 on successful score submission', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique)
      .mockResolvedValueOnce(mockMatch as any)
      .mockResolvedValueOnce({
        ...mockMatch,
        homeScore: 2,
        awayScore: 1,
        status: 'completed',
      } as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      typeof fn === 'function' ? fn(prisma) : Promise.all(fn)
    );
    vi.mocked(prisma.tournamentMatch.updateMany).mockResolvedValue({ count: 1 } as any);

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

  it('returns 400 when scores are not whole numbers', async () => {
    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 1.5, awayScore: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('whole number');
  });

  it('returns 400 when scores exceed the supported limit', async () => {
    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 1000, awayScore: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('999 or less');
  });

  it('returns 400 for draw score in elimination format', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      format: 'single_elimination',
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue({
      ...mockMatch,
      stage: 'semi_finals',
    } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 1, awayScore: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Draws are not allowed');
  });

  it('allows draw score in round robin format', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      format: 'round_robin',
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique)
      .mockResolvedValueOnce({ ...mockMatch, stage: null } as any)
      .mockResolvedValueOnce({
        ...mockMatch,
        stage: null,
        homeScore: 1,
        awayScore: 1,
        status: 'completed',
      } as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      typeof fn === 'function' ? fn(prisma) : Promise.all(fn)
    );
    vi.mocked(prisma.tournamentMatch.updateMany).mockResolvedValue({ count: 1 } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 1, awayScore: 1 });

    expect(res.status).toBe(200);
  });

  it('reconciles lifecycle status after score submission', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique)
      .mockResolvedValueOnce(mockMatch as any)
      .mockResolvedValueOnce({
        ...mockMatch,
        homeScore: 3,
        awayScore: 1,
        status: 'completed',
      } as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      typeof fn === 'function' ? fn(prisma) : Promise.all(fn)
    );
    vi.mocked(prisma.tournamentMatch.updateMany).mockResolvedValue({ count: 1 } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 3, awayScore: 1 });

    expect(res.status).toBe(200);
    expect(vi.mocked(tournamentService.reconcileTournamentLifecycleStatus)).toHaveBeenCalledWith(
      'tournament-1',
      expect.any(String)
    );
  });

  it('returns 409 when concurrent submission already completed the match', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(mockMatch as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      typeof fn === 'function' ? fn(prisma) : Promise.all(fn)
    );
    vi.mocked(prisma.tournamentMatch.updateMany).mockResolvedValue({ count: 0 } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2, awayScore: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already been submitted');
  });

  it('sets startedAt when submitting score for a match that was not yet started', async () => {
    const beforeCall = new Date();
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    // Match has no startedAt (never started)
    vi.mocked(prisma.tournamentMatch.findUnique)
      .mockResolvedValueOnce({ ...mockMatch, startedAt: null } as any)
      .mockResolvedValueOnce({ ...mockMatch, homeScore: 1, awayScore: 0, status: 'completed', startedAt: beforeCall } as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      typeof fn === 'function' ? fn(prisma) : Promise.all(fn)
    );
    vi.mocked(prisma.tournamentMatch.updateMany).mockResolvedValue({ count: 1 } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 1, awayScore: 0 });

    expect(res.status).toBe(200);
    // updateMany must include startedAt in the data payload
    expect(prisma.tournamentMatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ startedAt: expect.any(Date) }),
      })
    );
  });

  it('notifies both team captains after score submission', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique)
      .mockResolvedValueOnce(mockMatch as any)
      .mockResolvedValueOnce({
        ...mockMatch,
        homeScore: 2,
        awayScore: 1,
        status: 'completed',
        homeTeam: { id: 'team-1', name: 'Team Alpha' },
        awayTeam: { id: 'team-2', name: 'Team Beta' },
      } as any);
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([
      { captainUserId: 'captain-1' },
      { captainUserId: 'captain-2' },
    ] as any);
    vi.mocked(prisma.tournamentMatch.updateMany).mockResolvedValue({ count: 1 } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2, awayScore: 1 });

    expect(res.status).toBe(200);
    expect(prisma.tournamentNotification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 'captain-1', type: 'score_submitted' }),
          expect.objectContaining({ userId: 'captain-2', type: 'score_submitted' }),
        ]),
      })
    );
  });
});

describe('PUT /api/tournaments/:id/matches/:matchId/score (adminUpdateScore)', () => {
  it('returns 200 when admin updates score on a scheduled match', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(mockMatch as any);
    vi.mocked(prisma.tournamentMatch.update).mockResolvedValue({
      ...mockMatch,
      homeScore: 2,
      awayScore: 1,
      status: 'completed',
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2, awayScore: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ homeScore: 2, awayScore: 1 });
  });

  it('reverts standings and re-applies when updating a completed match score', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue({
      ...mockMatch,
      status: 'completed',
      homeScore: 2,
      awayScore: 1,
      completedAt: new Date('2025-06-01'),
    } as any);
    vi.mocked(prisma.tournamentMatch.update).mockResolvedValue({
      ...mockMatch,
      homeScore: 3,
      awayScore: 0,
      status: 'completed',
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 3, awayScore: 0 });

    expect(res.status).toBe(200);
    expect(tournamentService.revertStandings).toHaveBeenCalled();
    expect(tournamentService.updateStandings).toHaveBeenCalled();
  });

  it('returns 400 when the tournament is already completed', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'completed',
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 3, awayScore: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cancelled or completed');
  });

  it('returns 400 when scores are missing', async () => {
    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when admin score overrides are not whole numbers', async () => {
    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2, awayScore: 0.5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('whole number');
  });

  it('returns 400 when admin score overrides exceed the supported limit', async () => {
    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2, awayScore: 1000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('999 or less');
  });

  it('returns 403 when user is not organizer or admin', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2, awayScore: 1 });

    expect(res.status).toBe(403);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2, awayScore: 1 });

    expect(res.status).toBe(404);
  });

  it('returns 404 when match not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2, awayScore: 1 });

    expect(res.status).toBe(404);
  });

  it('returns 400 when trying to assign a referee after the tournament has started', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'registration',
      startDate: new Date(Date.now() - 60_000),
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/referee')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('before the tournament starts');
    expect(vi.mocked(prisma.tournamentMatch.update)).not.toHaveBeenCalled();
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
// AUTO-ASSIGN REFEREES
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/tournaments/:id/matches/auto-assign-referees (autoAssignReferees)', () => {
  it('returns 200 with assigned count when matches exist', async () => {
    const team3 = { ...mockTeam, id: 'team-3', name: 'Team Gamma' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentMatch.findMany)
      .mockResolvedValueOnce([
        // match needing a referee — no scheduledAt so slot-based logic applies
        { ...mockMatch, refereeTeamId: null, scheduledAt: null, roundNumber: 1, groupName: null, stage: null, status: 'scheduled' },
      ] as any)
      .mockResolvedValueOnce([{ ...mockMatch, refereeTeamId: 'team-3', homeTeam: mockTeam, awayTeam: { ...mockTeam, id: 'team-2' }, refereeTeam: team3 }] as any);
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([
      mockTeam,
      { ...mockTeam, id: 'team-2', name: 'Team Beta' },
      team3,
    ] as any);
    vi.mocked(prisma.tournamentMatch.update).mockResolvedValue({ ...mockMatch, refereeTeamId: 'team-3' } as any);
    // groupBy mock
    (prisma.tournamentMatch as any).groupBy = vi.fn().mockResolvedValue([]);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/auto-assign-referees')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('assigned');
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/auto-assign-referees')
      .send({});

    expect(res.status).toBe(404);
  });

  it('returns 400 when fewer than 3 teams', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentMatch.findMany).mockResolvedValue([]);
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([mockTeam, { ...mockTeam, id: 'team-2' }] as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/auto-assign-referees')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 403 when user is not organizer or admin', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/auto-assign-referees')
      .send({});

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REFEREE DUTIES
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/tournaments/:id/referee-duties (getRefereeDuties)', () => {
  it('returns 200 with duty counts', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([mockTeam] as any);
    (prisma.tournamentMatch as any).groupBy = vi.fn().mockResolvedValue([]);

    const res = await request(app).get('/api/tournaments/tournament-1/referee-duties');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/tournament-1/referee-duties');

    expect(res.status).toBe(404);
  });
});



describe('GET /api/tournaments/:id/standings (getStandings)', () => {
  it('returns 200 with standings list', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
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
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentStanding.findMany).mockResolvedValue([]);

    const res = await request(app).get('/api/tournaments/tournament-1/standings');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 403 when user cannot view a private tournament standings', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      isPublic: false,
      organizerId: 'other-user-id',
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/tournament-1/standings');

    expect(res.status).toBe(403);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/tournament-1/standings');

    expect(res.status).toBe(404);
  });
});

describe('GET /api/tournaments/:id/matches (getTournamentMatches)', () => {
  it('returns 200 with paginated filtered matches', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findMany).mockResolvedValue([mockMatch] as any);
    vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/tournaments/tournament-1/matches')
      .query({ status: 'scheduled', teamId: 'team-1', page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ page: 1, total: 1 });
    expect(prisma.tournamentMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tournamentId: 'tournament-1',
          status: 'scheduled',
          OR: [{ homeTeamId: 'team-1' }, { awayTeamId: 'team-1' }],
        }),
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POOLS
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/tournaments/:id/pools (getPools)', () => {
  it('returns 200 with paginated pools list', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
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
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
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
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/tournament-1/pools/nonexistent');

    expect(res.status).toBe(404);
  });

  it('returns 403 when user cannot view a private tournament pool', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      isPublic: false,
      organizerId: 'other-user-id',
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/tournament-1/pools/pool-1');

    expect(res.status).toBe(403);
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

  it('returns 400 when tournament registration is closed for a non-admin team captain', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      organizerId: 'another-user-id',
      status: 'in_progress',
    } as any);
    // User is NOT an admin
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    // User IS the team captain
    vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(true);

    const res = await request(app).post(
      '/api/tournaments/tournament-1/pools/pool-1/teams/team-1'
    );

    expect(res.status).toBe(400);
  });

  it('returns 403 when user is not organizer, admin, or team captain', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      organizerId: 'another-user-id',
      status: 'registration',
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(false);

    const res = await request(app).post(
      '/api/tournaments/tournament-1/pools/pool-1/teams/team-1'
    );

    expect(res.status).toBe(403);
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
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

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
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
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
  it('returns 400 when userId is already a player in another team in this tournament', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst)
      .mockResolvedValueOnce(mockTeam as any)  // team exists
      .mockResolvedValueOnce(null);             // no captain conflict
    vi.mocked(tournamentService.isOrganizerOrAdmin)
      .mockResolvedValueOnce(true)              // requester is allowed
      .mockResolvedValueOnce(false);            // player is not an organizer/admin
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'player-user-1' } as any);
    vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValueOnce({ id: 'existing-player' } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/team-1/players')
      .send({ playerName: 'John Doe', userId: 'player-user-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already a player in another team/i);
  });
});

describe('GET /api/tournaments/:id/teams/:teamId/players (getPlayers)', () => {
  it('returns 200 with players list', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      id: 'tournament-1',
      organizerId: 'test-user-id',
      isPublic: true,
    } as any);
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

  it('prepends captain to players when captain has no player record', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      id: 'tournament-1',
      organizerId: 'test-user-id',
      isPublic: true,
    } as any);
    const teamWithCaptain = {
      ...mockTeam,
      captainUserId: 'captain-1',
      captainUser: { id: 'captain-1', name: 'Alice Captain', email: 'alice.captain@example.com' },
    };

    // Players do not include the captain
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(teamWithCaptain as any);
    vi.mocked(prisma.tournamentPlayer.findMany).mockResolvedValue([mockPlayer] as any);

    const res = await request(app).get('/api/tournaments/tournament-1/teams/team-1/players');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0].user.id).toBe('captain-1');
    expect((res.body[0].id as string).startsWith('captain:')).toBe(true);
  });

  it('does not duplicate captain when captain already in players list', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      id: 'tournament-1',
      organizerId: 'test-user-id',
      isPublic: true,
    } as any);
    const teamWithCaptain = {
      ...mockTeam,
      captainUserId: 'cap-2',
      captainUser: { id: 'cap-2', name: 'Cap Two', email: 'cap.two@example.com' },
    };
    const playerWithUser = { ...mockPlayer, user: { id: 'cap-2', name: 'Cap Two', email: 'cap.two@example.com' }, userId: 'cap-2' };

    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(teamWithCaptain as any);
    vi.mocked(prisma.tournamentPlayer.findMany).mockResolvedValue([playerWithUser] as any);

    const res = await request(app).get('/api/tournaments/tournament-1/teams/team-1/players');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].user.id).toBe('cap-2');
  });

  it('returns 403 for private tournaments without authentication', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      id: 'tournament-1',
      organizerId: 'organizer-1',
      isPublic: false,
    } as any);

    const res = await request(unauthenticatedApp).get('/api/tournaments/tournament-1/teams/team-1/players');

    expect(res.status).toBe(403);
  });

  it('redacts player email fields for unauthenticated public requests', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      id: 'tournament-1',
      organizerId: 'organizer-1',
      isPublic: true,
    } as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({
      ...mockTeam,
      captainUser: { id: 'captain-1', name: 'Alice Captain' },
    } as any);
    vi.mocked(prisma.tournamentPlayer.findMany).mockResolvedValue([
      {
        ...mockPlayer,
        user: { id: 'player-user-1', name: 'Player One' },
      },
    ] as any);

    const res = await request(unauthenticatedApp).get('/api/tournaments/tournament-1/teams/team-1/players');

    expect(res.status).toBe(200);
    expect(res.body[0].user.email).toBeUndefined();
  });
});

describe('PUT /api/tournaments/:id/teams/:teamId/players/:playerId (updatePlayer)', () => {
  it('returns 200 when player is updated', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPlayer.findUnique).mockResolvedValue(mockPlayer as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
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
  it('returns 400 when new userId is already a player in another team in this tournament', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst)
      .mockResolvedValueOnce(mockTeam as any)  // team exists
      .mockResolvedValueOnce(null);             // no captain conflict
    vi.mocked(prisma.tournamentPlayer.findUnique).mockResolvedValue(mockPlayer as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin)
      .mockResolvedValueOnce(true)              // requester is allowed
      .mockResolvedValueOnce(false);            // new user is not an organizer/admin
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'player-user-2', deletedAt: null } as any);
    vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValueOnce({ id: 'other-player' } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/players/player-1')
      .send({ userId: 'player-user-2' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already a player in another team/i);
  });
});

describe('DELETE /api/tournaments/:id/teams/:teamId/players/:playerId (removePlayer)', () => {
  it('returns 200 when player is removed', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({
      ...mockTeam,
      _count: { players: 1 },
    } as any);
    vi.mocked(prisma.tournamentPlayer.findUnique).mockResolvedValue(mockPlayer as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
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

  it('notifies captain when invitation is accepted and captain exists', async () => {
    vi.mocked(tournamentService.acceptTeamInvitation).mockResolvedValue({
      id: 'inv-1',
      teamId: 'team-1',
      team: { id: 'team-1', name: 'Team Alpha' },
    } as any);

    vi.mocked(prisma.tournamentTeam.findUnique).mockResolvedValue({
      id: 'team-1',
      name: 'Team Alpha',
      captainUser: { id: 'captain-1', name: 'Captain', email: 'cap@example.com' },
      tournament: { id: 'tournament-1', name: 'Test Tournament' }
    } as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', name: 'Joined User', email: 'joined@example.com' } as any);

    const res = await request(app).post('/api/tournaments/invitations/token-abc/accept');

    expect(res.status).toBe(200);
    expect(NotificationFactory.createTournamentNotifications).toHaveBeenCalled();
    // Ensure notification created for captain with team and player info
    expect(vi.mocked(NotificationFactory.createTournamentNotifications).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        type: 'team_registered',
        userIds: ['captain-1'],
        params: expect.objectContaining({
          teamName: 'Team Alpha',
          playerName: 'Joined User',
          tournamentName: 'Test Tournament'
        })
      })
    );
  });

  it('returns 400 when invitee is already a player in the tournament', async () => {
    vi.mocked(tournamentService.acceptTeamInvitation).mockImplementation(async () => {
      // Simulate service throwing when user already in tournament
      throw Object.assign(new Error('You are already a participant in this tournament'), { name: 'BadRequestError' });
    });

    const res = await request(app).post('/api/tournaments/invitations/token-abc/accept');

    expect(res.status).toBeGreaterThanOrEqual(400);
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

describe('GET /api/tournaments/invitations/:inviteToken (getInvitationByToken)', () => {
  it('returns 200 with invitation details when found', async () => {
    vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValue({
      ...mockInvitation,
      team: { id: 'team-1', name: 'Team Alpha', tournament: { id: 'tournament-1', name: 'Test Tournament' } },
      inviter: { id: 'test-user-id', name: 'Test User', email: 'test@example.com' }
    } as any);

    const res = await request(app).get('/api/tournaments/invitations/token-abc');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('team');
    expect(res.body.team.tournament.name).toBe('Test Tournament');
  });

  it('returns 404 when invitation not found', async () => {
    vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/invitations/nonexistent');

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

describe('deprecated status endpoint', () => {
  it('returns 404 for PUT /api/tournaments/:id/status', async () => {
    const res = await request(app)
      .put('/api/tournaments/tournament-1/status')
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
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    const registeredTournament = { ...mockTournament, organizerId: 'other-user-id', status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentTeam.create).mockResolvedValue({ ...mockTeam, captainUser: null } as any);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team' });

    expect(res.status).toBe(201);
  });

  it('returns 400 when required registration answers are missing', async () => {
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    const registeredTournament = { ...mockTournament, organizerId: 'other-user-id', status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentRegistrationField.findMany).mockResolvedValue([
      { id: 'field-1', label: 'Roster Size' },
    ] as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team', answers: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing required registration answers');
    expect(prisma.tournamentTeam.create).not.toHaveBeenCalled();
  });

  it('persists registration answers during self-registration when provided', async () => {
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    const registeredTournament = { ...mockTournament, organizerId: 'other-user-id', status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentRegistrationField.findMany)
      .mockResolvedValueOnce([{ id: 'field-1', label: 'Roster Size' }] as any)
      .mockResolvedValueOnce([{ id: 'field-1' }] as any);
    vi.mocked(prisma.tournamentTeam.create).mockResolvedValue({ ...mockTeam, captainUser: null } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team', answers: [{ fieldId: 'field-1', value: '10' }] });

    expect(res.status).toBe(201);
    expect(prisma.tournamentTeamAnswer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ fieldId: 'field-1', value: '10' }),
      })
    );
  });

  it('returns 201 when registering without a pool when tournament has no categories', async () => {
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    const registeredTournament = { ...mockTournament, organizerId: 'other-user-id', status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentCategory.count).mockResolvedValue(0 as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentTeam.create).mockResolvedValue({ ...mockTeam, captainUser: null } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team' });

    expect(res.status).toBe(201);
    expect(prisma.tournamentTeam.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          poolName: expect.anything(),
        }),
      })
    );
    // categoryId is no longer part of the response — teams are categorised via pools
    expect(res.body.categoryId).toBeUndefined();
    expect(res.body.team).toBeDefined();
  });

  it('uses categoryId in request body when provided', async () => {
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    const registeredTournament = { ...mockTournament, organizerId: 'other-user-id', status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentCategory.count).mockResolvedValue(1 as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentCategory.findFirst).mockResolvedValue({ id: 'cat-1', name: 'Category A' } as any);
    vi.mocked(prisma.tournamentTeam.create).mockResolvedValue({ ...mockTeam, id: 'new-team', captainUser: null } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team', categoryId: 'cat-1' });

    // categoryId is validated and applied as poolName hint when no pool is selected
    expect(res.status).toBe(201);
    expect(prisma.tournamentCategory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'cat-1', tournamentId: 'tournament-1' }) })
    );
    expect(prisma.tournamentTeam.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ poolName: 'Category A' }) })
    );
    expect(res.body.categoryId).toBe('cat-1');
  });

  it('returns 404 when poolId is provided but pool does not exist', async () => {
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    const registeredTournament = { ...mockTournament, organizerId: 'other-user-id', status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentCategory.count).mockResolvedValue(1 as any);
    vi.mocked(prisma.tournamentCategory.findFirst).mockResolvedValue({ id: 'cat-1', name: 'Category 1' } as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team', categoryId: 'cat-1', poolId: 'missing-pool' });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Pool not found');
  });

  it('returns 404 when poolId is invalid even when categoryId is provided', async () => {
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    const registeredTournament = { ...mockTournament, organizerId: 'other-user-id', status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentCategory.count).mockResolvedValue(1 as any);
    vi.mocked(prisma.tournamentCategory.findFirst).mockResolvedValue({ id: 'cat-1', name: 'Category 1' } as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team', poolId: 'pool-1', categoryId: 'cat-1' });

    expect(res.status).toBe(404);
  });

  it('allows registration when both pool and category provided and pool belongs to category', async () => {
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    const registeredTournament = { ...mockTournament, organizerId: 'other-user-id', status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentCategory.count).mockResolvedValue(1 as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue({ id: 'pool-1', name: 'Pool 1', tournamentId: 'tournament-1', categoryId: 'cat-1', maxTeams: 4, teams: [] } as any);
    vi.mocked(prisma.tournamentCategory.findFirst).mockResolvedValue({ id: 'cat-1', name: 'Category 1' } as any);
    vi.mocked(prisma.tournamentTeam.create).mockResolvedValue({ ...mockTeam, id: 'new-team', poolId: 'pool-1' } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team', poolId: 'pool-1', categoryId: 'cat-1' });

    expect(res.status).toBe(201);
    expect(res.body.team.poolId).toBe('pool-1');
    expect(res.body.categoryId).toBe('cat-1');
  });

  it('returns 400 when tournament is not in registration status', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({ ...mockTournament, status: 'in_progress' } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when tournament has reached max teams', async () => {
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    const registeredTournament = { ...mockTournament, organizerId: 'other-user-id', status: 'registration', maxTeams: 1 };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentTeam.count).mockResolvedValue(1);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('maximum number of teams');
  });

  it('returns 400 when user is already a player in the tournament', async () => {
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    const registeredTournament = { ...mockTournament, organizerId: 'other-user-id', status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
    // Simulate existing player record for this user in the tournament
    vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValue({ id: 'player-1', teamId: 'team-2', userId: 'test-user-id' } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).toContain('already a participant');
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/nonexistent/teams/self-register')
      .send({ name: 'New Team' });

    expect(res.status).toBe(404);
  });

  it('returns 404 when categoryId does not belong to the tournament', async () => {
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    const registeredTournament = { ...mockTournament, organizerId: 'other-user-id', status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentCategory.count).mockResolvedValue(1 as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
    // Category not found for this tournament
    vi.mocked(prisma.tournamentCategory.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team', categoryId: 'wrong-cat' });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Category not found');
  });

  it('returns 400 when categories exist and category is not selected', async () => {
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    const registeredTournament = { ...mockTournament, organizerId: 'other-user-id', status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentCategory.count).mockResolvedValue(2 as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'New Team' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Category selection is required');
  });

  it('returns 403 when the tournament organizer attempts to self-register', async () => {
    // mockTournament.organizerId === 'test-user-id' (the authenticated user)
    const registeredTournament = { ...mockTournament, status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'Organizer Team' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('organizer');
  });

  it('returns 403 when a co-organizer attempts to self-register', async () => {
    const registeredTournament = { ...mockTournament, organizerId: 'other-user-id', status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    // isOrganizerOrAdmin returns true (user is a co-organizer)
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/self-register')
      .send({ name: 'Co-Organizer Team' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('co-organizer');
  });
});

describe('DELETE /api/tournaments/:id/teams/self-register (selfUnregisterTeam)', () => {
  it('returns 200 on successful unregister', async () => {
    const registeredTournament = { ...mockTournament, status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([{
      ...mockTeam,
      captainUserId: 'test-user-id',
      _count: { players: 0 },
    }] as any);
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
      { ...mockTeam, id: 'team-1', captainUserId: 'test-user-id', _count: { players: 0 } },
      { ...mockTeam, id: 'team-2', captainUserId: 'test-user-id', _count: { players: 0 } },
    ] as any);
    vi.mocked(prisma.tournamentTeam.deleteMany).mockResolvedValue({ count: 2 } as any);

    const res = await request(app)
      .delete('/api/tournaments/tournament-1/teams/self-register');

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('unregistered');
    expect(prisma.tournamentTeam.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['team-1', 'team-2'] } }
    });
  });

  it('returns 400 when user is a team member but not the captain', async () => {
    const registeredTournament = { ...mockTournament, status: 'registration' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(registeredTournament as any);
    // User is found as a team member but is not the captain
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([{
      ...mockTeam,
      captainUserId: 'other-captain-id',
      _count: { players: 3 },
    }] as any);

    const res = await request(app)
      .delete('/api/tournaments/tournament-1/teams/self-register');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('registered team to unregister');
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

// ═══════════════════════════════════════════════════════════════════════════════
// MOVE TEAM TO POOL
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/tournaments/:id/teams/:teamId/pool-move (moveTeamToPool)', () => {
  it('returns 200 when team is moved to a different pool', async () => {
    const teamInPool = { ...mockTeam, poolId: 'pool-1' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(teamInPool as any);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(mockPool as any);
    vi.mocked(prisma.tournamentPool.findUnique).mockResolvedValue({
      ...mockPool,
      id: 'pool-2',
      teams: [],
    } as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn({
        ...prisma,
        tournamentTeam: {
          ...prisma.tournamentTeam,
          update: vi.fn().mockResolvedValue({ ...teamInPool, poolId: 'pool-2', captainUser: null }),
          findFirst: vi.fn().mockResolvedValue(null), // no waitlist entry
        },
        tournamentPoolWaitlist: {
          ...prisma.tournamentPoolWaitlist,
          findFirst: vi.fn().mockResolvedValue(null),
        },
        tournamentPool: {
          ...prisma.tournamentPool,
          findUnique: vi.fn().mockResolvedValue({ ...mockPool, id: 'pool-2', teams: [] }),
        },
      })
    );

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/pool-move')
      .send({ poolId: 'pool-2' });

    expect(res.status).toBe(200);
  });

  it('returns 200 with no change when team is already in target pool', async () => {
    const teamInPool = { ...mockTeam, poolId: 'pool-1' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(teamInPool as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/pool-move')
      .send({ poolId: 'pool-1' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('already in the target pool');
  });

  it('returns 400 when target pool does not belong to this tournament', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({ ...mockTeam, poolId: null } as any);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/pool-move')
      .send({ poolId: 'foreign-pool' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('pool not found');
  });

  it('returns 403 when non-organizer tries to move team', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/pool-move')
      .send({ poolId: 'pool-2' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/nonexistent/teams/team-1/pool-move')
      .send({ poolId: 'pool-2' });

    expect(res.status).toBe(404);
  });

  it('returns 404 when team not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/nonexistent/pool-move')
      .send({ poolId: 'pool-2' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when tournament is cancelled', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'cancelled',
    } as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({ ...mockTeam, poolId: null } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/pool-move')
      .send({ poolId: 'pool-2' });

    expect(res.status).toBe(400);
  });

  it('returns 200 when team is unassigned from pool (null poolId)', async () => {
    const teamInPool = { ...mockTeam, poolId: 'pool-1' };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(teamInPool as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn({
        ...prisma,
        tournamentTeam: {
          ...prisma.tournamentTeam,
          update: vi.fn().mockResolvedValue({ ...teamInPool, poolId: null }),
        },
        tournamentPoolWaitlist: {
          ...prisma.tournamentPoolWaitlist,
          findFirst: vi.fn().mockResolvedValue(null),
        },
        tournamentPool: {
          ...prisma.tournamentPool,
          findUnique: vi.fn().mockResolvedValue({ ...mockPool, teams: [] }),
        },
      })
    );

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/pool-move')
      .send({ poolId: null });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('removed from pool');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INVITATION PREVIEW (public endpoint)
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/tournaments/invitations/preview/:inviteToken (getInvitationDetails)', () => {
  const mockDetailedInvitation = {
    ...mockInvitation,
    inviteToken: 'token-abc',
    status: 'pending',
    message: null,
    expiresAt: new Date(Date.now() + 7 * 86_400_000), // 7 days from now
    inviter: { id: 'test-user-id', name: 'Test User' },
    team: {
      id: 'team-1',
      name: 'Team Alpha',
      tournament: { id: 'tournament-1', name: 'Test Tournament', sportType: 'football' },
    },
  };

  it('returns 200 with invitation details for valid token', async () => {
    vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValue(
      mockDetailedInvitation as any
    );

    const res = await request(app).get('/api/tournaments/invitations/preview/token-abc');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      inviteToken: 'token-abc',
      status: 'pending',
      team: { id: 'team-1', name: 'Team Alpha' },
      tournament: { id: 'tournament-1', name: 'Test Tournament' },
      inviter: { id: 'test-user-id', name: 'Test User' },
    });
  });

  it('returns 404 when invitation token does not exist', async () => {
    vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/invitations/preview/bad-token');

    expect(res.status).toBe(404);
  });

  it('returns 400 when invitation has expired (status = expired)', async () => {
    vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValue({
      ...mockDetailedInvitation,
      status: 'expired',
    } as any);

    const res = await request(app).get('/api/tournaments/invitations/preview/token-abc');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('expired');
  });

  it('returns 400 when invitation expiresAt is in the past', async () => {
    vi.mocked(prisma.tournamentTeamInvitation.findUnique).mockResolvedValue({
      ...mockDetailedInvitation,
      status: 'pending',
      expiresAt: new Date(Date.now() - 1000),
    } as any);

    const res = await request(app).get('/api/tournaments/invitations/preview/token-abc');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('expired');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE SUBMISSION — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/tournaments/:id/matches/:matchId/score — edge cases', () => {
  it('returns 400 when homeScore is negative', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: -1, awayScore: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('negative');
  });

  it('returns 400 when awayScore is negative', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 0, awayScore: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('negative');
  });

  it('returns 400 for draw in single elimination format', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      format: 'single_elimination',
      status: 'in_progress',
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue({
      ...mockMatch,
      stage: null,
    } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2, awayScore: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Draws are not allowed');
  });

  it('returns 409 when match score already submitted', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue({
      ...mockMatch,
      status: 'completed',
      homeScore: 2,
      awayScore: 1,
    } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 3, awayScore: 1 });

    expect(res.status).toBe(409);
  });

  it('returns 400 when scores are missing', async () => {
    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('required');
  });

  it('returns 403 when user cannot submit score', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(mockMatch as any);
    vi.mocked(tournamentService.canSubmitScore).mockResolvedValue(false);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2, awayScore: 1 });

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN SCORE OVERRIDE — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/tournaments/:id/matches/:matchId/score (adminUpdateScore) — edge cases', () => {
  it('returns 400 when scores are negative', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: -1, awayScore: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('negative');
  });

  it('returns 400 when tournament is cancelled', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'cancelled',
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2, awayScore: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cancelled');
  });

  it('returns 403 when non-admin tries to override score', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2, awayScore: 1 });

    expect(res.status).toBe(403);
  });

  it('returns 400 for draw in elimination format', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      format: 'single_elimination',
      status: 'in_progress',
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue({
      ...mockMatch,
      stage: null,
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 1, awayScore: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Draws are not allowed');
  });

  it('returns 404 when match not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2, awayScore: 1 });

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE MATCH — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/tournaments/:id/matches (createMatch) — edge cases', () => {
  it('returns 400 when home and away teams are the same', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches')
      .send({ homeTeamId: 'team-1', awayTeamId: 'team-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('different');
  });

  it('returns 400 when referee team is one of the playing teams', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst)
      .mockResolvedValueOnce(mockTeam as any)
      .mockResolvedValueOnce({ ...mockTeam, id: 'team-2' } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches')
      .send({ homeTeamId: 'team-1', awayTeamId: 'team-2', refereeTeamId: 'team-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Referee team cannot be one of the playing teams');
  });

  it('returns 400 when tournament is cancelled', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'cancelled',
    } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches')
      .send({ homeTeamId: 'team-1', awayTeamId: 'team-2' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when home team IDs are missing', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches')
      .send({ awayTeamId: 'team-2' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Both home and away teams are required');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE MATCH — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/tournaments/:id/matches/:matchId (deleteMatch) — edge cases', () => {
  it('returns 200 and reverts standings when deleting a completed match with scores', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'registration',
      startDate: new Date(Date.now() + 60_000),
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue({
      ...mockMatch,
      tournamentId: 'tournament-1',
      status: 'completed',
      homeScore: 2,
      awayScore: 1,
    } as any);
    vi.mocked(prisma.tournamentMatch.delete).mockResolvedValue(mockMatch as any);

    const res = await request(app).delete('/api/tournaments/tournament-1/matches/match-1');

    expect(res.status).toBe(200);
    expect(tournamentService.revertStandings).toHaveBeenCalled();
    expect(res.body.message).toContain('deleted');
  });

  it('returns 200 when deleting a scheduled match', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'registration',
      startDate: new Date(Date.now() + 60_000),
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue({
      ...mockMatch,
      tournamentId: 'tournament-1',
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
    } as any);
    vi.mocked(prisma.tournamentMatch.delete).mockResolvedValue(mockMatch as any);

    const res = await request(app).delete('/api/tournaments/tournament-1/matches/match-1');

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');
  });

  it('returns 403 when non-admin tries to delete', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app).delete('/api/tournaments/tournament-1/matches/match-1');

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGN REFEREE — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/tournaments/:id/matches/:matchId/referee (assignReferee) — edge cases', () => {
  it('returns 200 when referee is assigned successfully', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue({
      ...mockMatch,
      tournamentId: 'tournament-1',
    } as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({
      ...mockTeam,
      id: 'ref-team',
    } as any);
    vi.mocked(prisma.tournamentMatch.update).mockResolvedValue({
      ...mockMatch,
      refereeTeamId: 'ref-team',
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/referee')
      .send({ refereeTeamId: 'ref-team' });

    expect(res.status).toBe(200);
  });

  it('returns 400 when referee team is one of the playing teams', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue({
      ...mockMatch,
      tournamentId: 'tournament-1',
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/referee')
      .send({ refereeTeamId: 'team-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Referee team cannot be one of the playing teams');
  });

  it('returns 400 when referee team does not belong to this tournament', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue({
      ...mockMatch,
      tournamentId: 'tournament-1',
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
    } as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/referee')
      .send({ refereeTeamId: 'foreign-team' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('does not belong to this tournament');
  });

  it('returns 403 when non-admin tries to assign referee', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/referee')
      .send({ refereeTeamId: 'ref-team' });

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE POOL — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/tournaments/:id/pools/:poolId (updatePool) — edge cases', () => {
  it('returns 400 when maxTeams would be reduced below current team count', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(mockPool as any);
    vi.mocked(prisma.tournamentTeam.count).mockResolvedValue(4);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/pools/pool-1')
      .send({ maxTeams: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('current team count');
  });

  it('returns 400 when maxTeams is less than 2', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(mockPool as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/pools/pool-1')
      .send({ maxTeams: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('at least 2 teams');
  });

  it('returns 400 when pool name exceeds max length', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentPool.findFirst).mockResolvedValue(mockPool as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/pools/pool-1')
      .send({ name: 'A'.repeat(101) });

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE MATCH — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/tournaments/:id/matches/:matchId (updateMatch) — edge cases', () => {
  it('returns 400 when trying to set status to completed via update endpoint', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'registration',
      startDate: new Date(Date.now() + 60_000),
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue({
      ...mockMatch,
      tournamentId: 'tournament-1',
      status: 'scheduled',
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1')
      .send({ status: 'completed' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('score submission endpoint');
  });

  it('returns 403 when non-admin tries to update match', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1')
      .send({ roundNumber: 2 });

    expect(res.status).toBe(403);
  });

  it('returns 400 when tournament is completed', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'completed',
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue({
      ...mockMatch,
      tournamentId: 'tournament-1',
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1')
      .send({ roundNumber: 2 });

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE TEAM PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/tournaments/:id/teams/:teamId/payment (updateTeamPayment)', () => {
  it('returns 200 and updated team when admin marks team as paid', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentTeam.update).mockResolvedValue({
      ...mockTeam,
      paymentStatus: 'paid',
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/payment')
      .send({ paymentStatus: 'paid' });

    expect(res.status).toBe(200);
    expect(prisma.tournamentTeam.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'team-1' },
        data: expect.objectContaining({ paymentStatus: 'paid' }),
      })
    );
  });

  it('sets paidAt when marking as paid', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentTeam.update).mockResolvedValue({
      ...mockTeam,
      paymentStatus: 'paid',
    } as any);

    await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/payment')
      .send({ paymentStatus: 'paid' });

    expect(prisma.tournamentTeam.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAt: expect.any(Date),
          paidByUserId: 'test-user-id',
        }),
      })
    );
  });

  it('clears paidAt when marking as unpaid', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({
      ...mockTeam,
      paymentStatus: 'paid',
    } as any);
    vi.mocked(prisma.tournamentTeam.update).mockResolvedValue(mockTeam as any);

    await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/payment')
      .send({ paymentStatus: 'unpaid' });

    expect(prisma.tournamentTeam.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: 'unpaid',
          paidAt: null,
          paidByUserId: null,
        }),
      })
    );
  });

  it('returns 200 when marking as waived', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentTeam.update).mockResolvedValue({
      ...mockTeam,
      paymentStatus: 'waived',
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/payment')
      .send({ paymentStatus: 'waived' });

    expect(res.status).toBe(200);
  });

  it('allows marking a team as paid while the tournament is in progress', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentTeam.update).mockResolvedValue({
      ...mockTeam,
      paymentStatus: 'paid',
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/payment')
      .send({ paymentStatus: 'paid' });

    expect(res.status).toBe(200);
  });

  it('blocks unpaid-style payment updates after the payment deadline passes', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      paymentDeadline: new Date('2020-01-01T00:00:00.000Z'),
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/payment')
      .send({ paymentStatus: 'pending' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Payment deadline has passed');
  });

  it('returns 400 when paymentStatus is invalid', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/payment')
      .send({ paymentStatus: 'invalid_status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('paymentStatus must be one of');
  });

  it('returns 400 when paymentStatus is missing', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/payment')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('paymentStatus must be one of');
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/payment')
      .send({ paymentStatus: 'paid' });

    expect(res.status).toBe(404);
  });

  it('returns 403 when non-organizer tries to update payment', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/payment')
      .send({ paymentStatus: 'paid' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when team not found in tournament', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/nonexistent/payment')
      .send({ paymentStatus: 'paid' });

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tournaments/:id/teams/payment/batch (batchUpdateTeamPayments)', () => {
  it('returns 200 and updates only teams needing change', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([
      { id: 'team-1', paymentStatus: 'unpaid' },
      { id: 'team-2', paymentStatus: 'paid' },
    ] as any);
    vi.mocked(prisma.tournamentTeam.updateMany).mockResolvedValue({ count: 1 } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/payment/batch')
      .send({ teamIds: ['team-1', 'team-2', 'missing-team'], paymentStatus: 'paid' });

    expect(res.status).toBe(200);
    expect(prisma.tournamentTeam.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['team-1'] } }),
      })
    );
    expect(res.body).toEqual(
      expect.objectContaining({
        paymentStatus: 'paid',
        requestedCount: 3,
        updatedCount: 1,
        skippedCount: 1,
        notFoundCount: 1,
        updatedTeamIds: ['team-1'],
        skippedTeamIds: ['team-2'],
        notFoundTeamIds: ['missing-team'],
      })
    );
  });

  it('deduplicates duplicate team IDs in request', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([
      { id: 'team-1', paymentStatus: 'unpaid' },
    ] as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/payment/batch')
      .send({ teamIds: ['team-1', 'team-1'], paymentStatus: 'paid' });

    expect(res.status).toBe(200);
    expect(res.body.requestedCount).toBe(1);
  });

  it('blocks batch unpaid-style updates after the payment deadline passes', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      paymentDeadline: new Date('2020-01-01T00:00:00.000Z'),
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/payment/batch')
      .send({ teamIds: ['team-1'], paymentStatus: 'pending' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Payment deadline has passed');
  });

  it('returns 400 when teamIds is missing', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/payment/batch')
      .send({ paymentStatus: 'paid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('teamIds must be a non-empty array');
  });

  it('returns 400 when paymentStatus is invalid', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/payment/batch')
      .send({ teamIds: ['team-1'], paymentStatus: 'invalid_status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('paymentStatus must be one of');
  });

  it('returns 403 when non-organizer tries to batch update payment', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/payment/batch')
      .send({ teamIds: ['team-1'], paymentStatus: 'paid' });

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/tournaments/:id/payments/:paymentId/status (updatePaymentTransactionStatus)', () => {
  it('returns 400 for invalid transaction status transition', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentPaymentTransaction.findFirst).mockResolvedValue({
      id: 'payment-1',
      tournamentId: 'tournament-1',
      teamId: 'team-1',
      status: 'refunded',
      paidAt: new Date('2026-01-01T00:00:00.000Z'),
      refundedAt: new Date('2026-01-02T00:00:00.000Z'),
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/payments/payment-1/status')
      .send({ status: 'paid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Cannot transition payment transaction from refunded to paid');
    expect(prisma.tournamentPaymentTransaction.update).not.toHaveBeenCalled();
  });

  it('is idempotent when status is unchanged', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentPaymentTransaction.findFirst).mockResolvedValue({
      id: 'payment-1',
      tournamentId: 'tournament-1',
      teamId: 'team-1',
      status: 'paid',
      paidAt: new Date('2026-01-01T00:00:00.000Z'),
      refundedAt: null,
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/payments/payment-1/status')
      .send({ status: 'paid' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('payment-1');
    expect(prisma.tournamentPaymentTransaction.update).not.toHaveBeenCalled();
    expect(prisma.tournamentTeam.update).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE BRACKETS — PAYMENT GATE
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/tournaments/:id/generate-brackets — payment gate', () => {
  it('returns 400 when requirePaymentForBrackets is true and unpaid teams exist', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      format: 'single_elimination',
      requirePaymentForBrackets: true,
    } as any);
    vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(0);
    vi.mocked(prisma.tournamentTeam.count).mockResolvedValue(3);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/generate-brackets')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('payment');
  });

  it('succeeds when requirePaymentForBrackets is true but forceGenerate bypasses gate', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      format: 'single_elimination',
      requirePaymentForBrackets: true,
    } as any);
    vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(0);
    vi.mocked(tournamentService.generateSingleEliminationBrackets).mockResolvedValue({ count: 4 });
    vi.mocked(prisma.tournament.update).mockResolvedValue(mockTournament as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/generate-brackets')
      .send({ forceGenerate: true });

    expect(res.status).toBe(200);
  });

  it('succeeds when requirePaymentForBrackets is true and all teams are paid', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      format: 'single_elimination',
      requirePaymentForBrackets: true,
    } as any);
    vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(0);
    vi.mocked(prisma.tournamentTeam.count).mockResolvedValue(0); // zero unpaid teams
    vi.mocked(tournamentService.generateSingleEliminationBrackets).mockResolvedValue({ count: 4 });
    vi.mocked(prisma.tournament.update).mockResolvedValue(mockTournament as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/generate-brackets')
      .send({});

    expect(res.status).toBe(200);
  });

  it('does not delete existing brackets before failing the payment gate', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      format: 'single_elimination',
      requirePaymentForBrackets: true,
    } as any);
    vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(2);
    vi.mocked(prisma.tournamentTeam.count).mockResolvedValue(1);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/generate-brackets')
      .send({});

    expect(res.status).toBe(400);
    expect(prisma.tournamentStanding.deleteMany).not.toHaveBeenCalled();
    expect(prisma.tournamentMatch.deleteMany).not.toHaveBeenCalled();
  });

  it('skips payment check when requirePaymentForBrackets is false', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      format: 'single_elimination',
      requirePaymentForBrackets: false,
    } as any);
    vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(0);
    vi.mocked(tournamentService.generateSingleEliminationBrackets).mockResolvedValue({ count: 4 });
    vi.mocked(prisma.tournament.update).mockResolvedValue(mockTournament as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/generate-brackets')
      .send({});

    expect(res.status).toBe(200);
    // team count should not have been queried for payment
    expect(prisma.tournamentTeam.count).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRATION FEE — CREATE / UPDATE TOURNAMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/tournaments — registration fee fields', () => {
  const validBody = {
    name: 'Paid Cup',
    sportType: 'football',
    format: 'single_elimination',
    startDate: '2025-12-01T10:00:00Z',
  };

  it('stores registrationFee when provided', async () => {
    vi.mocked(prisma.tournament.create).mockResolvedValue({
      ...mockTournament,
      registrationFee: 25.5,
      requirePaymentForBrackets: false,
    } as any);

    const res = await request(app)
      .post('/api/tournaments')
      .send({ ...validBody, registrationFee: 25.5 });

    expect(res.status).toBe(201);
    expect(prisma.tournament.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ registrationFee: 25.5 }),
      })
    );
  });

  it('stores requirePaymentForBrackets when provided', async () => {
    vi.mocked(prisma.tournament.create).mockResolvedValue({
      ...mockTournament,
      registrationFee: 10,
      requirePaymentForBrackets: true,
    } as any);

    const res = await request(app)
      .post('/api/tournaments')
      .send({ ...validBody, registrationFee: 10, requirePaymentForBrackets: true });

    expect(res.status).toBe(201);
    expect(prisma.tournament.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requirePaymentForBrackets: true }),
      })
    );
  });
});

describe('PUT /api/tournaments/:id — registration fee update', () => {
  it('updates registrationFee to a new value', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournament.update).mockResolvedValue({
      ...mockTournament,
      registrationFee: 50,
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1')
      .send({ registrationFee: 50 });

    expect(res.status).toBe(200);
    expect(prisma.tournament.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ registrationFee: 50 }),
      })
    );
  });

  it('clears registrationFee when set to null', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      registrationFee: 25,
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournament.update).mockResolvedValue({
      ...mockTournament,
      registrationFee: null,
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1')
      .send({ registrationFee: null });

    expect(res.status).toBe(200);
    expect(prisma.tournament.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ registrationFee: null }),
      })
    );
  });

  it('returns 400 when registrationFee is a negative number', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1')
      .send({ registrationFee: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('non-negative');
  });

  it('updates requirePaymentForBrackets to true', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournament.update).mockResolvedValue({
      ...mockTournament,
      requirePaymentForBrackets: true,
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1')
      .send({ requirePaymentForBrackets: true });

    expect(res.status).toBe(200);
    expect(prisma.tournament.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requirePaymentForBrackets: true }),
      })
    );
  });

  it('returns 400 when requirePaymentForBrackets is not a boolean', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1')
      .send({ requirePaymentForBrackets: 'yes' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('boolean');
  });
});

describe('POST /api/tournaments/:id/matches/:matchId/score — groups_knockout auto-generate', () => {
  it('auto-generates knockout brackets when all groups are complete and autoGenerateBrackets is enabled', async () => {
    vi.mocked(prisma.tournament.findUnique)
      .mockResolvedValueOnce({
        ...mockTournament,
        format: 'groups_knockout',
        status: 'in_progress',
        autoGenerateBrackets: true,
      } as any)
      .mockResolvedValueOnce({
        id: 'tournament-1',
        format: 'groups_knockout',
        status: 'in_progress',
        autoGenerateBrackets: true,
      } as any);
    vi.mocked(prisma.tournamentMatch.findUnique)
      .mockResolvedValueOnce({
        ...mockMatch,
        stage: 'group_stage',
        status: 'scheduled',
      } as any)
      .mockResolvedValueOnce({
        ...mockMatch,
        stage: 'group_stage',
        status: 'completed',
        homeScore: 2,
        awayScore: 1,
      } as any);
    vi.mocked(prisma.tournamentMatch.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.tournamentMatch.count)
      .mockResolvedValueOnce(8) // group matches
      .mockResolvedValueOnce(0) // incomplete group matches
      .mockResolvedValueOnce(0); // knockout matches

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/score')
      .send({ homeScore: 2, awayScore: 1 });

    expect(res.status).toBe(200);
    expect(tournamentService.generateKnockoutFromStandings).toHaveBeenCalledWith('tournament-1');
  });
});

describe('Tournament workflow e2e scenarios', () => {
  it('covers groups_knockout flow from registrations through knockout generation and final scoring', async () => {
    const tournament = {
      ...mockTournament,
      format: 'groups_knockout',
      status: 'registration',
      maxTeams: 8,
      autoGenerateBrackets: false,
      tiebreakerRules: ['wins', 'goal_difference', 'goals_for'],
    };
    const teams: Array<{ id: string; name: string }> = [];
    const finalMatch = {
      ...mockMatch,
      id: 'final-1',
      stage: 'finals',
      status: 'scheduled',
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      homeScore: null,
      awayScore: null,
      startedAt: null,
      completedAt: null,
    };

    vi.mocked(prisma.tournament.findUnique).mockImplementation(async (args: any) => {
      if (args?.where?.id !== 'tournament-1') return null as any;
      if (!args?.select) return tournament as any;
      const selected: Record<string, unknown> = {};
      Object.keys(args.select).forEach((key) => {
        selected[key] = (tournament as Record<string, unknown>)[key];
      });
      return selected as any;
    });
    vi.mocked(prisma.tournamentTeam.count).mockImplementation(async () => teams.length as any);
    vi.mocked(prisma.tournamentTeam.create).mockImplementation(async ({ data }: any) => {
      const team = {
        ...mockTeam,
        id: `team-${teams.length + 1}`,
        name: data.name,
      };
      teams.push({ id: team.id, name: team.name });
      return team as any;
    });
    vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(0 as any);
    vi.mocked(prisma.tournamentMatch.findMany).mockResolvedValue([{ status: 'completed' }] as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockImplementation(async ({ where }: any) => {
      if (where?.id === 'final-1') return finalMatch as any;
      return null as any;
    });
    vi.mocked(prisma.tournamentMatch.updateMany).mockImplementation(async ({ where, data }: any) => {
      if (where?.id === 'final-1' && finalMatch.status !== 'completed') {
        finalMatch.homeScore = data.homeScore;
        finalMatch.awayScore = data.awayScore;
        finalMatch.status = 'completed';
        finalMatch.startedAt = data.startedAt;
        finalMatch.completedAt = data.completedAt;
        return { count: 1 } as any;
      }
      return { count: 0 } as any;
    });

    const firstRegistration = await request(app)
      .post('/api/tournaments/tournament-1/teams')
      .send({ name: 'Team One', captainName: 'Captain One' });
    const secondRegistration = await request(app)
      .post('/api/tournaments/tournament-1/teams')
      .send({ name: 'Team Two', captainName: 'Captain Two' });

    tournament.status = 'registration_closed';
    const groupMatchGeneration = await request(app)
      .post('/api/tournaments/tournament-1/generate-group-matches')
      .send({ numberOfGroups: 2 });

    tournament.status = 'in_progress';
    const knockoutGeneration = await request(app)
      .post('/api/tournaments/tournament-1/generate-brackets')
      .send({});

    const finalScoreSubmission = await request(app)
      .post('/api/tournaments/tournament-1/matches/final-1/score')
      .send({ homeScore: 2, awayScore: 1 });

    expect(firstRegistration.status).toBe(201);
    expect(secondRegistration.status).toBe(201);
    expect(groupMatchGeneration.status).toBe(200);
    expect(knockoutGeneration.status).toBe(200);
    expect(finalScoreSubmission.status).toBe(200);
    expect(tournamentService.generateGroupsKnockoutBrackets).toHaveBeenCalledWith('tournament-1', 2);
    expect(tournamentService.generateKnockoutFromStandings).toHaveBeenCalledWith('tournament-1');
    expect(tournamentService.reconcileTournamentLifecycleStatus).toHaveBeenCalledWith('tournament-1', 'submit_score');
  });

  it('auto-generates knockout when the final group-stage score is submitted in a tied group race', async () => {
    const tournament = {
      ...mockTournament,
      format: 'groups_knockout',
      status: 'in_progress',
      autoGenerateBrackets: true,
      tiebreakerRules: ['wins', 'goal_difference'],
    };
    const decidingGroupMatch = {
      ...mockMatch,
      id: 'group-final',
      stage: 'group_stage',
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      startedAt: null,
      completedAt: null,
    };

    vi.mocked(prisma.tournament.findUnique).mockImplementation(async (args: any) => {
      if (args?.where?.id !== 'tournament-1') return null as any;
      if (!args?.select) return tournament as any;
      const selected: Record<string, unknown> = {};
      Object.keys(args.select).forEach((key) => {
        selected[key] = (tournament as Record<string, unknown>)[key];
      });
      return selected as any;
    });
    vi.mocked(prisma.tournamentMatch.findUnique).mockImplementation(async ({ where }: any) => {
      if (where?.id === 'group-final') return decidingGroupMatch as any;
      return null as any;
    });
    vi.mocked(prisma.tournamentMatch.updateMany).mockImplementation(async ({ where, data }: any) => {
      if (where?.id === 'group-final' && decidingGroupMatch.status !== 'completed') {
        decidingGroupMatch.status = 'completed';
        decidingGroupMatch.homeScore = data.homeScore;
        decidingGroupMatch.awayScore = data.awayScore;
        decidingGroupMatch.startedAt = data.startedAt;
        decidingGroupMatch.completedAt = data.completedAt;
        return { count: 1 } as any;
      }
      return { count: 0 } as any;
    });
    vi.mocked(prisma.tournamentMatch.count).mockImplementation(async ({ where }: any) => {
      if (where?.stage === 'group_stage' && !where?.status) return 6 as any;
      if (where?.stage === 'group_stage' && where?.status?.not === 'completed') return 0 as any;
      if (where?.stage?.not === 'group_stage') return 0 as any;
      return 0 as any;
    });

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/group-final/score')
      .send({ homeScore: 3, awayScore: 2 });

    expect(res.status).toBe(200);
    expect(tournamentService.generateKnockoutFromStandings).toHaveBeenCalledWith('tournament-1');
    expect(tournamentService.reconcileTournamentLifecycleStatus).toHaveBeenCalledWith('tournament-1', 'auto_generate_knockout');
    expect(tournamentService.reconcileTournamentLifecycleStatus).toHaveBeenCalledWith('tournament-1', 'submit_score');
  });

  it('enforces registration capacity and then progresses a single-elimination match to the next stage', async () => {
    const tournament = {
      ...mockTournament,
      format: 'single_elimination',
      status: 'registration',
      maxTeams: 2,
    };
    const teams: string[] = [];
    const semiFinalMatch = {
      ...mockMatch,
      id: 'semi-1',
      stage: 'semi_finals',
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      startedAt: null,
      completedAt: null,
    };

    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(tournament as any);
    vi.mocked(prisma.tournamentTeam.count).mockImplementation(async () => teams.length as any);
    vi.mocked(prisma.tournamentTeam.create).mockImplementation(async ({ data }: any) => {
      teams.push(data.name);
      return { ...mockTeam, id: `team-${teams.length}`, name: data.name } as any;
    });
    vi.mocked(prisma.tournamentMatch.count).mockResolvedValue(0 as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockImplementation(async ({ where }: any) => {
      if (where?.id === 'semi-1') return semiFinalMatch as any;
      return null as any;
    });
    vi.mocked(prisma.tournamentMatch.updateMany).mockImplementation(async ({ where, data }: any) => {
      if (where?.id === 'semi-1' && semiFinalMatch.status !== 'completed') {
        semiFinalMatch.status = 'completed';
        semiFinalMatch.homeScore = data.homeScore;
        semiFinalMatch.awayScore = data.awayScore;
        semiFinalMatch.startedAt = data.startedAt;
        semiFinalMatch.completedAt = data.completedAt;
        return { count: 1 } as any;
      }
      return { count: 0 } as any;
    });

    const registrationOne = await request(app)
      .post('/api/tournaments/tournament-1/teams')
      .send({ name: 'Capacity Team 1', captainName: 'Captain 1' });
    const registrationTwo = await request(app)
      .post('/api/tournaments/tournament-1/teams')
      .send({ name: 'Capacity Team 2', captainName: 'Captain 2' });
    const overCapacityRegistration = await request(app)
      .post('/api/tournaments/tournament-1/teams')
      .send({ name: 'Capacity Team 3', captainName: 'Captain 3' });

    tournament.status = 'in_progress';
    const bracketGeneration = await request(app)
      .post('/api/tournaments/tournament-1/generate-brackets')
      .send({});
    const semiFinalScoreSubmission = await request(app)
      .post('/api/tournaments/tournament-1/matches/semi-1/score')
      .send({ homeScore: 1, awayScore: 0 });

    expect(registrationOne.status).toBe(201);
    expect(registrationTwo.status).toBe(201);
    expect(overCapacityRegistration.status).toBe(400);
    expect(bracketGeneration.status).toBe(200);
    expect(semiFinalScoreSubmission.status).toBe(200);
    expect(tournamentService.generateSingleEliminationBrackets).toHaveBeenCalledWith(
      'tournament-1',
      expect.objectContaining({
        randomizeSeeds: false,
        allowByes: true,
      })
    );
    expect(tournamentService.advanceWinners).toHaveBeenCalledWith('tournament-1', 'semi_finals');
  });
});

describe('PUT /api/tournaments/:id/matches/:matchId/referee — conflict checks', () => {
  it('returns 400 when referee team has an overlapping assignment', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'registration',
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    } as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue({
      ...mockMatch,
      scheduledAt: new Date('2026-06-20T10:00:00.000Z'),
      scheduledDurationMinutes: 60,
    } as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({
      ...mockTeam,
      id: 'ref-team',
      name: 'Ref Team',
    } as any);
    vi.mocked(prisma.tournamentMatch.findMany).mockResolvedValue([
      {
        id: 'match-overlap',
        scheduledAt: new Date('2026-06-20T10:30:00.000Z'),
        scheduledDurationMinutes: 60,
      },
    ] as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/referee')
      .send({ refereeTeamId: 'ref-team' });

    expect(res.status).toBe(400);
    expect(String(res.body.error || '')).toContain('conflict');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM CHECK-IN (#4)
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/tournaments/:id/teams/:teamId/check-in (checkInTeam)', () => {
  it('returns 200 when organizer checks in a team', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(false);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentTeam.update).mockResolvedValue({ ...mockTeam, checkedIn: true } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/check-in')
      .send({ checkedIn: true });

    expect(res.status).toBe(200);
    expect(prisma.tournamentTeam.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'team-1' },
        data: expect.objectContaining({ checkedIn: true }),
      })
    );
  });

  it('returns 200 when captain checks in their own team', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(true);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentTeam.update).mockResolvedValue({ ...mockTeam, checkedIn: true } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/check-in')
      .send({ checkedIn: true });

    expect(res.status).toBe(200);
  });

  it('sets checkedIn to false when checkedIn: false is sent', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(false);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({
      ...mockTeam,
      checkedIn: true,
      checkedInAt: new Date(),
    } as any);
    vi.mocked(prisma.tournamentTeam.update).mockResolvedValue({ ...mockTeam, checkedIn: false } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/check-in')
      .send({ checkedIn: false });

    expect(res.status).toBe(200);
    expect(prisma.tournamentTeam.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ checkedIn: false, checkedInAt: null }),
      })
    );
  });

  it('returns 403 when user is neither organizer nor captain', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/check-in')
      .send({ checkedIn: true });

    expect(res.status).toBe(403);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/check-in')
      .send({ checkedIn: true });

    expect(res.status).toBe(404);
  });

  it('returns 404 when team not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(false);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/check-in')
      .send({ checkedIn: true });

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tournaments/:id/matches/:matchId/scorekeeper (assignMatchScorekeeper)', () => {
  it('creates a notification for the assigned scorekeeper', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentMatch.findFirst).mockResolvedValue(mockMatch as any);
    vi.mocked(prisma.tournamentMatch.update).mockResolvedValue({
      ...mockMatch,
      homeTeam: { id: 'team-1', name: 'Team Alpha' },
      awayTeam: { id: 'team-2', name: 'Team Beta' },
      scorekeeper: { id: 'scorekeeper-1', name: 'Score Keeper', email: 'scorekeeper@example.com' },
      court: { id: 'court-1', name: 'Court 1' },
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/scorekeeper')
      .send({ scorekeeperUserId: 'scorekeeper-1' });

    expect(res.status).toBe(200);
    expect(prisma.tournamentNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'scorekeeper-1',
          type: 'match_scheduled',
        }),
      })
    );
  });
});

describe('PUT /api/tournaments/:id/matches/:matchId/start (startMatch)', () => {
  it('returns 400 when tournament is not yet in progress', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'registration_closed',
    } as any);
    vi.mocked(prisma.tournamentMatch.findFirst).mockResolvedValue(mockMatch as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/start')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('in progress');
  });

  it('allows organizers to explicitly start early from registration_closed', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'registration_closed',
    } as any);
    vi.mocked(prisma.tournamentMatch.findFirst).mockResolvedValue(mockMatch as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentMatch.update).mockResolvedValue({
      ...mockMatch,
      status: 'in_progress',
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/start')
      .send({ allowEarlyStart: true });

    expect(res.status).toBe(200);
    expect(prisma.tournament.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tournament-1' },
        data: { status: 'in_progress' },
      })
    );
  });
});

describe('POST /api/tournaments/:id/matches/:matchId/cancel (cancelMatch)', () => {
  it('cancels a non-completed match', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentMatch.findFirst).mockResolvedValue({
      ...mockMatch,
      status: 'scheduled',
    } as any);
    vi.mocked(prisma.tournamentMatch.update).mockResolvedValue({
      ...mockMatch,
      status: 'cancelled',
    } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/cancel')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });
});

describe('GET /api/tournaments/portal/:shareToken (getPublicTournamentPortal)', () => {
  it('does not expose team paymentStatus in the public response', async () => {
    vi.mocked(prisma.tournament.findFirst).mockResolvedValue({
      ...mockTournament,
      isPublic: true,
      courts: [],
      announcements: [],
      organizer: { id: 'organizer-1', name: 'Organizer' },
    } as any);
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([
      { id: 'team-1', name: 'Team Alpha', checkedIn: true, seedNumber: 1, poolId: null },
    ] as any);
    vi.mocked(prisma.tournamentMatch.findMany).mockResolvedValue([]);
    vi.mocked(prisma.tournamentStanding.findMany).mockResolvedValue([]);

    const res = await request(app).get('/api/tournaments/portal/public-token');

    expect(res.status).toBe(200);
    expect(res.body.teams[0].paymentStatus).toBeUndefined();
  });

  it('applies tournament tiebreaker sorting rules to portal standings', async () => {
    vi.mocked(prisma.tournament.findFirst).mockResolvedValue({
      ...mockTournament,
      isPublic: true,
      tiebreakerRules: ['wins'],
      courts: [],
      announcements: [],
      organizer: { id: 'organizer-1', name: 'Organizer' },
    } as any);
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.tournamentMatch.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.tournamentStanding.findMany).mockResolvedValue([
      { id: 's1', points: 3, wins: 1, goalsFor: 2, goalsAgainst: 0 },
    ] as any);

    const res = await request(app).get('/api/tournaments/portal/public-token');

    expect(res.status).toBe(200);
    expect(tournamentService.sortStandingsByTiebreakerRules).toHaveBeenCalledWith(
      expect.any(Array),
      ['wins']
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRATION WAITLIST (#2)
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/tournaments/:id/registration-waitlist (getRegistrationWaitlist)', () => {
  it('returns 200 with waitlist entries', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentRegistrationWaitlist.findMany).mockResolvedValue([
      { id: 'wl-1', tournamentId: 'tournament-1', teamId: 'team-1', position: 1, team: { id: 'team-1', name: 'Team Alpha', captainUserId: null } } as any,
    ]);

    const res = await request(app).get('/api/tournaments/tournament-1/registration-waitlist');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app).get('/api/tournaments/tournament-1/registration-waitlist');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/tournaments/:id/registration-waitlist (joinRegistrationWaitlist)', () => {
  it('returns 201 when team successfully joins the registration waitlist', async () => {
    const fullTournament = { ...mockTournament, status: 'registration', maxTeams: 2 };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(fullTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({ ...mockTeam, captainUserId: 'test-user-id' } as any);
    vi.mocked(prisma.tournamentTeam.count).mockResolvedValue(2); // at capacity
    vi.mocked(prisma.tournamentRegistrationWaitlist.findFirst).mockResolvedValue(null);
    const waitlistEntry = { id: 'wl-1', tournamentId: 'tournament-1', teamId: 'team-1', position: 1, team: { id: 'team-1', name: 'Team Alpha' } };
    vi.mocked(prisma.tournamentRegistrationWaitlist.create).mockResolvedValue(waitlistEntry as any);
    vi.mocked(prisma.tournamentRegistrationWaitlist.count).mockResolvedValue(0);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/registration-waitlist')
      .send({});

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('position', 1);
  });

  it('returns 400 when user has no registered team', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({ ...mockTournament, status: 'registration' } as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/registration-waitlist')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('registered team');
  });

  it('returns 400 when tournament still has open spots', async () => {
    const tournamentWithCap = { ...mockTournament, status: 'registration', maxTeams: 8 };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(tournamentWithCap as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({ ...mockTeam, captainUserId: 'test-user-id' } as any);
    vi.mocked(prisma.tournamentTeam.count).mockResolvedValue(5); // below cap

    const res = await request(app)
      .post('/api/tournaments/tournament-1/registration-waitlist')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('open spots');
  });

  it('returns 400 when team is already on the waitlist', async () => {
    const fullTournament = { ...mockTournament, status: 'registration', maxTeams: 2 };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(fullTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({ ...mockTeam, captainUserId: 'test-user-id' } as any);
    vi.mocked(prisma.tournamentTeam.count).mockResolvedValue(2);
    vi.mocked(prisma.tournamentRegistrationWaitlist.findFirst).mockResolvedValue({ id: 'wl-1' } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/registration-waitlist')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already on');
  });

  it('returns 400 when the tournament is already in progress', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
      maxTeams: 2,
    } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/registration-waitlist')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Registration waitlist');
  });
});

describe('DELETE /api/tournaments/:id/registration-waitlist (leaveRegistrationWaitlist)', () => {
  it('returns 200 when team successfully leaves the waitlist', async () => {
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({ ...mockTeam, captainUserId: 'test-user-id' } as any);
    vi.mocked(prisma.tournamentRegistrationWaitlist.findFirst).mockResolvedValue(
      { id: 'wl-1', tournamentId: 'tournament-1', teamId: 'team-1', position: 1 } as any
    );

    const res = await request(app)
      .delete('/api/tournaments/tournament-1/registration-waitlist');

    expect(res.status).toBe(200);
    expect(prisma.tournamentRegistrationWaitlist.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'wl-1' } })
    );
  });

  it('returns 400 when user has no team in tournament', async () => {
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/tournaments/tournament-1/registration-waitlist');

    expect(res.status).toBe(400);
  });

  it('returns 404 when team is not on the waitlist', async () => {
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({ ...mockTeam, captainUserId: 'test-user-id' } as any);
    vi.mocked(prisma.tournamentRegistrationWaitlist.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/tournaments/tournament-1/registration-waitlist');

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/tournaments/:id/registration-waitlist/:teamId (promoteFromRegistrationWaitlist)', () => {
  it('returns 200 when organizer promotes a team from the waitlist', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentRegistrationWaitlist.findFirst).mockResolvedValue(
      { id: 'wl-1', tournamentId: 'tournament-1', teamId: 'team-1', position: 1 } as any
    );

    const res = await request(app)
      .delete('/api/tournaments/tournament-1/registration-waitlist/team-1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('teamId', 'team-1');
    expect(prisma.tournamentRegistrationWaitlist.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'wl-1' } })
    );
  });

  it('returns 403 when non-organizer tries to promote', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .delete('/api/tournaments/tournament-1/registration-waitlist/team-1');

    expect(res.status).toBe(403);
  });

  it('returns 404 when team is not on the waitlist', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentRegistrationWaitlist.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/tournaments/tournament-1/registration-waitlist/team-99');

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE DISPUTES (#3)
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/tournaments/:id/matches/:matchId/disputes (createScoreDispute)', () => {
  const completedMatch = { ...mockMatch, tournamentId: 'tournament-1', status: 'completed' };

  it('returns 201 when an involved player creates a dispute', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(completedMatch as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    const dispute = { id: 'dispute-1', matchId: 'match-1', reason: 'Wrong score', status: 'open', disputingTeam: { id: 'team-1', name: 'Team Alpha' }, match: { id: 'match-1', homeScore: 2, awayScore: 1 } };
    vi.mocked(prisma.tournamentScoreDispute.create).mockResolvedValue(dispute as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/disputes')
      .send({ reason: 'Wrong score' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 'dispute-1');
  });

  it('returns 400 when reason is missing', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(completedMatch as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/disputes')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('reason');
  });

  it('returns 400 when match is not completed', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(mockMatch as any); // status: 'scheduled'

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/disputes')
      .send({ reason: 'Wrong score' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('completed');
  });

  it('returns 403 when user is not involved in the match', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(completedMatch as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/disputes')
      .send({ reason: 'Wrong score' });

    expect(res.status).toBe(403);
  });

  it('returns 409 when team has already disputed this match', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(completedMatch as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentScoreDispute.create).mockRejectedValue(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' })
    );

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/disputes')
      .send({ reason: 'Wrong score' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already raised');
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/matches/match-1/disputes')
      .send({ reason: 'Wrong score' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/tournaments/:id/matches/:matchId/disputes (getMatchDisputes)', () => {
  it('returns 200 with disputes list when organizer requests', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(mockMatch as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentScoreDispute.findMany).mockResolvedValue([
      { id: 'dispute-1', matchId: 'match-1', reason: 'Wrong score', status: 'open', disputingTeam: mockTeam, resolvedBy: null } as any,
    ]);

    const res = await request(app)
      .get('/api/tournaments/tournament-1/matches/match-1/disputes');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it('returns 200 when a match participant requests disputes', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(mockMatch as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentScoreDispute.findMany).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/tournaments/tournament-1/matches/match-1/disputes');

    expect(res.status).toBe(200);
  });

  it('returns 403 when non-participant requests disputes', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentMatch.findUnique).mockResolvedValue(mockMatch as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/tournaments/tournament-1/matches/match-1/disputes');

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/tournaments/:id/disputes/:disputeId (resolveScoreDispute)', () => {
  const openDispute = {
    id: 'dispute-1',
    matchId: 'match-1',
    status: 'open',
    match: {
      id: 'match-1',
      tournamentId: 'tournament-1',
      status: 'completed',
      homeScore: 2,
      awayScore: 1,
      stage: 'group_stage',
      homeTeamId: 'team-1',
      awayTeamId: 'team-2',
      startedAt: null,
      completedAt: null,
    },
  };

  it('returns 200 when organizer resolves a dispute', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentScoreDispute.findUnique).mockResolvedValue(openDispute as any);
    vi.mocked(prisma.tournamentScoreDispute.update).mockResolvedValue({
      ...openDispute, status: 'resolved', resolution: 'Score confirmed correct',
      disputingTeam: mockTeam, resolvedBy: { id: 'test-user-id', name: 'Test User' },
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/disputes/dispute-1')
      .send({ status: 'resolved', resolution: 'Score confirmed correct' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');
  });

  it('returns 200 when organizer dismisses a dispute', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentScoreDispute.findUnique).mockResolvedValue(openDispute as any);
    vi.mocked(prisma.tournamentScoreDispute.update).mockResolvedValue({
      ...openDispute, status: 'dismissed', disputingTeam: mockTeam, resolvedBy: null,
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/disputes/dispute-1')
      .send({ status: 'dismissed' });

    expect(res.status).toBe(200);
  });

  it('updates the disputed match score when correction payload is provided', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentScoreDispute.findUnique).mockResolvedValue(openDispute as any);
    vi.mocked(prisma.tournamentMatch.update).mockResolvedValue({
      ...mockMatch,
      id: 'match-1',
      homeScore: 0,
      awayScore: 3,
      stage: 'group_stage',
      homeTeam: { id: 'team-1', name: 'Team A' },
      awayTeam: { id: 'team-2', name: 'Team B' },
    } as any);
    vi.mocked(prisma.tournamentScoreDispute.update).mockResolvedValue({
      ...openDispute,
      status: 'resolved',
      disputingTeam: mockTeam,
      resolvedBy: { id: 'test-user-id', name: 'Test User' },
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/disputes/dispute-1')
      .send({ status: 'resolved', resolution: 'score corrected', homeScore: 0, awayScore: 3 });

    expect(res.status).toBe(200);
    expect(prisma.tournamentMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'match-1' },
        data: expect.objectContaining({ homeScore: 0, awayScore: 3 }),
      })
    );
    expect(tournamentService.revertStandings).toHaveBeenCalledWith('match-1', expect.anything());
    expect(tournamentService.updateStandings).toHaveBeenCalledWith(
      'match-1',
      expect.any(Object),
      expect.anything()
    );
    expect(res.body.correctedMatch).toBeDefined();
  });

  it('returns 400 when score correction is sent with dismissed status', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/disputes/dispute-1')
      .send({ status: 'dismissed', homeScore: 1, awayScore: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Score correction');
  });

  it('returns 400 when status is invalid', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/disputes/dispute-1')
      .send({ status: 'cancelled' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('status');
  });

  it('returns 400 when dispute has already been resolved', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentScoreDispute.findUnique).mockResolvedValue({
      ...openDispute, status: 'resolved',
    } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/disputes/dispute-1')
      .send({ status: 'resolved' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already been resolved');
  });

  it('returns 403 when non-organizer tries to resolve', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/disputes/dispute-1')
      .send({ status: 'resolved' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when dispute not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentScoreDispute.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/disputes/dispute-1')
      .send({ status: 'resolved' });

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS (#7)
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/tournaments/:id/announcements (createAnnouncement)', () => {
  it('returns 201 with the created announcement', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    const announcement = {
      id: 'ann-1', tournamentId: 'tournament-1', authorId: 'test-user-id',
      title: 'Schedule Update', body: 'Match times have changed.', isPinned: false,
      createdAt: new Date(), updatedAt: new Date(),
      author: { id: 'test-user-id', name: 'Test User' },
    };
    vi.mocked(prisma.tournamentAnnouncement.create).mockResolvedValue(announcement as any);
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([]);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/announcements')
      .send({ title: 'Schedule Update', body: 'Match times have changed.' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 'ann-1');
    expect(prisma.tournamentAnnouncement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Schedule Update', body: 'Match times have changed.' }),
      })
    );
  });

  it('notifies team captains when an announcement is posted', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentAnnouncement.create).mockResolvedValue({
      id: 'ann-1', tournamentId: 'tournament-1', author: { id: 'test-user-id', name: 'Test User' },
    } as any);
    vi.mocked(prisma.tournamentTeam.findMany).mockResolvedValue([
      { captainUserId: 'captain-1' } as any,
      { captainUserId: 'captain-2' } as any,
    ]);

    await request(app)
      .post('/api/tournaments/tournament-1/announcements')
      .send({ title: 'Update', body: 'Important info.' });

    expect(prisma.tournamentNotification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 'captain-1' }),
          expect.objectContaining({ userId: 'captain-2' }),
        ]),
      })
    );
  });

  it('returns 400 when title is missing', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/announcements')
      .send({ body: 'Some body text.' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('title');
  });

  it('returns 400 when body is missing', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/announcements')
      .send({ title: 'Update' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('body');
  });

  it('returns 403 when non-organizer tries to post', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/announcements')
      .send({ title: 'Update', body: 'Info.' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when title exceeds maximum length', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/announcements')
      .send({ title: 'A'.repeat(201), body: 'Valid body.' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('title');
  });
});

describe('GET /api/tournaments/:id/announcements (getAnnouncements)', () => {
  it('returns 200 with paginated announcements', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    const ann = { id: 'ann-1', title: 'Update', body: 'Info.', isPinned: false, createdAt: new Date(), author: { id: 'test-user-id', name: 'Test User' } };
    vi.mocked(prisma.tournamentAnnouncement.findMany).mockResolvedValue([ann as any]);
    vi.mocked(prisma.tournamentAnnouncement.count).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/tournaments/tournament-1/announcements');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveLength(1);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toHaveProperty('total', 1);
  });

  it('returns 403 when non-participant accesses private tournament announcements', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      isPublic: false,
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/tournaments/tournament-1/announcements');

    expect(res.status).toBe(403);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/tournaments/tournament-1/announcements');

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRATION FIELDS (#9)
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/tournaments/:id/registration-fields (getRegistrationFields)', () => {
  it('returns 200 with fields list', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    const field = { id: 'field-1', label: 'Jersey Number', fieldType: 'number', isRequired: false, sortOrder: 0 };
    vi.mocked(prisma.tournamentRegistrationField.findMany).mockResolvedValue([field as any]);

    const res = await request(app)
      .get('/api/tournaments/tournament-1/registration-fields');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('label', 'Jersey Number');
  });

  it('returns 403 when non-participant accesses private tournament fields', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      isPublic: false,
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/tournaments/tournament-1/registration-fields');

    expect(res.status).toBe(403);
  });

  it('returns 404 when tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/tournaments/tournament-1/registration-fields');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/tournaments/:id/registration-fields (createRegistrationField)', () => {
  it('returns 201 when organizer creates a field', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    const created = { id: 'field-1', tournamentId: 'tournament-1', label: 'Jersey Number', fieldType: 'number', isRequired: true, sortOrder: 0 };
    vi.mocked(prisma.tournamentRegistrationField.create).mockResolvedValue(created as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/registration-fields')
      .send({ label: 'Jersey Number', fieldType: 'number', isRequired: true });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 'field-1');
  });

  it('defaults fieldType to "text" when not provided', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentRegistrationField.create).mockResolvedValue({ id: 'f-1', fieldType: 'text' } as any);

    await request(app)
      .post('/api/tournaments/tournament-1/registration-fields')
      .send({ label: 'Note' });

    expect(prisma.tournamentRegistrationField.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fieldType: 'text' }),
      })
    );
  });

  it('returns 400 when label is missing', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/registration-fields')
      .send({ fieldType: 'text' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('label');
  });

  it('returns 400 when fieldType is invalid', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/registration-fields')
      .send({ label: 'Note', fieldType: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('fieldType');
  });

  it('returns 403 when non-organizer tries to create a field', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/registration-fields')
      .send({ label: 'Jersey Number' });

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/tournaments/:id/registration-fields/:fieldId (updateRegistrationField)', () => {
  it('returns 200 with the updated field', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentRegistrationField.findFirst).mockResolvedValue({ id: 'field-1' } as any);
    vi.mocked(prisma.tournamentRegistrationField.update).mockResolvedValue({ id: 'field-1', label: 'Updated Label', isRequired: true } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/registration-fields/field-1')
      .send({ label: 'Updated Label', isRequired: true });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('label', 'Updated Label');
  });

  it('returns 404 when field not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentRegistrationField.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/registration-fields/field-99')
      .send({ label: 'X' });

    expect(res.status).toBe(404);
  });

  it('returns 403 when non-organizer tries to update', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/registration-fields/field-1')
      .send({ label: 'X' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/tournaments/:id/registration-fields/:fieldId (deleteRegistrationField)', () => {
  it('returns 200 when organizer deletes a field', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentRegistrationField.findFirst).mockResolvedValue({ id: 'field-1' } as any);

    const res = await request(app)
      .delete('/api/tournaments/tournament-1/registration-fields/field-1');

    expect(res.status).toBe(200);
    expect(prisma.tournamentRegistrationField.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'field-1' } })
    );
  });

  it('returns 403 when non-organizer tries to delete', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .delete('/api/tournaments/tournament-1/registration-fields/field-1');

    expect(res.status).toBe(403);
  });
});

describe('POST /api/tournaments/:id/teams/:teamId/answers (submitTeamAnswers)', () => {
  it('returns 200 when captain submits answers', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({ ...mockTeam, captainUserId: 'test-user-id' } as any);
    vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(true);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    vi.mocked(prisma.tournamentRegistrationField.findMany).mockResolvedValue([
      { id: 'field-1' } as any,
    ]);
    vi.mocked(prisma.tournamentTeamAnswer.findMany).mockResolvedValue([
      { id: 'ans-1', fieldId: 'field-1', teamId: 'team-1', value: '7', field: { id: 'field-1', label: 'Jersey', fieldType: 'number' } } as any,
    ]);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/team-1/answers')
      .send({ answers: [{ fieldId: 'field-1', value: '7' }] });

    expect(res.status).toBe(200);
    expect(prisma.tournamentTeamAnswer.upsert).toHaveBeenCalled();
  });

  it('returns 400 when answers is not an array', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/team-1/answers')
      .send({ answers: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('array');
  });

  it('returns 403 when neither captain nor organizer', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(false);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/teams/team-1/answers')
      .send({ answers: [] });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/tournaments/:id/teams/:teamId/answers (getTeamAnswers)', () => {
  it('returns 200 with team answers', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentTeamAnswer.findMany).mockResolvedValue([
      { id: 'ans-1', fieldId: 'field-1', teamId: 'team-1', value: '7', field: { id: 'field-1', label: 'Jersey', fieldType: 'number' } } as any,
    ]);

    const res = await request(app)
      .get('/api/tournaments/tournament-1/teams/team-1/answers');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('value', '7');
  });

  it('returns 404 when team not found', async () => {
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/tournaments/tournament-1/teams/team-1/answers');

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYER STATS (#12)
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/tournaments/:id/teams/:teamId/player-stats (getPlayerStats)', () => {
  it('returns 200 with player stats', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPlayerStat.findMany).mockResolvedValue([
      { id: 'stat-1', playerId: 'player-1', statKey: 'goals', value: 3, player: { id: 'player-1', playerName: 'John', jerseyNumber: null } } as any,
    ]);

    const res = await request(app)
      .get('/api/tournaments/tournament-1/teams/team-1/player-stats');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('statKey', 'goals');
  });

  it('returns 404 when team not found', async () => {
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/tournaments/tournament-1/teams/team-1/player-stats');

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tournaments/:id/teams/:teamId/players/:playerId/stats (upsertPlayerStat)', () => {
  it('returns 200 when organizer records a stat', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValue(mockPlayer as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(false);
    vi.mocked(prisma.tournamentPlayerStat.upsert).mockResolvedValue(
      { id: 'stat-1', playerId: 'player-1', statKey: 'goals', value: 3, player: { id: 'player-1', playerName: 'John' } } as any
    );

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/players/player-1/stats')
      .send({ statKey: 'goals', value: 3 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('statKey', 'goals');
    expect(res.body).toHaveProperty('value', 3);
  });

  it('returns 200 when captain records a stat', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValue(mockPlayer as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(true);
    vi.mocked(prisma.tournamentPlayerStat.upsert).mockResolvedValue(
      { id: 'stat-1', statKey: 'assists', value: 1, player: { id: 'player-1', playerName: 'John' } } as any
    );

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/players/player-1/stats')
      .send({ statKey: 'assists', value: 1 });

    expect(res.status).toBe(200);
  });

  it('returns 400 when statKey is missing', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValue(mockPlayer as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/players/player-1/stats')
      .send({ value: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('statKey');
  });

  it('returns 400 when value is not a number', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValue(mockPlayer as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/players/player-1/stats')
      .send({ statKey: 'goals', value: 'three' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('number');
  });

  it('returns 403 when neither organizer nor captain', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValue(mockPlayer as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    vi.mocked(tournamentService.isTeamCaptain).mockResolvedValue(false);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/players/player-1/stats')
      .send({ statKey: 'goals', value: 2 });

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TOURNAMENT CLONE (#14)
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/tournaments/:id/clone (cloneTournament)', () => {
  const clonedTournament = {
    ...mockTournament,
    id: 'tournament-clone-1',
    name: 'Test Tournament (Copy)',
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    organizer: { id: 'test-user-id', name: 'Test User', email: 'test@example.com' },
  };

  // Source tournament enriched with the nested data the new clone reads
  const sourceTournamentWithNested = {
    ...mockTournament,
    categories: [],
    pools: [],
    registrationFields: [],
    courts: [],
  };

  it('returns 201 with the cloned tournament', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(sourceTournamentWithNested as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournament.create).mockResolvedValue(clonedTournament as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/clone');

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Tournament (Copy)');
  });

  it('creates the clone with the caller as organizer', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(sourceTournamentWithNested as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournament.create).mockResolvedValue(clonedTournament as any);

    await request(app).post('/api/tournaments/tournament-1/clone');

    expect(prisma.tournament.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizerId: 'test-user-id' }),
      })
    );
  });

  it('sets startDate to 7 days from now for the clone', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(sourceTournamentWithNested as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournament.create).mockResolvedValue(clonedTournament as any);

    const before = Date.now();
    await request(app).post('/api/tournaments/tournament-1/clone');
    const after = Date.now();

    const callArgs = vi.mocked(prisma.tournament.create).mock.calls[0][0];
    const clonedStart = (callArgs as any).data.startDate.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(clonedStart).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(clonedStart).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  it('returns 403 when non-organizer tries to clone', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(sourceTournamentWithNested as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/clone');

    expect(res.status).toBe(403);
  });

  it('returns 404 when source tournament not found', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/clone');

    expect(res.status).toBe(404);
  });

  // ── Deep-clone tests ──────────────────────────────────────────────────────

  it('deep-clones categories, preserving name and sortOrder', async () => {
    const sourceWithCategories = {
      ...sourceTournamentWithNested,
      categories: [
        { id: 'cat-1', name: 'Open', description: null, sortOrder: 0 },
        { id: 'cat-2', name: 'Junior', description: 'Under 18', sortOrder: 1 },
      ],
    };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(sourceWithCategories as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournament.create).mockResolvedValue(clonedTournament as any);
    vi.mocked(prisma.tournamentCategory.create).mockResolvedValue({
      id: 'new-cat-1', name: 'Open', tournamentId: 'tournament-clone-1',
    } as any);

    await request(app).post('/api/tournaments/tournament-1/clone');

    expect(prisma.tournamentCategory.create).toHaveBeenCalledTimes(2);
    expect(prisma.tournamentCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Open', sortOrder: 0 }),
      })
    );
    expect(prisma.tournamentCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Junior', sortOrder: 1 }),
      })
    );
  });

  it('deep-clones pools without teams', async () => {
    const sourceWithPools = {
      ...sourceTournamentWithNested,
      pools: [
        { id: 'pool-1', name: 'Pool A', description: null, maxTeams: 4, venue: null, categoryId: null },
        { id: 'pool-2', name: 'Pool B', description: 'B side', maxTeams: 6, venue: 'Gym B', categoryId: null },
      ],
    };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(sourceWithPools as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournament.create).mockResolvedValue(clonedTournament as any);

    await request(app).post('/api/tournaments/tournament-1/clone');

    expect(prisma.tournamentPool.create).toHaveBeenCalledTimes(2);
    expect(prisma.tournamentPool.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Pool A', maxTeams: 4 }),
      })
    );
    expect(prisma.tournamentPool.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Pool B', maxTeams: 6 }),
      })
    );
  });

  it('re-links cloned pools to cloned categories by new id', async () => {
    const sourceWithBoth = {
      ...sourceTournamentWithNested,
      categories: [
        { id: 'src-cat-1', name: 'Open', description: null, sortOrder: 0 },
      ],
      pools: [
        { id: 'src-pool-1', name: 'Pool A', description: null, maxTeams: 4, venue: null, categoryId: 'src-cat-1' },
      ],
    };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(sourceWithBoth as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournament.create).mockResolvedValue(clonedTournament as any);
    vi.mocked(prisma.tournamentCategory.create).mockResolvedValue({
      id: 'new-cat-id',
      name: 'Open',
      tournamentId: 'tournament-clone-1',
    } as any);

    await request(app).post('/api/tournaments/tournament-1/clone');

    // The pool should be created with the NEW category id, not the old one
    expect(prisma.tournamentPool.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ categoryId: 'new-cat-id' }),
      })
    );
  });

  it('deep-clones registration fields', async () => {
    const sourceWithFields = {
      ...sourceTournamentWithNested,
      registrationFields: [
        { id: 'field-1', label: 'T-Shirt Size', fieldType: 'select', isRequired: true, options: ['S', 'M', 'L'], sortOrder: 0 },
        { id: 'field-2', label: 'Emergency Contact', fieldType: 'text', isRequired: false, options: [], sortOrder: 1 },
      ],
    };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(sourceWithFields as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournament.create).mockResolvedValue(clonedTournament as any);

    await request(app).post('/api/tournaments/tournament-1/clone');

    expect(prisma.tournamentRegistrationField.create).toHaveBeenCalledTimes(2);
    expect(prisma.tournamentRegistrationField.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          label: 'T-Shirt Size',
          fieldType: 'select',
          isRequired: true,
          options: ['S', 'M', 'L'],
        }),
      })
    );
  });

  it('deep-clones active courts', async () => {
    const sourceWithCourts = {
      ...sourceTournamentWithNested,
      courts: [
        { id: 'court-1', name: 'Court 1', location: 'Gym A', isActive: true },
        { id: 'court-2', name: 'Court 2', location: null, isActive: true },
      ],
    };
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(sourceWithCourts as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournament.create).mockResolvedValue(clonedTournament as any);

    await request(app).post('/api/tournaments/tournament-1/clone');

    expect(prisma.tournamentCourt.create).toHaveBeenCalledTimes(2);
    expect(prisma.tournamentCourt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Court 1', location: 'Gym A', isActive: true }),
      })
    );
  });

  it('skips deep-clone sub-entities when source has none', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(sourceTournamentWithNested as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournament.create).mockResolvedValue(clonedTournament as any);

    await request(app).post('/api/tournaments/tournament-1/clone');

    expect(prisma.tournamentCategory.create).not.toHaveBeenCalled();
    expect(prisma.tournamentPool.create).not.toHaveBeenCalled();
    expect(prisma.tournamentRegistrationField.create).not.toHaveBeenCalled();
    expect(prisma.tournamentCourt.create).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NEGATIVE AUTHORIZATION + ROLE-CONFLICT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Authorization: updateTeam captainUserId role-conflict checks', () => {
  it('returns 400 when new captain user does not exist', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    // User not found
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1')
      .send({ captainUserId: 'nonexistent-user' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 403 when new captain is already an organizer/co-organizer', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin)
      .mockResolvedValueOnce(true)  // requester is org
      .mockResolvedValueOnce(true); // new captain is also org
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'org-user', deletedAt: null } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1')
      .send({ captainUserId: 'org-user' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/organizer|co-organizer/i);
  });

  it('returns 400 when new captain is already captain of another team', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst)
      .mockResolvedValueOnce(mockTeam as any)  // current team lookup
      .mockResolvedValueOnce({ id: 'team-2', name: 'Team Beta' } as any); // conflict
    vi.mocked(tournamentService.isOrganizerOrAdmin)
      .mockResolvedValueOnce(true)   // requester is org
      .mockResolvedValueOnce(false); // new captain is not org
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'other-captain', deletedAt: null } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1')
      .send({ captainUserId: 'other-captain' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/captain/i);
  });
});

describe('Authorization: updatePlayer userId role-conflict checks', () => {
  it('returns 400 when new userId does not exist', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPlayer.findUnique).mockResolvedValue(mockPlayer as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/players/player-1')
      .send({ userId: 'nonexistent-user' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 403 when new userId belongs to an organizer/co-organizer', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.tournamentPlayer.findUnique).mockResolvedValue(mockPlayer as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin)
      .mockResolvedValueOnce(true)  // requester check
      .mockResolvedValueOnce(true); // new userId is also org
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'org-user', deletedAt: null } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/players/player-1')
      .send({ userId: 'org-user' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/organizer/i);
  });

  it('returns 400 when new userId is captain of another team', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst)
      .mockResolvedValueOnce(mockTeam as any)
      .mockResolvedValueOnce({ id: 'team-2' } as any); // captain conflict
    vi.mocked(prisma.tournamentPlayer.findUnique).mockResolvedValue(mockPlayer as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'other-captain', deletedAt: null } as any);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/teams/team-1/players/player-1')
      .send({ userId: 'other-captain' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/captain/i);
  });
});

describe('Authorization: addAdmin player-conflict check', () => {
  it('returns 400 when target user is already a team captain in this tournament', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...mockVerifiedUser, emailVerified: true, deletedAt: null } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    // Captain conflict
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({ id: 'team-1' } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/admins')
      .send({ userId: 'other-user-id' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/team registered/i);
  });

  it('returns 400 when target user is already a registered player in this tournament', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...mockVerifiedUser, emailVerified: true, deletedAt: null } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    // No captain conflict but player conflict
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValue({ id: 'player-1' } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/admins')
      .send({ userId: 'other-user-id' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/player/i);
  });

  it('clears permission cache after admin is added', async () => {
    const { clearUserPermissionCache } = await import('../../services/permissionService');
    vi.mocked(clearUserPermissionCache).mockResolvedValue(undefined);

    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...mockVerifiedUser, emailVerified: true, deletedAt: null } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentAdminRole.create).mockResolvedValue(mockAdminRole as any);

    await request(app)
      .post('/api/tournaments/tournament-1/admins')
      .send({ userId: 'other-user-id' });

    expect(clearUserPermissionCache).toHaveBeenCalledWith('other-user-id');
  });
});

describe('Authorization: removeAdmin clears permission cache', () => {
  it('clears permission cache after admin is removed', async () => {
    const { clearUserPermissionCache } = await import('../../services/permissionService');
    vi.mocked(clearUserPermissionCache).mockResolvedValue(undefined);

    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.tournamentAdminRole.findFirst).mockResolvedValue(mockAdminRole as any);
    vi.mocked(prisma.tournamentAdminRole.delete).mockResolvedValue(mockAdminRole as any);

    await request(app).delete('/api/tournaments/tournament-1/admins/other-user-id');

    expect(clearUserPermissionCache).toHaveBeenCalledWith('other-user-id');
  });
});

describe('Idempotency: startMatch is safe under concurrent calls', () => {
  it('returns 200 when match is already in_progress (idempotent)', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);
    vi.mocked(prisma.tournamentMatch.findFirst).mockResolvedValue({
      ...mockMatch,
      status: 'in_progress',
      startedAt: new Date(),
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/start')
      .send({});

    expect(res.status).toBe(200);
    // Should not call updateMany since match is already in_progress
    expect(prisma.tournamentMatch.updateMany).not.toHaveBeenCalled();
  });

  it('returns 400 when match is already completed', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      ...mockTournament,
      status: 'in_progress',
    } as any);
    vi.mocked(prisma.tournamentMatch.findFirst).mockResolvedValue({
      ...mockMatch,
      status: 'completed',
    } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);

    const res = await request(app)
      .put('/api/tournaments/tournament-1/matches/match-1/start')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already completed/i);
  });
});

describe('QR check-in: single-use token behavior', () => {
  it('clears the checkInToken after successful check-in', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue({
      ...mockTeam,
      checkInToken: 'valid-token',
      checkedIn: false,
      checkedInAt: null,
    } as any);
    vi.mocked(prisma.tournamentTeam.update).mockResolvedValue({
      ...mockTeam,
      checkedIn: true,
      checkedInAt: new Date(),
      checkInToken: null,
    } as any);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/check-in/qr')
      .send({ token: 'valid-token' });

    expect(res.status).toBe(200);
    expect(prisma.tournamentTeam.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ checkInToken: null }),
      })
    );
  });

  it('returns 404 when QR token does not match any team', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tournaments/tournament-1/check-in/qr')
      .send({ token: 'invalid-or-used-token' });

    expect(res.status).toBe(404);
  });
});

describe('Notifications: addAdmin notifies new co-organizer', () => {
  it('sends a notification to the newly added admin', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizer).mockReturnValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...mockVerifiedUser, emailVerified: true, deletedAt: null } as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(false);
    vi.mocked(prisma.tournamentTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentPlayer.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.tournamentAdminRole.create).mockResolvedValue(mockAdminRole as any);
    vi.mocked(prisma.tournamentNotification.create).mockResolvedValue({} as any);

    await request(app)
      .post('/api/tournaments/tournament-1/admins')
      .send({ userId: 'other-user-id' });

    expect(prisma.tournamentNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'other-user-id' }),
      })
    );
  });
});

describe('Notifications: resolveMatchIncident notifies reporter', () => {
  it('notifies the incident reporter when incident is resolved', async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue(mockTournament as any);
    vi.mocked(tournamentService.isOrganizerOrAdmin).mockResolvedValue(true);
    vi.mocked(prisma.tournamentMatchIncident.findFirst).mockResolvedValue({
      id: 'incident-1',
      tournamentId: 'tournament-1',
      matchId: 'match-1',
      reportedByUserId: 'reporter-user-id',
      status: 'open',
      description: 'Test incident',
    } as any);
    vi.mocked(prisma.tournamentMatchIncident.update).mockResolvedValue({
      id: 'incident-1',
      status: 'resolved',
    } as any);
    vi.mocked(prisma.tournamentNotification.create).mockResolvedValue({} as any);

    await request(app)
      .put('/api/tournaments/tournament-1/incidents/incident-1/resolve')
      .send({ status: 'resolved', resolution: 'Issue fixed' });

    expect(prisma.tournamentNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'reporter-user-id' }),
      })
    );
  });
});
