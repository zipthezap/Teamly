import prisma from '../config/database';
import { sendEmail } from '../utils/emailService';
import { batchShouldSendEmailNotification } from '../utils/notificationHelper';
import { sanitizeUserInput } from '../utils/validation';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { hasId, isUserWithEmail } from '../utils/typeGuards';

/**
 * Helper function to extract and find mentioned users from comment content
 */
const findMentionedUsers = (
  sanitizedContent: string,
  groupMembers: Array<{ user: { id: string; name: string; email: string } }>,
  currentUserId: string
) => {
  // Extract mentions from sanitized content (@username)
  const mentionRegex = /@(\w+)/g;
  const mentionMatches = sanitizedContent.matchAll(mentionRegex);
  const mentions = Array.from(mentionMatches, match => match[1]);

  if (mentions.length === 0) {
    return { mentions: [], mentionedUsers: new Set() };
  }

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

    if (mentionedMember && mentionedMember.user.id !== currentUserId) {
      mentionedUsers.add(mentionedMember.user);
    }
  }

  return { mentions, mentionedUsers };
};

// Create a comment
export const createComment = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
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
            userId: req.user!.id
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

  // Extract mentions from sanitized content
  const { mentions, mentionedUsers } = findMentionedUsers(sanitizedContent, event.group.members, req.user!.id);

  // Use transaction to create comment and mentions atomically
  const comment = await prisma.$transaction(async (tx) => {
    // Create comment with sanitized content
    const newComment = await tx.comment.create({
      data: {
        content: sanitizedContent,
        eventId,
        userId: req.user!.id,
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

    // Create all mention records within transaction
    if (mentionedUsers.size > 0) {
      const mentionPromises = Array.from(mentionedUsers)
        .filter(hasId)
        .map(mentionedUser => 
          tx.commentMention.create({
            data: {
              commentId: newComment.id,
              userId: mentionedUser.id
            }
          })
        );
      
      await Promise.all(mentionPromises);
    }

    return newComment;
  });

  // Send email notifications outside transaction (non-critical operation)
  if (mentionedUsers.size > 0) {
    // Batch fetch preferences for all mentioned users
    const mentionedUserIds = Array.from(mentionedUsers)
      .filter(hasId)
      .map(u => u.id);
    const notificationMap = await batchShouldSendEmailNotification(mentionedUserIds, 'commentMentions');
    
    // Send email notifications
    for (const mentionedUser of mentionedUsers) {
      if (!isUserWithEmail(mentionedUser)) {
        continue;
      }
      // Send email notification if enabled
      if (notificationMap.get(mentionedUser.id)) {
        await sendEmail(
          mentionedUser.email,
          'commentMention',
          mentionedUser.name,
          req.user!.name,
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
            userId: req.user!.id
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

  if (existingComment.userId !== req.user!.id) {
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

  if (comment.userId !== req.user!.id) {
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
