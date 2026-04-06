-- AlterEnum: Add waitlisted and co_organizer values to EventParticipantStatus
ALTER TYPE "EventParticipantStatus" ADD VALUE IF NOT EXISTS 'waitlisted';
ALTER TYPE "EventParticipantStatus" ADD VALUE IF NOT EXISTS 'co_organizer';

-- CreateTable: GroupBan
CREATE TABLE "GroupBan" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannedBy" TEXT NOT NULL,
    "reason" TEXT,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: GroupBan unique on (groupId, userId)
CREATE UNIQUE INDEX "GroupBan_groupId_userId_key" ON "GroupBan"("groupId", "userId");

-- CreateIndex
CREATE INDEX "GroupBan_userId_idx" ON "GroupBan"("userId");

-- CreateIndex
CREATE INDEX "GroupBan_groupId_idx" ON "GroupBan"("groupId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey: GroupBan -> Group
ALTER TABLE "GroupBan" ADD CONSTRAINT "GroupBan_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: GroupBan -> User (banned user)
ALTER TABLE "GroupBan" ADD CONSTRAINT "GroupBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: GroupBan -> User (banner)
ALTER TABLE "GroupBan" ADD CONSTRAINT "GroupBan_bannedBy_fkey" FOREIGN KEY ("bannedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: AuditLog -> User
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
