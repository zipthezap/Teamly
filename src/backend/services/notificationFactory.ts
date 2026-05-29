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
  EmailPreference,
  TournamentNotificationType as PrismaTournamentNotificationType,
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
  idempotencyKey?: string;
}

interface GroupNotificationInput extends BaseNotificationInput {
  groupId: string;
  type: GroupNotificationType;
  idempotencyKey?: string;
}

interface TeamUpNotificationInput extends BaseNotificationInput {
  teamUpRequestId: string;
  type: TeamUpNotificationType;
  idempotencyKey?: string;
}

interface TournamentNotificationInput extends BaseNotificationInput {
  tournamentId: string;
  type: TournamentNotificationType;
  idempotencyKey?: string;
}

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL;
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
const NOTIFICATION_SERVICE_TIMEOUT_MS = Number(process.env.NOTIFICATION_SERVICE_TIMEOUT_MS || 8000);
const NOTIFICATION_SERVICE_CANARY_PERCENT = Number(process.env.NOTIFICATION_SERVICE_CANARY_PERCENT || 100);
const NOTIFICATION_SERVICE_SESSION_CANARY_PERCENT = Number(process.env.NOTIFICATION_SERVICE_SESSION_CANARY_PERCENT || NOTIFICATION_SERVICE_CANARY_PERCENT);
const NOTIFICATION_SERVICE_GROUP_CANARY_PERCENT = Number(process.env.NOTIFICATION_SERVICE_GROUP_CANARY_PERCENT || NOTIFICATION_SERVICE_CANARY_PERCENT);
const NOTIFICATION_SERVICE_TEAMUP_CANARY_PERCENT = Number(process.env.NOTIFICATION_SERVICE_TEAMUP_CANARY_PERCENT || NOTIFICATION_SERVICE_CANARY_PERCENT);
const NOTIFICATION_SERVICE_TOURNAMENT_CANARY_PERCENT = Number(process.env.NOTIFICATION_SERVICE_TOURNAMENT_CANARY_PERCENT || NOTIFICATION_SERVICE_CANARY_PERCENT);

const prismaTournamentNotificationTypeValues = new Set<string>(
  Object.values(PrismaTournamentNotificationType)
);

export class NotificationFactory {
  private static toPrismaTournamentType(type: TournamentNotificationType): PrismaTournamentNotificationType {
    if (!prismaTournamentNotificationTypeValues.has(type)) {
      throw new Error(`Unsupported tournament notification type: ${type}`);
    }
    return type as PrismaTournamentNotificationType;
  }

