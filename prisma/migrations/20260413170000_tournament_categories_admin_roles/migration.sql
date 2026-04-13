-- AlterTable: add registrationStartDate to Tournament
ALTER TABLE "Tournament" ADD COLUMN "registrationStartDate" TIMESTAMP(3);

-- AlterTable: add categoryId to TournamentPool
ALTER TABLE "TournamentPool" ADD COLUMN "categoryId" TEXT;

-- CreateEnum: TournamentAdminRoleType
CREATE TYPE "TournamentAdminRoleType" AS ENUM ('co_organizer');

-- CreateTable: TournamentCategory
CREATE TABLE "TournamentCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "tournamentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TournamentAdminRole
CREATE TABLE "TournamentAdminRole" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TournamentAdminRoleType" NOT NULL DEFAULT 'co_organizer',
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentAdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentCategory_tournamentId_name_key" ON "TournamentCategory"("tournamentId", "name");
CREATE INDEX "TournamentCategory_tournamentId_idx" ON "TournamentCategory"("tournamentId");
CREATE INDEX "TournamentCategory_tournamentId_sortOrder_idx" ON "TournamentCategory"("tournamentId", "sortOrder");

CREATE UNIQUE INDEX "TournamentAdminRole_tournamentId_userId_key" ON "TournamentAdminRole"("tournamentId", "userId");
CREATE INDEX "TournamentAdminRole_tournamentId_idx" ON "TournamentAdminRole"("tournamentId");
CREATE INDEX "TournamentAdminRole_userId_idx" ON "TournamentAdminRole"("userId");

CREATE INDEX "TournamentPool_categoryId_idx" ON "TournamentPool"("categoryId");

-- AddForeignKey
ALTER TABLE "TournamentCategory" ADD CONSTRAINT "TournamentCategory_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TournamentPool" ADD CONSTRAINT "TournamentPool_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TournamentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TournamentAdminRole" ADD CONSTRAINT "TournamentAdminRole_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TournamentAdminRole" ADD CONSTRAINT "TournamentAdminRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TournamentAdminRole" ADD CONSTRAINT "TournamentAdminRole_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
