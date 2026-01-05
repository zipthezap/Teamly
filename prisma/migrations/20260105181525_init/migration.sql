-- AlterTable
ALTER TABLE "EmailPreference" ADD COLUMN     "muteEventCancellations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "muteEventCreated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "muteEventInvites" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "muteEventReminders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "muteEventUpdates" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "muteGroupInvites" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "muteGroupRequests" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "muteNearbyGroups" BOOLEAN NOT NULL DEFAULT false;
