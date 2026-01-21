/**
 * Notification Factory Service
 * Centralized service for creating notifications with transaction support,
 * deduplication, and consistent patterns across all notification types.
 */

import prisma from '../config/database';
import { logger } from '../utils/logger';
import { filterUnmutedUsers } from '../utils/notificationHelper';
import { 
  EventNotificationType, 
  GroupNotificationType, 
  TeamUpNotificationType 
} from '../../shared/types/event.types';
import { TournamentNotificationType } from '../../shared/types/tournament.types';
import { Prisma } from '@prisma/client';

export interface NotificationParams {
  [key: string]: string | number | boolean | undefined;
}

export interface NotificationMetadata {
  actionUrl?: string;
  actionText?: string;
  category?: 'event' | 'group' | 'teamup' | 'tournament' | 'system' | 'social';
  priority?: 'low' | 'medium' | 'high';
  imageUrl?: string;
  relatedUserId?: string;
  relatedUserName?: string;
}

interface BaseNotificationInput {
  userIds: string[];
  params?: NotificationParams;
  metadata?: NotificationMetadata;
  checkMutePreference?: boolean;
  deduplicateWindow?: number; // milliseconds
}

interface EventNotificationInput extends BaseNotificationInput {
  eventId: string;
  type: EventNotificationType;
}

interface GroupNotificationInput extends BaseNotificationInput {
  groupId: string;
  type: GroupNotificationType;
}

interface TeamUpNotificationInput extends BaseNotificationInput {
  teamUpRequestId: string;
  type: TeamUpNotificationType;
}

interface TournamentNotificationInput extends BaseNotificationInput {
  tournamentId: string;
  type: TournamentNotificationType;
}

export class NotificationFactory {
  /**
   * Create event notifications for multiple users
   */
  static async createEventNotifications(
    input: EventNotificationInput,
    tx?: Prisma.TransactionClient
  ): Promise<{ created: number; skipped: number }> {
    const client = tx || prisma;
    const {
      eventId,
      type,
      userIds,
      params,
      metadata,
      checkMutePreference = true,
      deduplicateWindow = 0
    } = input;

    if (userIds.length === 0) {
      return { created: 0, skipped: 0 };
    }

    // Filter muted users if requested
    let targetUserIds = userIds;
    if (checkMutePreference) {
      const muteKey = this.getMuteKeyForEventType(type);
      if (muteKey) {
        targetUserIds = await filterUnmutedUsers(userIds, muteKey);
      }
    }

    // Deduplicate if window is specified
    if (deduplicateWindow > 0) {
      const windowStart = new Date(Date.now() - deduplicateWindow);
      const existingNotifications = await client.eventNotification.findMany({
        where: {
          eventId,
          type,
          userId: { in: targetUserIds },
          createdAt: { gte: windowStart }
        },
        select: { userId: true }
      });
      
      const existingUserIds = new Set(existingNotifications.map(n => n.userId));
      targetUserIds = targetUserIds.filter(id => !existingUserIds.has(id));
    }

    if (targetUserIds.length === 0) {
      return { created: 0, skipped: userIds.length };
    }

    // Create notifications
    try {
      const notifications = targetUserIds.map(userId => ({
        eventId,
        userId,
        type,
        params: params || {},
        metadata: metadata || {}
      }));

      await client.eventNotification.createMany({
        data: notifications,
        skipDuplicates: true
      });

      logger.debug(`Created ${targetUserIds.length} event notifications`, 'NotificationFactory', {
        type,
        eventId,
        count: targetUserIds.length
      });

      return { 
        created: targetUserIds.length, 
        skipped: userIds.length - targetUserIds.length 
      };
    } catch (error) {
      logger.error('Failed to create event notifications', 'NotificationFactory', { 
        error,
        type,
        eventId,
        userCount: targetUserIds.length
      });
      throw error;
    }
  }

