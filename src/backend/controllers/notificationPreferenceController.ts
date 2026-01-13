import prisma from '../config/database';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';

export const getNotificationPreferences = asyncHandler(async (req: Request, res: Response) => {
  let prefs = await prisma.emailPreference.findUnique({
    where: { userId: req.user!.id },
  });
  if (!prefs) {
    prefs = await prisma.emailPreference.create({ data: { userId: req.user!.id } });
  }
  res.json(prefs);
});

export const updateNotificationPreferences = asyncHandler(async (req: Request, res: Response) => {
  const prefs = await prisma.emailPreference.update({
    where: { userId: req.user!.id },
    data: req.body,
  });
  res.json(prefs);
});
