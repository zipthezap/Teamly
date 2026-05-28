import prisma from '../config/database';

const hasDryRunFlag = process.argv.includes('--dry-run');

const run = async (): Promise<void> => {
  const requests: any[] = await prisma.teamUpRequest.findMany({
    where: { requestType: 'need_players' },
    select: {
      id: true,
      title: true,
      playersNeeded: true,
      skillLevel: true,
      // @ts-ignore
      positions: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  let createdCount = 0;
  for (const request of requests) {
    if (request.positions.length > 0) {
      continue;
    }

    const safeTitle = request.title.replace(/[\r\n\t]/g, ' ').slice(0, 80);
      if (!hasDryRunFlag) {
      await (prisma as any).teamUpRequestPosition.create({
        data: {
          teamUpRequestId: request.id,
          name: 'Player',
          slotsNeeded: Math.max(request.playersNeeded || 1, 1),
          skillLevelRequired: request.skillLevel || null,
        },
      });
    }

    createdCount += 1;
    console.log(
      `[${hasDryRunFlag ? 'DRY-RUN' : 'CREATED'}] ${request.id} (${safeTitle}) default TeamUp position`
    );
  }

  console.log(
    `${hasDryRunFlag ? 'Dry run complete' : 'Backfill complete'}: ${createdCount} TeamUp request(s) ${
      hasDryRunFlag ? 'would receive' : 'received'
    } default positions.`
  );
};

run()
  .catch((error) => {
    console.error('TeamUp position backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
