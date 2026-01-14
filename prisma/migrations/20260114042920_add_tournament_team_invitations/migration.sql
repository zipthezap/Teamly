-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'declined', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "TournamentTeamInvitation" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "inviteeName" TEXT,
    "inviteeUserId" TEXT,
    "inviterId" TEXT NOT NULL,
    "inviteToken" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentTeamInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeamInvitation_inviteToken_key" ON "TournamentTeamInvitation"("inviteToken");

-- CreateIndex
CREATE INDEX "TournamentTeamInvitation_teamId_idx" ON "TournamentTeamInvitation"("teamId");

-- CreateIndex
CREATE INDEX "TournamentTeamInvitation_inviteeEmail_idx" ON "TournamentTeamInvitation"("inviteeEmail");

-- CreateIndex
CREATE INDEX "TournamentTeamInvitation_inviteeUserId_idx" ON "TournamentTeamInvitation"("inviteeUserId");

-- CreateIndex
CREATE INDEX "TournamentTeamInvitation_inviteToken_idx" ON "TournamentTeamInvitation"("inviteToken");

-- CreateIndex
CREATE INDEX "TournamentTeamInvitation_status_idx" ON "TournamentTeamInvitation"("status");

-- CreateIndex
CREATE INDEX "TournamentTeamInvitation_expiresAt_idx" ON "TournamentTeamInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "TournamentTeamInvitation_teamId_inviteeEmail_status_idx" ON "TournamentTeamInvitation"("teamId", "inviteeEmail", "status");

-- AddForeignKey
ALTER TABLE "TournamentTeamInvitation" ADD CONSTRAINT "TournamentTeamInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TournamentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeamInvitation" ADD CONSTRAINT "TournamentTeamInvitation_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeamInvitation" ADD CONSTRAINT "TournamentTeamInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
