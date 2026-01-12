-- CreateTable
CREATE TABLE "TournamentPool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxTeams" INTEGER NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentPoolWaitlist" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentPoolWaitlist_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "TournamentTeam" ADD COLUMN "poolId" TEXT,
ADD COLUMN "registrationOrder" INTEGER;

-- CreateIndex
CREATE INDEX "TournamentPool_tournamentId_idx" ON "TournamentPool"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPool_tournamentId_name_key" ON "TournamentPool"("tournamentId", "name");

-- CreateIndex
CREATE INDEX "TournamentPoolWaitlist_poolId_idx" ON "TournamentPoolWaitlist"("poolId");

-- CreateIndex
CREATE INDEX "TournamentPoolWaitlist_teamId_idx" ON "TournamentPoolWaitlist"("teamId");

-- CreateIndex
CREATE INDEX "TournamentPoolWaitlist_poolId_position_idx" ON "TournamentPoolWaitlist"("poolId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPoolWaitlist_poolId_teamId_key" ON "TournamentPoolWaitlist"("poolId", "teamId");

-- CreateIndex
CREATE INDEX "TournamentTeam_poolId_idx" ON "TournamentTeam"("poolId");

-- AddForeignKey
ALTER TABLE "TournamentTeam" ADD CONSTRAINT "TournamentTeam_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "TournamentPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPool" ADD CONSTRAINT "TournamentPool_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPoolWaitlist" ADD CONSTRAINT "TournamentPoolWaitlist_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "TournamentPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPoolWaitlist" ADD CONSTRAINT "TournamentPoolWaitlist_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TournamentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
