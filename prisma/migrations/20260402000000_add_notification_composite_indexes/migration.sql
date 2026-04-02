-- AddIndex: Composite indexes for cursor-based pagination on notification tables.
-- (userId, createdAt, id) covers the ORDER BY createdAt DESC, id DESC pattern used
-- by getUserNotifications cursor pagination.
CREATE INDEX "EventNotification_userId_createdAt_id_idx" ON "EventNotification"("userId", "createdAt", "id");
CREATE INDEX "GroupNotification_userId_createdAt_id_idx" ON "GroupNotification"("userId", "createdAt", "id");
CREATE INDEX "TeamUpNotification_userId_createdAt_id_idx" ON "TeamUpNotification"("userId", "createdAt", "id");
CREATE INDEX "TournamentNotification_userId_createdAt_id_idx" ON "TournamentNotification"("userId", "createdAt", "id");

-- AddIndex: Composite indexes for unread + sorted queries.
-- (userId, read, createdAt) covers the common WHERE userId = ? AND read = false ORDER BY createdAt
-- access pattern used by getNotificationStats and getUserNotifications unread queries.
CREATE INDEX "EventNotification_userId_read_createdAt_idx" ON "EventNotification"("userId", "read", "createdAt");
CREATE INDEX "GroupNotification_userId_read_createdAt_idx" ON "GroupNotification"("userId", "read", "createdAt");
CREATE INDEX "TeamUpNotification_userId_read_createdAt_idx" ON "TeamUpNotification"("userId", "read", "createdAt");
CREATE INDEX "TournamentNotification_userId_read_createdAt_idx" ON "TournamentNotification"("userId", "read", "createdAt");
