-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inviteToken" TEXT;

-- CreateTable
CREATE TABLE "GuestParticipant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "GuestParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestParticipant_eventId_idx" ON "GuestParticipant"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_inviteToken_key" ON "Event"("inviteToken");

-- AddForeignKey
ALTER TABLE "GuestParticipant" ADD CONSTRAINT "GuestParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
