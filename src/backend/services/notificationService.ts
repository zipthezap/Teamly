/**
 * Unified Notification Service
 * Handles all in-app notifications with improved features
 */

import prisma from '../config/database';
import { EventNotificationType, GroupNotificationType, TeamUpNotificationType } from '../../shared/types/event.types';
import { TournamentNotificationType } from '../../shared/types/tournament.types';
import { Prisma } from '@prisma/client';

export interface NotificationMetadata {
  actionUrl?: string;
  actionText?: string;
  category?: 'event' | 'group' | 'teamup' | 'tournament' | 'system' | 'social';
  priority?: 'low' | 'medium' | 'high';
  imageUrl?: string;
  relatedUserId?: string;
  relatedUserName?: string;
  [key: string]: string | number | boolean | Date | undefined;
}

export interface NotificationParams {
  name?: string;
  eventTitle?: string;
  groupName?: string;
  title?: string;
  sportType?: string;
  tournamentName?: string;
  teamName?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Type guard to safely convert Prisma Json to NotificationParams
 */
function toNotificationParams(params: Prisma.JsonValue | null | undefined): NotificationParams | undefined {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return undefined;
  }
  
  const result: NotificationParams = {};
  const obj = params as Record<string, unknown>;
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    } else if (value === null || value === undefined) {
      result[key] = undefined;
    }
  }
  
  return result;
}

// Types for notification query results with includes
type EventNotificationWithRelations = Prisma.EventNotificationGetPayload<{
  include: {
    event: { select: { id: true, title: true, startTime: true } };
    user: { select: { id: true, name: true } };
  };
}>;

type GroupNotificationWithRelations = Prisma.GroupNotificationGetPayload<{
  include: {
    group: { select: { id: true, name: true } };
  };
}>;

type TeamUpNotificationWithRelations = Prisma.TeamUpNotificationGetPayload<{
  include: {
    teamUpRequest: { select: { id: true, title: true, sportType: true } };
  };
}>;

type TournamentNotificationWithRelations = Prisma.TournamentNotificationGetPayload<{
  include: {
    tournament: { select: { id: true, name: true, sportType: true } };
  };
}>;

export interface UnifiedNotification {
  id: string;
  userId: string;
  type: string;
  notificationType: 'event' | 'group' | 'teamup' | 'tournament';
  params?: NotificationParams;
  read: boolean;
  createdAt: Date;
  metadata?: NotificationMetadata;
  event?: {
    id: string;
    title: string;
  };
  group?: {
    id: string;
    name: string;
  };
  teamUpRequest?: {
    id: string;
    title: string;
  };
  tournament?: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    name: string;
  };
}

/**
 * Get all notifications for a user with enhanced metadata
 */
