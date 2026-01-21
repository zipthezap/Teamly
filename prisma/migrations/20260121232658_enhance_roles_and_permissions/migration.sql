-- AlterTable: Add invite tracking fields to GroupJoinRequest
ALTER TABLE "GroupJoinRequest" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "GroupJoinRequest" ADD COLUMN "invitedBy" TEXT;

-- AlterTable: Add invite token expiration to Group
ALTER TABLE "Group" ADD COLUMN "inviteTokenExpiresAt" TIMESTAMP(3);

-- AlterTable: Add invite token expiration to Event
ALTER TABLE "Event" ADD COLUMN "inviteTokenExpiresAt" TIMESTAMP(3);

-- CreateTable: Create InviteLog for auditing
CREATE TABLE "InviteLog" (
    "id" TEXT NOT NULL,
    "inviterType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "inviteeId" TEXT,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "message" TEXT,
    "metadata" JSONB,

    CONSTRAINT "InviteLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupJoinRequest_expiresAt_idx" ON "GroupJoinRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "InviteLog_inviterType_entityId_idx" ON "InviteLog"("inviterType", "entityId");

-- CreateIndex
CREATE INDEX "InviteLog_inviterId_idx" ON "InviteLog"("inviterId");

-- CreateIndex
CREATE INDEX "InviteLog_inviteeEmail_idx" ON "InviteLog"("inviteeEmail");

-- CreateIndex
CREATE INDEX "InviteLog_status_idx" ON "InviteLog"("status");

-- CreateIndex
CREATE INDEX "InviteLog_sentAt_idx" ON "InviteLog"("sentAt");

-- CreateIndex
CREATE INDEX "InviteLog_expiresAt_idx" ON "InviteLog"("expiresAt");

-- AddForeignKey
ALTER TABLE "GroupJoinRequest" ADD CONSTRAINT "GroupJoinRequest_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLog" ADD CONSTRAINT "InviteLog_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLog" ADD CONSTRAINT "InviteLog_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLog" ADD CONSTRAINT "InviteLog_revokedBy_fkey" FOREIGN KEY ("revokedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
