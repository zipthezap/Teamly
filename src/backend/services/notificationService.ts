/**
 * Unified Notification Service
 * Handles all in-app notifications with improved features
 */

import prisma from '../config/database';

export interface NotificationMetadata {
  actionUrl?: string;
  actionText?: string;
  category?: 'event' | 'group' | 'system' | 'social';
  priority?: 'low' | 'medium' | 'high';
  imageUrl?: string;
  relatedUserId?: string;
  relatedUserName?: string;
}

export interface UnifiedNotification {
  id: string;
  userId: string;
  type: string;
  notificationType: 'event' | 'group';
  title: string;
  message: string;
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
    notificationType?: 'event' | 'group';
    startDate?: Date;
    endDate?: Date;
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
  } = options;

  // Build where clause for event notifications
  const eventWhere: any = { userId };
  if (!includeRead) {
    eventWhere.read = false;
  }
  if (type) {
    eventWhere.type = type;
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
    groupWhere.type = type;
  }
  if (startDate || endDate) {
    groupWhere.createdAt = {};
    if (startDate) groupWhere.createdAt.gte = startDate;
    if (endDate) groupWhere.createdAt.lte = endDate;
  }

  // Fetch notifications based on filter
  let eventNotifications: any[] = [];
  let groupNotifications: any[] = [];
  let eventCount = 0;
  let groupCount = 0;

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

  // Transform and enrich notifications
  const enrichedEventNotifications: UnifiedNotification[] = eventNotifications.map((n) => {
    const metadata = enrichNotificationMetadata('event', n.type, n.event, n.user);
    return {
      id: n.id,
      userId: n.userId,
      type: n.type,
      notificationType: 'event' as const,
      title: generateNotificationTitle('event', n.type, n.event, n.user),
      message: generateNotificationMessage('event', n.type, n.event, n.user),
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
      type: n.type,
      notificationType: 'group' as const,
      title: generateNotificationTitle('group', n.type, null, null, n.group),
      message: generateNotificationMessage('group', n.type, null, null, n.group),
      read: n.read,
      createdAt: n.createdAt,
      metadata,
      group: n.group,
    };
  });

  // Merge and sort all notifications
  const allNotifications = [...enrichedEventNotifications, ...enrichedGroupNotifications].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  return {
    notifications: allNotifications.slice(0, limit),
    total: eventCount + groupCount,
  };
};

/**
 * Enrich notification with metadata for enhanced UI
 */
function enrichNotificationMetadata(
  notificationType: 'event' | 'group',
  type: string,
  event?: any,
  user?: any,
  group?: any
): NotificationMetadata {
  const metadata: NotificationMetadata = {
    category: notificationType,
  };

  // Set priority based on type
  if (['late', 'declined', 'cancelled'].includes(type)) {
    metadata.priority = 'high';
  } else if (['join', 'accepted', 'created'].includes(type)) {
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
  }

  // Add user info for social notifications
  if (user) {
    metadata.relatedUserId = user.id;
    metadata.relatedUserName = user.name;
  }

  return metadata;
}

/**
 * Generate notification title
 */
function generateNotificationTitle(
  notificationType: 'event' | 'group',
  type: string,
  event?: any,
  user?: any,
  group?: any
): string {
  const userName = user?.name || 'Someone';
  const eventTitle = event?.title || 'event';
  const groupName = group?.name || 'group';

  if (notificationType === 'event') {
    switch (type) {
      case 'created':
        return `New Event: ${eventTitle}`;
      case 'reminder':
        return `Reminder: ${eventTitle}`;
      case 'join':
        return `${userName} joined your event`;
      case 'leave':
        return `${userName} left your event`;
      case 'late':
        return `${userName} will be late`;
      case 'confirmed':
        return `${userName} confirmed attendance`;
      case 'declined':
        return `${userName} declined`;
      default:
        return `Event Update: ${eventTitle}`;
    }
  } else {
    switch (type) {
      case 'join_request':
        return 'New Join Request';
      case 'accepted':
        return 'Join Request Accepted';
      case 'nearby_created':
        return 'New Group Near You';
      default:
        return `Group Update: ${groupName}`;
    }
  }
}

/**
 * Generate notification message
 */
function generateNotificationMessage(
  notificationType: 'event' | 'group',
  type: string,
  event?: any,
  user?: any,
  group?: any
): string {
  const userName = user?.name || 'Someone';
  const eventTitle = event?.title || 'your event';
  const groupName = group?.name || 'group';

  if (notificationType === 'event') {
    switch (type) {
      case 'created':
        return 'A new event has been created. Check it out!';
      case 'reminder':
        return "Don't forget to attend!";
      case 'join':
        return `${userName} has joined "${eventTitle}"`;
      case 'leave':
        return `${userName} has left "${eventTitle}"`;
      case 'late':
        return `${userName} marked themselves as late for "${eventTitle}"`;
      case 'confirmed':
        return `${userName} confirmed attendance for "${eventTitle}"`;
      case 'declined':
        return `${userName} declined "${eventTitle}"`;
      default:
        return `There's an update to "${eventTitle}"`;
    }
  } else {
    switch (type) {
      case 'join_request':
        return `Someone wants to join "${groupName}"`;
      case 'accepted':
        return `Welcome to "${groupName}"! Your join request was accepted.`;
      case 'nearby_created':
        return `New group "${groupName}" created near you`;
      default:
        return `There's an update to "${groupName}"`;
    }
  }
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
    ]);
  }
};

/**
 * Get notification statistics for a user
 */
export const getNotificationStats = async (userId: string) => {
  const [unreadEvent, unreadGroup, totalEvent, totalGroup, recentActivity] = await Promise.all([
    prisma.eventNotification.count({ where: { userId, read: false } }),
    prisma.groupNotification.count({ where: { userId, read: false } }),
    prisma.eventNotification.count({ where: { userId } }),
    prisma.groupNotification.count({ where: { userId } }),
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
    unread: unreadEvent + unreadGroup,
    unreadEvent,
    unreadGroup,
    total: totalEvent + totalGroup,
    totalEvent,
    totalGroup,
    last7Days: recentActivity.length,
    typeCounts,
  };
};
