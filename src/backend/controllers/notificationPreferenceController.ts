import prisma from '../config/database';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { UpdateEmailPreferenceData } from '../../shared/types/email.types';

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
  const data: UpdateEmailPreferenceData = req.body;
  const prefs = await prisma.emailPreference.upsert({
    where: { userId: req.user!.id },
    update: {
      ...(data.eventInvites !== undefined && { eventInvites: data.eventInvites }),
      ...(data.eventReminders !== undefined && { eventReminders: data.eventReminders }),
      ...(data.eventUpdates !== undefined && { eventUpdates: data.eventUpdates }),
      ...(data.eventCancellations !== undefined && { eventCancellations: data.eventCancellations }),
      ...(data.groupInvites !== undefined && { groupInvites: data.groupInvites }),
      ...(data.commentMentions !== undefined && { commentMentions: data.commentMentions }),
      ...(data.nearbyTeamUps !== undefined && { nearbyTeamUps: data.nearbyTeamUps }),
      ...(data.muteEventInvites !== undefined && { muteEventInvites: data.muteEventInvites }),
      ...(data.muteEventReminders !== undefined && { muteEventReminders: data.muteEventReminders }),
      ...(data.muteEventUpdates !== undefined && { muteEventUpdates: data.muteEventUpdates }),
      ...(data.muteEventCancellations !== undefined && { muteEventCancellations: data.muteEventCancellations }),
      ...(data.muteGroupInvites !== undefined && { muteGroupInvites: data.muteGroupInvites }),
      ...(data.muteGroupRequests !== undefined && { muteGroupRequests: data.muteGroupRequests }),
      ...(data.muteNearbyGroups !== undefined && { muteNearbyGroups: data.muteNearbyGroups }),
      ...(data.muteEventCreated !== undefined && { muteEventCreated: data.muteEventCreated }),
      ...(data.muteNearbyTeamUps !== undefined && { muteNearbyTeamUps: data.muteNearbyTeamUps })
    },
    create: {
      userId: req.user!.id,
      ...data
    }
  });
  res.json(prefs);
});
