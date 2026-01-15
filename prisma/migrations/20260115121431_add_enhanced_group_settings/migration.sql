-- AlterTable
ALTER TABLE "Group" 
ADD COLUMN "sportType" "SportType",
ADD COLUMN "maxMembers" INTEGER,
ADD COLUMN "autoApproveJoinRequests" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "tags" TEXT;
