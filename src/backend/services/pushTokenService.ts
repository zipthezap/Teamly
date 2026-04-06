import { PushDevicePlatform } from '@prisma/client';
import prisma from '../config/database';

export interface RegisterPushDeviceInput {
  userId: string;
  token: string;
  platform: PushDevicePlatform;
  locale?: string;
  timezone?: string;
  appVersion?: string;
  deviceModel?: string;
}

const STALE_DEVICE_DAYS = 90;
const TOKEN_MAX_LENGTH = 512;
const META_MAX_LENGTH = 128;

const normalizeToken = (token: string): string => token.trim();

const sanitizeOptional = (value?: string): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, META_MAX_LENGTH);
};

export const validatePushToken = (token: string): boolean => {
  const normalized = normalizeToken(token);
  if (!normalized || normalized.length > TOKEN_MAX_LENGTH) return false;
  return /^[A-Za-z0-9\-_:.\[\]]+$/.test(normalized);
};

export const registerOrUpdatePushDevice = async (input: RegisterPushDeviceInput) => {
  const token = normalizeToken(input.token);
  const now = new Date();

  const existingByToken = await prisma.pushDeviceToken.findUnique({
    where: { token },
    select: { id: true, userId: true },
  });

  if (existingByToken && existingByToken.userId !== input.userId) {
    return prisma.pushDeviceToken.update({
      where: { id: existingByToken.id },
      data: {
        userId: input.userId,
        platform: input.platform,
        enabled: true,
        locale: sanitizeOptional(input.locale),
        timezone: sanitizeOptional(input.timezone),
        appVersion: sanitizeOptional(input.appVersion),
        deviceModel: sanitizeOptional(input.deviceModel),
        lastSeen: now,
      },
    });
  }

  return prisma.pushDeviceToken.upsert({
    where: { token },
    update: {
      userId: input.userId,
      platform: input.platform,
      enabled: true,
      locale: sanitizeOptional(input.locale),
      timezone: sanitizeOptional(input.timezone),
      appVersion: sanitizeOptional(input.appVersion),
      deviceModel: sanitizeOptional(input.deviceModel),
      lastSeen: now,
    },
    create: {
      userId: input.userId,
      token,
      platform: input.platform,
      enabled: true,
      locale: sanitizeOptional(input.locale),
      timezone: sanitizeOptional(input.timezone),
      appVersion: sanitizeOptional(input.appVersion),
      deviceModel: sanitizeOptional(input.deviceModel),
      lastSeen: now,
    },
  });
};

export const disablePushDevice = async (userId: string, token: string): Promise<void> => {
  await prisma.pushDeviceToken.updateMany({
    where: {
      userId,
      token: normalizeToken(token),
    },
    data: {
      enabled: false,
      lastSeen: new Date(),
    },
  });
};

export const disableAllPushDevices = async (userId: string): Promise<void> => {
  await prisma.pushDeviceToken.updateMany({
    where: { userId },
    data: {
      enabled: false,
      lastSeen: new Date(),
    },
  });
};

export const touchPushDeviceToken = async (token: string): Promise<void> => {
  await prisma.pushDeviceToken.updateMany({
    where: { token: normalizeToken(token) },
    data: { lastSeen: new Date(), enabled: true },
  });
};

export const disableInvalidPushTokens = async (tokens: string[]): Promise<void> => {
  if (tokens.length === 0) return;
  await prisma.pushDeviceToken.updateMany({
    where: { token: { in: tokens } },
    data: { enabled: false, lastSeen: new Date() },
  });
};

export const cleanupStalePushDevices = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - STALE_DEVICE_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.pushDeviceToken.deleteMany({
    where: {
      enabled: false,
      lastSeen: { lt: cutoff },
    },
  });
  return result.count;
};

export const getActivePushDevicesForUsers = async (userIds: string[]) => {
  if (userIds.length === 0) return [];
  return prisma.pushDeviceToken.findMany({
    where: {
      userId: { in: userIds },
      enabled: true,
    },
    select: {
      id: true,
      token: true,
      platform: true,
      userId: true,
      locale: true,
      timezone: true,
    },
  });
};
