import prisma from '../../config/database';
import { Request, Response } from 'express';
import { dispatchPushNotifications } from '../../services/pushNotificationService';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors';
import { clampScore } from './_helpers';

export const updateTeamUpRsvp = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rsvpStatus } = req.body ?? {};
  if (!rsvpStatus || !['going', 'late', 'cant_make_it'].includes(rsvpStatus)) {
    throw new BadRequestError('rsvpStatus must be one of: going, late, cant_make_it');
  }

  const response = await prisma.teamUpResponse.findFirst({
    where: {
      teamUpRequestId: id,
      userId: req.user!.id,
      status: 'accepted',
    },
    select: {
      id: true,
      teamUpRequestId: true,
      teamUpRequest: { select: { creatorId: true, title: true, sportType: true } },
    },
  });
  if (!response) {
    throw new NotFoundError('Accepted response not found for this TeamUp request');
  }

  const updated = await prisma.teamUpResponse.update({
    where: { id: response.id },
    data: {
      rsvpStatus,
      rsvpUpdatedAt: new Date(),
    },
    select: {
      id: true,
      rsvpStatus: true,
      rsvpUpdatedAt: true,
      teamUpRequestId: true,
    },
  });

  await prisma.teamUpNotification.create({
    data: {
      userId: response.teamUpRequest.creatorId,
      teamUpRequestId: response.teamUpRequestId,
      type: 'teamup_response',
      params: {
        title: response.teamUpRequest.title,
        sportType: response.teamUpRequest.sportType,
        name: req.user!.name,
      },
      metadata: {
        rsvpStatus,
        actionUrl: `/teamup/${response.teamUpRequestId}`,
      },
    },
  }).catch((_error: unknown): undefined => undefined);

  res.json(updated);
};

export const markTeamUpAttendance = async (req: Request, res: Response) => {
  const { id, responseId } = req.params;
  const { attendanceStatus } = req.body ?? {};
  if (!attendanceStatus || !['attended', 'late', 'no_show', 'excused'].includes(attendanceStatus)) {
    throw new BadRequestError('attendanceStatus must be one of: attended, late, no_show, excused');
  }

  const requestRecord = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { creatorId: true },
  });
  if (!requestRecord) throw new NotFoundError('TeamUp request not found');
  if (requestRecord.creatorId !== req.user!.id) {
    throw new ForbiddenError('Only the creator can mark attendance');
  }

  const updated = await prisma.teamUpResponse.update({
    where: { id: responseId },
    data: {
      attendanceStatus,
      attendanceMarkedAt: new Date(),
      attendanceMarkedByUserId: req.user!.id,
    },
    select: {
      id: true,
      userId: true,
      attendanceStatus: true,
      attendanceMarkedAt: true,
    },
  });

  res.json(updated);
};

export const getMyTeamUpAttendanceHistory = async (req: Request, res: Response) => {
  const history = await prisma.teamUpResponse.findMany({
    where: {
      userId: req.user!.id,
      attendanceStatus: { not: null },
    },
    select: {
      attendanceStatus: true,
      createdAt: true,
      teamUpRequest: {
        select: {
          id: true,
          title: true,
          sportType: true,
          dateTime: true,
          city: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totals = history.reduce(
    (acc, row) => {
      const key = row.attendanceStatus as keyof typeof acc;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    { attended: 0, late: 0, no_show: 0, excused: 0 }
  );
  const attendedLike = totals.attended + totals.late;
  const reliabilityScore =
    history.length === 0 ? 0 : clampScore((attendedLike / history.length) * 100);

  res.json({
    reliabilityScore,
    totals,
    history,
  });
};

export const sendTeamUpReminderNudges = async (req: Request, res: Response) => {
  const { id } = req.params;
  const requestRecord = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { creatorId: true, title: true, sportType: true },
  });
  if (!requestRecord) throw new NotFoundError('TeamUp request not found');
  if (requestRecord.creatorId !== req.user!.id) {
    throw new ForbiddenError('Only the creator can send reminders');
  }

  const recipients = await prisma.teamUpResponse.findMany({
    where: {
      teamUpRequestId: id,
      status: 'accepted',
      rsvpStatus: 'unset',
    },
    select: { userId: true },
  });

  if (recipients.length === 0) {
    return res.json({ message: 'No pending RSVPs to remind', notifiedCount: 0 });
  }

  await prisma.teamUpNotification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.userId,
      teamUpRequestId: id,
      type: 'teamup_response',
      params: {
        title: requestRecord.title,
        sportType: requestRecord.sportType,
      },
      metadata: {
        reminder: true,
        actionUrl: `/teamup/${id}`,
      },
    })),
    skipDuplicates: false,
  });

  await dispatchPushNotifications({
    userIds: recipients.map((recipient) => recipient.userId),
    notificationKind: 'teamup',
    notificationType: 'teamup_response',
    entityId: id,
    params: {
      title: requestRecord.title,
      sportType: requestRecord.sportType,
    },
    metadata: { actionUrl: `/teamup/${id}`, reminder: true },
  }).catch((_error: unknown): undefined => undefined);

  res.json({ message: 'Reminder nudges sent', notifiedCount: recipients.length });
};
