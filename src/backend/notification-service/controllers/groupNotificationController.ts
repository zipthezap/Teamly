import { Request, Response } from 'express';

import prisma from '../../config/database';
import { dispatchPushNotifications } from '../../services/pushNotificationService';
import { filterUnmutedUsers } from '../../utils/notificationHelper';
import { logger } from '../../utils/logger';
import { pushNotificationToUser } from '../../services/sseService';
import { GroupNotificationType } from '../../../shared/types/event.types';
import { EmailPreference } from '@prisma/client';
import { buildGroupIdempotencyKey } from './_idempotency';

const getMuteKeyForGroupType = (type: GroupNotificationType): keyof EmailPreference | null => {
  switch (type) {
    case 'invited':
    case 'accepted':
      return 'muteGroupInvites';
    case 'join_request':
      return 'muteGroupRequests';
    case GroupNotificationType.session_created:
      return 'muteSessionCreated';
    case 'nearby_created':
      return 'muteNearbyGroups';
    case 'removed':
      return 'muteGroupRequests';
    default:
      return null;
  }
};

type GroupNotificationRequestBody = {
  groupId: string;
  type: GroupNotificationType;
  userIds: string[];
  params?: Record<string, string | number | boolean | undefined>;
  checkMutePreference?: boolean;
  deduplicateWindow?: number;
  idempotencyKey?: string;
};

export const createGroupNotifications = async (req: Request, res: Response): Promise<void> => {
  const {
    groupId,
    type,
    userIds,
    params,
    checkMutePreference = true,
    deduplicateWindow = 0,
    idempotencyKey: requestIdempotencyKey,
  } = req.body as GroupNotificationRequestBody;

  if (!groupId || !type || !Array.isArray(userIds)) {
    res.status(400).json({ error: 'groupId, type, and userIds are required' });
    return;
  }

  if (userIds.length === 0) {
    res.json({ created: 0, skipped: 0 });
    return;
  }

  const idempotencyKey =
    requestIdempotencyKey ||
    buildGroupIdempotencyKey({
      groupId,
      type,
      userIds,
      params,
    });

  let targetUserIds = userIds;
  if (checkMutePreference) {
    const muteKey = getMuteKeyForGroupType(type);
    if (muteKey) {
      targetUserIds = await filterUnmutedUsers(userIds, muteKey);
    }
  }

  if (targetUserIds.length > 0) {
    const existingIdempotentNotifications = await prisma.groupNotification.findMany({
      where: {
        groupId,
        type,
        userId: { in: targetUserIds },
        params: { path: ['idempotencyKey'], equals: idempotencyKey },
      },
      select: { userId: true },
    });
    const existingUserIds = new Set(existingIdempotentNotifications.map((notification) => notification.userId));
    targetUserIds = targetUserIds.filter((id) => !existingUserIds.has(id));
  }

  if (deduplicateWindow > 0 && targetUserIds.length > 0) {
    const windowStart = new Date(Date.now() - deduplicateWindow);
    const existingNotifications = await prisma.groupNotification.findMany({
      where: {
        groupId,
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
    groupId,
    userId,
    type,
    params: { ...(params || {}), idempotencyKey },
  }));

  await prisma.groupNotification.createMany({
    data: notifications,
    skipDuplicates: true,
  });

  const ssePayload = { type: 'group', notificationType: type, groupId, params };
  targetUserIds.forEach((userId) => {
    try {
      pushNotificationToUser(userId, ssePayload);
    } catch {
      // Non-fatal: best-effort realtime push.
    }
  });

  void dispatchPushNotifications({
    userIds: targetUserIds,
    notificationKind: 'group',
    notificationType: type,
    entityId: groupId,
    params,
  });

  logger.debug('Created group notifications via Notification Service', 'NotificationService', {
    groupId,
    type,
    created: targetUserIds.length,
    skipped: userIds.length - targetUserIds.length,
  });

  res.json({
    created: targetUserIds.length,
    skipped: userIds.length - targetUserIds.length,
  });
};
