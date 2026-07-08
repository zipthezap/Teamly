import prisma from '../../config/database';
import { Request, Response } from 'express';
import * as teamUpService from '../../services/teamUpService';
import { NotificationFactory } from '../../services/notificationFactory';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors';
import { TeamUpNotificationType } from '../../../shared/types/event.types';

export const getTeamUpComments = async (req: Request, res: Response) => {
  const { id } = req.params;

  const teamUpRequest = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!teamUpRequest) {
    throw new NotFoundError('TeamUp request not found');
  }

  const comments = await prisma.teamUpComment.findMany({
    where: { teamUpRequestId: id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePicture: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  res.json(comments);
};

export const addTeamUpComment = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    throw new BadRequestError('Comment content is required');
  }

  // Sanitize the content
  const sanitized = teamUpService.sanitizeTeamUpData({ message: content });
  teamUpService.validateTeamUpTextLengths({ message: sanitized.message });

  const teamUpRequest2 = await prisma.teamUpRequest.findUnique({
    where: { id },
    select: { 
      id: true, 
      status: true,
      title: true,
      sportType: true,
      creatorId: true
    }
  });

  if (!teamUpRequest2) {
    throw new NotFoundError('TeamUp request not found');
  }

  const comment = await prisma.teamUpComment.create({
    data: {
      teamUpRequestId: id,
      userId: req.user!.id,
      content: sanitized.message || content.trim()
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePicture: true
        }
      }
    }
  });

  // Create notification for TeamUp creator if commenter is not the creator
  if (req.user!.id !== teamUpRequest2.creatorId) {
    await NotificationFactory.createTeamUpNotifications({
      teamUpRequestId: id,
      type: TeamUpNotificationType.teamup_comment,
      userIds: [teamUpRequest2.creatorId],
      params: {
        name: req.user!.name,
        title: teamUpRequest2.title,
        sportType: teamUpRequest2.sportType,
      },
      metadata: {
        commentId: comment.id,
        commenterId: req.user!.id,
        commenterName: req.user!.name,
        actionUrl: `/teamup/${id}`,
      },
      checkMutePreference: false,
    });
  }

  res.status(201).json(comment);
};

export const deleteTeamUpComment = async (req: Request, res: Response) => {
  const { id, commentId } = req.params;

  const comment = await prisma.teamUpComment.findUnique({
    where: { id: commentId },
    select: { userId: true, teamUpRequestId: true }
  });

  if (!comment) {
    throw new NotFoundError('Comment not found');
  }

  if (comment.teamUpRequestId !== id) {
    throw new BadRequestError('Comment does not belong to this TeamUp request');
  }

  if (comment.userId !== req.user!.id) {
    throw new ForbiddenError('Only the author can delete this comment');
  }

  await prisma.teamUpComment.delete({
    where: { id: commentId }
  });

  res.json({ message: 'Comment deleted' });
};
