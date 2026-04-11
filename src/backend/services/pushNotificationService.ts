import prisma from '../config/database';
import { logger } from '../utils/logger';
import { disableInvalidPushTokens, getActivePushDevicesForUsers } from './pushTokenService';
import { NotificationParams, NotificationMetadata } from './notificationFactory';
import { shouldSendPushNotification } from '../utils/notificationHelper';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

type NotificationKind = 'session' | 'group' | 'teamup' | 'tournament';

interface PushDispatchInput {
  userIds: string[];
  notificationKind: NotificationKind;
  notificationType: string;
  entityId?: string;
  params?: NotificationParams;
  metadata?: NotificationMetadata;
}

interface PushPayload {
  token: string;
  notification: { title: string; body: string };
  data: Record<string, string>;
  badge: number;
}

interface PushProviderResult {
  invalidTokens: string[];
}

const PUSH_MAX_RETRIES = 2;
let messagingClient: Messaging | null = null;

const isPushEnabledForKind = async (userId: string, kind: NotificationKind): Promise<boolean> => {
  return shouldSendPushNotification(userId, kind);
};

const buildTitleAndBody = (
  kind: NotificationKind,
  notificationType: string,
  params?: NotificationParams
): { title: string; body: string } => {
  const actor = String(params?.name ?? params?.actorName ?? 'Someone');
  const eventTitle = String(params?.eventTitle ?? 'an session');
  const groupName = String(params?.groupName ?? 'a group');
  const requestTitle = String(params?.title ?? 'a request');
  const tournamentName = String(params?.tournamentName ?? 'a tournament');

  if (kind === 'session') {
    return {
      title: 'Event update',
      body:
        notificationType === 'join'
          ? `${actor} joined ${eventTitle}`
          : notificationType === 'leave'
            ? `${actor} left ${eventTitle}`
            : `${eventTitle} has a new update`,
    };
  }

  if (kind === 'group') {
    return {
      title: 'Group update',
      body:
        notificationType === 'join_request'
          ? `New join request for ${groupName}`
          : `${groupName} has a new update`,
    };
  }

  if (kind === 'teamup') {
    return {
      title: 'TeamUp update',
      body: `${requestTitle} has a new update`,
    };
  }

  return {
    title: 'Tournament update',
    body: `${tournamentName} has a new update`,
  };
};

const getMessagingClient = (): Messaging | null => {
  if (messagingClient) return messagingClient;

  const projectId = process.env.FCM_PROJECT_ID;
  const serviceAccount = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!projectId || !serviceAccount) return null;

  try {
    const parsed = JSON.parse(serviceAccount) as {
      client_email?: string;
      private_key?: string;
      project_id?: string;
    };
    if (!parsed.client_email || !parsed.private_key) {
      logger.warn('Invalid FCM service account JSON', 'PushNotificationService');
      return null;
    }

    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: parsed.project_id || projectId,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key,
        }),
        projectId,
      });
    }

    messagingClient = getMessaging();
    return messagingClient;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin messaging', 'PushNotificationService', { error });
    return null;
  }
};

const sendViaProvider = async (payloads: PushPayload[]): Promise<PushProviderResult> => {
  const invalidTokens: string[] = [];
  const client = getMessagingClient();
  if (!client) {
    logger.warn('FCM not configured, skipping external push provider send', 'PushNotificationService', {
      payloadCount: payloads.length,
    });
    return { invalidTokens };
  }

  for (const payload of payloads) {
    try {
      await client.send({
        token: payload.token,
        notification: payload.notification,
        data: payload.data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'teamly_notifications',
            notificationCount: payload.badge,
          },
        },
        apns: {
          payload: {
            aps: {
              badge: payload.badge,
              sound: 'default',
            },
          },
        },
      });
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token')
      ) {
        invalidTokens.push(payload.token);
      } else {
        logger.warn('FCM send failed for token', 'PushNotificationService', {
          tokenSuffix: payload.token.slice(-8),
          code,
          error,
        });
      }
    }
  }

  return { invalidTokens };
};

const withRetries = async (payloads: PushPayload[]): Promise<PushProviderResult> => {
  let attempt = 0;
  let lastInvalid: string[] = [];

  while (attempt <= PUSH_MAX_RETRIES) {
    try {
      return await sendViaProvider(payloads);
    } catch (error) {
      attempt += 1;
      logger.warn('Push provider send failed', 'PushNotificationService', {
        attempt,
        payloadCount: payloads.length,
        error,
      });
      if (attempt > PUSH_MAX_RETRIES) throw error;
      lastInvalid = [];
    }
  }

  return { invalidTokens: lastInvalid };
};

const getUnreadCount = async (userId: string): Promise<number> => {
  const [eventCount, groupCount, teamUpCount, tournamentCount] = await Promise.all([
    prisma.sessionNotification.count({ where: { userId, read: false } }),
    prisma.groupNotification.count({ where: { userId, read: false } }),
    prisma.teamUpNotification.count({ where: { userId, read: false } }),
    prisma.tournamentNotification.count({ where: { userId, read: false } }),
  ]);
  return eventCount + groupCount + teamUpCount + tournamentCount;
};

export const dispatchPushNotifications = async (input: PushDispatchInput): Promise<void> => {
  if (input.userIds.length === 0) return;

  const eligibleUsers = (
    await Promise.all(
      input.userIds.map(async (userId) => {
        const enabled = await isPushEnabledForKind(userId, input.notificationKind);
        return enabled ? userId : null;
      })
    )
  ).filter((id): id is string => Boolean(id));

  if (eligibleUsers.length === 0) return;

  const [devices, badgeCounts] = await Promise.all([
    getActivePushDevicesForUsers(eligibleUsers),
    Promise.all(
      eligibleUsers.map(async (userId) => {
        const count = await getUnreadCount(userId);
        return [userId, count] as const;
      })
    ),
  ]);

  if (devices.length === 0) return;

  const badgeByUser = new Map<string, number>(badgeCounts);
  const { title, body } = buildTitleAndBody(input.notificationKind, input.notificationType, input.params);

  const payloads: PushPayload[] = devices.map((device) => ({
    token: device.token,
    notification: { title, body },
    data: {
      notificationKind: input.notificationKind,
      notificationType: input.notificationType,
      entityId: input.entityId ?? '',
      actionUrl: String(input.metadata?.actionUrl ?? ''),
    },
    badge: badgeByUser.get(device.userId) ?? 0,
  }));

  try {
    const result = await withRetries(payloads);
    if (result.invalidTokens.length > 0) {
      await disableInvalidPushTokens(result.invalidTokens);
    }
  } catch (error) {
    logger.error('Push dispatch failed after retries', 'PushNotificationService', {
      notificationKind: input.notificationKind,
      notificationType: input.notificationType,
      userCount: eligibleUsers.length,
      error,
    });
  }
};
