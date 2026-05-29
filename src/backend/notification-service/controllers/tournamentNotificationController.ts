import { Prisma, TournamentNotificationType as PrismaTournamentNotificationType } from '@prisma/client';
import { Request, Response } from 'express';

import { TournamentNotificationType } from '../../../shared/types/tournament.types';
import prisma from '../../config/database';
import { dispatchPushNotifications } from '../../services/pushNotificationService';
import { logger } from '../../utils/logger';

const prismaTournamentNotificationTypeValues = new Set<string>(
  Object.values(PrismaTournamentNotificationType)
);

const toPrismaTournamentType = (type: TournamentNotificationType): PrismaTournamentNotificationType => {
  if (!prismaTournamentNotificationTypeValues.has(type)) {
    throw new Error(`Unsupported tournament notification type: ${type}`);
  }
  return type as PrismaTournamentNotificationType;
};

type TournamentNotificationRequestBody = {
  tournamentId: string;
  type: TournamentNotificationType;
  userIds: string[];
  params?: Record<string, string | number | boolean | undefined>;
  metadata?: Record<string, string | number | boolean | Date | undefined>;
  deduplicateWindow?: number;
  idempotencyKey?: string;
};

export const createTournamentNotifications = async (req: Request, res: Response): Promise<void> => {
  const {
    tournamentId,
    type,
    userIds,
    params,
    metadata,
    deduplicateWindow = 0,
    idempotencyKey,
  } = req.body as TournamentNotificationRequestBody;

  if (!tournamentId || !type || !Array.isArray(userIds)) {
    res.status(400).json({ error: 'tournamentId, type, and userIds are required' });
    return;
  }

  if (userIds.length === 0) {
    res.json({ created: 0, skipped: 0 });
    return;
  }

  const prismaTournamentType = toPrismaTournamentType(type);
  let targetUserIds = userIds;

  if (idempotencyKey) {
    const existingIdempotentNotifications = (await prisma.tournamentNotification.findMany({
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
      targetUserIds = targetUserIds.filter((id) => !existingUserIds.has(id));
    }
  }

  if (deduplicateWindow > 0) {
    const windowStart = new Date(Date.now() - deduplicateWindow);
    const existingNotifications = await prisma.tournamentNotification.findMany({
      where: {
        tournamentId,
        type: prismaTournamentType,
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

  const notifications: Prisma.TournamentNotificationCreateManyInput[] = targetUserIds.map((userId) => ({
    tournamentId,
    userId,
    type: prismaTournamentType,
    params: params || {},
    metadata: { ...(metadata || {}), ...(idempotencyKey ? { idempotencyKey } : {}) },
  }));

  await prisma.tournamentNotification.createMany({
    data: notifications,
    skipDuplicates: true,
  });

  void dispatchPushNotifications({
    userIds: targetUserIds,
    notificationKind: 'tournament',
    notificationType: type,
    entityId: tournamentId,
    params,
    metadata,
  });

  logger.debug('Created tournament notifications via Notification Service', 'NotificationService', {
    tournamentId,
    type,
    created: targetUserIds.length,
    skipped: userIds.length - targetUserIds.length,
  });

  res.json({
    created: targetUserIds.length,
    skipped: userIds.length - targetUserIds.length,
  });
};
