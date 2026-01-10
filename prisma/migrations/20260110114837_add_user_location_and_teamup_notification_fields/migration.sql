-- AlterTable
ALTER TABLE "User" ADD COLUMN "address" TEXT,
ADD COLUMN "postalCode" TEXT,
ADD COLUMN "discoveryRadius" INTEGER DEFAULT 25;

-- AlterTable
ALTER TABLE "EmailPreference" ADD COLUMN "nearbyTeamUps" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "muteNearbyTeamUps" BOOLEAN NOT NULL DEFAULT false;
