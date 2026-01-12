-- CreateIndex for Event table to improve scalability
-- Composite indexes for common query patterns

CREATE INDEX IF NOT EXISTS "Event_status_startTime_idx" ON "Event"("status", "startTime");
CREATE INDEX IF NOT EXISTS "Event_eventType_startTime_idx" ON "Event"("eventType", "startTime");
CREATE INDEX IF NOT EXISTS "Event_isPublic_startTime_idx" ON "Event"("isPublic", "startTime");
CREATE INDEX IF NOT EXISTS "Event_archived_status_startTime_idx" ON "Event"("archived", "status", "startTime");

-- CreateIndex for TeamUpRequest table to improve scalability
-- Composite indexes for common query patterns

CREATE INDEX IF NOT EXISTS "TeamUpRequest_sportType_status_dateTime_idx" ON "TeamUpRequest"("sportType", "status", "dateTime");
CREATE INDEX IF NOT EXISTS "TeamUpRequest_city_country_status_dateTime_idx" ON "TeamUpRequest"("city", "country", "status", "dateTime");
CREATE INDEX IF NOT EXISTS "TeamUpRequest_creatorId_status_idx" ON "TeamUpRequest"("creatorId", "status");
