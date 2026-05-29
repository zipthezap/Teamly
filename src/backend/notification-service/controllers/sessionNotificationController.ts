import { EmailPreference } from '@prisma/client';
import { Request, Response } from 'express';

import { SessionNotificationType } from '../../../shared/types/event.types';
import { buildSessionIdempotencyKey } from './_idempotency';
import prisma from '../../config/database';
import { dispatchPushNotifications } from '../../services/pushNotificationService';
import { pushNotificationToUser } from '../../services/sseService';
import { filterUnmutedUsers } from '../../utils/notificationHelper';
import { logger } from '../../utils/logger';

const getMuteKeyForEventType = (type: SessionNotificationType): keyof EmailPreference | null => {
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
};

type SessionNotificationRequestBody = {
  sessionId: string;
  type: SessionNotificationType;
  userIds: string[];
  params?: Record<string, string | number | boolean | undefined>;
  metadata?: Record<string, string | number | boolean | Date | undefined>;
  checkMutePreference?: boolean;
  deduplicateWindow?: number;
  idempotencyKey?: string;
};

export const createSessionNotifications = async (req: Request, res: Response): Promise<void> => {
  const {
    sessionId,
    type,
    userIds,
    params,
    metadata,
    checkMutePreference = true,
    deduplicateWindow = 0,
    idempotencyKey: requestIdempotencyKey,
  } = req.body as SessionNotificationRequestBody;

  if (!sessionId || !type || !Array.isArray(userIds)) {
    res.status(400).json({ error: 'sessionId, type, and userIds are required' });
    return;
  }

  if (userIds.length === 0) {
    res.json({ created: 0, skipped: 0 });
    return;
  }

  const idempotencyKey =
    requestIdempotencyKey ||
    buildSessionIdempotencyKey({
      sessionId,
      type,
      userIds,
      params,
      metadata,
    });

  let targetUserIds = userIds;
  if (checkMutePreference) {
    const muteKey = getMuteKeyForEventType(type);
    if (muteKey) {
      targetUserIds = await filterUnmutedUsers(userIds, muteKey);
    }
  }

  if (targetUserIds.length > 0) {
    const existingIdempotentNotifications = await prisma.sessionNotification.findMany({
      where: {
        sessionId,
        type,
        userId: { in: targetUserIds },
        metadata: { path: ['idempotencyKey'], equals: idempotencyKey },
      },
      select: { userId: true },
    });
    const existingUserIds = new Set(existingIdempotentNotifications.map((notification) => notification.userId));
    targetUserIds = targetUserIds.filter((id) => !existingUserIds.has(id));
  }

  if (deduplicateWindow > 0 && targetUserIds.length > 0) {
    const windowStart = new Date(Date.now() - deduplicateWindow);
    const existingNotifications = await prisma.sessionNotification.findMany({
      where: {
        sessionId,
        type,
        userId: { in: targetUserIds },
        createdAt: { gte: windowStart },
      },
      select: { userId: true },
    });
    const existingUserIds = new Set(existingNotifications.map((notification) => notification.userId));
    targetUserIds = targetUserIds.filter((id) => !existingUserIds.has(id));
  }

  if (targetUserIds.length === 0) {
    res.json({ created: 0, skipped: userIds.length });
    return;
  }

  const notifications = targetUserIds.map((userId) => ({
    sessionId,
    userId,
    type,
    params: params || {},
    metadata: { ...(metadata || {}), idempotencyKey },
  }));

  await prisma.sessionNotification.createMany({
    data: notifications,
    skipDuplicates: true,
  });

  const ssePayload = { type: 'session', notificationType: type, sessionId, params, metadata };
  targetUserIds.forEach((userId) => {
    try {
      pushNotificationToUser(userId, ssePayload);
    } catch {
      // Non-fatal: best-effort realtime push.
    }
  });

  void dispatchPushNotifications({
    userIds: targetUserIds,
    notificationKind: 'session',
    notificationType: type,
    entityId: sessionId,
    params,
    metadata,
  });

  logger.debug('Created session notifications via Notification Service', 'NotificationService', {
    sessionId,
    type,
    created: targetUserIds.length,
    skipped: userIds.length - targetUserIds.length,
  });

  res.json({
    created: targetUserIds.length,
    skipped: userIds.length - targetUserIds.length,
  });
};
