-- AlterTable: Add paymentInfo field to Tournament for payment instructions
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "paymentInfo" TEXT;
