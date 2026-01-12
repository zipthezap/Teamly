-- Additional indexes for scalability improvements

-- Notification queries optimization
-- Composite indexes for filtering unread notifications by timestamp
CREATE INDEX IF NOT EXISTS "EventNotification_userId_read_createdAt_idx" ON "EventNotification"("userId", "read", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "GroupNotification_userId_read_createdAt_idx" ON "GroupNotification"("userId", "read", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "TeamUpNotification_userId_read_createdAt_idx" ON "TeamUpNotification"("userId", "read", "createdAt" DESC);

-- RefreshToken cleanup optimization
-- Index for finding expired tokens to clean up
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- RevokedToken cleanup optimization  
-- Already has index on expiresAt, but ensure it exists
-- CREATE INDEX IF NOT EXISTS "RevokedToken_expiresAt_idx" ON "RevokedToken"("expiresAt");

-- UserSession cleanup and lookup optimization
-- Index for finding expired sessions to clean up
CREATE INDEX IF NOT EXISTS "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");
-- Composite index for finding active sessions by user
CREATE INDEX IF NOT EXISTS "UserSession_userId_expiresAt_idx" ON "UserSession"("userId", "expiresAt");

-- EmailQueue processing optimization
-- Composite index for finding pending emails to process
CREATE INDEX IF NOT EXISTS "EmailQueue_status_scheduledAt_idx" ON "EmailQueue"("status", "scheduledAt");

-- EventReminder processing optimization
-- Composite index for finding unsent reminders that are due
CREATE INDEX IF NOT EXISTS "EventReminder_sent_remindAt_idx" ON "EventReminder"("sent", "remindAt");

-- Comment queries optimization
-- Composite index for event comments with pagination
CREATE INDEX IF NOT EXISTS "Comment_eventId_createdAt_idx" ON "Comment"("eventId", "createdAt" DESC);
-- Index for finding replies to a comment
CREATE INDEX IF NOT EXISTS "Comment_parentId_createdAt_idx" ON "Comment"("parentId", "createdAt" DESC);

-- TeamUpComment queries optimization  
-- Composite index for teamup comments with pagination
CREATE INDEX IF NOT EXISTS "TeamUpComment_teamUpRequestId_createdAt_idx" ON "TeamUpComment"("teamUpRequestId", "createdAt" DESC);

-- Tournament queries optimization
-- Composite indexes for filtering tournaments
CREATE INDEX IF NOT EXISTS "Tournament_status_startDate_idx" ON "Tournament"("status", "startDate");
CREATE INDEX IF NOT EXISTS "Tournament_sportType_status_startDate_idx" ON "Tournament"("sportType", "status", "startDate");
CREATE INDEX IF NOT EXISTS "Tournament_groupId_status_idx" ON "Tournament"("groupId", "status");

-- TournamentMatch queries optimization
-- Composite index for finding matches by tournament and status
CREATE INDEX IF NOT EXISTS "TournamentMatch_tournamentId_status_idx" ON "TournamentMatch"("tournamentId", "status");
-- Index for finding matches by scheduled time
CREATE INDEX IF NOT EXISTS "TournamentMatch_scheduledTime_idx" ON "TournamentMatch"("scheduledTime");

-- TournamentTeam queries optimization
-- Already has indexes, but adding for team listing
CREATE INDEX IF NOT EXISTS "TournamentTeam_tournamentId_createdAt_idx" ON "TournamentTeam"("tournamentId", "createdAt");

-- GuestParticipant queries optimization
-- Composite index for event guests with pagination
CREATE INDEX IF NOT EXISTS "GuestParticipant_eventId_joinedAt_idx" ON "GuestParticipant"("eventId", "joinedAt" DESC);
