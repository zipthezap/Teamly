import prisma from '../config/database';
import { Request, Response } from 'express';

export const getNotificationPreferences = async (req: Request, res: Response) => {
  try {
    let prefs = await prisma.emailPreference.findUnique({
      where: { userId: req.user.id },
    });
    if (!prefs) {
      prefs = await prisma.emailPreference.create({ data: { userId: req.user.id } });
    }
    res.json(prefs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
};

export const updateNotificationPreferences = async (req: Request, res: Response) => {
  try {
    const prefs = await prisma.emailPreference.update({
      where: { userId: req.user.id },
      data: req.body,
    });
    res.json(prefs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
};