  /**
   * Create group notifications for multiple users
   */
  static async createGroupNotifications(
    input: GroupNotificationInput,
    tx?: Prisma.TransactionClient
  ): Promise<{ created: number; skipped: number }> {
    const client = tx || prisma;
    const {
      groupId,
      type,
      userIds,
      params,
      checkMutePreference = true,
      deduplicateWindow = 0
    } = input;

    if (userIds.length === 0) {
      return { created: 0, skipped: 0 };
    }

    // Filter muted users if requested
    let targetUserIds = userIds;
    if (checkMutePreference) {
      const muteKey = this.getMuteKeyForGroupType(type);
      if (muteKey) {
        targetUserIds = await filterUnmutedUsers(userIds, muteKey);
      }
    }

    // Deduplicate if window is specified
    if (deduplicateWindow > 0) {
      const windowStart = new Date(Date.now() - deduplicateWindow);
      const existingNotifications = await client.groupNotification.findMany({
        where: {
          groupId,
          type,
          userId: { in: targetUserIds },
          createdAt: { gte: windowStart }
        },
        select: { userId: true }
      });
      
      const existingUserIds = new Set(existingNotifications.map(n => n.userId));
      targetUserIds = targetUserIds.filter(id => !existingUserIds.has(id));
    }

    if (targetUserIds.length === 0) {
      return { created: 0, skipped: userIds.length };
    }

    // Create notifications
    try {
      const notifications = targetUserIds.map(userId => ({
        groupId,
        userId,
        type,
        params: params || {}
      }));

      await client.groupNotification.createMany({
        data: notifications,
        skipDuplicates: true
      });

      logger.debug(`Created ${targetUserIds.length} group notifications`, 'NotificationFactory', {
        type,
        groupId,
        count: targetUserIds.length
      });

      return { 
        created: targetUserIds.length, 
        skipped: userIds.length - targetUserIds.length 
      };
    } catch (error) {
      logger.error('Failed to create group notifications', 'NotificationFactory', { 
        error,
        type,
        groupId,
        userCount: targetUserIds.length
      });
      throw error;
    }
  }

  /**
   * Create team-up notifications for multiple users
   */
  static async createTeamUpNotifications(
    input: TeamUpNotificationInput,
    tx?: Prisma.TransactionClient
  ): Promise<{ created: number; skipped: number }> {
    const client = tx || prisma;
    const {
      teamUpRequestId,
      type,
      userIds,
      params,
      metadata,
      checkMutePreference = true,
      deduplicateWindow = 0
    } = input;

    if (userIds.length === 0) {
      return { created: 0, skipped: 0 };
    }

    // Filter muted users if requested
    let targetUserIds = userIds;
    if (checkMutePreference) {
      const muteKey = this.getMuteKeyForTeamUpType(type);
      if (muteKey) {
        targetUserIds = await filterUnmutedUsers(userIds, muteKey);
      }
    }

    // Deduplicate if window is specified
    if (deduplicateWindow > 0) {
      const windowStart = new Date(Date.now() - deduplicateWindow);
      const existingNotifications = await client.teamUpNotification.findMany({
        where: {
          teamUpRequestId,
          type,
          userId: { in: targetUserIds },
          createdAt: { gte: windowStart }
        },
        select: { userId: true }
      });
      
      const existingUserIds = new Set(existingNotifications.map(n => n.userId));
      targetUserIds = targetUserIds.filter(id => !existingUserIds.has(id));
    }

    if (targetUserIds.length === 0) {
      return { created: 0, skipped: userIds.length };
    }

    // Create notifications
    try {
      const notifications = targetUserIds.map(userId => ({
        teamUpRequestId,
        userId,
        type,
        params: params || {},
        metadata: metadata || {}
      }));

      await client.teamUpNotification.createMany({
        data: notifications,
        skipDuplicates: true
      });

      logger.debug(`Created ${targetUserIds.length} team-up notifications`, 'NotificationFactory', {
        type,
        teamUpRequestId,
        count: targetUserIds.length
      });

      return { 
        created: targetUserIds.length, 
        skipped: userIds.length - targetUserIds.length 
      };
    } catch (error) {
      logger.error('Failed to create team-up notifications', 'NotificationFactory', { 
        error,
        type,
        teamUpRequestId,
        userCount: targetUserIds.length
      });
      throw error;
    }
  }

