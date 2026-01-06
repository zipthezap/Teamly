import prisma from '../config/database';
import { sendEmail } from '../utils/emailService';
import { batchShouldSendEmailNotification } from '../utils/notificationHelper';
import { Request, Response } from 'express';

// Create a comment
export const createComment = async (req: Request, res: Response) => {
  try {
    const { eventId, content, parentId } = req.body;

    if (!eventId || !content) {
      return res.status(400).json({ error: 'Event ID and content are required' });
    }

    // Check if event exists and user has access
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        group: {
          members: {
            some: {
              userId: req.user.id
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
      return res.status(404).json({ error: 'Event not found or access denied' });
    }

    // If parentId provided, verify parent comment exists
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId }
      });

      if (!parentComment || parentComment.eventId !== eventId) {
        return res.status(400).json({ error: 'Invalid parent comment' });
      }
    }

    // Extract mentions from content (@username)
    const mentionRegex = /@(\w+)/g;
    const mentionMatches = content.matchAll(mentionRegex);
    const mentions = Array.from(mentionMatches, match => match[1]);

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content,
        eventId,
        userId: req.user.id,
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
        
        if (mentionedMember && mentionedMember.user.id !== req.user.id) {
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
            req.user.name,
            event.title,
            content
          );
        }
      }
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
};

// Get comments for an event
export const getEventComments = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    // Check if event exists and user has access
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        group: {
          members: {
            some: {
              userId: req.user.id
            }
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found or access denied' });
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
  } catch (error) {
    console.error('Get event comments error:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
};

// Update a comment
export const updateComment = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Find comment and verify ownership
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (existingComment.userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
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
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
};

// Delete a comment
export const deleteComment = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;

    // Find comment and verify ownership
    const comment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    await prisma.comment.delete({
      where: { id: commentId }
    });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};

module.exports = {
  createComment,
  getEventComments,
  updateComment,
  deleteComment
};
