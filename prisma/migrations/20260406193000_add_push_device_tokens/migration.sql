-- CreateEnum
CREATE TYPE "PushDevicePlatform" AS ENUM ('android', 'ios', 'web');

-- AlterTable
ALTER TABLE "EmailPreference"
ADD COLUMN "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "pushEvents" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "pushGroups" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "pushTeamUp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "pushTournaments" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PushDeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "PushDevicePlatform" NOT NULL,
    "token" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT,
    "timezone" TEXT,
    "appVersion" TEXT,
    "deviceModel" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushDeviceToken_token_key" ON "PushDeviceToken"("token");

-- CreateIndex
CREATE INDEX "PushDeviceToken_userId_enabled_idx" ON "PushDeviceToken"("userId", "enabled");

-- CreateIndex
CREATE INDEX "PushDeviceToken_lastSeen_idx" ON "PushDeviceToken"("lastSeen");

-- CreateIndex
CREATE INDEX "PushDeviceToken_platform_idx" ON "PushDeviceToken"("platform");

-- AddForeignKey
ALTER TABLE "PushDeviceToken" ADD CONSTRAINT "PushDeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
