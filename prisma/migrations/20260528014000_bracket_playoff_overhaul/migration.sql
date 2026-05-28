-- CreateEnum
CREATE TYPE "BracketSide" AS ENUM ('winners', 'losers', 'grand_final');

-- AlterTable
ALTER TABLE "Tournament"
  ADD COLUMN "playoffSize" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "doubleElimination" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TournamentMatch"
  ALTER COLUMN "awayTeamId" DROP NOT NULL,
  ADD COLUMN "bracketSide" "BracketSide",
  ADD COLUMN "isBye" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "loserGoesToMatchId" TEXT;

-- CreateIndex
CREATE INDEX "TournamentMatch_bracketSide_idx" ON "TournamentMatch"("bracketSide");

-- AddForeignKey
ALTER TABLE "TournamentMatch"
  ADD CONSTRAINT "TournamentMatch_loserGoesToMatchId_fkey"
  FOREIGN KEY ("loserGoesToMatchId") REFERENCES "TournamentMatch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
