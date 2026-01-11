-- AlterTable
ALTER TABLE "User" ADD COLUMN "googleId" TEXT,
ADD COLUMN "facebookId" TEXT,
ADD COLUMN "authProvider" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_facebookId_key" ON "User"("facebookId");

-- CreateIndex
CREATE INDEX "User_googleId_idx" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_facebookId_idx" ON "User"("facebookId");
