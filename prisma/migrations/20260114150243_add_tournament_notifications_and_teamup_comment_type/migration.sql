-- AlterEnum: Add new TeamUp notification type for comments
ALTER TYPE "TeamUpNotificationType" ADD VALUE 'teamup_comment';

-- CreateEnum: Create TournamentNotificationType enum
CREATE TYPE "TournamentNotificationType" AS ENUM ('team_registered', 'tournament_updated', 'tournament_cancelled', 'match_scheduled', 'score_submitted');

-- CreateTable: Create TournamentNotification table
CREATE TABLE "TournamentNotification" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TournamentNotificationType" NOT NULL,
    "params" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TournamentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Add indexes for TournamentNotification
CREATE INDEX "TournamentNotification_userId_idx" ON "TournamentNotification"("userId");
CREATE INDEX "TournamentNotification_tournamentId_idx" ON "TournamentNotification"("tournamentId");
CREATE INDEX "TournamentNotification_read_idx" ON "TournamentNotification"("read");
CREATE INDEX "TournamentNotification_userId_read_idx" ON "TournamentNotification"("userId", "read");
CREATE INDEX "TournamentNotification_createdAt_idx" ON "TournamentNotification"("createdAt");

-- AddForeignKey: Add foreign keys for TournamentNotification
ALTER TABLE "TournamentNotification" ADD CONSTRAINT "TournamentNotification_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentNotification" ADD CONSTRAINT "TournamentNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
