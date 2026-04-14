-- CreateEnum: TeamUpRequestType
CREATE TYPE "TeamUpRequestType" AS ENUM ('need_players', 'looking_for_play');

-- AlterTable: add requestType column to TeamUpRequest
ALTER TABLE "TeamUpRequest" ADD COLUMN "requestType" "TeamUpRequestType" NOT NULL DEFAULT 'need_players';

-- CreateIndex: requestType for filtering
CREATE INDEX "TeamUpRequest_requestType_idx" ON "TeamUpRequest"("requestType");

-- CreateIndex: composite for request type + status + dateTime filtering
CREATE INDEX "TeamUpRequest_requestType_status_dateTime_idx" ON "TeamUpRequest"("requestType", "status", "dateTime");
