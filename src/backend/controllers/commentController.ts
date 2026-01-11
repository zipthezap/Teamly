import prisma from '../config/database';
import { sendEmail } from '../utils/emailService';
import { batchShouldSendEmailNotification } from '../utils/notificationHelper';
import { sanitizeUserInput } from '../utils/validation';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';

// Create a comment
export const createComment = asyncHandler(async (req: Request, res: Response) => {
  const { eventId, content, parentId } = req.body;

  if (!eventId || !content) {
    throw new BadRequestError('Event ID and content are required');
  }

  // Sanitize content to prevent XSS
  const sanitizedContent = sanitizeUserInput(content);

  // Check if event exists and user has access
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      group: {
        members: {
          some: {
            userId: (req.user as any).id
          }
        }
      }
    },
    include: {
      group: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        }
      }
    }
  });

  if (!event) {
    throw new NotFoundError('Event not found or access denied');
  }

  // If parentId provided, verify parent comment exists
  if (parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: parentId }
    });

    if (!parentComment || parentComment.eventId !== eventId) {
      throw new BadRequestError('Invalid parent comment');
    }
  }

  // Extract mentions from sanitized content (@username)
  const mentionRegex = /@(\w+)/g;
  const mentionMatches = sanitizedContent.matchAll(mentionRegex);
  const mentions = Array.from(mentionMatches, match => match[1]);

  // Create comment with sanitized content
  const comment = await prisma.comment.create({
    data: {
      content: sanitizedContent,
      eventId,
      userId: (req.user as any).id,
      parentId: parentId || null
    },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      },
      replies: {
        include: {
          user: {
            select: { id: true, name: true }
          }
        }
      }
    }
  });

  // Process mentions
  if (mentions.length > 0) {
    const groupMembers = event.group.members;
    
    // Create lookup maps for efficient matching
    const membersByName = new Map();
    const membersByEmail = new Map();
    
    groupMembers.forEach(m => {
      membersByName.set(m.user.name.toLowerCase(), m);
      membersByEmail.set(m.user.email.split('@')[0].toLowerCase(), m);
    });
    
    // Find unique mentioned users
    const mentionedUsers = new Set();
    for (const mention of mentions) {
      const mentionLower = mention.toLowerCase();
      const mentionedMember = membersByName.get(mentionLower) || membersByEmail.get(mentionLower);
      
      if (mentionedMember && mentionedMember.user.id !== (req.user as any).id) {
        mentionedUsers.add(mentionedMember.user);
      }
    }
    
    // Batch fetch preferences for all mentioned users
    const mentionedUserIds = Array.from(mentionedUsers).map(u => (u as { id: string }).id);
    const notificationMap = await batchShouldSendEmailNotification(mentionedUserIds, 'commentMentions');
    
    // Create mentions and send notifications
    for (const mentionedUser of mentionedUsers) {
      const user = mentionedUser as { id: string; email: string; name: string };
      // Create mention record
      await prisma.commentMention.create({
        data: {
          commentId: comment.id,
          userId: user.id
        }
      });
      // Send email notification if enabled
      if (notificationMap.get(user.id)) {
        await sendEmail(
          user.email,
          'commentMention',
          user.name,
          (req.user as any).name,
          event.title,
          content
        );
      }
    }
  }

  res.status(201).json(comment);
});

// Get comments for an event
export const getEventComments = asyncHandler(async (req: Request, res: Response) => {
  const { eventId } = req.params;

  // Check if event exists and user has access
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      group: {
        members: {
          some: {
            userId: (req.user as any).id
          }
        }
      }
    }
  });

  if (!event) {
    throw new NotFoundError('Event not found or access denied');
  }

  // Get top-level comments with their replies
  const comments = await prisma.comment.findMany({
    where: {
      eventId,
      parentId: null
    },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      },
      replies: {
        include: {
          user: {
            select: { id: true, name: true }
          },
          replies: {
            include: {
              user: {
                select: { id: true, name: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      },
      mentions: {
        include: {
          user: {
            select: { id: true, name: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(comments);
});

// Update a comment
export const updateComment = asyncHandler(async (req: Request, res: Response) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!content) {
    throw new BadRequestError('Content is required');
  }

  // Find comment and verify ownership
  const existingComment = await prisma.comment.findUnique({
    where: { id: commentId }
  });

  if (!existingComment) {
    throw new NotFoundError('Comment not found');
  }

  if (existingComment.userId !== (req.user as any).id) {
    throw new ForbiddenError('You can only edit your own comments');
  }

  const comment = await prisma.comment.update({
    where: { id: commentId },
    data: { content },
    include: {
      user: {
        select: { id: true, name: true }
      }
    }
  });

  res.json(comment);
});

// Delete a comment
export const deleteComment = asyncHandler(async (req: Request, res: Response) => {
  const { commentId } = req.params;

  // Find comment and verify ownership
  const comment = await prisma.comment.findUnique({
    where: { id: commentId }
  });

  if (!comment) {
    throw new NotFoundError('Comment not found');
  }

  if (comment.userId !== (req.user as any).id) {
    throw new ForbiddenError('You can only delete your own comments');
  }

  await prisma.comment.delete({
    where: { id: commentId }
  });

  res.json({ message: 'Comment deleted successfully' });
});

module.exports = {
  createComment,
  getEventComments,
  updateComment,
  deleteComment
};
