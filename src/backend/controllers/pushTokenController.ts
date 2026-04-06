import { PushDevicePlatform, Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { BadRequestError } from '../utils/errors';
import {
  disableAllPushDevices,
  disablePushDevice,
  registerOrUpdatePushDevice,
  validatePushToken,
} from '../services/pushTokenService';
import prisma from '../config/database';

const PLATFORM_VALUES: PushDevicePlatform[] = ['android', 'ios', 'web'];

const parsePlatform = (value: unknown): PushDevicePlatform => {
  if (typeof value !== 'string' || !PLATFORM_VALUES.includes(value as PushDevicePlatform)) {
    throw new BadRequestError('platform must be one of: android, ios, web');
  }
  return value as PushDevicePlatform;
};

const parseToken = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new BadRequestError('token is required');
  }
  const token = value.trim();
  if (!validatePushToken(token)) {
    throw new BadRequestError('token is invalid');
  }
  return token;
};

const pickOptionalString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const publicSelect = {
  id: true,
  platform: true,
  enabled: true,
  locale: true,
  timezone: true,
  appVersion: true,
  deviceModel: true,
  lastSeen: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PushDeviceTokenSelect;

export const listPushDevices = asyncHandler(async (req: Request, res: Response) => {
  const devices = await prisma.pushDeviceToken.findMany({
    where: { userId: req.user!.id },
    select: publicSelect,
    orderBy: [{ enabled: 'desc' }, { lastSeen: 'desc' }],
  });
  res.json({ devices });
});

export const registerPushDevice = asyncHandler(async (req: Request, res: Response) => {
  const token = parseToken(req.body?.token);
  const platform = parsePlatform(req.body?.platform);

  const device = await registerOrUpdatePushDevice({
    userId: req.user!.id,
    token,
    platform,
    locale: pickOptionalString(req.body?.locale),
    timezone: pickOptionalString(req.body?.timezone),
    appVersion: pickOptionalString(req.body?.appVersion),
    deviceModel: pickOptionalString(req.body?.deviceModel),
  });

  res.status(201).json({
    device: {
      id: device.id,
      platform: device.platform,
      enabled: device.enabled,
      lastSeen: device.lastSeen,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    },
  });
});

export const refreshPushDevice = asyncHandler(async (req: Request, res: Response) => {
  const oldToken = parseToken(req.body?.oldToken);
  const newToken = parseToken(req.body?.newToken);
  const platform = parsePlatform(req.body?.platform);

  await disablePushDevice(req.user!.id, oldToken);

  const device = await registerOrUpdatePushDevice({
    userId: req.user!.id,
    token: newToken,
    platform,
    locale: pickOptionalString(req.body?.locale),
    timezone: pickOptionalString(req.body?.timezone),
    appVersion: pickOptionalString(req.body?.appVersion),
    deviceModel: pickOptionalString(req.body?.deviceModel),
  });

  res.json({
    device: {
      id: device.id,
      platform: device.platform,
      enabled: device.enabled,
      lastSeen: device.lastSeen,
      updatedAt: device.updatedAt,
    },
  });
});

export const disablePushDeviceEndpoint = asyncHandler(async (req: Request, res: Response) => {
  const token = parseToken(req.body?.token);
  await disablePushDevice(req.user!.id, token);
  res.json({ message: 'Push device disabled' });
});

export const disableAllPushDevicesEndpoint = asyncHandler(async (req: Request, res: Response) => {
  await disableAllPushDevices(req.user!.id);
  res.json({ message: 'All push devices disabled' });
});
