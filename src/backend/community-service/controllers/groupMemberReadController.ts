import { Request, Response } from 'express';

import prisma from '../../config/database';
import { ForbiddenError, NotFoundError } from '../../utils/errors';

export const getGroupMembers = async (req: Request, res: Response) => {
  const { id } = req.params;

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, profilePicture: true },
          },
        },
      },
    },
  });

  if (!group) {
    throw new NotFoundError('Group not found');
  }

  const isMember = group.members.some((m) => m.userId === req.user?.id);
  if (!isMember) {
    throw new ForbiddenError('Only group members can view the member list');
  }

  const members = group.members.map((member) => ({
    id: member.userId,
    name: member.user?.name,
    email: member.user?.email,
    profilePicture: member.user?.profilePicture,
    role: member.role,
  }));

  res.setHeader('Cache-Control', 'no-store');
  res.json(members);
};