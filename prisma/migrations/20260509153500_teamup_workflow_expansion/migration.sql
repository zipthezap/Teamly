-- TeamUp workflow expansion: RSVP, attendance, waitlist/autofill, moderation, saved searches, analytics views

-- Enums
ALTER TYPE "TeamUpResponseStatus" ADD VALUE IF NOT EXISTS 'waitlisted';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TeamUpRsvpStatus') THEN
    CREATE TYPE "TeamUpRsvpStatus" AS ENUM ('unset', 'going', 'late', 'cant_make_it');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TeamUpAttendanceStatus') THEN
    CREATE TYPE "TeamUpAttendanceStatus" AS ENUM ('attended', 'late', 'no_show', 'excused');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TeamUpModerationStatus') THEN
    CREATE TYPE "TeamUpModerationStatus" AS ENUM ('open', 'in_review', 'resolved', 'dismissed');
  END IF;
END$$;

-- TeamUpResponse enhancements
ALTER TABLE "TeamUpResponse"
  ADD COLUMN IF NOT EXISTS "rsvpStatus" "TeamUpRsvpStatus" NOT NULL DEFAULT 'unset',
  ADD COLUMN IF NOT EXISTS "rsvpUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "attendanceStatus" "TeamUpAttendanceStatus",
  ADD COLUMN IF NOT EXISTS "attendanceMarkedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "attendanceMarkedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "waitlistRank" INTEGER,
  ADD COLUMN IF NOT EXISTS "autoFillOfferedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "autoFillExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "matchScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "matchReasons" JSONB;

CREATE INDEX IF NOT EXISTS "TeamUpResponse_teamUpRequestId_status_requestPositionId_idx"
  ON "TeamUpResponse"("teamUpRequestId", "status", "requestPositionId");
CREATE INDEX IF NOT EXISTS "TeamUpResponse_teamUpRequestId_requestPositionId_waitlistRank_idx"
  ON "TeamUpResponse"("teamUpRequestId", "requestPositionId", "waitlistRank");
CREATE INDEX IF NOT EXISTS "TeamUpResponse_userId_attendanceStatus_idx"
  ON "TeamUpResponse"("userId", "attendanceStatus");

-- Moderation queue
CREATE TABLE IF NOT EXISTS "TeamUpModerationCase" (
  "id" TEXT NOT NULL,
  "teamUpRequestId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "assigneeId" TEXT,
  "reason" TEXT NOT NULL,
  "status" "TeamUpModerationStatus" NOT NULL DEFAULT 'open',
  "resolutionNote" TEXT,
  "decisionAt" TIMESTAMP(3),
  "decidedByUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamUpModerationCase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TeamUpModerationCase_teamUpRequestId_status_idx"
  ON "TeamUpModerationCase"("teamUpRequestId", "status");
CREATE INDEX IF NOT EXISTS "TeamUpModerationCase_reporterId_createdAt_idx"
  ON "TeamUpModerationCase"("reporterId", "createdAt");
CREATE INDEX IF NOT EXISTS "TeamUpModerationCase_status_createdAt_idx"
  ON "TeamUpModerationCase"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TeamUpModerationCase_teamUpRequestId_fkey'
  ) THEN
    ALTER TABLE "TeamUpModerationCase"
      ADD CONSTRAINT "TeamUpModerationCase_teamUpRequestId_fkey"
      FOREIGN KEY ("teamUpRequestId") REFERENCES "TeamUpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TeamUpModerationCase_reporterId_fkey'
  ) THEN
    ALTER TABLE "TeamUpModerationCase"
      ADD CONSTRAINT "TeamUpModerationCase_reporterId_fkey"
      FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TeamUpModerationCase_assigneeId_fkey'
  ) THEN
    ALTER TABLE "TeamUpModerationCase"
      ADD CONSTRAINT "TeamUpModerationCase_assigneeId_fkey"
      FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Saved search presets
CREATE TABLE IF NOT EXISTS "TeamUpSavedSearch" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sportType" TEXT,
  "requestType" "TeamUpRequestType",
  "skillLevel" TEXT,
  "city" TEXT,
  "country" TEXT,
  "search" TEXT,
  "fromDate" TIMESTAMP(3),
  "toDate" TIMESTAMP(3),
  "preferredPosition" TEXT,
  "preferredSkillLevel" TEXT,
  "notifyOnMatch" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamUpSavedSearch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TeamUpSavedSearch_userId_createdAt_idx"
  ON "TeamUpSavedSearch"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TeamUpSavedSearch_userId_fkey'
  ) THEN
    ALTER TABLE "TeamUpSavedSearch"
      ADD CONSTRAINT "TeamUpSavedSearch_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- Analytics event table
CREATE TABLE IF NOT EXISTS "TeamUpRequestView" (
  "id" TEXT NOT NULL,
  "teamUpRequestId" TEXT NOT NULL,
  "viewerId" TEXT,
  "source" TEXT,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamUpRequestView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TeamUpRequestView_teamUpRequestId_viewedAt_idx"
  ON "TeamUpRequestView"("teamUpRequestId", "viewedAt");
CREATE INDEX IF NOT EXISTS "TeamUpRequestView_viewerId_viewedAt_idx"
  ON "TeamUpRequestView"("viewerId", "viewedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TeamUpRequestView_teamUpRequestId_fkey'
  ) THEN
    ALTER TABLE "TeamUpRequestView"
      ADD CONSTRAINT "TeamUpRequestView_teamUpRequestId_fkey"
      FOREIGN KEY ("teamUpRequestId") REFERENCES "TeamUpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TeamUpRequestView_viewerId_fkey'
  ) THEN
    ALTER TABLE "TeamUpRequestView"
      ADD CONSTRAINT "TeamUpRequestView_viewerId_fkey"
      FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
