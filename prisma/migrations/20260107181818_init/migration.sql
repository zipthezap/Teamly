-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'upcoming';

-- AlterTable
ALTER TABLE "EventNotification" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "EventRequest" ADD COLUMN     "voteDeadline" TIMESTAMP(3),
ADD COLUMN     "voteThreshold" DOUBLE PRECISION DEFAULT 0.5;
