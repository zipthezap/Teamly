-- AlterTable
ALTER TABLE "EventNotification" ADD COLUMN     "params" JSONB;

-- AlterTable
ALTER TABLE "GroupNotification" ADD COLUMN     "params" JSONB;
