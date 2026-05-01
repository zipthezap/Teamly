-- AlterTable: Add registration fee and payment gate fields to Tournament
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "registrationFee" DOUBLE PRECISION;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "requirePaymentForBrackets" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add payment tracking fields to TournamentTeam
ALTER TABLE "TournamentTeam" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE "TournamentTeam" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "TournamentTeam" ADD COLUMN IF NOT EXISTS "paidByUserId" TEXT;
