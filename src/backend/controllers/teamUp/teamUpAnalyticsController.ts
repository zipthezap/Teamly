import prisma from '../../config/database';
import { Request, Response } from 'express';
import { clampScore } from './_helpers';

export const getTeamUpAnalytics = async (req: Request, res: Response) => {
  const { fromDate, toDate } = req.query;
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (fromDate) {
    const parsed = new Date(String(fromDate));
    if (!isNaN(parsed.getTime())) dateFilter.gte = parsed;
  }
  if (toDate) {
    const parsed = new Date(String(toDate));
    if (!isNaN(parsed.getTime())) dateFilter.lte = parsed;
  }

  const requestWhere = Object.keys(dateFilter).length
    ? { createdAt: dateFilter }
    : undefined;

  const [views, applications, accepted, attendance, requests] = await Promise.all([
    prisma.teamUpRequestView.count({
      where: requestWhere
        ? {
            viewedAt: dateFilter,
          }
        : undefined,
    }),
    prisma.teamUpResponse.count({
      where: requestWhere
        ? {
            createdAt: dateFilter,
          }
        : undefined,
    }),
    prisma.teamUpResponse.count({
      where: {
        status: 'accepted',
        ...(requestWhere
          ? {
              createdAt: dateFilter,
            }
          : {}),
      },
    }),
    prisma.teamUpResponse.count({
      where: {
        attendanceStatus: { in: ['attended', 'late'] },
      },
    }),
    prisma.teamUpRequest.findMany({
      where: requestWhere,
      select: {
        id: true,
        sportType: true,
        city: true,
        createdAt: true,
        responses: {
          where: { status: 'accepted' },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    }),
  ]);

  const fillTimes = requests
    .map((item) => {
      const firstAccepted = item.responses[0];
      if (!firstAccepted) return null;
      return {
        sportType: item.sportType,
        city: item.city ?? 'unknown',
        fillHours:
          (new Date(firstAccepted.createdAt).getTime() - new Date(item.createdAt).getTime()) /
          (1000 * 60 * 60),
      };
    })
    .filter((value): value is { sportType: string; city: string; fillHours: number } => Boolean(value));

  const averageFillTimeHours =
    fillTimes.length === 0
      ? 0
      : clampScore(fillTimes.reduce((sum, item) => sum + item.fillHours, 0) / fillTimes.length);

  const conversion = {
    viewToApply: views === 0 ? 0 : clampScore((applications / views) * 100),
    applyToAccept: applications === 0 ? 0 : clampScore((accepted / applications) * 100),
    acceptToAttend: accepted === 0 ? 0 : clampScore((attendance / accepted) * 100),
  };

  res.json({
    funnel: {
      views,
      applications,
      accepted,
      attended: attendance,
      conversion,
    },
    fillTime: {
      averageHours: averageFillTimeHours,
      samples: fillTimes,
    },
  });
};
