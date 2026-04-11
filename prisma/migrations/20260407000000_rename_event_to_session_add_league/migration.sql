-- Rename Event-related enums
ALTER TYPE "EventNotificationType" RENAME TO "SessionNotificationType";
ALTER TYPE "EventParticipantStatus" RENAME TO "SessionParticipantStatus";
ALTER TYPE "EventStatus" RENAME TO "SessionStatus";

-- Add new enum value to SessionNotificationType (replacing event_updated/event_cancelled)
ALTER TYPE "SessionNotificationType" ADD VALUE IF NOT EXISTS 'session_updated';
ALTER TYPE "SessionNotificationType" ADD VALUE IF NOT EXISTS 'session_cancelled';

-- Add new enum values to SessionParticipantStatus
ALTER TYPE "SessionParticipantStatus" ADD VALUE IF NOT EXISTS 'waitlisted';
ALTER TYPE "SessionParticipantStatus" ADD VALUE IF NOT EXISTS 'co_organizer';

-- Add new enum for SessionAttendanceStatus
CREATE TYPE "SessionAttendanceStatus" AS ENUM ('on_time', 'late');

-- Add new enum for SessionRequestStatus
CREATE TYPE "SessionRequestStatus" AS ENUM ('voting', 'finalized', 'cancelled', 'expired');

-- Add new enum for LeagueStatus
CREATE TYPE "LeagueStatus" AS ENUM ('draft', 'registration', 'active', 'completed', 'cancelled');

-- Rename tables
ALTER TABLE "Event" RENAME TO "Session";
ALTER TABLE "EventReminder" RENAME TO "SessionReminder";
ALTER TABLE "EventAttendance" RENAME TO "SessionAttendance";
ALTER TABLE "EventNotification" RENAME TO "SessionNotification";
ALTER TABLE "EventParticipant" RENAME TO "SessionParticipant";
ALTER TABLE "EventRequest" RENAME TO "SessionRequest";
ALTER TABLE "EventVote" RENAME TO "SessionVote";

-- Rename columns in Session (was Event)
ALTER TABLE "Session" RENAME COLUMN "eventType" TO "sessionType";
ALTER TABLE "Session" RENAME COLUMN "parentEventId" TO "parentSessionId";

-- Rename columns in SessionReminder (was EventReminder)
ALTER TABLE "SessionReminder" RENAME COLUMN "eventId" TO "sessionId";

-- Rename columns in SessionAttendance (was EventAttendance)
ALTER TABLE "SessionAttendance" RENAME COLUMN "eventId" TO "sessionId";
ALTER TABLE "SessionAttendance" ADD COLUMN IF NOT EXISTS "status" "SessionAttendanceStatus" NOT NULL DEFAULT 'on_time';

-- Rename columns in SessionNotification (was EventNotification)
ALTER TABLE "SessionNotification" RENAME COLUMN "eventId" TO "sessionId";

-- Rename columns in SessionParticipant (was EventParticipant)
ALTER TABLE "SessionParticipant" RENAME COLUMN "eventId" TO "sessionId";

-- Rename columns in SessionRequest (was EventRequest)
ALTER TABLE "SessionRequest" RENAME COLUMN "finalizedEventId" TO "finalizedSessionId";

-- Rename primary key constraints
ALTER TABLE "Session" RENAME CONSTRAINT "Event_pkey" TO "Session_pkey";
ALTER TABLE "SessionReminder" RENAME CONSTRAINT "EventReminder_pkey" TO "SessionReminder_pkey";
ALTER TABLE "SessionAttendance" RENAME CONSTRAINT "EventAttendance_pkey" TO "SessionAttendance_pkey";
ALTER TABLE "SessionNotification" RENAME CONSTRAINT "EventNotification_pkey" TO "SessionNotification_pkey";
ALTER TABLE "SessionParticipant" RENAME CONSTRAINT "EventParticipant_pkey" TO "SessionParticipant_pkey";
ALTER TABLE "SessionRequest" RENAME CONSTRAINT "EventRequest_pkey" TO "SessionRequest_pkey";
ALTER TABLE "SessionVote" RENAME CONSTRAINT "EventVote_pkey" TO "SessionVote_pkey";

