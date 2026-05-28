-- Repair migration for schema drift on Tournament policy fields.
-- Ensures databases created from squashed/partial migration history are aligned
-- with prisma/schema.prisma before seed runs.

DO $$
BEGIN
  CREATE TYPE "TournamentSeedingPolicy" AS ENUM ('manual', 'random', 'rating');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "TournamentContingencyMode" AS ENUM ('normal', 'delayed', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT,
  ADD COLUMN IF NOT EXISTS "noShowGraceMinutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "noShowAutoForfeit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "forfeitScoreFor" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "forfeitScoreAgainst" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "minTeamRestMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "withdrawalDeadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "autoPromoteRegistrationWaitlist" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "rescheduleCutoffMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "allowRescheduleAfterStart" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "seedingPolicy" "TournamentSeedingPolicy" NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "seedsLockedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "enableThirdPlaceMatch" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "enableConsolationBracket" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "allowByes" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "contingencyMode" "TournamentContingencyMode" NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS "contingencyNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "contingencyDelayMinutes" INTEGER NOT NULL DEFAULT 0;