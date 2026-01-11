-- AlterTable
ALTER TABLE "User" ADD COLUMN     "oauthProfilePicture" TEXT,
ADD COLUMN     "lastOAuthSync" TIMESTAMP(3);
