-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SessionNotificationType" AS ENUM ('join', 'leave', 'late', 'confirmed', 'declined', 'status_change', 'comment', 'session_updated', 'session_cancelled');

-- CreateEnum
CREATE TYPE "GroupNotificationType" AS ENUM ('accepted', 'invited', 'join_request', 'session_created', 'nearby_created', 'removed');

-- CreateEnum
CREATE TYPE "TeamUpNotificationType" AS ENUM ('teamup_response', 'teamup_accepted', 'teamup_declined', 'teamup_nearby', 'teamup_comment');

-- CreateEnum
CREATE TYPE "TournamentNotificationType" AS ENUM ('team_registered', 'team_invited', 'tournament_updated', 'tournament_cancelled', 'match_scheduled', 'score_submitted', 'payment_reminder', 'score_disputed', 'announcement');

-- CreateEnum
CREATE TYPE "PushDevicePlatform" AS ENUM ('android', 'ios', 'web');

-- CreateEnum
CREATE TYPE "SessionParticipantStatus" AS ENUM ('pending', 'confirmed', 'declined', 'waitlisted', 'co_organizer');

-- CreateEnum
CREATE TYPE "GuestParticipantStatus" AS ENUM ('confirmed', 'declined');

-- CreateEnum
CREATE TYPE "GroupJoinRequestSource" AS ENUM ('USER', 'INVITE', 'LINK');

-- CreateEnum
CREATE TYPE "GroupJoinRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "GroupMemberRole" AS ENUM ('member', 'moderator', 'admin');

-- CreateEnum
CREATE TYPE "SessionAttendanceStatus" AS ENUM ('on_time', 'late');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "SportType" AS ENUM ('football', 'basketball', 'tennis', 'volleyball', 'running', 'cycling', 'swimming', 'cricket', 'americanFootball', 'iceHockey', 'baseball', 'rugby', 'handball', 'fieldHockey', 'other');

-- CreateEnum
CREATE TYPE "SessionRequestStatus" AS ENUM ('voting', 'finalized', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "EmailQueueStatus" AS ENUM ('pending', 'sent', 'failed', 'retry');

-- CreateEnum
CREATE TYPE "TeamUpRequestType" AS ENUM ('need_players', 'looking_for_play');

-- CreateEnum
CREATE TYPE "TeamUpRequestStatus" AS ENUM ('open', 'filled', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "TeamUpResponseStatus" AS ENUM ('pending', 'accepted', 'declined', 'cancelled', 'waitlisted');

-- CreateEnum
CREATE TYPE "TeamUpRsvpStatus" AS ENUM ('unset', 'going', 'late', 'cant_make_it');

-- CreateEnum
CREATE TYPE "TeamUpAttendanceStatus" AS ENUM ('attended', 'late', 'no_show', 'excused');

-- CreateEnum
CREATE TYPE "TeamUpModerationStatus" AS ENUM ('open', 'in_review', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('single_elimination', 'double_elimination', 'round_robin', 'groups_knockout');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('draft', 'registration', 'registration_closed', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "BracketStage" AS ENUM ('group_stage', 'round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals', 'third_place', 'finals');

-- CreateEnum
CREATE TYPE "TournamentPaymentTransactionStatus" AS ENUM ('initiated', 'pending', 'paid', 'failed', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "ScoreDisputeStatus" AS ENUM ('open', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "RegistrationFieldType" AS ENUM ('text', 'number', 'boolean', 'select');

-- CreateEnum
CREATE TYPE "MatchIncidentType" AS ENUM ('late_start', 'injury', 'dispute', 'technical', 'other');

-- CreateEnum
CREATE TYPE "MatchIncidentStatus" AS ENUM ('open', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "TournamentAdminRoleType" AS ENUM ('co_organizer');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'declined', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "LeagueStatus" AS ENUM ('draft', 'registration', 'active', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "UserProfilePicture" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfilePicture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "GroupMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionReminder" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SessionReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SessionAttendanceStatus" NOT NULL DEFAULT 'on_time',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionNotification" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SessionNotificationType" NOT NULL,
    "params" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SessionNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupNotification" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "GroupNotificationType" NOT NULL,
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GroupNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamUpNotification" (
    "id" TEXT NOT NULL,
    "teamUpRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TeamUpNotificationType" NOT NULL,
    "params" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TeamUpNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentNotification" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TournamentNotificationType" NOT NULL,
    "params" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TournamentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteLog" (
    "id" TEXT NOT NULL,
    "inviterType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "inviteeId" TEXT,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "message" TEXT,
    "metadata" JSONB,

    CONSTRAINT "InviteLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "googleId" TEXT,
    "facebookId" TEXT,
    "appleId" TEXT,
    "authProvider" TEXT,
    "oauthProfilePicture" TEXT,
    "lastOAuthSync" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationToken" TEXT,
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "accountLockedUntil" TIMESTAMP(3),
    "city" TEXT,
    "country" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "discoveryRadius" INTEGER DEFAULT 25,
    "profilePicture" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationName" TEXT,
    "city" TEXT,
    "country" TEXT,
    "picture" TEXT,
    "sportType" "SportType",
    "maxMembers" INTEGER,
    "autoApproveJoinRequests" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT,
    "allowMemberInvites" BOOLEAN NOT NULL DEFAULT false,
    "allowMemberCopyLink" BOOLEAN NOT NULL DEFAULT true,
    "inviteToken" TEXT,
    "inviteTokenExpiresAt" TIMESTAMP(3),
    "creatorId" TEXT NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupJoinRequest" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "GroupJoinRequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" "GroupJoinRequestSource" NOT NULL DEFAULT 'USER',
    "expiresAt" TIMESTAMP(3),
    "invitedBy" TEXT,

    CONSTRAINT "GroupJoinRequest_pkey" PRIMARY KEY ("id")
);

-- (file continues...)