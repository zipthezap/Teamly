/**
 * Notification Factory Service
 * Centralized service for creating notifications with transaction support,
 * deduplication, and consistent patterns across all notification types.
 */

import prisma from '../config/database';
import { logger } from '../utils/logger';
import { filterUnmutedUsers } from '../utils/notificationHelper';
import { 
  Prisma, 
  EmailPreference 
} from '@prisma/client';
import { SessionNotificationType, GroupNotificationType, TeamUpNotificationType } from '../../shared/types/event.types';
import { TournamentNotificationType } from '../../shared/types/tournament.types';
import { pushNotificationToUser } from './sseService';
import { dispatchPushNotifications } from './pushNotificationService';

export interface NotificationParams {
  [key: string]: string | number | boolean | undefined;
}

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

interface BaseNotificationInput {
  userIds: string[];
  params?: NotificationParams;
  metadata?: NotificationMetadata;
  checkMutePreference?: boolean;
  deduplicateWindow?: number; // milliseconds
}

interface SessionNotificationInput extends BaseNotificationInput {
  sessionId: string;
  type: SessionNotificationType;
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
   * Create session notifications for multiple users
   */
  static async createSessionNotifications(
    input: SessionNotificationInput,
    tx?: Prisma.TransactionClient
  ): Promise<{ created: number; skipped: number }> {
    const client = tx || prisma;
    const {
      sessionId,
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
      const existingNotifications = await client.sessionNotification.findMany({
        where: {
          sessionId,
          type,
          userId: { in: targetUserIds },
          createdAt: { gte: windowStart }
        },
        select: { userId: true }
      });
      
      const existingUserIds = new Set(existingNotifications.map((notification) => notification.userId));
      targetUserIds = targetUserIds.filter(id => !existingUserIds.has(id));
    }

    if (targetUserIds.length === 0) {
      return { created: 0, skipped: userIds.length };
    }

    // Create notifications
    try {
      const notifications = targetUserIds.map(userId => ({
        sessionId,
        userId,
        type,
        params: params || {},
        metadata: metadata || {}
      }));

      await client.sessionNotification.createMany({
        data: notifications,
        skipDuplicates: true
      });

      // Push real-time SSE events to connected clients (non-blocking)
      const ssePayload = { type: 'session', notificationType: type, sessionId, params, metadata };
      targetUserIds.forEach(userId => {
        try { pushNotificationToUser(userId, ssePayload); } catch { /* ignore SSE errors */ }
      });

      void dispatchPushNotifications({
        userIds: targetUserIds,
        notificationKind: 'session',
        notificationType: type,
        entityId: sessionId,
        params,
        metadata,
      });

      logger.debug(`Created ${targetUserIds.length} session notifications`, 'NotificationFactory', {
        type,
        sessionId,
        count: targetUserIds.length
      });

      return { 
        created: targetUserIds.length, 
        skipped: userIds.length - targetUserIds.length 
      };
    } catch (error) {
      logger.error('Failed to create session notifications', 'NotificationFactory', { 
        error,
        type,
        sessionId,
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

      // Push real-time SSE events to connected clients (non-blocking)
      const ssePayload = { type: 'group', notificationType: type, groupId, params };
      targetUserIds.forEach(userId => {
        try { pushNotificationToUser(userId, ssePayload); } catch { /* ignore SSE errors */ }
      });

      void dispatchPushNotifications({
        userIds: targetUserIds,
        notificationKind: 'group',
        notificationType: type,
        entityId: groupId,
        params,
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

      void dispatchPushNotifications({
        userIds: targetUserIds,
        notificationKind: 'teamup',
        notificationType: type,
        entityId: teamUpRequestId,
        params,
        metadata,
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

    // Lightweight instrumentation for debugging notification flows
    try {
      logger.info('createTournamentNotifications called', 'NotificationFactory', {
        tournamentId,
        type,
        requestedUserCount: userIds.length,
        params: params || {},
        metadata: metadata || {}
      });
    } catch {
      // swallow logging errors to avoid breaking notification paths
    }

    // Deduplicate if window is specified
    let finalUserIds = targetUserIds;
    if (deduplicateWindow > 0) {
      const windowStart = new Date(Date.now() - deduplicateWindow);
      const existingNotifications = await client.tournamentNotification.findMany({
        where: {
          tournamentId,
          // Prisma expects the generated enum type; cast to any to bridge shared enum
          type: type as any,
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
        // Cast to any so Prisma accepts the shared enum value
        type: type as any,
        params: params || {},
        metadata: metadata || {}
      }));

      await client.tournamentNotification.createMany({
        data: notifications as any,
        skipDuplicates: true
      });

      try {
        void dispatchPushNotifications({
          userIds: finalUserIds,
          notificationKind: 'tournament',
          notificationType: type,
          entityId: tournamentId,
          params,
          metadata,
        });
      } catch (error) {
        logger.error('dispatchPushNotifications failed', 'NotificationFactory', { error, tournamentId, type });
      }

      logger.debug(`Created ${finalUserIds.length} tournament notifications`, 'NotificationFactory', {
        type,
        tournamentId,
        count: finalUserIds.length
      });

      try {
        logger.info('createTournamentNotifications completed', 'NotificationFactory', {
          tournamentId,
          type,
          created: finalUserIds.length,
          skipped: userIds.length - finalUserIds.length
        });
      } catch { /* ignore */ }

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
   * Get mute preference key for session notification type
   */
  private static getMuteKeyForEventType(type: SessionNotificationType): keyof EmailPreference | null {
    switch (type) {
      case 'join':
      case 'leave':
      case 'confirmed':
      case 'declined':
        return 'muteSessionInvites';
      case 'comment':
        return 'commentMentions';
      case 'session_updated':
      case 'late':
      case 'status_change':
        return 'muteSessionUpdates';
      case 'session_cancelled':
        return 'muteSessionCancellations';
      default:
        return null;
    }
  }

  /**
   * Get mute preference key for group notification type
   */
  private static getMuteKeyForGroupType(type: GroupNotificationType): keyof EmailPreference | null {
    switch (type) {
      case 'invited':
      case 'accepted': // User being accepted into group relates to invites
        return 'muteGroupInvites';
      case 'join_request':
        return 'muteGroupRequests';
      case GroupNotificationType.session_created:
        return 'muteSessionCreated';
      case 'nearby_created':
        return 'muteNearbyGroups';
      case 'removed':
        return 'muteGroupRequests'; // Use group requests for group membership changes
      default:
        return null;
    }
  }

  /**
   * Get mute preference key for team-up notification type
   */
  private static getMuteKeyForTeamUpType(type: TeamUpNotificationType): keyof EmailPreference | null {
    switch (type) {
      case 'teamup_response':
      case 'teamup_accepted':
      case 'teamup_declined':
      case 'teamup_comment':
        return 'nearbyTeamUps';
      case 'teamup_nearby':
        return 'muteNearbyTeamUps';
      default:
        return null;
    }
  }
}
