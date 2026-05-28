/**
 * Unified Notification Service
 * Handles all in-app notifications with improved features
 */

import prisma from '../config/database';
import { SessionNotificationType, GroupNotificationType, TeamUpNotificationType } from '../../shared/types/event.types';
import { TournamentNotificationType } from '../../shared/types/tournament.types';
import { Prisma, TournamentNotificationType as PrismaTournamentNotificationType } from '@prisma/client';
import { BadRequestError, ForbiddenError } from '../utils/errors';

export interface NotificationMetadata {
  actionUrl?: string;
  actionText?: string;
  category?: 'session' | 'group' | 'teamup' | 'tournament' | 'system' | 'social';
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

const tournamentNotificationTypeValues = new Set<string>(Object.values(TournamentNotificationType));

function toPrismaTournamentNotificationType(value: string): PrismaTournamentNotificationType | null {
  if (!tournamentNotificationTypeValues.has(value)) {
    return null;
  }
  return value as PrismaTournamentNotificationType;
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
type SessionNotificationWithRelations = Prisma.SessionNotificationGetPayload<{
  include: {
    session: { select: { id: true, title: true, startTime: true } };
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
  notificationType: 'session' | 'group' | 'teamup' | 'tournament';
  params?: NotificationParams;
  read: boolean;
  createdAt: Date;
  metadata?: NotificationMetadata;
  session?: {
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

interface NotificationCursor {
  createdAt: string;
  id: string;
}

const encodeNotificationCursor = (notification: UnifiedNotification): string =>
  Buffer.from(
    JSON.stringify({
      createdAt: notification.createdAt.toISOString(),
      id: notification.id,
    }),
    'utf8'
  ).toString('base64url');

const decodeNotificationCursor = (cursor?: string): { createdAt: Date; id: string } | null => {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as NotificationCursor;
    if (!parsed.createdAt || !parsed.id) {
      throw new Error('Invalid cursor payload');
    }
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      throw new Error('Invalid cursor date');
    }
    return { createdAt, id: parsed.id };
  } catch {
    throw new BadRequestError('Invalid notification cursor');
  }
};

/**
 * Get all notifications for a user with enhanced metadata
 */
export const getUserNotifications = async (
  userId: string,
  options: {
    includeRead?: boolean;
    limit?: number;
    offset?: number;
    cursor?: string;
    type?: string;
    notificationType?: 'session' | 'group' | 'teamup' | 'tournament';
    startDate?: Date;
    endDate?: Date;
    searchQuery?: string;
  } = {}
): Promise<{ notifications: UnifiedNotification[]; total: number; hasMore: boolean; nextCursor: string | null }> => {
  const {
    includeRead = false,
    limit = 50,
    offset = 0,
    cursor,
    type,
    notificationType,
    startDate,
    endDate,
    searchQuery,
  } = options;

  const parsedCursor = decodeNotificationCursor(cursor);
  // For offset pagination, over-fetch by one record after offset to compute hasMore
  // without issuing an additional count query for the merged page.
  const isOffsetPagination = !parsedCursor;
  const queryTake = isOffsetPagination ? offset + limit + 1 : limit + 1;
  const baseOrderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

  // Pre-compute which enum values for each notification table match the search query
  // so we can push type-based filtering to the DB instead of doing it in-memory.
  // When matches exist for a table, we restrict that table's query to those types.
  // Params-based search (JSON field) cannot be expressed as a Prisma predicate and
  // is handled by the in-memory filter further below.
  const normalizedSearch = searchQuery ? searchQuery.toLowerCase().trim() : '';
  const matchingEventTypes = normalizedSearch
    ? (Object.values(SessionNotificationType) as string[]).filter((v) => v.toLowerCase().includes(normalizedSearch))
    : [];
  const matchingGroupTypes = normalizedSearch
    ? (Object.values(GroupNotificationType) as string[]).filter((v) => v.toLowerCase().includes(normalizedSearch))
    : [];
  const matchingTeamUpTypes = normalizedSearch
    ? (Object.values(TeamUpNotificationType) as string[]).filter((v) => v.toLowerCase().includes(normalizedSearch))
    : [];
  const matchingTournamentTypes = normalizedSearch
    ? (Object.values(TournamentNotificationType) as PrismaTournamentNotificationType[]).filter((v) => v.toLowerCase().includes(normalizedSearch))
    : [];

  const appendCursorAndClause = <T extends { AND?: unknown }>(
    where: T
  ): T => {
    if (!parsedCursor) {
      return where;
    }

    return {
      ...where,
      AND: [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { createdAt: { lt: parsedCursor.createdAt } },
            { AND: [{ createdAt: parsedCursor.createdAt }, { id: { lt: parsedCursor.id } }] },
          ],
        },
      ],
    };
  };

  // Build where clause for session notifications
  let eventWhere: Prisma.SessionNotificationWhereInput = { userId };
  if (!includeRead) {
    eventWhere.read = false;
  }
  if (type) {
    eventWhere.type = type as SessionNotificationType;
  }
  if (startDate || endDate) {
    eventWhere.createdAt = {};
    if (startDate) eventWhere.createdAt.gte = startDate;
    if (endDate) eventWhere.createdAt.lte = endDate;
  }
  // When a search query matches session type enum values, push the filter to the DB
  // to reduce result set size. Params-based search is handled in-memory below.
  if (matchingEventTypes.length > 0) {
    eventWhere.type = { in: matchingEventTypes as SessionNotificationType[] };
  }
  if (parsedCursor) {
    eventWhere = {
      AND: [
        eventWhere,
        {
          OR: [
            { createdAt: { lt: parsedCursor.createdAt } },
            { AND: [{ createdAt: parsedCursor.createdAt }, { id: { lt: parsedCursor.id } }] },
          ],
        },
      ],
    };
  }

  // Build where clause for group notifications
  let groupWhere: Prisma.GroupNotificationWhereInput = { userId };
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
  if (matchingGroupTypes.length > 0) {
    groupWhere.type = { in: matchingGroupTypes as GroupNotificationType[] };
  }
  if (parsedCursor) {
    groupWhere = {
      AND: [
        groupWhere,
        {
          OR: [
            { createdAt: { lt: parsedCursor.createdAt } },
            { AND: [{ createdAt: parsedCursor.createdAt }, { id: { lt: parsedCursor.id } }] },
          ],
        },
      ],
    };
  }

  // Fetch notifications based on filter
  let eventNotifications: SessionNotificationWithRelations[] = [];
  let groupNotifications: GroupNotificationWithRelations[] = [];
  let teamUpNotifications: TeamUpNotificationWithRelations[] = [];
  let tournamentNotifications: TournamentNotificationWithRelations[] = [];
  let eventCount = 0;
  let groupCount = 0;
  let teamUpCount = 0;
  let tournamentCount = 0;

  if (!notificationType || notificationType === 'session') {
    [eventNotifications, eventCount] = await Promise.all([
      prisma.sessionNotification.findMany({
        where: eventWhere,
        include: {
          session: { select: { id: true, title: true, startTime: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: baseOrderBy,
        take: queryTake,
      }),
      prisma.sessionNotification.count({ where: eventWhere }),
    ]);
  }

  if (!notificationType || notificationType === 'group') {
    [groupNotifications, groupCount] = await Promise.all([
      prisma.groupNotification.findMany({
        where: groupWhere,
        include: {
          group: { select: { id: true, name: true } },
        },
        orderBy: baseOrderBy,
        take: queryTake,
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
    if (matchingTeamUpTypes.length > 0) {
      teamUpWhere.type = { in: matchingTeamUpTypes as TeamUpNotificationType[] };
    }
    const teamUpWhereWithCursor = appendCursorAndClause(teamUpWhere);

    [teamUpNotifications, teamUpCount] = await Promise.all([
      prisma.teamUpNotification.findMany({
        where: teamUpWhereWithCursor,
        include: {
          teamUpRequest: { select: { id: true, title: true, sportType: true } },
        },
        orderBy: baseOrderBy,
        take: queryTake,
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
      const tournamentType = toPrismaTournamentNotificationType(type);
      if (tournamentType) {
        tournamentWhere.type = tournamentType;
      }
    }
    if (startDate || endDate) {
      tournamentWhere.createdAt = {};
      if (startDate) tournamentWhere.createdAt.gte = startDate;
      if (endDate) tournamentWhere.createdAt.lte = endDate;
    }
    if (matchingTournamentTypes.length > 0) {
      tournamentWhere.type = { in: matchingTournamentTypes };
    }
    const tournamentWhereWithCursor = appendCursorAndClause(tournamentWhere);

    [tournamentNotifications, tournamentCount] = await Promise.all([
      prisma.tournamentNotification.findMany({
        where: tournamentWhereWithCursor,
        include: {
          tournament: { select: { id: true, name: true, sportType: true } },
        },
        orderBy: baseOrderBy,
        take: queryTake,
      }),
      prisma.tournamentNotification.count({ where: tournamentWhere }),
    ]);
  }

  // Transform and enrich notifications
  const enrichedEventNotifications: UnifiedNotification[] = eventNotifications.map((n) => {
    const metadata = enrichNotificationMetadata('session', n.type, n.session, n.user);
    return {
      id: n.id,
      userId: n.userId,
      type: n.type as SessionNotificationType,
      notificationType: 'session' as const,
      params: toNotificationParams(n.params) || {
        name: n.user?.name,
        eventTitle: n.session?.title,
        // add more as needed
      },
      read: n.read,
      createdAt: n.createdAt,
      metadata,
      session: n.session,
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

  // Apply params-based search in-memory. Type-based search has already been pushed
  // to the DB WHERE clause above via enum value matching (matchingEventTypes etc.).
  // JSON params cannot be efficiently searched with a Prisma predicate, so we retain
  // the in-memory filter only for params string values.
  if (normalizedSearch) {
    allNotifications = allNotifications.filter(
      (n) =>
        n.params && Object.values(n.params).some(v => typeof v === 'string' && v.toLowerCase().includes(normalizedSearch))
    );
  }

  const slicedNotifications = isOffsetPagination
    ? allNotifications.slice(offset, offset + limit + 1)
    : allNotifications.slice(0, limit + 1);
  const hasMore = slicedNotifications.length > limit;
  const notifications = slicedNotifications.slice(0, limit);
  const nextCursor = hasMore && notifications.length > 0
    ? encodeNotificationCursor(notifications[notifications.length - 1])
    : null;

  return {
    notifications,
    total: searchQuery ? allNotifications.length : eventCount + groupCount + teamUpCount + tournamentCount,
    hasMore,
    nextCursor,
  };
};

/**
 * Enrich notification with metadata for enhanced UI
 */
function enrichNotificationMetadata(
  notificationType: 'session' | 'group' | 'teamup' | 'tournament',
  type: string,
  session?: { id: string; title: string; startTime?: Date },
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
  if (notificationType === 'session' && session?.id) {
    metadata.actionUrl = `/events/${session.id}`;
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
    await assertNotificationOwnership(userId, notificationIds);

    // Mark specific notifications as read
    await Promise.all([
      prisma.sessionNotification.updateMany({
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
      prisma.sessionNotification.updateMany({
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
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [unreadEvent, unreadGroup, unreadTeamUp, unreadTournament, totalEvent, totalGroup, totalTeamUp, totalTournament, recentActivityGroups] = await Promise.all([
    prisma.sessionNotification.count({ where: { userId, read: false } }),
    prisma.groupNotification.count({ where: { userId, read: false } }),
    prisma.teamUpNotification.count({ where: { userId, read: false } }),
    prisma.tournamentNotification.count({ where: { userId, read: false } }),
    prisma.sessionNotification.count({ where: { userId } }),
    prisma.groupNotification.count({ where: { userId } }),
    prisma.teamUpNotification.count({ where: { userId } }),
    prisma.tournamentNotification.count({ where: { userId } }),
    // Use groupBy to aggregate type counts in the DB instead of fetching all records
    prisma.sessionNotification.groupBy({
      by: ['type'],
      where: { userId, createdAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
    }),
  ]);

  // Build type counts and last7Days total from the aggregated DB result
  const typeCounts: Record<string, number> = {};
  let last7Days = 0;
  recentActivityGroups.forEach((g) => {
    typeCounts[g.type] = g._count._all;
    last7Days += g._count._all;
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
    last7Days,
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

  await assertNotificationOwnership(userId, notificationIds);

  const [eventDeleted, groupDeleted, teamUpDeleted, tournamentDeleted] = await Promise.all([
    prisma.sessionNotification.deleteMany({
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

// Conservative upper bound to reject anomalously long IDs and keep payload validation bounded.
const NOTIFICATION_ID_MAX_LENGTH = 191;

async function assertNotificationOwnership(userId: string, notificationIds: string[]): Promise<void> {
  const normalizedIds = new Set<string>();
  for (const rawId of notificationIds) {
    if (typeof rawId !== 'string') {
      throw new BadRequestError('notificationIds must contain valid notification IDs');
    }

    const id = rawId.trim();
    if (!id || id.length > NOTIFICATION_ID_MAX_LENGTH) {
      throw new BadRequestError('notificationIds must contain valid notification IDs');
    }

    normalizedIds.add(id);
  }

  const dedupedIds = [...normalizedIds];

  const [eventRows, groupRows, teamUpRows, tournamentRows] = await Promise.all([
    prisma.sessionNotification.findMany({
      where: { userId, id: { in: dedupedIds } },
      select: { id: true },
    }),
    prisma.groupNotification.findMany({
      where: { userId, id: { in: dedupedIds } },
      select: { id: true },
    }),
    prisma.teamUpNotification.findMany({
      where: { userId, id: { in: dedupedIds } },
      select: { id: true },
    }),
    prisma.tournamentNotification.findMany({
      where: { userId, id: { in: dedupedIds } },
      select: { id: true },
    }),
  ]);

  const ownedIds = new Set(
    [...eventRows, ...groupRows, ...teamUpRows, ...tournamentRows].map((row) => row.id)
  );

  if (ownedIds.size !== dedupedIds.length) {
    throw new ForbiddenError('One or more notifications are inaccessible');
  }
}

/**
 * Delete all read notifications for a user
 */
export const deleteAllReadNotifications = async (
  userId: string
): Promise<{ deletedCount: number }> => {
  const [eventDeleted, groupDeleted, teamUpDeleted, tournamentDeleted] = await Promise.all([
    prisma.sessionNotification.deleteMany({
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
