import prisma from '../config/database';
import * as tournamentService from '../services/tournamentService';
import { BracketStage, MatchStatus, TournamentFormat } from '../../shared/types/tournament.types';

const SCENARIO_PREFIX = '[Seed] Groups KO';
const ORGANIZER_EMAIL = 'seed.tournament.lifecycle@teamly.local';

const createOrGetOrganizer = async () => {
  const existing = await prisma.user.findUnique({ where: { email: ORGANIZER_EMAIL } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email: ORGANIZER_EMAIL,
      name: 'Tournament Seed Organizer',
      authProvider: 'local',
    },
  });
};

const buildTournamentDates = (mode: 'registration_open' | 'registration_closed' | 'active') => {
  const now = new Date();
  if (mode === 'registration_open') {
    return {
      startDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      registrationStartDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    };
  }
  if (mode === 'registration_closed') {
    return {
      startDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
      registrationStartDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    };
  }
  return {
    startDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    endDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
    registrationStartDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    registrationDeadline: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
  };
};

const syncStatus = async (tournamentId: string) => {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      status: true,
      name: true,
      startDate: true,
      endDate: true,
      registrationStartDate: true,
      registrationDeadline: true,
    },
  });
  if (!tournament) return null;
  return tournamentService.syncTournamentAutoStatus(tournament, 'seed_script');
};

const createTeams = async (tournamentId: string, count: number) => {
  for (let i = 1; i <= count; i += 1) {
    await prisma.tournamentTeam.create({
      data: {
        tournamentId,
        name: `Seed Team ${i}`,
      },
    });
  }
};

const completeGroupMatch = async (
  tournamentId: string,
  matchId: string,
  homeScore: number,
  awayScore: number
) => {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return;
  await prisma.$transaction(async (tx) => {
    await tx.tournamentMatch.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.COMPLETED,
        homeScore,
        awayScore,
        startedAt: new Date(Date.now() - 45 * 60_000),
        completedAt: new Date(),
      },
    });
    await tournamentService.updateStandings(matchId, tournament, tx);
  });
};

const createBaseTournament = async (
  organizerId: string,
  name: string,
  mode: 'registration_open' | 'registration_closed' | 'active',
  autoGenerateBrackets = false
) => {
  const dates = buildTournamentDates(mode);
  const tournament = await prisma.tournament.create({
    data: {
      name,
      organizerId,
      sportType: 'football',
      format: TournamentFormat.GROUPS_KNOCKOUT,
      autoGenerateBrackets,
      ...dates,
    },
  });
  await syncStatus(tournament.id);
  return tournament;
};

const seedRegistrationOpen = async (organizerId: string) => {
  return createBaseTournament(
    organizerId,
    `${SCENARIO_PREFIX} • Registration Open`,
    'registration_open'
  );
};

const seedRegistrationClosed = async (organizerId: string) => {
  const tournament = await createBaseTournament(
    organizerId,
    `${SCENARIO_PREFIX} • Registration Closed`,
    'registration_closed'
  );
  await createTeams(tournament.id, 8);
  await syncStatus(tournament.id);
  return tournament;
};

