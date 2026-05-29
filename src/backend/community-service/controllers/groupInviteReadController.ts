import { Request, Response } from 'express';

import prisma from '../../config/database';

export const getUserInvitations = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const invitations = await prisma.groupJoinRequest.findMany({
    where: {
      userId,
      status: 'pending',
      createdBy: 'INVITE',
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          description: true,
          picture: true,
          isPublic: true,
        },
      },
      inviter: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(invitations);
};

export const getMyJoinRequests = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const requests = await prisma.groupJoinRequest.findMany({
    where: {
      userId,
      status: 'pending',
      createdBy: 'USER',
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          description: true,
          picture: true,
          isPublic: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(requests);
};