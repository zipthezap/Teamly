-- AlterTable: Add security fields to User table
ALTER TABLE "User" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetExpires" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "accountLockedUntil" TIMESTAMP(3);
