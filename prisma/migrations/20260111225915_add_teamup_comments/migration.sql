-- CreateTable
CREATE TABLE "TeamUpComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "teamUpRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TeamUpComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamUpComment_teamUpRequestId_idx" ON "TeamUpComment"("teamUpRequestId");

-- CreateIndex
CREATE INDEX "TeamUpComment_userId_idx" ON "TeamUpComment"("userId");

-- CreateIndex
CREATE INDEX "TeamUpComment_createdAt_idx" ON "TeamUpComment"("createdAt");

-- AddForeignKey
ALTER TABLE "TeamUpComment" ADD CONSTRAINT "TeamUpComment_teamUpRequestId_fkey" FOREIGN KEY ("teamUpRequestId") REFERENCES "TeamUpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpComment" ADD CONSTRAINT "TeamUpComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
