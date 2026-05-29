import { EmailPreference } from '@prisma/client';
import { Request, Response } from 'express';

import { TeamUpNotificationType } from '../../../shared/types/event.types';
import prisma from '../../config/database';
import { dispatchPushNotifications } from '../../services/pushNotificationService';
import { filterUnmutedUsers } from '../../utils/notificationHelper';
import { logger } from '../../utils/logger';

const getMuteKeyForTeamUpType = (type: TeamUpNotificationType): keyof EmailPreference | null => {
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
};

type TeamUpNotificationRequestBody = {
  teamUpRequestId: string;
  type: TeamUpNotificationType;
  userIds: string[];
  params?: Record<string, string | number | boolean | undefined>;
  metadata?: Record<string, string | number | boolean | Date | undefined>;
  checkMutePreference?: boolean;
  deduplicateWindow?: number;
};

export const createTeamUpNotifications = async (req: Request, res: Response): Promise<void> => {
  const {
    teamUpRequestId,
    type,
    userIds,
    params,
    metadata,
    checkMutePreference = true,
    deduplicateWindow = 0,
  } = req.body as TeamUpNotificationRequestBody;

  if (!teamUpRequestId || !type || !Array.isArray(userIds)) {
    res.status(400).json({ error: 'teamUpRequestId, type, and userIds are required' });
    return;
  }

  if (userIds.length === 0) {
    res.json({ created: 0, skipped: 0 });
    return;
  }

  let targetUserIds = userIds;
  if (checkMutePreference) {
    const muteKey = getMuteKeyForTeamUpType(type);
    if (muteKey) {
      targetUserIds = await filterUnmutedUsers(userIds, muteKey);
    }
  }

  if (deduplicateWindow > 0 && targetUserIds.length > 0) {
    const windowStart = new Date(Date.now() - deduplicateWindow);
    const existingNotifications = await prisma.teamUpNotification.findMany({
      where: {
        teamUpRequestId,
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
    teamUpRequestId,
    userId,
    type,
    params: params || {},
    metadata: metadata || {},
  }));

  await prisma.teamUpNotification.createMany({
    data: notifications,
    skipDuplicates: true,
  });

  void dispatchPushNotifications({
    userIds: targetUserIds,
    notificationKind: 'teamup',
    notificationType: type,
    entityId: teamUpRequestId,
    params,
    metadata,
  });

  logger.debug('Created team-up notifications via Notification Service', 'NotificationService', {
    teamUpRequestId,
    type,
    created: targetUserIds.length,
    skipped: userIds.length - targetUserIds.length,
  });

  res.json({
    created: targetUserIds.length,
    skipped: userIds.length - targetUserIds.length,
  });
};
