import { Request, Response } from 'express';

import prisma from '../../config/database';
import { CacheService } from '../../services/cacheService';
import * as locationService from '../../services/locationService';
import { hasLocation } from '../../utils/typeGuards';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const getGroups = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const includeEvents = req.query.includeEvents === 'true';

  const cacheKey = `user:${userId}:groups:${includeEvents}`;
  const cached = await CacheService.get(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  const groups = await prisma.group.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      creator: {
        select: { id: true, name: true, email: true, profilePicture: true },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, profilePicture: true },
          },
        },
      },
      ...(includeEvents && {
        sessions: {
          where: {
            archived: false,
            startTime: {
              gte: new Date(Date.now() - THIRTY_DAYS_MS),
            },
          },
          orderBy: { startTime: 'asc' },
          take: 20,
        },
      }),
      _count: {
        select: {
          sessions: true,
          members: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const mappedGroups = groups.map((group) => ({
    ...group,
    members: group.members.map((member) => ({
      id: member.userId,
      name: member.user.name,
      email: member.user.email,
      profilePicture: member.user.profilePicture,
      role: member.role,
    })),
  }));

  const enrichedGroups = mappedGroups.map((group) => {
    if (hasLocation(group) && group.latitude !== null && group.longitude !== null) {
      return locationService.enrichWithLocationInfo(group);
    }
    return group;
  });

  await CacheService.set(cacheKey, enrichedGroups, 120);
  res.json(enrichedGroups);
};
