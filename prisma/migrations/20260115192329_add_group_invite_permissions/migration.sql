-- AlterTable
ALTER TABLE "Group" ADD COLUMN "allowMemberInvites" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Group" ADD COLUMN "allowMemberCopyLink" BOOLEAN NOT NULL DEFAULT true;
