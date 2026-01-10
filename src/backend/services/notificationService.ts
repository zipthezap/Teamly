/**
 * Unified Notification Service
 * Handles all in-app notifications with improved features
 */

import prisma from '../config/database';
import { EventNotificationType, GroupNotificationType, TeamUpNotificationType } from '../../shared/types/event.types';

export interface NotificationMetadata {
  actionUrl?: string;
  actionText?: string;
  category?: 'event' | 'group' | 'teamup' | 'system' | 'social';
  priority?: 'low' | 'medium' | 'high';
  imageUrl?: string;
  relatedUserId?: string;
  relatedUserName?: string;
}

export interface UnifiedNotification {
  id: string;
  userId: string;
  type: string;
  notificationType: 'event' | 'group' | 'teamup';
  params?: Record<string, any>; // parameters for translation
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
    notificationType?: 'event' | 'group' | 'teamup';
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
  const eventWhere: any = { userId };
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
  const groupWhere: any = { userId };
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
  let eventNotifications: any[] = [];
  let groupNotifications: any[] = [];
  let teamUpNotifications: any[] = [];
  let eventCount = 0;
  let groupCount = 0;
  let teamUpCount = 0;

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
    const teamUpWhere: any = { userId };
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

  // Transform and enrich notifications
  const enrichedEventNotifications: UnifiedNotification[] = eventNotifications.map((n) => {
    const metadata = enrichNotificationMetadata('event', n.type, n.event, n.user);
    return {
      id: n.id,
      userId: n.userId,
      type: n.type as EventNotificationType,
      notificationType: 'event' as const,
      params: n.params || {
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
    const metadata = enrichNotificationMetadata('group', n.type, null, null, n.group);
    return {
      id: n.id,
      userId: n.userId,
      type: n.type as GroupNotificationType,
      notificationType: 'group' as const,
      params: n.params || {
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
    const metadata = enrichNotificationMetadata('teamup', n.type, null, null, null, n.teamUpRequest);
    return {
      id: n.id,
      userId: n.userId,
      type: n.type as TeamUpNotificationType,
      notificationType: 'teamup' as const,
      params: n.params || {
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

  // Merge and sort all notifications
  let allNotifications = [...enrichedEventNotifications, ...enrichedGroupNotifications, ...enrichedTeamUpNotifications].sort(
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
    total: searchQuery ? allNotifications.length : eventCount + groupCount + teamUpCount,
  };
};

/**
 * Enrich notification with metadata for enhanced UI
 */
function enrichNotificationMetadata(
  notificationType: 'event' | 'group' | 'teamup',
  type: string,
  event?: any,
  user?: any,
  group?: any,
  teamUpRequest?: any
): NotificationMetadata {
  const metadata: NotificationMetadata = {
    category: notificationType,
  };

  // Set priority based on type
  if (['late', 'declined', 'cancelled', 'teamup_declined'].includes(type)) {
    metadata.priority = 'high';
  } else if (['join', 'accepted', 'created', 'teamup_accepted', 'teamup_response'].includes(type)) {
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
    } else {
      metadata.actionText = 'View Request';
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
    ]);
  }
};

/**
 * Get notification statistics for a user
 */
export const getNotificationStats = async (userId: string) => {
  const [unreadEvent, unreadGroup, unreadTeamUp, totalEvent, totalGroup, totalTeamUp, recentActivity] = await Promise.all([
    prisma.eventNotification.count({ where: { userId, read: false } }),
    prisma.groupNotification.count({ where: { userId, read: false } }),
    prisma.teamUpNotification.count({ where: { userId, read: false } }),
    prisma.eventNotification.count({ where: { userId } }),
    prisma.groupNotification.count({ where: { userId } }),
    prisma.teamUpNotification.count({ where: { userId } }),
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
    unread: unreadEvent + unreadGroup + unreadTeamUp,
    unreadEvent,
    unreadGroup,
    unreadTeamUp,
    total: totalEvent + totalGroup + totalTeamUp,
    totalEvent,
    totalGroup,
    totalTeamUp,
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

  const [eventDeleted, groupDeleted, teamUpDeleted] = await Promise.all([
    prisma.eventNotification.deleteMany({
      where: { id: { in: notificationIds }, userId },
    }),
    prisma.groupNotification.deleteMany({
      where: { id: { in: notificationIds }, userId },
    }),
    prisma.teamUpNotification.deleteMany({
      where: { id: { in: notificationIds }, userId },
    }),
  ]);

  return { deletedCount: eventDeleted.count + groupDeleted.count + teamUpDeleted.count };
};

/**
 * Delete all read notifications for a user
 */
export const deleteAllReadNotifications = async (
  userId: string
): Promise<{ deletedCount: number }> => {
  const [eventDeleted, groupDeleted, teamUpDeleted] = await Promise.all([
    prisma.eventNotification.deleteMany({
      where: { userId, read: true },
    }),
    prisma.groupNotification.deleteMany({
      where: { userId, read: true },
    }),
    prisma.teamUpNotification.deleteMany({
      where: { userId, read: true },
    }),
  ]);

  return { deletedCount: eventDeleted.count + groupDeleted.count + teamUpDeleted.count };
};