  private static normalizeCanaryPercent(rawPercent: number): number {
    if (!Number.isFinite(rawPercent)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.floor(rawPercent)));
  }

  private static hashBucket(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 100);
  }

  private static shouldUseNotificationService(
    kind: 'session' | 'group' | 'teamup' | 'tournament',
    sampleKey: string
  ): boolean {
    const percentByKind = {
      session: NOTIFICATION_SERVICE_SESSION_CANARY_PERCENT,
      group: NOTIFICATION_SERVICE_GROUP_CANARY_PERCENT,
      teamup: NOTIFICATION_SERVICE_TEAMUP_CANARY_PERCENT,
      tournament: NOTIFICATION_SERVICE_TOURNAMENT_CANARY_PERCENT,
    };

    const canaryPercent = this.normalizeCanaryPercent(percentByKind[kind]);
    if (canaryPercent <= 0) {
      return false;
    }
    if (canaryPercent >= 100) {
      return true;
    }

    return this.hashBucket(sampleKey) < canaryPercent;
  }

  private static classifyNotificationServiceFallbackReason(error: unknown): string {
    const maybeCode = (error as { reasonCode?: string } | null)?.reasonCode;
    if (typeof maybeCode === 'string' && maybeCode.length > 0) {
      return maybeCode;
    }

    const maybeStatus = (error as { status?: number } | null)?.status;
    if (typeof maybeStatus === 'number') {
      return `http_${maybeStatus}`;
    }

    const maybeName = (error as { name?: string } | null)?.name;
    if (maybeName === 'AbortError') {
      return 'timeout';
    }

    return 'unknown';
  }

  private static stableSerialize(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableSerialize(item)).join(',')}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${this.stableSerialize(val)}`);

    return `{${entries.join(',')}}`;
  }

  private static buildTournamentIdempotencyKey(input: TournamentNotificationInput): string {
    const sortedUserIds = [...input.userIds].sort();
    const payload = [
      input.tournamentId,
      input.type,
      this.stableSerialize(sortedUserIds),
      this.stableSerialize(input.params || {}),
      this.stableSerialize(input.metadata || {}),
    ].join('|');

    return `tn_${this.hashBucket(payload)}_${payload.length}`;
  }

  private static buildSessionIdempotencyKey(input: SessionNotificationInput): string {
    const sortedUserIds = [...input.userIds].sort();
    const payload = [
      input.sessionId,
      input.type,
      this.stableSerialize(sortedUserIds),
      this.stableSerialize(input.params || {}),
      this.stableSerialize(input.metadata || {}),
    ].join('|');

    return `sn_${this.hashBucket(payload)}_${payload.length}`;
  }

  private static buildGroupIdempotencyKey(input: GroupNotificationInput): string {
    const sortedUserIds = [...input.userIds].sort();
    const payload = [
      input.groupId,
      input.type,
      this.stableSerialize(sortedUserIds),
      this.stableSerialize(input.params || {}),
    ].join('|');

    return `gn_${this.hashBucket(payload)}_${payload.length}`;
  }

  private static buildTeamUpIdempotencyKey(input: TeamUpNotificationInput): string {
    const sortedUserIds = [...input.userIds].sort();
    const payload = [
      input.teamUpRequestId,
      input.type,
      this.stableSerialize(sortedUserIds),
      this.stableSerialize(input.params || {}),
      this.stableSerialize(input.metadata || {}),
    ].join('|');

    return `tun_${this.hashBucket(payload)}_${payload.length}`;
  }

  /**
   * Create session notifications for multiple users
   */
  static async createSessionNotifications(
    input: SessionNotificationInput,
    tx?: Prisma.TransactionClient
  ): Promise<{ created: number; skipped: number }> {
    const idempotencyKey = input.idempotencyKey || this.buildSessionIdempotencyKey(input);

    if (!tx && NOTIFICATION_SERVICE_URL && this.shouldUseNotificationService('session', `${input.sessionId}:${input.type}`)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), NOTIFICATION_SERVICE_TIMEOUT_MS);
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (INTERNAL_SERVICE_TOKEN) {
          headers['x-internal-service-token'] = INTERNAL_SERVICE_TOKEN;
        }

        let response: globalThis.Response;
        try {
          response = await fetch(`${NOTIFICATION_SERVICE_URL.replace(/\/$/, '')}/api/notifications/session`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...input, idempotencyKey }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        const payload = await response.json() as { created?: number; skipped?: number; error?: string };
        if (!response.ok) {
          const error = new Error(payload.error || `Notification service request failed with status ${response.status}`) as Error & { status?: number; reasonCode?: string };
          error.status = response.status;
          error.reasonCode = `http_${response.status}`;
          throw error;
        }

        return {
          created: payload.created || 0,
          skipped: payload.skipped || 0,
        };
      } catch (error) {
        const fallbackReason = this.classifyNotificationServiceFallbackReason(error);
        logger.warn('Notification service unavailable for createSessionNotifications, falling back to local implementation', 'NotificationFactory', {
          error,
          fallbackReason,
          notificationType: input.type,
          sessionId: input.sessionId,
        });
      }
    }

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

    const existingIdempotentNotifications = await client.sessionNotification.findMany({
      where: {
        sessionId,
        type,
        userId: { in: targetUserIds },
        metadata: { path: ['idempotencyKey'], equals: idempotencyKey },
      },
      select: { userId: true },
    });

    if (existingIdempotentNotifications.length > 0) {
      const existingUserIds = new Set(existingIdempotentNotifications.map((notification) => notification.userId));
      targetUserIds = targetUserIds.filter((id) => !existingUserIds.has(id));
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
        metadata: { ...(metadata || {}), idempotencyKey }
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
    const idempotencyKey = input.idempotencyKey || this.buildGroupIdempotencyKey(input);

    if (!tx && NOTIFICATION_SERVICE_URL && this.shouldUseNotificationService('group', `${input.groupId}:${input.type}`)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), NOTIFICATION_SERVICE_TIMEOUT_MS);
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (INTERNAL_SERVICE_TOKEN) {
          headers['x-internal-service-token'] = INTERNAL_SERVICE_TOKEN;
        }

        let response: globalThis.Response;
        try {
          response = await fetch(`${NOTIFICATION_SERVICE_URL.replace(/\/$/, '')}/api/notifications/group`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...input, idempotencyKey }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        const payload = await response.json() as { created?: number; skipped?: number; error?: string };
        if (!response.ok) {
          const error = new Error(payload.error || `Notification service request failed with status ${response.status}`) as Error & { status?: number; reasonCode?: string };
          error.status = response.status;
          error.reasonCode = `http_${response.status}`;
          throw error;
        }

        return {
          created: payload.created || 0,
          skipped: payload.skipped || 0,
        };
      } catch (error) {
        const fallbackReason = this.classifyNotificationServiceFallbackReason(error);
        logger.warn('Notification service unavailable for createGroupNotifications, falling back to local implementation', 'NotificationFactory', {
          error,
          fallbackReason,
          notificationType: input.type,
          groupId: input.groupId,
        });
      }
    }

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

    const existingIdempotentNotifications = await client.groupNotification.findMany({
      where: {
        groupId,
        type,
        userId: { in: targetUserIds },
        params: { path: ['idempotencyKey'], equals: idempotencyKey },
      },
      select: { userId: true },
    });

    if (existingIdempotentNotifications.length > 0) {
      const existingUserIds = new Set(existingIdempotentNotifications.map((notification) => notification.userId));
      targetUserIds = targetUserIds.filter((id) => !existingUserIds.has(id));
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
        params: { ...(params || {}), idempotencyKey }
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
    const idempotencyKey = input.idempotencyKey || this.buildTeamUpIdempotencyKey(input);

    if (!tx && NOTIFICATION_SERVICE_URL && this.shouldUseNotificationService('teamup', `${input.teamUpRequestId}:${input.type}`)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), NOTIFICATION_SERVICE_TIMEOUT_MS);
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (INTERNAL_SERVICE_TOKEN) {
          headers['x-internal-service-token'] = INTERNAL_SERVICE_TOKEN;
        }

        let response: globalThis.Response;
        try {
          response = await fetch(`${NOTIFICATION_SERVICE_URL.replace(/\/$/, '')}/api/notifications/teamup`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...input, idempotencyKey }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        const payload = await response.json() as { created?: number; skipped?: number; error?: string };
        if (!response.ok) {
          const error = new Error(payload.error || `Notification service request failed with status ${response.status}`) as Error & { status?: number; reasonCode?: string };
          error.status = response.status;
          error.reasonCode = `http_${response.status}`;
          throw error;
        }

        return {
          created: payload.created || 0,
          skipped: payload.skipped || 0,
        };
      } catch (error) {
        const fallbackReason = this.classifyNotificationServiceFallbackReason(error);
        logger.warn('Notification service unavailable for createTeamUpNotifications, falling back to local implementation', 'NotificationFactory', {
          error,
          fallbackReason,
          notificationType: input.type,
          teamUpRequestId: input.teamUpRequestId,
        });
      }
    }

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

    const existingIdempotentNotifications = await client.teamUpNotification.findMany({
      where: {
        teamUpRequestId,
        type,
        userId: { in: targetUserIds },
        metadata: { path: ['idempotencyKey'], equals: idempotencyKey },
      },
      select: { userId: true },
    });

    if (existingIdempotentNotifications.length > 0) {
      const existingUserIds = new Set(existingIdempotentNotifications.map((notification) => notification.userId));
      targetUserIds = targetUserIds.filter((id) => !existingUserIds.has(id));
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
        metadata: { ...(metadata || {}), idempotencyKey }
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
    const idempotencyKey = input.idempotencyKey || this.buildTournamentIdempotencyKey(input);

    if (!tx && NOTIFICATION_SERVICE_URL && this.shouldUseNotificationService('tournament', `${input.tournamentId}:${input.type}:${idempotencyKey}`)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), NOTIFICATION_SERVICE_TIMEOUT_MS);
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (INTERNAL_SERVICE_TOKEN) {
          headers['x-internal-service-token'] = INTERNAL_SERVICE_TOKEN;
        }

        let response: globalThis.Response;
        try {
          response = await fetch(`${NOTIFICATION_SERVICE_URL.replace(/\/$/, '')}/api/notifications/tournament`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...input, idempotencyKey }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        const payload = await response.json() as { created?: number; skipped?: number; error?: string };
        if (!response.ok) {
          const error = new Error(payload.error || `Notification service request failed with status ${response.status}`) as Error & { status?: number; reasonCode?: string };
          error.status = response.status;
          error.reasonCode = `http_${response.status}`;
          throw error;
        }

        return {
          created: payload.created || 0,
          skipped: payload.skipped || 0,
        };
      } catch (error) {
        const fallbackReason = this.classifyNotificationServiceFallbackReason(error);
        logger.warn('Notification service unavailable for createTournamentNotifications, falling back to local implementation', 'NotificationFactory', {
          error,
          fallbackReason,
          notificationType: input.type,
          tournamentId: input.tournamentId,
          idempotencyKey,
        });
      }
    }

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
    const prismaTournamentType = this.toPrismaTournamentType(type);

    const existingIdempotentNotifications = (await client.tournamentNotification.findMany({
      where: {
        tournamentId,
        type: prismaTournamentType,
        userId: { in: targetUserIds },
        metadata: { path: ['idempotencyKey'], equals: idempotencyKey },
      },
      select: { userId: true },
    })) || [];

    if (existingIdempotentNotifications.length > 0) {
      const existingUserIds = new Set(existingIdempotentNotifications.map((notification) => notification.userId));
      finalUserIds = finalUserIds.filter((userId) => !existingUserIds.has(userId));
    }

    if (deduplicateWindow > 0) {
      const windowStart = new Date(Date.now() - deduplicateWindow);
      const existingNotifications = await client.tournamentNotification.findMany({
        where: {
          tournamentId,
          type: prismaTournamentType,
          userId: { in: finalUserIds },
          createdAt: { gte: windowStart }
        },
        select: { userId: true }
      });
      
      const existingUserIds = new Set(existingNotifications.map(n => n.userId));
      finalUserIds = finalUserIds.filter(id => !existingUserIds.has(id));
    }

    if (finalUserIds.length === 0) {
      return { created: 0, skipped: userIds.length };
    }

    // Create notifications
    try {
      const notifications: Prisma.TournamentNotificationCreateManyInput[] = finalUserIds.map(userId => ({
        tournamentId,
        userId,
        type: prismaTournamentType,
        params: params || {},
        metadata: { ...(metadata || {}), idempotencyKey }
      }));

      await client.tournamentNotification.createMany({
        data: notifications,
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
