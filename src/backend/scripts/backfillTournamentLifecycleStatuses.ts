import prisma from '../config/database';
import { computeAutoStatus } from '../services/tournamentService';
import { MatchStatus, TournamentStatus } from '../../shared/types/tournament.types';

const hasDryRunFlag = process.argv.includes('--dry-run');

const run = async (): Promise<void> => {
  const tournaments = await prisma.tournament.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      registrationStartDate: true,
      registrationDeadline: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let updatedCount = 0;
  for (const tournament of tournaments) {
    const [matchCount, incompleteMatchCount] = await Promise.all([
      prisma.tournamentMatch.count({ where: { tournamentId: tournament.id } }),
      prisma.tournamentMatch.count({
        where: {
          tournamentId: tournament.id,
          OR: [
            { status: { not: MatchStatus.COMPLETED } },
            { homeScore: null },
            { awayScore: null },
          ],
        },
      }),
    ]);

    const nextStatus = computeAutoStatus({
      ...tournament,
      hasMatches: matchCount > 0,
      hasIncompleteMatches: incompleteMatchCount > 0,
    });

    if (!nextStatus || nextStatus === tournament.status) {
      continue;
    }

    if (!hasDryRunFlag) {
      await prisma.tournament.update({
        where: { id: tournament.id },
        data: { status: nextStatus as TournamentStatus },
      });
    }

    updatedCount += 1;
    // eslint-disable-next-line no-console
    console.log(
      `[${hasDryRunFlag ? 'DRY-RUN' : 'UPDATED'}] ${tournament.id} (${tournament.name}): ${tournament.status} -> ${nextStatus}`
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `${hasDryRunFlag ? 'Dry run complete' : 'Backfill complete'}: ${updatedCount} tournament(s) ${
      hasDryRunFlag ? 'would be updated' : 'updated'
    }.`
  );
};

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
