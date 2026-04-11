import prisma from '../config/database';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { UpdateEmailPreferenceData } from '../../shared/types/email.types';

export const getNotificationPreferences = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
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
      ...(data.sessionInvites !== undefined && { sessionInvites: data.sessionInvites }),
      ...(data.sessionReminders !== undefined && { sessionReminders: data.sessionReminders }),
      ...(data.sessionUpdates !== undefined && { sessionUpdates: data.sessionUpdates }),
      ...(data.sessionCancellations !== undefined && { sessionCancellations: data.sessionCancellations }),
      ...(data.groupInvites !== undefined && { groupInvites: data.groupInvites }),
      ...(data.commentMentions !== undefined && { commentMentions: data.commentMentions }),
      ...(data.nearbyTeamUps !== undefined && { nearbyTeamUps: data.nearbyTeamUps }),
      ...(data.muteSessionInvites !== undefined && { muteSessionInvites: data.muteSessionInvites }),
      ...(data.muteSessionReminders !== undefined && { muteSessionReminders: data.muteSessionReminders }),
      ...(data.muteSessionUpdates !== undefined && { muteSessionUpdates: data.muteSessionUpdates }),
      ...(data.muteSessionCancellations !== undefined && { muteSessionCancellations: data.muteSessionCancellations }),
      ...(data.muteGroupInvites !== undefined && { muteGroupInvites: data.muteGroupInvites }),
      ...(data.muteGroupRequests !== undefined && { muteGroupRequests: data.muteGroupRequests }),
      ...(data.muteNearbyGroups !== undefined && { muteNearbyGroups: data.muteNearbyGroups }),
      ...(data.muteSessionCreated !== undefined && { muteSessionCreated: data.muteSessionCreated }),
      ...(data.muteNearbyTeamUps !== undefined && { muteNearbyTeamUps: data.muteNearbyTeamUps }),
      ...(data.pushEnabled !== undefined && { pushEnabled: data.pushEnabled }),
      ...(data.pushSessions !== undefined && { pushSessions: data.pushSessions }),
      ...(data.pushGroups !== undefined && { pushGroups: data.pushGroups }),
      ...(data.pushTeamUp !== undefined && { pushTeamUp: data.pushTeamUp }),
      ...(data.pushTournaments !== undefined && { pushTournaments: data.pushTournaments }),
    },
    create: {
      userId: req.user!.id,
      sessionInvites: data.sessionInvites ?? true,
      sessionReminders: data.sessionReminders ?? true,
      sessionUpdates: data.sessionUpdates ?? true,
      sessionCancellations: data.sessionCancellations ?? true,
      groupInvites: data.groupInvites ?? true,
      commentMentions: data.commentMentions ?? true,
      nearbyTeamUps: data.nearbyTeamUps ?? true,
      muteSessionInvites: data.muteSessionInvites ?? false,
      muteSessionReminders: data.muteSessionReminders ?? false,
      muteSessionUpdates: data.muteSessionUpdates ?? false,
      muteSessionCancellations: data.muteSessionCancellations ?? false,
      muteGroupInvites: data.muteGroupInvites ?? false,
      muteGroupRequests: data.muteGroupRequests ?? false,
      muteNearbyGroups: data.muteNearbyGroups ?? false,
      muteSessionCreated: data.muteSessionCreated ?? false,
      muteNearbyTeamUps: data.muteNearbyTeamUps ?? false,
      pushEnabled: data.pushEnabled ?? true,
      pushSessions: data.pushSessions ?? true,
      pushGroups: data.pushGroups ?? true,
      pushTeamUp: data.pushTeamUp ?? true,
      pushTournaments: data.pushTournaments ?? true,
    }
  });
  res.json(prefs);
});
