-- AlterTable: add selfRefEnabled flag to Tournament
ALTER TABLE "Tournament" ADD COLUMN "selfRefEnabled" BOOLEAN NOT NULL DEFAULT false;