  /**
   * Create tournament notifications for multiple users
   */
  static async createTournamentNotifications(
    input: TournamentNotificationInput,
    tx?: Prisma.TransactionClient
  ): Promise<{ created: number; skipped: number }> {
    const client = tx || prisma;
    const {
      tournamentId,
      type,
      userIds,
      params,
      metadata,
      // checkMutePreference - not used for tournaments yet
      deduplicateWindow = 0
    } = input;

    if (userIds.length === 0) {
      return { created: 0, skipped: 0 };
    }

    // Filter muted users if requested (tournaments don't have specific mute preferences yet)
    const targetUserIds = userIds;

    // Deduplicate if window is specified
    let finalUserIds = targetUserIds;
    if (deduplicateWindow > 0) {
      const windowStart = new Date(Date.now() - deduplicateWindow);
      const existingNotifications = await client.tournamentNotification.findMany({
        where: {
          tournamentId,
          type,
          userId: { in: targetUserIds },
          createdAt: { gte: windowStart }
        },
        select: { userId: true }
      });
      
      const existingUserIds = new Set(existingNotifications.map(n => n.userId));
      finalUserIds = targetUserIds.filter(id => !existingUserIds.has(id));
    }

    if (finalUserIds.length === 0) {
      return { created: 0, skipped: userIds.length };
    }

    // Create notifications
    try {
      const notifications = finalUserIds.map(userId => ({
        tournamentId,
        userId,
        type,
        params: params || {},
        metadata: metadata || {}
      }));

      await client.tournamentNotification.createMany({
        data: notifications,
        skipDuplicates: true
      });

      logger.debug(`Created ${finalUserIds.length} tournament notifications`, 'NotificationFactory', {
        type,
        tournamentId,
        count: finalUserIds.length
      });

      return { 
        created: finalUserIds.length, 
        skipped: userIds.length - finalUserIds.length 
      };
    } catch (error) {
      logger.error('Failed to create tournament notifications', 'NotificationFactory', { 
        error,
        type,
        tournamentId,
        userCount: finalUserIds.length
      });
      throw error;
    }
  }

  /**
   * Get mute preference key for event notification type
   */
  private static getMuteKeyForEventType(type: EventNotificationType): string | null {
    switch (type) {
      case 'join':
      case 'leave':
      case 'confirmed':
      case 'declined':
        return 'muteEventInvites';
      case 'comment':
        return 'muteEventComments';
      case 'event_updated':
      case 'event_cancelled':
      case 'late':
      case 'status_change':
        return 'muteEventUpdates';
      default:
        return null;
    }
  }

  /**
   * Get mute preference key for group notification type
   */
  private static getMuteKeyForGroupType(type: GroupNotificationType): string | null {
    switch (type) {
      case 'invited':
        return 'muteGroupInvites';
      case 'join_request':
      case 'accepted':
        return 'muteGroupJoinRequests';
      case 'event_created':
      case 'nearby_created':
        return 'muteGroupEvents';
      case 'removed':
        return 'muteGroupUpdates';
      default:
        return null;
    }
  }

  /**
   * Get mute preference key for team-up notification type
   */
  private static getMuteKeyForTeamUpType(type: TeamUpNotificationType): string | null {
    switch (type) {
      case 'teamup_response':
      case 'teamup_accepted':
      case 'teamup_declined':
        return 'muteTeamUpResponses';
      case 'teamup_nearby':
        return 'muteTeamUpNearby';
      case 'teamup_comment':
        return 'muteTeamUpComments';
      default:
        return null;
    }
  }
}