-- Update foreign key constraints for SessionReminder
ALTER TABLE "SessionReminder" DROP CONSTRAINT IF EXISTS "EventReminder_eventId_fkey";
ALTER TABLE "SessionReminder" ADD CONSTRAINT "SessionReminder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update foreign key constraints for SessionAttendance
ALTER TABLE "SessionAttendance" DROP CONSTRAINT IF EXISTS "EventAttendance_eventId_fkey";
ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update foreign key constraints for SessionNotification
ALTER TABLE "SessionNotification" DROP CONSTRAINT IF EXISTS "EventNotification_eventId_fkey";
ALTER TABLE "SessionNotification" ADD CONSTRAINT "SessionNotification_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update foreign key constraints for SessionParticipant
ALTER TABLE "SessionParticipant" DROP CONSTRAINT IF EXISTS "EventParticipant_eventId_fkey";
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update self-referential FK for Session (parentSessionId)
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Event_parentEventId_fkey";
ALTER TABLE "Session" ADD CONSTRAINT "Session_parentSessionId_fkey" FOREIGN KEY ("parentSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update FK for SessionRequest finalizedSessionId
ALTER TABLE "SessionRequest" DROP CONSTRAINT IF EXISTS "EventRequest_finalizedEventId_fkey";
ALTER TABLE "SessionRequest" ADD CONSTRAINT "SessionRequest_finalizedSessionId_fkey" FOREIGN KEY ("finalizedSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rename indexes
ALTER INDEX IF EXISTS "Event_groupId_idx" RENAME TO "Session_groupId_idx";
ALTER INDEX IF EXISTS "Event_creatorId_idx" RENAME TO "Session_creatorId_idx";
ALTER INDEX IF EXISTS "Event_status_idx" RENAME TO "Session_status_idx";
ALTER INDEX IF EXISTS "Event_eventType_idx" RENAME TO "Session_sessionType_idx";
ALTER INDEX IF EXISTS "EventParticipant_sessionId_idx" RENAME TO "SessionParticipant_sessionId_idx";
ALTER INDEX IF EXISTS "EventParticipant_userId_idx" RENAME TO "SessionParticipant_userId_idx";
ALTER INDEX IF EXISTS "EventReminder_sessionId_idx" RENAME TO "SessionReminder_sessionId_idx";
ALTER INDEX IF EXISTS "EventAttendance_sessionId_idx" RENAME TO "SessionAttendance_sessionId_idx";
ALTER INDEX IF EXISTS "EventNotification_sessionId_idx" RENAME TO "SessionNotification_sessionId_idx";
ALTER INDEX IF EXISTS "EventRequest_groupId_idx" RENAME TO "SessionRequest_groupId_idx";
ALTER INDEX IF EXISTS "EventRequest_creatorId_idx" RENAME TO "SessionRequest_creatorId_idx";

-- Drop old enum values that no longer exist (via recreate is not possible in Postgres easily, skip for now)

-- Add new League tables
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sport" "SportType" NOT NULL,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationName" TEXT,
    "city" TEXT,
    "country" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "sessionCount" INTEGER,
    "status" "LeagueStatus" NOT NULL DEFAULT 'draft',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT true,
    "maxTeams" INTEGER,
    "creatorId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeagueTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "captainUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeagueTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaguePlayer" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "playerName" TEXT,
    "jerseyNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaguePlayer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeagueSessionEntry" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "roundNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeagueSessionEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeagueMatch" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "roundNumber" INTEGER,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledAt" TIMESTAMP(3),
    "playedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeagueMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeagueStanding" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 0,
    "won" INTEGER NOT NULL DEFAULT 0,
    "drawn" INTEGER NOT NULL DEFAULT 0,
    "lost" INTEGER NOT NULL DEFAULT 0,
    "goalsFor" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainst" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeagueStanding_pkey" PRIMARY KEY ("id")
);

-- League foreign keys and indexes
ALTER TABLE "League" ADD CONSTRAINT "League_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "League" ADD CONSTRAINT "League_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "League_groupId_idx" ON "League"("groupId");
CREATE INDEX "League_creatorId_idx" ON "League"("creatorId");
CREATE INDEX "League_status_idx" ON "League"("status");
CREATE INDEX "League_sport_idx" ON "League"("sport");

ALTER TABLE "LeagueTeam" ADD CONSTRAINT "LeagueTeam_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueTeam" ADD CONSTRAINT "LeagueTeam_captainUserId_fkey" FOREIGN KEY ("captainUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "LeagueTeam_leagueId_name_key" ON "LeagueTeam"("leagueId", "name");
CREATE INDEX "LeagueTeam_leagueId_idx" ON "LeagueTeam"("leagueId");

ALTER TABLE "LeaguePlayer" ADD CONSTRAINT "LeaguePlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "LeagueTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaguePlayer" ADD CONSTRAINT "LeaguePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "LeaguePlayer_teamId_userId_key" ON "LeaguePlayer"("teamId", "userId");
CREATE INDEX "LeaguePlayer_teamId_idx" ON "LeaguePlayer"("teamId");

ALTER TABLE "LeagueSessionEntry" ADD CONSTRAINT "LeagueSessionEntry_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueSessionEntry" ADD CONSTRAINT "LeagueSessionEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "LeagueSessionEntry_leagueId_sessionId_key" ON "LeagueSessionEntry"("leagueId", "sessionId");
CREATE INDEX "LeagueSessionEntry_leagueId_idx" ON "LeagueSessionEntry"("leagueId");

ALTER TABLE "LeagueMatch" ADD CONSTRAINT "LeagueMatch_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "LeagueTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueMatch" ADD CONSTRAINT "LeagueMatch_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "LeagueTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "LeagueMatch_leagueId_idx" ON "LeagueMatch"("leagueId");
CREATE INDEX "LeagueMatch_homeTeamId_idx" ON "LeagueMatch"("homeTeamId");
CREATE INDEX "LeagueMatch_awayTeamId_idx" ON "LeagueMatch"("awayTeamId");

ALTER TABLE "LeagueStanding" ADD CONSTRAINT "LeagueStanding_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueStanding" ADD CONSTRAINT "LeagueStanding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "LeagueTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "LeagueStanding_leagueId_teamId_key" ON "LeagueStanding"("leagueId", "teamId");
CREATE INDEX "LeagueStanding_leagueId_idx" ON "LeagueStanding"("leagueId");
