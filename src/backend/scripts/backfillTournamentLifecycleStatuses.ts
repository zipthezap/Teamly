import prisma from '../config/database';
import * as tournamentService from '../services/tournamentService';
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
    const safeTournamentName = tournament.name
      .replace(/[\r\n\t]/g, ' ')
      .slice(0, 80);
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
      // Ensure in-memory sync cache is invalidated so subsequent reads reflect this manual update
      try {
        tournamentService.invalidateSyncCache(tournament.id);
      } catch (err) {
        // Non-critical for backfill, but log for observability
        // eslint-disable-next-line no-console
        console.warn('Failed to invalidate sync cache after backfill update', err);
      }
    }

    updatedCount += 1;
    console.log(
      `[${hasDryRunFlag ? 'DRY-RUN' : 'UPDATED'}] ${tournament.id} (${safeTournamentName}): ${tournament.status} -> ${nextStatus}`
    );
  }

  console.log(
    `${hasDryRunFlag ? 'Dry run complete' : 'Backfill complete'}: ${updatedCount} tournament(s) ${
      hasDryRunFlag ? 'would be updated' : 'updated'
    }.`
  );
};

run()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
