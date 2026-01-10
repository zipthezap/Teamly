-- CreateTable
CREATE TABLE "TeamUpNotification" (
    "id" TEXT NOT NULL,
    "teamUpRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "params" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TeamUpNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamUpNotification_userId_idx" ON "TeamUpNotification"("userId");

-- CreateIndex
CREATE INDEX "TeamUpNotification_teamUpRequestId_idx" ON "TeamUpNotification"("teamUpRequestId");

-- CreateIndex
CREATE INDEX "TeamUpNotification_read_idx" ON "TeamUpNotification"("read");

-- CreateIndex
CREATE INDEX "TeamUpNotification_userId_read_idx" ON "TeamUpNotification"("userId", "read");

-- CreateIndex
CREATE INDEX "TeamUpNotification_createdAt_idx" ON "TeamUpNotification"("createdAt");

-- AddForeignKey
ALTER TABLE "TeamUpNotification" ADD CONSTRAINT "TeamUpNotification_teamUpRequestId_fkey" FOREIGN KEY ("teamUpRequestId") REFERENCES "TeamUpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpNotification" ADD CONSTRAINT "TeamUpNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
