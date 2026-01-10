/*
  Warnings:

  - The `status` column on the `Event` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `EventParticipant` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `GuestParticipant` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[eventId,userId,remindAt]` on the table `EventReminder` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `eventType` on the `Event` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `EventNotification` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `GroupNotification` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `type` on the `TeamUpNotification` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "EventNotificationType" AS ENUM ('join', 'leave', 'late', 'confirmed', 'declined', 'status_change', 'comment');

-- CreateEnum
CREATE TYPE "GroupNotificationType" AS ENUM ('accepted', 'invited', 'join_request');

-- CreateEnum
CREATE TYPE "TeamUpNotificationType" AS ENUM ('teamup_response', 'teamup_accepted', 'teamup_declined', 'teamup_nearby');

-- CreateEnum
CREATE TYPE "EventParticipantStatus" AS ENUM ('pending', 'confirmed', 'declined');

-- CreateEnum
CREATE TYPE "GuestParticipantStatus" AS ENUM ('confirmed', 'declined');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "SportType" AS ENUM ('football', 'basketball', 'tennis', 'volleyball', 'running', 'cycling', 'swimming', 'other');

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "eventType",
ADD COLUMN     "eventType" "SportType" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "EventStatus" NOT NULL DEFAULT 'upcoming';

-- AlterTable
ALTER TABLE "EventNotification" DROP COLUMN "type",
ADD COLUMN     "type" "EventNotificationType" NOT NULL;

-- AlterTable
ALTER TABLE "EventParticipant" DROP COLUMN "status",
ADD COLUMN     "status" "EventParticipantStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "GroupNotification" DROP COLUMN "type",
ADD COLUMN     "type" "GroupNotificationType" NOT NULL;

-- AlterTable
ALTER TABLE "GuestParticipant" DROP COLUMN "status",
ADD COLUMN     "status" "GuestParticipantStatus" NOT NULL DEFAULT 'confirmed';

-- AlterTable
ALTER TABLE "TeamUpNotification" DROP COLUMN "type",
ADD COLUMN     "type" "TeamUpNotificationType" NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedBy" TEXT;

-- CreateTable
CREATE TABLE "UserProfilePicture" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfilePicture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserProfilePicture_userId_isCurrent_idx" ON "UserProfilePicture"("userId", "isCurrent");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Event_eventType_idx" ON "Event"("eventType");

-- CreateIndex
CREATE INDEX "EventParticipant_status_idx" ON "EventParticipant"("status");

-- CreateIndex
CREATE INDEX "EventParticipant_eventId_status_idx" ON "EventParticipant"("eventId", "status");

-- CreateIndex
CREATE INDEX "EventParticipant_joinedAt_idx" ON "EventParticipant"("joinedAt");

-- CreateIndex
CREATE INDEX "EventReminder_sent_idx" ON "EventReminder"("sent");

-- CreateIndex
CREATE UNIQUE INDEX "EventReminder_eventId_userId_remindAt_key" ON "EventReminder"("eventId", "userId", "remindAt");

-- CreateIndex
CREATE INDEX "GuestParticipant_joinedAt_idx" ON "GuestParticipant"("joinedAt");

-- CreateIndex
CREATE INDEX "User_createdAt_deletedAt_idx" ON "User"("createdAt", "deletedAt");

-- AddForeignKey
ALTER TABLE "UserProfilePicture" ADD CONSTRAINT "UserProfilePicture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
