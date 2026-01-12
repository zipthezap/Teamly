-- AlterTable
-- Add detailedScore field for sports with sets/periods (volleyball, tennis, etc.)
ALTER TABLE "TournamentMatch" ADD COLUMN "detailedScore" JSONB;
