-- TeamUp: add position-based role requirements and response position selection

-- CreateTable
CREATE TABLE "TeamUpRequestPosition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slotsNeeded" INTEGER NOT NULL DEFAULT 1,
    "skillLevelRequired" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "teamUpRequestId" TEXT NOT NULL,

    CONSTRAINT "TeamUpRequestPosition_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "TeamUpResponse"
ADD COLUMN "requestPositionId" TEXT,
ADD COLUMN "applicantSkillLevel" TEXT;

-- Indexes
CREATE INDEX "TeamUpRequestPosition_teamUpRequestId_idx" ON "TeamUpRequestPosition"("teamUpRequestId");
CREATE INDEX "TeamUpRequestPosition_teamUpRequestId_name_idx" ON "TeamUpRequestPosition"("teamUpRequestId", "name");
CREATE INDEX "TeamUpRequestPosition_teamUpRequestId_slotsNeeded_idx" ON "TeamUpRequestPosition"("teamUpRequestId", "slotsNeeded");
CREATE INDEX "TeamUpResponse_requestPositionId_idx" ON "TeamUpResponse"("requestPositionId");

-- Foreign keys
ALTER TABLE "TeamUpRequestPosition"
ADD CONSTRAINT "TeamUpRequestPosition_teamUpRequestId_fkey"
FOREIGN KEY ("teamUpRequestId")
REFERENCES "TeamUpRequest"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "TeamUpResponse"
ADD CONSTRAINT "TeamUpResponse_requestPositionId_fkey"
FOREIGN KEY ("requestPositionId")
REFERENCES "TeamUpRequestPosition"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
