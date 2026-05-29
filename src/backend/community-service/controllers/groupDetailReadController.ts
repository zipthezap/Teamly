import { Request, Response } from 'express';

import prisma from '../../config/database';
import { CacheService } from '../../services/cacheService';
import * as locationService from '../../services/locationService';
import { NotFoundError } from '../../utils/errors';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const getGroup = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: id } },
    select: { role: true },
  });

  const isMember = !!membership;
  const cacheKey = isMember ? `group:${id}:member:${userId}` : `group:${id}:public`;
  const cached = await CacheService.get(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  if (isMember) {
    const group = await prisma.group.findFirst({
      where: { id },
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
        sessions: {
          where: {
            archived: false,
            startTime: {
              gte: new Date(Date.now() - SEVEN_DAYS_MS),
            },
          },
          include: {
            creator: {
              select: { id: true, name: true, email: true },
            },
            _count: {
              select: {
                participants: true,
                guestParticipants: true,
              },
            },
          },
          orderBy: { startTime: 'asc' },
          take: 50,
        },
        _count: {
          select: {
            sessions: true,
            members: true,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundError('Group not found');
    }

    const mappedGroup = {
      ...group,
      members: group.members.map((member) => ({
        id: member.userId,
        name: member.user.name,
        email: member.user.email,
        profilePicture: member.user.profilePicture,
        role: member.role,
      })),
    };

    const enrichedGroup = locationService.enrichWithLocationInfo(mappedGroup);
    await CacheService.set(cacheKey, enrichedGroup, 60);
    return res.json(enrichedGroup);
  }

  const group = await prisma.group.findFirst({
    where: { id, isPublic: true },
    include: {
      creator: {
        select: { id: true, name: true, profilePicture: true },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, profilePicture: true },
          },
        },
      },
      _count: {
        select: {
          sessions: true,
          members: true,
        },
      },
    },
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  const mappedGroup = {
    ...group,
    members: group.members.map((member) => ({
      id: member.userId,
      name: member.user.name,
      email: undefined as string | undefined,
      profilePicture: member.user.profilePicture,
      role: member.role,
    })),
    sessions: [] as unknown[],
  };

  const enrichedGroup = locationService.enrichWithLocationInfo(mappedGroup);
  await CacheService.set(cacheKey, enrichedGroup, 30);

  res.json(enrichedGroup);
};