const seedInProgressGroupPlay = async (organizerId: string) => {
  const tournament = await createBaseTournament(
    organizerId,
    `${SCENARIO_PREFIX} • In Progress`,
    'active'
  );
  await createTeams(tournament.id, 8);
  await tournamentService.generateGroupsKnockoutBrackets(tournament.id, 2);

  const firstGroupMatch = await prisma.tournamentMatch.findFirst({
    where: { tournamentId: tournament.id, stage: BracketStage.GROUP_STAGE },
    orderBy: [{ roundNumber: 'asc' }, { matchOrder: 'asc' }],
  });
  if (firstGroupMatch) {
    await prisma.tournamentMatch.update({
      where: { id: firstGroupMatch.id },
      data: {
        status: MatchStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });
  }
  await syncStatus(tournament.id);
  return tournament;
};

const seedFormingBrackets = async (organizerId: string) => {
  const tournament = await createBaseTournament(
    organizerId,
    `${SCENARIO_PREFIX} • Forming Brackets`,
    'active'
  );
  await createTeams(tournament.id, 8);
  await tournamentService.generateGroupsKnockoutBrackets(tournament.id, 2);
  const groupMatches = await prisma.tournamentMatch.findMany({
    where: { tournamentId: tournament.id, stage: BracketStage.GROUP_STAGE },
    orderBy: [{ roundNumber: 'asc' }, { matchOrder: 'asc' }],
  });
  for (const [index, match] of groupMatches.entries()) {
    const homeScore = (index % 4) + 1;
    const awayScore = index % 3;
    await completeGroupMatch(tournament.id, match.id, homeScore, awayScore);
  }
  await syncStatus(tournament.id);
  return tournament;
};

const seedComplete = async (organizerId: string) => {
  const tournament = await createBaseTournament(
    organizerId,
    `${SCENARIO_PREFIX} • Complete`,
    'active'
  );
  await createTeams(tournament.id, 8);
  await tournamentService.generateGroupsKnockoutBrackets(tournament.id, 2);
  const groupMatches = await prisma.tournamentMatch.findMany({
    where: { tournamentId: tournament.id, stage: BracketStage.GROUP_STAGE },
    orderBy: [{ roundNumber: 'asc' }, { matchOrder: 'asc' }],
  });
  for (const [index, match] of groupMatches.entries()) {
    await completeGroupMatch(tournament.id, match.id, (index % 3) + 2, index % 2);
  }
  await tournamentService.generateKnockoutFromStandings(tournament.id);
  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { endDate: new Date(Date.now() - 60_000) },
  });
  await syncStatus(tournament.id);
  return tournament;
};

const cleanupExistingSeeds = async () => {
  const existing = await prisma.tournament.findMany({
    where: { name: { startsWith: SCENARIO_PREFIX } },
    select: { id: true },
  });
  if (existing.length === 0) return;
  const ids = existing.map((t) => t.id);
  await prisma.$transaction([
    prisma.tournamentStanding.deleteMany({ where: { tournamentId: { in: ids } } }),
    prisma.tournamentMatch.deleteMany({ where: { tournamentId: { in: ids } } }),
    prisma.tournamentTeam.deleteMany({ where: { tournamentId: { in: ids } } }),
    prisma.tournament.deleteMany({ where: { id: { in: ids } } }),
  ]);
};

const run = async () => {
  await cleanupExistingSeeds();
  const organizer = await createOrGetOrganizer();

  const created = await Promise.all([
    seedRegistrationOpen(organizer.id),
    seedRegistrationClosed(organizer.id),
    seedInProgressGroupPlay(organizer.id),
    seedFormingBrackets(organizer.id),
    seedComplete(organizer.id),
  ]);

  const summaries = await Promise.all(created.map(async (tournament) => {
    const [fresh, groupMatches, knockoutMatches] = await Promise.all([
      prisma.tournament.findUnique({
        where: { id: tournament.id },
        select: { id: true, name: true, status: true },
      }),
      prisma.tournamentMatch.count({
        where: { tournamentId: tournament.id, stage: BracketStage.GROUP_STAGE },
      }),
      prisma.tournamentMatch.count({
        where: { tournamentId: tournament.id, stage: { not: BracketStage.GROUP_STAGE } },
      }),
    ]);
    return {
      id: fresh?.id,
      name: fresh?.name,
      status: fresh?.status,
      groupMatches,
      knockoutMatches,
    };
  }));

  // eslint-disable-next-line no-console
  console.table(summaries);
  // eslint-disable-next-line no-console
  console.log(`Seeded ${summaries.length} lifecycle scenarios successfully.`);
};

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to seed lifecycle scenarios:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