export const getUserNotifications = async (
  userId: string,
  options: {
    includeRead?: boolean;
    limit?: number;
    offset?: number;
    type?: string;
    notificationType?: 'event' | 'group' | 'teamup' | 'tournament';
    startDate?: Date;
    endDate?: Date;
    searchQuery?: string;
  } = {}
): Promise<{ notifications: UnifiedNotification[]; total: number }> => {
  const {
    includeRead = false,
    limit = 50,
    offset = 0,
    type,
    notificationType,
    startDate,
    endDate,
    searchQuery,
  } = options;

  // Build where clause for event notifications
  const eventWhere: Prisma.EventNotificationWhereInput = { userId };
  if (!includeRead) {
    eventWhere.read = false;
  }
  if (type) {
    eventWhere.type = type as EventNotificationType;
  }
  if (startDate || endDate) {
    eventWhere.createdAt = {};
    if (startDate) eventWhere.createdAt.gte = startDate;
    if (endDate) eventWhere.createdAt.lte = endDate;
  }

  // Build where clause for group notifications
  const groupWhere: Prisma.GroupNotificationWhereInput = { userId };
  if (!includeRead) {
    groupWhere.read = false;
  }
  if (type) {
    groupWhere.type = type as GroupNotificationType;
  }
  if (startDate || endDate) {
    groupWhere.createdAt = {};
    if (startDate) groupWhere.createdAt.gte = startDate;
    if (endDate) groupWhere.createdAt.lte = endDate;
  }

  // Fetch notifications based on filter
  let eventNotifications: EventNotificationWithRelations[] = [];
  let groupNotifications: GroupNotificationWithRelations[] = [];
  let teamUpNotifications: TeamUpNotificationWithRelations[] = [];
  let tournamentNotifications: TournamentNotificationWithRelations[] = [];
  let eventCount = 0;
  let groupCount = 0;
  let teamUpCount = 0;
  let tournamentCount = 0;

  if (!notificationType || notificationType === 'event') {
    [eventNotifications, eventCount] = await Promise.all([
      prisma.eventNotification.findMany({
        where: eventWhere,
        include: {
          event: { select: { id: true, title: true, startTime: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.eventNotification.count({ where: eventWhere }),
    ]);
  }

  if (!notificationType || notificationType === 'group') {
    [groupNotifications, groupCount] = await Promise.all([
      prisma.groupNotification.findMany({
        where: groupWhere,
        include: {
          group: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.groupNotification.count({ where: groupWhere }),
    ]);
  }

  if (!notificationType || notificationType === 'teamup') {
    const teamUpWhere: Prisma.TeamUpNotificationWhereInput = { userId };
    if (!includeRead) {
      teamUpWhere.read = false;
    }
    if (type) {
      teamUpWhere.type = type as TeamUpNotificationType;
    }
    if (startDate || endDate) {
      teamUpWhere.createdAt = {};
      if (startDate) teamUpWhere.createdAt.gte = startDate;
      if (endDate) teamUpWhere.createdAt.lte = endDate;
    }

    [teamUpNotifications, teamUpCount] = await Promise.all([
      prisma.teamUpNotification.findMany({
        where: teamUpWhere,
        include: {
          teamUpRequest: { select: { id: true, title: true, sportType: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.teamUpNotification.count({ where: teamUpWhere }),
    ]);
  }

  if (!notificationType || notificationType === 'tournament') {
    const tournamentWhere: Prisma.TournamentNotificationWhereInput = { userId };
    if (!includeRead) {
      tournamentWhere.read = false;
    }
    if (type) {
      tournamentWhere.type = type as TournamentNotificationType;
    }
    if (startDate || endDate) {
      tournamentWhere.createdAt = {};
      if (startDate) tournamentWhere.createdAt.gte = startDate;
      if (endDate) tournamentWhere.createdAt.lte = endDate;
    }

    [tournamentNotifications, tournamentCount] = await Promise.all([
      prisma.tournamentNotification.findMany({
        where: tournamentWhere,
        include: {
          tournament: { select: { id: true, name: true, sportType: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.tournamentNotification.count({ where: tournamentWhere }),
    ]);
  }

  // Transform and enrich notifications
  const enrichedEventNotifications: UnifiedNotification[] = eventNotifications.map((n) => {
    const metadata = enrichNotificationMetadata('event', n.type, n.event, n.user);
    return {
      id: n.id,
      userId: n.userId,
      type: n.type as EventNotificationType,
      notificationType: 'event' as const,
      params: toNotificationParams(n.params) || {
        name: n.user?.name,
        eventTitle: n.event?.title,
        // add more as needed
      },
      read: n.read,
      createdAt: n.createdAt,
      metadata,
      event: n.event,
      user: n.user,
    };
  });

  const enrichedGroupNotifications: UnifiedNotification[] = groupNotifications.map((n) => {
    const metadata = enrichNotificationMetadata('group', n.type, undefined, undefined, n.group);
    return {
      id: n.id,
      userId: n.userId,
      type: n.type as GroupNotificationType,
      notificationType: 'group' as const,
      params: toNotificationParams(n.params) || {
        groupName: n.group?.name,
        // add more as needed
      },
      read: n.read,
      createdAt: n.createdAt,
      metadata,
      group: n.group,
    };
  });

  const enrichedTeamUpNotifications: UnifiedNotification[] = teamUpNotifications.map((n) => {
    const metadata = enrichNotificationMetadata('teamup', n.type, undefined, undefined, undefined, n.teamUpRequest);
    return {
      id: n.id,
      userId: n.userId,
      type: n.type as TeamUpNotificationType,
      notificationType: 'teamup' as const,
      params: toNotificationParams(n.params) || {
        title: n.teamUpRequest?.title,
        sportType: n.teamUpRequest?.sportType,
        // add more as needed
      },
      read: n.read,
      createdAt: n.createdAt,
      metadata,
      teamUpRequest: n.teamUpRequest,
    };
  });

  const enrichedTournamentNotifications: UnifiedNotification[] = tournamentNotifications.map((n) => {
    const metadata = enrichNotificationMetadata('tournament', n.type, undefined, undefined, undefined, undefined, n.tournament);
    return {
      id: n.id,
      userId: n.userId,
      type: n.type as TournamentNotificationType,
      notificationType: 'tournament' as const,
      params: toNotificationParams(n.params) || {
        tournamentName: n.tournament?.name,
        sportType: n.tournament?.sportType,
        // add more as needed
      },
      read: n.read,
      createdAt: n.createdAt,
      metadata,
      tournament: n.tournament,
    };
  });

  // Merge and sort all notifications
  let allNotifications = [...enrichedEventNotifications, ...enrichedGroupNotifications, ...enrichedTeamUpNotifications, ...enrichedTournamentNotifications].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  // Apply search filter if provided
  // Note: Search is applied in-memory after fetching from database.
  // For better performance with large datasets, consider implementing
  // database-level full-text search or moving search to WHERE clause.
  if (searchQuery && searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    allNotifications = allNotifications.filter(
      (n) =>
        (n.type && n.type.toLowerCase().includes(query)) ||
        (n.params && Object.values(n.params).some(v => typeof v === 'string' && v.toLowerCase().includes(query)))
    );
  }

  return {
    notifications: allNotifications.slice(0, limit),
    total: searchQuery ? allNotifications.length : eventCount + groupCount + teamUpCount + tournamentCount,
  };
};

/**
 * Enrich notification with metadata for enhanced UI
 */
function enrichNotificationMetadata(
  notificationType: 'event' | 'group' | 'teamup' | 'tournament',
  type: string,
  event?: { id: string; title: string; startTime?: Date },
  user?: { id: string; name: string },
  group?: { id: string; name: string },
  teamUpRequest?: { id: string; title: string; sportType?: string },
  tournament?: { id: string; name: string; sportType?: string }
): NotificationMetadata {
  const metadata: NotificationMetadata = {
    category: notificationType,
  };

  // Set priority based on type
  if (['late', 'declined', 'cancelled', 'teamup_declined', 'tournament_cancelled'].includes(type)) {
    metadata.priority = 'high';
  } else if (['join', 'accepted', 'created', 'teamup_accepted', 'teamup_response', 'teamup_comment', 'team_registered', 'score_submitted'].includes(type)) {
    metadata.priority = 'medium';
  } else {
    metadata.priority = 'low';
  }

  // Add action URLs
  if (notificationType === 'event' && event?.id) {
    metadata.actionUrl = `/events/${event.id}`;
    metadata.actionText = 'View Event';
  } else if (notificationType === 'group' && group?.id) {
    metadata.actionUrl = `/groups/${group.id}`;
    if (type === 'join_request') {
      metadata.actionText = 'Review Request';
    } else {
      metadata.actionText = 'View Group';
    }
  } else if (notificationType === 'teamup' && teamUpRequest?.id) {
    metadata.actionUrl = `/teamup/${teamUpRequest.id}`;
    if (type === 'teamup_response') {
      metadata.actionText = 'Review Response';
    } else if (type === 'teamup_comment') {
      metadata.actionText = 'View Comment';
    } else {
      metadata.actionText = 'View Request';
    }
  } else if (notificationType === 'tournament' && tournament?.id) {
    metadata.actionUrl = `/tournaments/${tournament.id}`;
    if (type === 'team_registered') {
      metadata.actionText = 'View Team';
    } else if (type === 'score_submitted') {
      metadata.actionText = 'Review Score';
    } else {
      metadata.actionText = 'View Tournament';
    }
  }

  // Add user info for social notifications
  if (user) {
    metadata.relatedUserId = user.id;
    metadata.relatedUserName = user.name;
  }

  return metadata;
}

/**
 * Mark notifications as read
 */
export const markNotificationsAsRead = async (
  userId: string,
  notificationIds?: string[]
): Promise<void> => {
  if (notificationIds && notificationIds.length > 0) {
    // Mark specific notifications as read
    await Promise.all([
      prisma.eventNotification.updateMany({
        where: { id: { in: notificationIds }, userId },
        data: { read: true },
      }),
      prisma.groupNotification.updateMany({
        where: { id: { in: notificationIds }, userId },
        data: { read: true },
      }),
      prisma.teamUpNotification.updateMany({
        where: { id: { in: notificationIds }, userId },
        data: { read: true },
      }),
      prisma.tournamentNotification.updateMany({
        where: { id: { in: notificationIds }, userId },
        data: { read: true },
      }),
    ]);
  } else {
    // Mark all as read
    await Promise.all([
      prisma.eventNotification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      }),
      prisma.groupNotification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      }),
      prisma.teamUpNotification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      }),
      prisma.tournamentNotification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      }),
    ]);
  }
};

/**
 * Get notification statistics for a user
 */
export const getNotificationStats = async (userId: string) => {
  const [unreadEvent, unreadGroup, unreadTeamUp, unreadTournament, totalEvent, totalGroup, totalTeamUp, totalTournament, recentActivity] = await Promise.all([
    prisma.eventNotification.count({ where: { userId, read: false } }),
    prisma.groupNotification.count({ where: { userId, read: false } }),
    prisma.teamUpNotification.count({ where: { userId, read: false } }),
    prisma.tournamentNotification.count({ where: { userId, read: false } }),
    prisma.eventNotification.count({ where: { userId } }),
    prisma.groupNotification.count({ where: { userId } }),
    prisma.teamUpNotification.count({ where: { userId } }),
    prisma.tournamentNotification.count({ where: { userId } }),
    prisma.eventNotification.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { type: true },
    }),
  ]);

  // Count by type
  const typeCounts: Record<string, number> = {};
  recentActivity.forEach((n) => {
    typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  });

  return {
    unread: unreadEvent + unreadGroup + unreadTeamUp + unreadTournament,
    unreadEvent,
    unreadGroup,
    unreadTeamUp,
    unreadTournament,
    total: totalEvent + totalGroup + totalTeamUp + totalTournament,
    totalEvent,
    totalGroup,
    totalTeamUp,
    totalTournament,
    last7Days: recentActivity.length,
    typeCounts,
  };
};

/**
 * Delete specific notifications
 */
export const deleteNotifications = async (
  userId: string,
  notificationIds: string[]
): Promise<{ deletedCount: number }> => {
  if (!notificationIds || notificationIds.length === 0) {
    return { deletedCount: 0 };
  }

  const [eventDeleted, groupDeleted, teamUpDeleted, tournamentDeleted] = await Promise.all([
    prisma.eventNotification.deleteMany({
      where: { id: { in: notificationIds }, userId },
    }),
    prisma.groupNotification.deleteMany({
      where: { id: { in: notificationIds }, userId },
    }),
    prisma.teamUpNotification.deleteMany({
      where: { id: { in: notificationIds }, userId },
    }),
    prisma.tournamentNotification.deleteMany({
      where: { id: { in: notificationIds }, userId },
    }),
  ]);

  return { deletedCount: eventDeleted.count + groupDeleted.count + teamUpDeleted.count + tournamentDeleted.count };
};

/**
 * Delete all read notifications for a user
 */
export const deleteAllReadNotifications = async (
  userId: string
): Promise<{ deletedCount: number }> => {
  const [eventDeleted, groupDeleted, teamUpDeleted, tournamentDeleted] = await Promise.all([
    prisma.eventNotification.deleteMany({
      where: { userId, read: true },
    }),
    prisma.groupNotification.deleteMany({
      where: { userId, read: true },
    }),
    prisma.teamUpNotification.deleteMany({
      where: { userId, read: true },
    }),
    prisma.tournamentNotification.deleteMany({
      where: { userId, read: true },
    }),
  ]);

  return { deletedCount: eventDeleted.count + groupDeleted.count + teamUpDeleted.count + tournamentDeleted.count };
};
