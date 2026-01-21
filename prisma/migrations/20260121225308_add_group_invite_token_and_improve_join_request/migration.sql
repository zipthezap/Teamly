-- CreateEnum for GroupJoinRequestSource
CREATE TYPE "GroupJoinRequestSource" AS ENUM ('USER', 'INVITE', 'LINK');

-- Add inviteToken to Group table
ALTER TABLE "Group" ADD COLUMN "inviteToken" TEXT;

-- Add unique constraint for inviteToken
CREATE UNIQUE INDEX "Group_inviteToken_key" ON "Group"("inviteToken");

-- Migrate existing GroupJoinRequest.createdBy from String to Enum
-- First, update existing data to match enum values
UPDATE "GroupJoinRequest" 
SET "createdBy" = CASE 
  WHEN "createdBy" = 'user' THEN 'USER'
  WHEN "createdBy" = 'invite' THEN 'INVITE'
  ELSE 'USER'
END;

-- Alter column type to use the new enum
ALTER TABLE "GroupJoinRequest" 
ALTER COLUMN "createdBy" DROP DEFAULT,
ALTER COLUMN "createdBy" TYPE "GroupJoinRequestSource" USING "createdBy"::"GroupJoinRequestSource",
ALTER COLUMN "createdBy" SET DEFAULT 'USER';
