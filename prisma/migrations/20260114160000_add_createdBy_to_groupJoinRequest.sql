-- Add createdBy field to GroupJoinRequest to distinguish between user-initiated and invite-initiated join requests
ALTER TABLE "GroupJoinRequest" ADD COLUMN "createdBy" VARCHAR(16) DEFAULT 'user';
-- Optionally, add an index for filtering
CREATE INDEX IF NOT EXISTS "GroupJoinRequest_createdBy_idx" ON "GroupJoinRequest" ("createdBy");
