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
CREATE TYPE "GuestParticipantStatus" AS ENUM ('pending', 'confirmed', 'declined');

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
CREATE TYPE "BracketSide" AS ENUM ('winners', 'losers', 'grand_final');

-- CreateEnum
CREATE TYPE "TournamentSeedingPolicy" AS ENUM ('manual', 'random', 'rating');

-- CreateEnum
CREATE TYPE "TournamentContingencyMode" AS ENUM ('normal', 'delayed', 'suspended');

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
    "userId" TEXT,
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
    "emailVerificationExpires" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "failedPasswordAttempts" INTEGER NOT NULL DEFAULT 0,
    "failedTwoFactorAttempts" INTEGER NOT NULL DEFAULT 0,
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

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "role" "GroupMemberRole" NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupBan" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannedBy" TEXT NOT NULL,
    "reason" TEXT,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sessionType" "SportType" NOT NULL,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationName" TEXT,
    "city" TEXT,
    "country" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "maxPlayers" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "status" "SessionStatus" NOT NULL DEFAULT 'upcoming',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "inviteToken" TEXT,
    "inviteTokenExpiresAt" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "recurrenceEnd" TIMESTAMP(3),
    "parentSessionId" TEXT,
    "exceptionDates" JSONB,
    "creatorId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionParticipant" (
    "id" TEXT NOT NULL,
    "status" "SessionParticipantStatus" NOT NULL DEFAULT 'pending',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SessionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" TEXT NOT NULL,
    "location" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "maxPlayers" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SessionRequestStatus" NOT NULL DEFAULT 'voting',
    "voteDeadline" TIMESTAMP(3),
    "voteThreshold" DOUBLE PRECISION DEFAULT 0.5,
    "creatorId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "finalizedSessionId" TEXT,

    CONSTRAINT "SessionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionVote" (
    "id" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SessionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionInvites" BOOLEAN NOT NULL DEFAULT true,
    "sessionReminders" BOOLEAN NOT NULL DEFAULT true,
    "sessionUpdates" BOOLEAN NOT NULL DEFAULT true,
    "sessionCancellations" BOOLEAN NOT NULL DEFAULT true,
    "groupInvites" BOOLEAN NOT NULL DEFAULT true,
    "commentMentions" BOOLEAN NOT NULL DEFAULT true,
    "nearbyTeamUps" BOOLEAN NOT NULL DEFAULT true,
    "muteSessionInvites" BOOLEAN NOT NULL DEFAULT false,
    "muteSessionReminders" BOOLEAN NOT NULL DEFAULT false,
    "muteSessionUpdates" BOOLEAN NOT NULL DEFAULT false,
    "muteSessionCancellations" BOOLEAN NOT NULL DEFAULT false,
    "muteGroupInvites" BOOLEAN NOT NULL DEFAULT false,
    "muteGroupRequests" BOOLEAN NOT NULL DEFAULT false,
    "muteNearbyGroups" BOOLEAN NOT NULL DEFAULT false,
    "muteSessionCreated" BOOLEAN NOT NULL DEFAULT false,
    "muteNearbyTeamUps" BOOLEAN NOT NULL DEFAULT false,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushSessions" BOOLEAN NOT NULL DEFAULT true,
    "pushGroups" BOOLEAN NOT NULL DEFAULT true,
    "pushTeamUp" BOOLEAN NOT NULL DEFAULT true,
    "pushTournaments" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "PushDevicePlatform" NOT NULL,
    "token" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT,
    "timezone" TEXT,
    "appVersion" TEXT,
    "deviceModel" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentMention" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestParticipant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "GuestParticipantStatus" NOT NULL DEFAULT 'confirmed',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT NOT NULL,

    CONSTRAINT "GuestParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevokedToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "RevokedToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailQueue" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "textContent" TEXT,
    "templateType" TEXT,
    "templateData" JSONB,
    "status" "EmailQueueStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamUpRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sportType" TEXT NOT NULL,
    "requestType" "TeamUpRequestType" NOT NULL DEFAULT 'need_players',
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationName" TEXT,
    "city" TEXT,
    "country" TEXT,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "playersNeeded" INTEGER NOT NULL DEFAULT 1,
    "skillLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "TeamUpRequestStatus" NOT NULL DEFAULT 'open',
    "expiresAt" TIMESTAMP(3),
    "creatorId" TEXT NOT NULL,

    CONSTRAINT "TeamUpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamUpRequestPosition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slotsNeeded" INTEGER NOT NULL DEFAULT 1,
    "skillLevelRequired" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "teamUpRequestId" TEXT NOT NULL,

    CONSTRAINT "TeamUpRequestPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamUpResponse" (
    "id" TEXT NOT NULL,
    "message" TEXT,
    "applicantSkillLevel" TEXT,
    "status" "TeamUpResponseStatus" NOT NULL DEFAULT 'pending',
    "rsvpStatus" "TeamUpRsvpStatus" NOT NULL DEFAULT 'unset',
    "rsvpUpdatedAt" TIMESTAMP(3),
    "attendanceStatus" "TeamUpAttendanceStatus",
    "attendanceMarkedAt" TIMESTAMP(3),
    "attendanceMarkedByUserId" TEXT,
    "waitlistRank" INTEGER,
    "autoFillOfferedAt" TIMESTAMP(3),
    "autoFillExpiresAt" TIMESTAMP(3),
    "matchScore" DOUBLE PRECISION,
    "matchReasons" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamUpRequestId" TEXT NOT NULL,
    "requestPositionId" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TeamUpResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamUpComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "teamUpRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TeamUpComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamUpModerationCase" (
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

-- CreateTable
CREATE TABLE "TeamUpSavedSearch" (
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

-- CreateTable
CREATE TABLE "TeamUpRequestView" (
    "id" TEXT NOT NULL,
    "teamUpRequestId" TEXT NOT NULL,
    "viewerId" TEXT,
    "source" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamUpRequestView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sportType" "SportType" NOT NULL,
    "format" "TournamentFormat" NOT NULL DEFAULT 'single_elimination',
    "status" "TournamentStatus" NOT NULL DEFAULT 'draft',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "maxTeams" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationName" TEXT,
    "city" TEXT,
    "country" TEXT,
    "organizerId" TEXT NOT NULL,
    "groupId" TEXT,
    "registrationStartDate" TIMESTAMP(3),
    "registrationDeadline" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "allowLateRegistration" BOOLEAN NOT NULL DEFAULT false,
    "autoGenerateBrackets" BOOLEAN NOT NULL DEFAULT false,
    "useManualBrackets" BOOLEAN NOT NULL DEFAULT false,
    "prizesDescription" TEXT,
    "rulesDescription" TEXT,
    "contactEmail" TEXT,
    "sportConfig" JSONB,
    "registrationFee" DOUBLE PRECISION,
    "requirePaymentForBrackets" BOOLEAN NOT NULL DEFAULT false,
    "paymentInfo" TEXT,
    "requireWaiverForRegistration" BOOLEAN NOT NULL DEFAULT false,
    "waiverText" TEXT,
    "rosterLockDate" TIMESTAMP(3),
    "paymentDeadline" TIMESTAMP(3),
    "tiebreakerRules" JSONB,
    "selfRefEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "noShowGraceMinutes" INTEGER NOT NULL DEFAULT 15,
    "noShowAutoForfeit" BOOLEAN NOT NULL DEFAULT false,
    "forfeitScoreFor" INTEGER NOT NULL DEFAULT 1,
    "forfeitScoreAgainst" INTEGER NOT NULL DEFAULT 0,
    "minTeamRestMinutes" INTEGER NOT NULL DEFAULT 0,
    "withdrawalDeadline" TIMESTAMP(3),
    "autoPromoteRegistrationWaitlist" BOOLEAN NOT NULL DEFAULT true,
    "rescheduleCutoffMinutes" INTEGER NOT NULL DEFAULT 0,
    "allowRescheduleAfterStart" BOOLEAN NOT NULL DEFAULT false,
    "seedingPolicy" "TournamentSeedingPolicy" NOT NULL DEFAULT 'manual',
    "seedsLockedAt" TIMESTAMP(3),
    "playoffSize" INTEGER NOT NULL DEFAULT 8,
    "doubleElimination" BOOLEAN NOT NULL DEFAULT false,
    "enableThirdPlaceMatch" BOOLEAN NOT NULL DEFAULT true,
    "enableConsolationBracket" BOOLEAN NOT NULL DEFAULT false,
    "allowByes" BOOLEAN NOT NULL DEFAULT true,
    "contingencyMode" "TournamentContingencyMode" NOT NULL DEFAULT 'normal',
    "contingencyNotes" TEXT,
    "contingencyDelayMinutes" INTEGER NOT NULL DEFAULT 0,
    "shareToken" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "parentTournamentId" TEXT,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "captainName" TEXT,
    "captainEmail" TEXT,
    "captainUserId" TEXT,
    "tournamentId" TEXT NOT NULL,
    "poolNumber" INTEGER,
    "poolName" TEXT,
    "seedNumber" INTEGER,
    "poolId" TEXT,
    "registrationOrder" INTEGER,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "paidAt" TIMESTAMP(3),
    "paidByUserId" TEXT,
    "waiverAcceptedAt" TIMESTAMP(3),
    "waiverAcceptedByUserId" TEXT,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3),
    "checkInToken" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentMatch" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT,
    "refereeTeamId" TEXT,
    "scorekeeperUserId" TEXT,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "detailedScore" JSONB,
    "stage" "BracketStage",
    "bracketSide" "BracketSide",
    "roundNumber" INTEGER,
    "groupName" TEXT,
    "isBye" BOOLEAN NOT NULL DEFAULT false,
    "loserGoesToMatchId" TEXT,
    "isManuallyCreated" BOOLEAN NOT NULL DEFAULT false,
    "matchOrder" INTEGER,
    "status" "MatchStatus" NOT NULL DEFAULT 'scheduled',
    "scheduledAt" TIMESTAMP(3),
    "scheduledDurationMinutes" INTEGER DEFAULT 60,
    "courtId" TEXT,
    "location" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentPaymentTransaction" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "providerReference" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "TournamentPaymentTransactionStatus" NOT NULL DEFAULT 'initiated',
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentPaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentCourt" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentCourt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentCourtAvailability" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "date" TIMESTAMP(3),
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentCourtAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentStanding" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "goalsFor" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainst" INTEGER NOT NULL DEFAULT 0,
    "groupName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentStanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentPlayer" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "playerName" TEXT NOT NULL,
    "playerEmail" TEXT,
    "jerseyNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentPool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "venue" TEXT,
    "maxTeams" INTEGER NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentPoolWaitlist" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentPoolWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentRegistrationWaitlist" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentRegistrationWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentScoreDispute" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "disputingTeamId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ScoreDisputeStatus" NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentScoreDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentAnnouncement" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentRegistrationField" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "RegistrationFieldType" NOT NULL DEFAULT 'text',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentRegistrationField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentTeamAnswer" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentTeamAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentPlayerStat" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "statKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentPlayerStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentMatchIncident" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "reportedByUserId" TEXT NOT NULL,
    "incidentType" "MatchIncidentType" NOT NULL DEFAULT 'other',
    "description" TEXT NOT NULL,
    "status" "MatchIncidentStatus" NOT NULL DEFAULT 'open',
    "slaDeadline" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentMatchIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "tournamentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentAdminRole" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TournamentAdminRoleType" NOT NULL DEFAULT 'co_organizer',
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentAdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentTeamInvitation" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "inviteeName" TEXT,
    "inviteeUserId" TEXT,
    "inviterId" TEXT NOT NULL,
    "inviteToken" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentTeamInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "LeagueTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "captainUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaguePlayer" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "playerName" TEXT,
    "jerseyNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaguePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueSessionEntry" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "roundNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueSessionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE INDEX "UserProfilePicture_userId_isCurrent_idx" ON "UserProfilePicture"("userId", "isCurrent");

-- CreateIndex
CREATE INDEX "GroupMessage_userId_idx" ON "GroupMessage"("userId");

-- CreateIndex
CREATE INDEX "SessionReminder_sent_idx" ON "SessionReminder"("sent");

-- CreateIndex
CREATE UNIQUE INDEX "SessionReminder_sessionId_userId_remindAt_key" ON "SessionReminder"("sessionId", "userId", "remindAt");

-- CreateIndex
CREATE INDEX "SessionAttendance_status_idx" ON "SessionAttendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionAttendance_sessionId_userId_key" ON "SessionAttendance"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "SessionNotification_userId_idx" ON "SessionNotification"("userId");

-- CreateIndex
CREATE INDEX "SessionNotification_sessionId_idx" ON "SessionNotification"("sessionId");

-- CreateIndex
CREATE INDEX "SessionNotification_read_idx" ON "SessionNotification"("read");

-- CreateIndex
CREATE INDEX "SessionNotification_userId_read_idx" ON "SessionNotification"("userId", "read");

-- CreateIndex
CREATE INDEX "SessionNotification_createdAt_idx" ON "SessionNotification"("createdAt");

-- CreateIndex
CREATE INDEX "SessionNotification_userId_createdAt_id_idx" ON "SessionNotification"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SessionNotification_userId_read_createdAt_idx" ON "SessionNotification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "GroupNotification_userId_idx" ON "GroupNotification"("userId");

-- CreateIndex
CREATE INDEX "GroupNotification_groupId_idx" ON "GroupNotification"("groupId");

-- CreateIndex
CREATE INDEX "GroupNotification_read_idx" ON "GroupNotification"("read");

-- CreateIndex
CREATE INDEX "GroupNotification_userId_read_idx" ON "GroupNotification"("userId", "read");

-- CreateIndex
CREATE INDEX "GroupNotification_createdAt_idx" ON "GroupNotification"("createdAt");

-- CreateIndex
CREATE INDEX "GroupNotification_userId_createdAt_id_idx" ON "GroupNotification"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "GroupNotification_userId_read_createdAt_idx" ON "GroupNotification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "TeamUpNotification_userId_idx" ON "TeamUpNotification"("userId");

-- CreateIndex
CREATE INDEX "TeamUpNotification_teamUpRequestId_idx" ON "TeamUpNotification"("teamUpRequestId");

-- CreateIndex
CREATE INDEX "TeamUpNotification_read_idx" ON "TeamUpNotification"("read");

-- CreateIndex
CREATE INDEX "TeamUpNotification_userId_read_idx" ON "TeamUpNotification"("userId", "read");

-- CreateIndex
CREATE INDEX "TeamUpNotification_createdAt_idx" ON "TeamUpNotification"("createdAt");

-- CreateIndex
CREATE INDEX "TeamUpNotification_userId_createdAt_id_idx" ON "TeamUpNotification"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "TeamUpNotification_userId_read_createdAt_idx" ON "TeamUpNotification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "TournamentNotification_userId_idx" ON "TournamentNotification"("userId");

-- CreateIndex
CREATE INDEX "TournamentNotification_tournamentId_idx" ON "TournamentNotification"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentNotification_read_idx" ON "TournamentNotification"("read");

-- CreateIndex
CREATE INDEX "TournamentNotification_userId_read_idx" ON "TournamentNotification"("userId", "read");

-- CreateIndex
CREATE INDEX "TournamentNotification_createdAt_idx" ON "TournamentNotification"("createdAt");

-- CreateIndex
CREATE INDEX "TournamentNotification_userId_createdAt_id_idx" ON "TournamentNotification"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "TournamentNotification_userId_read_createdAt_idx" ON "TournamentNotification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "InviteLog_inviterType_entityId_idx" ON "InviteLog"("inviterType", "entityId");

-- CreateIndex
CREATE INDEX "InviteLog_inviterId_idx" ON "InviteLog"("inviterId");

-- CreateIndex
CREATE INDEX "InviteLog_inviteeEmail_idx" ON "InviteLog"("inviteeEmail");

-- CreateIndex
CREATE INDEX "InviteLog_status_idx" ON "InviteLog"("status");

-- CreateIndex
CREATE INDEX "InviteLog_sentAt_idx" ON "InviteLog"("sentAt");

-- CreateIndex
CREATE INDEX "InviteLog_expiresAt_idx" ON "InviteLog"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_facebookId_key" ON "User"("facebookId");

-- CreateIndex
CREATE UNIQUE INDEX "User_appleId_key" ON "User"("appleId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_emailVerificationToken_idx" ON "User"("emailVerificationToken");

-- CreateIndex
CREATE INDEX "User_emailVerificationExpires_idx" ON "User"("emailVerificationExpires");

-- CreateIndex
CREATE INDEX "User_passwordResetToken_idx" ON "User"("passwordResetToken");

-- CreateIndex
CREATE INDEX "User_city_country_idx" ON "User"("city", "country");

-- CreateIndex
CREATE INDEX "User_createdAt_deletedAt_idx" ON "User"("createdAt", "deletedAt");

-- CreateIndex
CREATE INDEX "User_googleId_idx" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_facebookId_idx" ON "User"("facebookId");

-- CreateIndex
CREATE INDEX "User_appleId_idx" ON "User"("appleId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_inviteToken_key" ON "Group"("inviteToken");

-- CreateIndex
CREATE INDEX "GroupJoinRequest_status_idx" ON "GroupJoinRequest"("status");

-- CreateIndex
CREATE INDEX "GroupJoinRequest_userId_status_idx" ON "GroupJoinRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "GroupJoinRequest_expiresAt_idx" ON "GroupJoinRequest"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupJoinRequest_groupId_userId_key" ON "GroupJoinRequest"("groupId", "userId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");

-- CreateIndex
CREATE INDEX "GroupMember_role_idx" ON "GroupMember"("role");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_role_idx" ON "GroupMember"("groupId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_userId_groupId_key" ON "GroupMember"("userId", "groupId");

-- CreateIndex
CREATE INDEX "GroupBan_userId_idx" ON "GroupBan"("userId");

-- CreateIndex
CREATE INDEX "GroupBan_groupId_idx" ON "GroupBan"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupBan_groupId_userId_key" ON "GroupBan"("groupId", "userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_inviteToken_key" ON "Session"("inviteToken");

-- CreateIndex
CREATE INDEX "Session_groupId_idx" ON "Session"("groupId");

-- CreateIndex
CREATE INDEX "Session_creatorId_idx" ON "Session"("creatorId");

-- CreateIndex
CREATE INDEX "Session_startTime_idx" ON "Session"("startTime");

-- CreateIndex
CREATE INDEX "Session_status_idx" ON "Session"("status");

-- CreateIndex
CREATE INDEX "Session_sessionType_idx" ON "Session"("sessionType");

-- CreateIndex
CREATE INDEX "Session_inviteToken_idx" ON "Session"("inviteToken");

-- CreateIndex
CREATE INDEX "Session_archived_idx" ON "Session"("archived");

-- CreateIndex
CREATE INDEX "Session_groupId_startTime_idx" ON "Session"("groupId", "startTime");

-- CreateIndex
CREATE INDEX "Session_creatorId_startTime_idx" ON "Session"("creatorId", "startTime");

-- CreateIndex
CREATE INDEX "Session_city_country_idx" ON "Session"("city", "country");

-- CreateIndex
CREATE INDEX "Session_status_startTime_idx" ON "Session"("status", "startTime");

-- CreateIndex
CREATE INDEX "Session_sessionType_startTime_idx" ON "Session"("sessionType", "startTime");

-- CreateIndex
CREATE INDEX "Session_isPublic_startTime_idx" ON "Session"("isPublic", "startTime");

-- CreateIndex
CREATE INDEX "Session_archived_status_startTime_idx" ON "Session"("archived", "status", "startTime");

-- CreateIndex
CREATE INDEX "SessionParticipant_sessionId_idx" ON "SessionParticipant"("sessionId");

-- CreateIndex
CREATE INDEX "SessionParticipant_userId_idx" ON "SessionParticipant"("userId");

-- CreateIndex
CREATE INDEX "SessionParticipant_status_idx" ON "SessionParticipant"("status");

-- CreateIndex
CREATE INDEX "SessionParticipant_sessionId_status_idx" ON "SessionParticipant"("sessionId", "status");

-- CreateIndex
CREATE INDEX "SessionParticipant_joinedAt_idx" ON "SessionParticipant"("joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionParticipant_sessionId_userId_key" ON "SessionParticipant"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionRequest_finalizedSessionId_key" ON "SessionRequest"("finalizedSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionVote_sessionRequestId_userId_key" ON "SessionVote"("sessionRequestId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailPreference_userId_key" ON "EmailPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushDeviceToken_token_key" ON "PushDeviceToken"("token");

-- CreateIndex
CREATE INDEX "PushDeviceToken_userId_enabled_idx" ON "PushDeviceToken"("userId", "enabled");

-- CreateIndex
CREATE INDEX "PushDeviceToken_lastSeen_idx" ON "PushDeviceToken"("lastSeen");

-- CreateIndex
CREATE INDEX "PushDeviceToken_platform_idx" ON "PushDeviceToken"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "CommentMention_commentId_userId_key" ON "CommentMention"("commentId", "userId");

-- CreateIndex
CREATE INDEX "GuestParticipant_sessionId_idx" ON "GuestParticipant"("sessionId");

-- CreateIndex
CREATE INDEX "GuestParticipant_joinedAt_idx" ON "GuestParticipant"("joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuestParticipant_sessionId_name_key" ON "GuestParticipant"("sessionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "RevokedToken_token_key" ON "RevokedToken"("token");

-- CreateIndex
CREATE INDEX "RevokedToken_token_idx" ON "RevokedToken"("token");

-- CreateIndex
CREATE INDEX "RevokedToken_userId_idx" ON "RevokedToken"("userId");

-- CreateIndex
CREATE INDEX "RevokedToken_expiresAt_idx" ON "RevokedToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_key" ON "UserSession"("token");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_token_idx" ON "UserSession"("token");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailQueue_status_idx" ON "EmailQueue"("status");

-- CreateIndex
CREATE INDEX "EmailQueue_scheduledAt_idx" ON "EmailQueue"("scheduledAt");

-- CreateIndex
CREATE INDEX "EmailQueue_recipient_idx" ON "EmailQueue"("recipient");

-- CreateIndex
CREATE INDEX "TeamUpRequest_creatorId_idx" ON "TeamUpRequest"("creatorId");

-- CreateIndex
CREATE INDEX "TeamUpRequest_dateTime_idx" ON "TeamUpRequest"("dateTime");

-- CreateIndex
CREATE INDEX "TeamUpRequest_status_idx" ON "TeamUpRequest"("status");

-- CreateIndex
CREATE INDEX "TeamUpRequest_sportType_idx" ON "TeamUpRequest"("sportType");

-- CreateIndex
CREATE INDEX "TeamUpRequest_requestType_idx" ON "TeamUpRequest"("requestType");

-- CreateIndex
CREATE INDEX "TeamUpRequest_city_country_idx" ON "TeamUpRequest"("city", "country");

-- CreateIndex
CREATE INDEX "TeamUpRequest_latitude_longitude_idx" ON "TeamUpRequest"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "TeamUpRequest_status_dateTime_idx" ON "TeamUpRequest"("status", "dateTime");

-- CreateIndex
CREATE INDEX "TeamUpRequest_sportType_status_dateTime_idx" ON "TeamUpRequest"("sportType", "status", "dateTime");

-- CreateIndex
CREATE INDEX "TeamUpRequest_requestType_status_dateTime_idx" ON "TeamUpRequest"("requestType", "status", "dateTime");

-- CreateIndex
CREATE INDEX "TeamUpRequest_city_country_status_dateTime_idx" ON "TeamUpRequest"("city", "country", "status", "dateTime");

-- CreateIndex
CREATE INDEX "TeamUpRequest_creatorId_status_idx" ON "TeamUpRequest"("creatorId", "status");

-- CreateIndex
CREATE INDEX "TeamUpRequestPosition_teamUpRequestId_idx" ON "TeamUpRequestPosition"("teamUpRequestId");

-- CreateIndex
CREATE INDEX "TeamUpRequestPosition_teamUpRequestId_name_idx" ON "TeamUpRequestPosition"("teamUpRequestId", "name");

-- CreateIndex
CREATE INDEX "TeamUpRequestPosition_teamUpRequestId_slotsNeeded_idx" ON "TeamUpRequestPosition"("teamUpRequestId", "slotsNeeded");

-- CreateIndex
CREATE INDEX "TeamUpResponse_teamUpRequestId_idx" ON "TeamUpResponse"("teamUpRequestId");

-- CreateIndex
CREATE INDEX "TeamUpResponse_requestPositionId_idx" ON "TeamUpResponse"("requestPositionId");

-- CreateIndex
CREATE INDEX "TeamUpResponse_userId_idx" ON "TeamUpResponse"("userId");

-- CreateIndex
CREATE INDEX "TeamUpResponse_status_idx" ON "TeamUpResponse"("status");

-- CreateIndex
CREATE INDEX "TeamUpResponse_userId_teamUpRequestId_idx" ON "TeamUpResponse"("userId", "teamUpRequestId");

-- CreateIndex
CREATE INDEX "TeamUpResponse_teamUpRequestId_status_requestPositionId_idx" ON "TeamUpResponse"("teamUpRequestId", "status", "requestPositionId");

-- CreateIndex
CREATE INDEX "TeamUpResponse_teamUpRequestId_requestPositionId_waitlistRa_idx" ON "TeamUpResponse"("teamUpRequestId", "requestPositionId", "waitlistRank");

-- CreateIndex
CREATE INDEX "TeamUpResponse_userId_attendanceStatus_idx" ON "TeamUpResponse"("userId", "attendanceStatus");

-- CreateIndex
CREATE UNIQUE INDEX "TeamUpResponse_teamUpRequestId_userId_key" ON "TeamUpResponse"("teamUpRequestId", "userId");

-- CreateIndex
CREATE INDEX "TeamUpComment_teamUpRequestId_idx" ON "TeamUpComment"("teamUpRequestId");

-- CreateIndex
CREATE INDEX "TeamUpComment_userId_idx" ON "TeamUpComment"("userId");

-- CreateIndex
CREATE INDEX "TeamUpComment_createdAt_idx" ON "TeamUpComment"("createdAt");

-- CreateIndex
CREATE INDEX "TeamUpModerationCase_teamUpRequestId_status_idx" ON "TeamUpModerationCase"("teamUpRequestId", "status");

-- CreateIndex
CREATE INDEX "TeamUpModerationCase_reporterId_createdAt_idx" ON "TeamUpModerationCase"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamUpModerationCase_status_createdAt_idx" ON "TeamUpModerationCase"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TeamUpSavedSearch_userId_createdAt_idx" ON "TeamUpSavedSearch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamUpRequestView_teamUpRequestId_viewedAt_idx" ON "TeamUpRequestView"("teamUpRequestId", "viewedAt");

-- CreateIndex
CREATE INDEX "TeamUpRequestView_viewerId_viewedAt_idx" ON "TeamUpRequestView"("viewerId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_shareToken_key" ON "Tournament"("shareToken");

-- CreateIndex
CREATE INDEX "Tournament_organizerId_idx" ON "Tournament"("organizerId");

-- CreateIndex
CREATE INDEX "Tournament_groupId_idx" ON "Tournament"("groupId");

-- CreateIndex
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");

-- CreateIndex
CREATE INDEX "Tournament_startDate_idx" ON "Tournament"("startDate");

-- CreateIndex
CREATE INDEX "Tournament_sportType_idx" ON "Tournament"("sportType");

-- CreateIndex
CREATE INDEX "Tournament_city_country_idx" ON "Tournament"("city", "country");

-- CreateIndex
CREATE INDEX "Tournament_isPublic_idx" ON "Tournament"("isPublic");

-- CreateIndex
CREATE INDEX "Tournament_parentTournamentId_idx" ON "Tournament"("parentTournamentId");

-- CreateIndex
CREATE INDEX "Tournament_shareToken_idx" ON "Tournament"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeam_checkInToken_key" ON "TournamentTeam"("checkInToken");

-- CreateIndex
CREATE INDEX "TournamentTeam_tournamentId_idx" ON "TournamentTeam"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentTeam_captainUserId_idx" ON "TournamentTeam"("captainUserId");

-- CreateIndex
CREATE INDEX "TournamentTeam_poolNumber_idx" ON "TournamentTeam"("poolNumber");

-- CreateIndex
CREATE INDEX "TournamentTeam_poolId_idx" ON "TournamentTeam"("poolId");

-- CreateIndex
CREATE INDEX "TournamentTeam_tournamentId_captainUserId_idx" ON "TournamentTeam"("tournamentId", "captainUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeam_tournamentId_name_key" ON "TournamentTeam"("tournamentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeam_tournamentId_captainUserId_key" ON "TournamentTeam"("tournamentId", "captainUserId");

-- CreateIndex
CREATE INDEX "TournamentMatch_tournamentId_idx" ON "TournamentMatch"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentMatch_homeTeamId_idx" ON "TournamentMatch"("homeTeamId");

-- CreateIndex
CREATE INDEX "TournamentMatch_awayTeamId_idx" ON "TournamentMatch"("awayTeamId");

-- CreateIndex
CREATE INDEX "TournamentMatch_refereeTeamId_idx" ON "TournamentMatch"("refereeTeamId");

-- CreateIndex
CREATE INDEX "TournamentMatch_scorekeeperUserId_idx" ON "TournamentMatch"("scorekeeperUserId");

-- CreateIndex
CREATE INDEX "TournamentMatch_status_idx" ON "TournamentMatch"("status");

-- CreateIndex
CREATE INDEX "TournamentMatch_stage_idx" ON "TournamentMatch"("stage");

-- CreateIndex
CREATE INDEX "TournamentMatch_bracketSide_idx" ON "TournamentMatch"("bracketSide");

-- CreateIndex
CREATE INDEX "TournamentMatch_matchOrder_idx" ON "TournamentMatch"("matchOrder");

-- CreateIndex
CREATE INDEX "TournamentMatch_courtId_idx" ON "TournamentMatch"("courtId");

-- CreateIndex
CREATE INDEX "TournamentMatch_courtId_scheduledAt_idx" ON "TournamentMatch"("courtId", "scheduledAt");

-- CreateIndex
CREATE INDEX "TournamentPaymentTransaction_tournamentId_idx" ON "TournamentPaymentTransaction"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentPaymentTransaction_teamId_idx" ON "TournamentPaymentTransaction"("teamId");

-- CreateIndex
CREATE INDEX "TournamentPaymentTransaction_status_idx" ON "TournamentPaymentTransaction"("status");

-- CreateIndex
CREATE INDEX "TournamentPaymentTransaction_providerReference_idx" ON "TournamentPaymentTransaction"("providerReference");

-- CreateIndex
CREATE INDEX "TournamentCourt_tournamentId_idx" ON "TournamentCourt"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentCourt_tournamentId_name_key" ON "TournamentCourt"("tournamentId", "name");

-- CreateIndex
CREATE INDEX "TournamentCourtAvailability_courtId_idx" ON "TournamentCourtAvailability"("courtId");

-- CreateIndex
CREATE INDEX "TournamentCourtAvailability_date_idx" ON "TournamentCourtAvailability"("date");

-- CreateIndex
CREATE INDEX "TournamentCourtAvailability_dayOfWeek_idx" ON "TournamentCourtAvailability"("dayOfWeek");

-- CreateIndex
CREATE INDEX "TournamentStanding_tournamentId_idx" ON "TournamentStanding"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentStanding_teamId_idx" ON "TournamentStanding"("teamId");

-- CreateIndex
CREATE INDEX "TournamentStanding_points_idx" ON "TournamentStanding"("points");

-- CreateIndex
CREATE INDEX "TournamentStanding_tournamentId_groupName_points_goalsFor_g_idx" ON "TournamentStanding"("tournamentId", "groupName", "points", "goalsFor", "goalsAgainst", "wins", "losses");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentStanding_tournamentId_teamId_groupName_key" ON "TournamentStanding"("tournamentId", "teamId", "groupName");

-- CreateIndex
CREATE INDEX "TournamentPlayer_teamId_idx" ON "TournamentPlayer"("teamId");

-- CreateIndex
CREATE INDEX "TournamentPlayer_userId_idx" ON "TournamentPlayer"("userId");

-- CreateIndex
CREATE INDEX "TournamentPlayer_userId_teamId_idx" ON "TournamentPlayer"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPlayer_teamId_userId_key" ON "TournamentPlayer"("teamId", "userId");

-- CreateIndex
CREATE INDEX "TournamentPool_tournamentId_idx" ON "TournamentPool"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentPool_categoryId_idx" ON "TournamentPool"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPool_tournamentId_name_key" ON "TournamentPool"("tournamentId", "name");

-- CreateIndex
CREATE INDEX "TournamentPoolWaitlist_poolId_idx" ON "TournamentPoolWaitlist"("poolId");

-- CreateIndex
CREATE INDEX "TournamentPoolWaitlist_teamId_idx" ON "TournamentPoolWaitlist"("teamId");

-- CreateIndex
CREATE INDEX "TournamentPoolWaitlist_poolId_position_idx" ON "TournamentPoolWaitlist"("poolId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPoolWaitlist_poolId_teamId_key" ON "TournamentPoolWaitlist"("poolId", "teamId");

-- CreateIndex
CREATE INDEX "TournamentRegistrationWaitlist_tournamentId_idx" ON "TournamentRegistrationWaitlist"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentRegistrationWaitlist_teamId_idx" ON "TournamentRegistrationWaitlist"("teamId");

-- CreateIndex
CREATE INDEX "TournamentRegistrationWaitlist_tournamentId_position_idx" ON "TournamentRegistrationWaitlist"("tournamentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRegistrationWaitlist_tournamentId_teamId_key" ON "TournamentRegistrationWaitlist"("tournamentId", "teamId");

-- CreateIndex
CREATE INDEX "TournamentScoreDispute_matchId_idx" ON "TournamentScoreDispute"("matchId");

-- CreateIndex
CREATE INDEX "TournamentScoreDispute_disputingTeamId_idx" ON "TournamentScoreDispute"("disputingTeamId");

-- CreateIndex
CREATE INDEX "TournamentScoreDispute_status_idx" ON "TournamentScoreDispute"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentScoreDispute_matchId_disputingTeamId_key" ON "TournamentScoreDispute"("matchId", "disputingTeamId");

-- CreateIndex
CREATE INDEX "TournamentAnnouncement_tournamentId_idx" ON "TournamentAnnouncement"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentAnnouncement_tournamentId_createdAt_idx" ON "TournamentAnnouncement"("tournamentId", "createdAt");

-- CreateIndex
CREATE INDEX "TournamentRegistrationField_tournamentId_idx" ON "TournamentRegistrationField"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentRegistrationField_tournamentId_sortOrder_idx" ON "TournamentRegistrationField"("tournamentId", "sortOrder");

-- CreateIndex
CREATE INDEX "TournamentTeamAnswer_fieldId_idx" ON "TournamentTeamAnswer"("fieldId");

-- CreateIndex
CREATE INDEX "TournamentTeamAnswer_teamId_idx" ON "TournamentTeamAnswer"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeamAnswer_fieldId_teamId_key" ON "TournamentTeamAnswer"("fieldId", "teamId");

-- CreateIndex
CREATE INDEX "TournamentPlayerStat_tournamentId_idx" ON "TournamentPlayerStat"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentPlayerStat_teamId_idx" ON "TournamentPlayerStat"("teamId");

-- CreateIndex
CREATE INDEX "TournamentPlayerStat_playerId_idx" ON "TournamentPlayerStat"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPlayerStat_playerId_statKey_key" ON "TournamentPlayerStat"("playerId", "statKey");

-- CreateIndex
CREATE INDEX "TournamentMatchIncident_tournamentId_idx" ON "TournamentMatchIncident"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentMatchIncident_matchId_idx" ON "TournamentMatchIncident"("matchId");

-- CreateIndex
CREATE INDEX "TournamentMatchIncident_status_idx" ON "TournamentMatchIncident"("status");

-- CreateIndex
CREATE INDEX "TournamentMatchIncident_slaDeadline_idx" ON "TournamentMatchIncident"("slaDeadline");

-- CreateIndex
CREATE INDEX "TournamentCategory_tournamentId_idx" ON "TournamentCategory"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentCategory_tournamentId_sortOrder_idx" ON "TournamentCategory"("tournamentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentCategory_tournamentId_name_key" ON "TournamentCategory"("tournamentId", "name");

-- CreateIndex
CREATE INDEX "TournamentAdminRole_tournamentId_idx" ON "TournamentAdminRole"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentAdminRole_userId_idx" ON "TournamentAdminRole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentAdminRole_tournamentId_userId_key" ON "TournamentAdminRole"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeamInvitation_inviteToken_key" ON "TournamentTeamInvitation"("inviteToken");

-- CreateIndex
CREATE INDEX "TournamentTeamInvitation_teamId_idx" ON "TournamentTeamInvitation"("teamId");

-- CreateIndex
CREATE INDEX "TournamentTeamInvitation_inviteeEmail_idx" ON "TournamentTeamInvitation"("inviteeEmail");

-- CreateIndex
CREATE INDEX "TournamentTeamInvitation_inviteeUserId_idx" ON "TournamentTeamInvitation"("inviteeUserId");

-- CreateIndex
CREATE INDEX "TournamentTeamInvitation_inviteToken_idx" ON "TournamentTeamInvitation"("inviteToken");

-- CreateIndex
CREATE INDEX "TournamentTeamInvitation_status_idx" ON "TournamentTeamInvitation"("status");

-- CreateIndex
CREATE INDEX "TournamentTeamInvitation_expiresAt_idx" ON "TournamentTeamInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "TournamentTeamInvitation_teamId_inviteeEmail_status_idx" ON "TournamentTeamInvitation"("teamId", "inviteeEmail", "status");

-- CreateIndex
CREATE INDEX "League_groupId_idx" ON "League"("groupId");

-- CreateIndex
CREATE INDEX "League_creatorId_idx" ON "League"("creatorId");

-- CreateIndex
CREATE INDEX "League_status_idx" ON "League"("status");

-- CreateIndex
CREATE INDEX "League_sport_idx" ON "League"("sport");

-- CreateIndex
CREATE INDEX "LeagueTeam_leagueId_idx" ON "LeagueTeam"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueTeam_leagueId_name_key" ON "LeagueTeam"("leagueId", "name");

-- CreateIndex
CREATE INDEX "LeaguePlayer_teamId_idx" ON "LeaguePlayer"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaguePlayer_teamId_userId_key" ON "LeaguePlayer"("teamId", "userId");

-- CreateIndex
CREATE INDEX "LeagueSessionEntry_leagueId_idx" ON "LeagueSessionEntry"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueSessionEntry_leagueId_sessionId_key" ON "LeagueSessionEntry"("leagueId", "sessionId");

-- CreateIndex
CREATE INDEX "LeagueMatch_leagueId_idx" ON "LeagueMatch"("leagueId");

-- CreateIndex
CREATE INDEX "LeagueMatch_homeTeamId_idx" ON "LeagueMatch"("homeTeamId");

-- CreateIndex
CREATE INDEX "LeagueMatch_awayTeamId_idx" ON "LeagueMatch"("awayTeamId");

-- CreateIndex
CREATE INDEX "LeagueStanding_leagueId_idx" ON "LeagueStanding"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueStanding_leagueId_teamId_key" ON "LeagueStanding"("leagueId", "teamId");

-- AddForeignKey
ALTER TABLE "UserProfilePicture" ADD CONSTRAINT "UserProfilePicture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionReminder" ADD CONSTRAINT "SessionReminder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionReminder" ADD CONSTRAINT "SessionReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionNotification" ADD CONSTRAINT "SessionNotification_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionNotification" ADD CONSTRAINT "SessionNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupNotification" ADD CONSTRAINT "GroupNotification_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupNotification" ADD CONSTRAINT "GroupNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpNotification" ADD CONSTRAINT "TeamUpNotification_teamUpRequestId_fkey" FOREIGN KEY ("teamUpRequestId") REFERENCES "TeamUpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpNotification" ADD CONSTRAINT "TeamUpNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentNotification" ADD CONSTRAINT "TournamentNotification_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentNotification" ADD CONSTRAINT "TournamentNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLog" ADD CONSTRAINT "InviteLog_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLog" ADD CONSTRAINT "InviteLog_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLog" ADD CONSTRAINT "InviteLog_revokedBy_fkey" FOREIGN KEY ("revokedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupJoinRequest" ADD CONSTRAINT "GroupJoinRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupJoinRequest" ADD CONSTRAINT "GroupJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupJoinRequest" ADD CONSTRAINT "GroupJoinRequest_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBan" ADD CONSTRAINT "GroupBan_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBan" ADD CONSTRAINT "GroupBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBan" ADD CONSTRAINT "GroupBan_bannedBy_fkey" FOREIGN KEY ("bannedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_parentSessionId_fkey" FOREIGN KEY ("parentSessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRequest" ADD CONSTRAINT "SessionRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRequest" ADD CONSTRAINT "SessionRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionVote" ADD CONSTRAINT "SessionVote_sessionRequestId_fkey" FOREIGN KEY ("sessionRequestId") REFERENCES "SessionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionVote" ADD CONSTRAINT "SessionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailPreference" ADD CONSTRAINT "EmailPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDeviceToken" ADD CONSTRAINT "PushDeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentMention" ADD CONSTRAINT "CommentMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentMention" ADD CONSTRAINT "CommentMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestParticipant" ADD CONSTRAINT "GuestParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevokedToken" ADD CONSTRAINT "RevokedToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpRequest" ADD CONSTRAINT "TeamUpRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpRequestPosition" ADD CONSTRAINT "TeamUpRequestPosition_teamUpRequestId_fkey" FOREIGN KEY ("teamUpRequestId") REFERENCES "TeamUpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpResponse" ADD CONSTRAINT "TeamUpResponse_teamUpRequestId_fkey" FOREIGN KEY ("teamUpRequestId") REFERENCES "TeamUpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpResponse" ADD CONSTRAINT "TeamUpResponse_requestPositionId_fkey" FOREIGN KEY ("requestPositionId") REFERENCES "TeamUpRequestPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpResponse" ADD CONSTRAINT "TeamUpResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpComment" ADD CONSTRAINT "TeamUpComment_teamUpRequestId_fkey" FOREIGN KEY ("teamUpRequestId") REFERENCES "TeamUpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpComment" ADD CONSTRAINT "TeamUpComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpModerationCase" ADD CONSTRAINT "TeamUpModerationCase_teamUpRequestId_fkey" FOREIGN KEY ("teamUpRequestId") REFERENCES "TeamUpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpModerationCase" ADD CONSTRAINT "TeamUpModerationCase_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpModerationCase" ADD CONSTRAINT "TeamUpModerationCase_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpSavedSearch" ADD CONSTRAINT "TeamUpSavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpRequestView" ADD CONSTRAINT "TeamUpRequestView_teamUpRequestId_fkey" FOREIGN KEY ("teamUpRequestId") REFERENCES "TeamUpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamUpRequestView" ADD CONSTRAINT "TeamUpRequestView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_parentTournamentId_fkey" FOREIGN KEY ("parentTournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeam" ADD CONSTRAINT "TournamentTeam_captainUserId_fkey" FOREIGN KEY ("captainUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeam" ADD CONSTRAINT "TournamentTeam_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeam" ADD CONSTRAINT "TournamentTeam_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "TournamentPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeam" ADD CONSTRAINT "TournamentTeam_waiverAcceptedByUserId_fkey" FOREIGN KEY ("waiverAcceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "TournamentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "TournamentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_refereeTeamId_fkey" FOREIGN KEY ("refereeTeamId") REFERENCES "TournamentTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_scorekeeperUserId_fkey" FOREIGN KEY ("scorekeeperUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_loserGoesToMatchId_fkey" FOREIGN KEY ("loserGoesToMatchId") REFERENCES "TournamentMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "TournamentCourt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPaymentTransaction" ADD CONSTRAINT "TournamentPaymentTransaction_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPaymentTransaction" ADD CONSTRAINT "TournamentPaymentTransaction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TournamentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentCourt" ADD CONSTRAINT "TournamentCourt_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentCourtAvailability" ADD CONSTRAINT "TournamentCourtAvailability_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "TournamentCourt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentStanding" ADD CONSTRAINT "TournamentStanding_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentStanding" ADD CONSTRAINT "TournamentStanding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TournamentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPlayer" ADD CONSTRAINT "TournamentPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TournamentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPlayer" ADD CONSTRAINT "TournamentPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPool" ADD CONSTRAINT "TournamentPool_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPool" ADD CONSTRAINT "TournamentPool_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TournamentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPoolWaitlist" ADD CONSTRAINT "TournamentPoolWaitlist_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "TournamentPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPoolWaitlist" ADD CONSTRAINT "TournamentPoolWaitlist_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TournamentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRegistrationWaitlist" ADD CONSTRAINT "TournamentRegistrationWaitlist_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRegistrationWaitlist" ADD CONSTRAINT "TournamentRegistrationWaitlist_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TournamentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentScoreDispute" ADD CONSTRAINT "TournamentScoreDispute_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "TournamentMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentScoreDispute" ADD CONSTRAINT "TournamentScoreDispute_disputingTeamId_fkey" FOREIGN KEY ("disputingTeamId") REFERENCES "TournamentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentScoreDispute" ADD CONSTRAINT "TournamentScoreDispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentAnnouncement" ADD CONSTRAINT "TournamentAnnouncement_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentAnnouncement" ADD CONSTRAINT "TournamentAnnouncement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRegistrationField" ADD CONSTRAINT "TournamentRegistrationField_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeamAnswer" ADD CONSTRAINT "TournamentTeamAnswer_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "TournamentRegistrationField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeamAnswer" ADD CONSTRAINT "TournamentTeamAnswer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TournamentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPlayerStat" ADD CONSTRAINT "TournamentPlayerStat_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TournamentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPlayerStat" ADD CONSTRAINT "TournamentPlayerStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "TournamentPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatchIncident" ADD CONSTRAINT "TournamentMatchIncident_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatchIncident" ADD CONSTRAINT "TournamentMatchIncident_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "TournamentMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatchIncident" ADD CONSTRAINT "TournamentMatchIncident_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentCategory" ADD CONSTRAINT "TournamentCategory_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentAdminRole" ADD CONSTRAINT "TournamentAdminRole_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentAdminRole" ADD CONSTRAINT "TournamentAdminRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentAdminRole" ADD CONSTRAINT "TournamentAdminRole_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeamInvitation" ADD CONSTRAINT "TournamentTeamInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "TournamentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeamInvitation" ADD CONSTRAINT "TournamentTeamInvitation_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeamInvitation" ADD CONSTRAINT "TournamentTeamInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueTeam" ADD CONSTRAINT "LeagueTeam_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueTeam" ADD CONSTRAINT "LeagueTeam_captainUserId_fkey" FOREIGN KEY ("captainUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaguePlayer" ADD CONSTRAINT "LeaguePlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "LeagueTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaguePlayer" ADD CONSTRAINT "LeaguePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueSessionEntry" ADD CONSTRAINT "LeagueSessionEntry_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueSessionEntry" ADD CONSTRAINT "LeagueSessionEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMatch" ADD CONSTRAINT "LeagueMatch_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "LeagueTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMatch" ADD CONSTRAINT "LeagueMatch_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "LeagueTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueStanding" ADD CONSTRAINT "LeagueStanding_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueStanding" ADD CONSTRAINT "LeagueStanding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "LeagueTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

