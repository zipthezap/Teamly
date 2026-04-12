-- Add missing columns to SessionRequest that were not present in older database schemas.
-- Using IF NOT EXISTS to be safe for databases already created from the squashed migration.
ALTER TABLE "SessionRequest" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SessionRequest" ADD COLUMN IF NOT EXISTS "voteDeadline" TIMESTAMP(3);
ALTER TABLE "SessionRequest" ADD COLUMN IF NOT EXISTS "voteThreshold" DOUBLE PRECISION DEFAULT 0.5;
ALTER TABLE "SessionRequest" ADD COLUMN IF NOT EXISTS "finalizedSessionId" TEXT;

-- Create unique index on finalizedSessionId if not already present
CREATE UNIQUE INDEX IF NOT EXISTS "SessionRequest_finalizedSessionId_key" ON "SessionRequest"("finalizedSessionId");
