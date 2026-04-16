import prisma from '../config/database';
import { LeagueStatus, Prisma, SportType } from '@prisma/client';
import { NotFoundError, ForbiddenError } from '../utils/errors';

export interface CreateLeagueData {
  title: string;
  description?: string;
  sport: string;
  groupId: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  city?: string;
  country?: string;
  startDate: Date;
  endDate?: Date;
  sessionCount?: number;
  isPublic?: boolean;
  maxTeams?: number;
}

const DEFAULT_LEAGUE_PAGE = 1;
const DEFAULT_LEAGUE_LIMIT = 20;
const MAX_LEAGUE_LIMIT = 100;

function normalizePositiveInt(
  value: number | string | undefined,
  fallback: number,
  options?: { min?: number; max?: number }
) {
  const min = options?.min ?? 1;
  const max = options?.max ?? Number.MAX_SAFE_INTEGER;
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;

  if (!Number.isInteger(parsed) || parsed === undefined || Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

export class LeagueService {
  async createLeague(data: CreateLeagueData, userId: string) {
    const { groupId, sport, startDate, endDate, ...rest } = data;
    return prisma.league.create({
      data: {
        ...rest,
        sport: sport as SportType,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        creatorId: userId,
        groupId,
      },
      include: {
        creator: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
    });
  }

  async getLeagues(params: { groupId?: string; status?: string; page?: number | string; limit?: number | string }) {
    const { groupId, status } = params;
    const page = normalizePositiveInt(params.page, DEFAULT_LEAGUE_PAGE);
    const limit = normalizePositiveInt(params.limit, DEFAULT_LEAGUE_LIMIT, {
      max: MAX_LEAGUE_LIMIT,
    });
    const where: Prisma.LeagueWhereInput = {};
    if (groupId) where.groupId = groupId;
    if (status) where.status = status as LeagueStatus;
    const [leagues, total] = await Promise.all([
      prisma.league.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
          _count: { select: { teams: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.league.count({ where }),
    ]);
    return { leagues, total, page, limit };
  }

  async getLeagueById(id: string) {
    const league = await prisma.league.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
        teams: { include: { players: true } },
        standings: { include: { team: true }, orderBy: { points: 'desc' } },
      },
    });
    if (!league) throw new NotFoundError('League not found');
    return league;
  }

  async updateLeague(id: string, data: Partial<CreateLeagueData> & { status?: string }, userId: string) {
    const league = await prisma.league.findUnique({ where: { id } });
    if (!league) throw new NotFoundError('League not found');
    if (league.creatorId !== userId) throw new ForbiddenError('Forbidden');
    const { sport, startDate, endDate, groupId: _groupId, status, ...rest } = data;
    return prisma.league.update({
      where: { id },
      data: {
        ...rest,
        ...(sport ? { sport: sport as SportType } : {}),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
        ...(status ? { status: status as LeagueStatus } : {}),
      },
    });
  }

  async deleteLeague(id: string, userId: string) {
    const league = await prisma.league.findUnique({ where: { id } });
    if (!league) throw new NotFoundError('League not found');
    if (league.creatorId !== userId) throw new ForbiddenError('Forbidden');
    await prisma.league.delete({ where: { id } });
  }

  async addTeam(leagueId: string, data: { name: string; captainUserId?: string }, userId: string) {
    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundError('League not found');
    if (league.creatorId !== userId) throw new ForbiddenError('Forbidden');
    const team = await prisma.leagueTeam.create({
      data: { name: data.name, leagueId, captainUserId: data.captainUserId },
    });
    await prisma.leagueStanding.create({
      data: { leagueId, teamId: team.id },
    });
    return team;
  }

  async removeTeam(leagueId: string, teamId: string, userId: string) {
    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundError('League not found');
    if (league.creatorId !== userId) throw new ForbiddenError('Forbidden');
    await prisma.leagueTeam.delete({ where: { id: teamId } });
  }

  async getStandings(leagueId: string) {
    return prisma.leagueStanding.findMany({
      where: { leagueId },
      include: { team: true },
      orderBy: [{ points: 'desc' }, { goalsFor: 'desc' }],
    });
  }

  async linkSession(leagueId: string, sessionId: string, roundNumber: number | undefined, userId: string) {
    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundError('League not found');
    if (league.creatorId !== userId) throw new ForbiddenError('Forbidden');
    return prisma.leagueSessionEntry.create({
      data: { leagueId, sessionId, roundNumber },
    });
  }

  async updateMatch(
    leagueId: string,
    matchId: string,
    result: { homeScore: number; awayScore: number; status?: string },
    userId: string
  ) {
    const league = await prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundError('League not found');
    if (league.creatorId !== userId) throw new ForbiddenError('Forbidden');
    const match = await prisma.leagueMatch.update({
      where: { id: matchId },
      data: {
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        status: result.status ?? 'completed',
        playedAt: new Date(),
      },
    });
    if (result.status === 'completed' || !result.status) {
      const { homeTeamId, awayTeamId, homeScore, awayScore } = match;
      const homeWon = (homeScore ?? 0) > (awayScore ?? 0);
      const awayWon = (awayScore ?? 0) > (homeScore ?? 0);
      const drawn = homeScore === awayScore;
      await Promise.all([
        prisma.leagueStanding.upsert({
          where: { leagueId_teamId: { leagueId, teamId: homeTeamId } },
          create: {
            leagueId,
            teamId: homeTeamId,
            played: 1,
            won: homeWon ? 1 : 0,
            drawn: drawn ? 1 : 0,
            lost: awayWon ? 1 : 0,
            goalsFor: homeScore ?? 0,
            goalsAgainst: awayScore ?? 0,
            points: homeWon ? 3 : drawn ? 1 : 0,
          },
          update: {
            played: { increment: 1 },
            won: { increment: homeWon ? 1 : 0 },
            drawn: { increment: drawn ? 1 : 0 },
            lost: { increment: awayWon ? 1 : 0 },
            goalsFor: { increment: homeScore ?? 0 },
            goalsAgainst: { increment: awayScore ?? 0 },
            points: { increment: homeWon ? 3 : drawn ? 1 : 0 },
          },
        }),
        prisma.leagueStanding.upsert({
          where: { leagueId_teamId: { leagueId, teamId: awayTeamId } },
          create: {
            leagueId,
            teamId: awayTeamId,
            played: 1,
            won: awayWon ? 1 : 0,
            drawn: drawn ? 1 : 0,
            lost: homeWon ? 1 : 0,
            goalsFor: awayScore ?? 0,
            goalsAgainst: homeScore ?? 0,
            points: awayWon ? 3 : drawn ? 1 : 0,
          },
          update: {
            played: { increment: 1 },
            won: { increment: awayWon ? 1 : 0 },
            drawn: { increment: drawn ? 1 : 0 },
            lost: { increment: homeWon ? 1 : 0 },
            goalsFor: { increment: awayScore ?? 0 },
            goalsAgainst: { increment: homeScore ?? 0 },
            points: { increment: awayWon ? 3 : drawn ? 1 : 0 },
          },
        }),
      ]);
    }
    return match;
  }
}

export const leagueService = new LeagueService();
