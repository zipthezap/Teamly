import prisma from '../config/database';
import * as validation from '../utils/validation';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { NotificationFactory } from '../services/notificationFactory';
import { SessionNotificationType } from '../../shared/types/event.types';
import { escapeHtml } from '../utils/validation';

// Get notifications for the current user (session and group notifications)
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
  const userId = req.user!.id;
  // Fetch both session and group notifications, ordered by createdAt desc
  const [sessionNotifications, groupNotifications] = await Promise.all([
    prisma.sessionNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.groupNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })
  ]);
  res.json({ sessionNotifications, groupNotifications });
});

// Undo Event Attendance (late)
export const unmarkLate = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.body;
  const userId = req.user!.id;

  // Find the attendance record
  const attendance = await prisma.sessionAttendance.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
  });

  if (!attendance || attendance.status !== 'late') {
    throw new BadRequestError('Not marked as late');
  }

  // Set status back to 'on_time' (or remove, depending on business logic)
  const updated = await prisma.sessionAttendance.update({
    where: { sessionId_userId: { sessionId, userId } },
    data: { status: 'on_time' },
  });


  // Remove the most recent 'late' activity log for this user/session
  const lastLate = await prisma.sessionNotification.findFirst({
    where: {
      sessionId,
      userId,
      type: 'late',
    },
    orderBy: { createdAt: 'desc' },
  });
  if (lastLate) {
    await prisma.sessionNotification.delete({ where: { id: lastLate.id } });
  }

  res.json(updated);
});

// Group Chat
export const createMessage = asyncHandler(async (req: Request, res: Response) => {
  const { groupId, content } = req.body;
  const userId = req.user!.id;

  // Verify the sender is a member of the group
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { id: true }
  });
  if (!membership) {
    throw new ForbiddenError('You are not a member of this group');
  }

  // Sanitize content to prevent XSS and strip surrounding whitespace
  // Some tests mock `utils/validation` without `escapeHtml` — fall back to sanitized input.
  const rawSanitized = validation.sanitizeUserInput(content);
  // Inline, minimal HTML escape to avoid relying on mocked `escapeHtml` in tests
  const sanitizedContent = rawSanitized.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
  
  const message = await prisma.groupMessage.create({
    data: { groupId, userId, content: sanitizedContent },
    include: { user: { select: { id: true, name: true, profilePicture: true, email: true } } }
  });
  res.status(201).json(message);
});

// Update a group message (edit content)
export const updateMessage = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content } = req.body;
  const userId = req.user!.id;

  if (!content || typeof content !== 'string') {
    throw new BadRequestError('Content is required');
  }

  const message = await prisma.groupMessage.findUnique({ where: { id } });
  if (!message) throw new NotFoundError('Message not found');

  // Verify membership
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: message.groupId } },
    select: { role: true }
  });
  if (!membership && message.userId !== userId) {
    throw new ForbiddenError('You are not a member of this group');
  }

  // Only owner or moderators/admins can edit others' messages
  const canEdit = message.userId === userId || (membership && (membership.role === 'admin' || membership.role === 'moderator'));
  if (!canEdit) throw new ForbiddenError('Not authorized to edit this message');

  const sanitizedContent = escapeHtml(validation.sanitizeUserInput(content));
  const updated = await prisma.groupMessage.update({ where: { id }, data: { content: sanitizedContent } });
  res.json(updated);
});

// Delete a group message
export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const message = await prisma.groupMessage.findUnique({ where: { id } });
  if (!message) throw new NotFoundError('Message not found');

  // Verify membership and role
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: message.groupId } },
    select: { role: true }
  });

  const canDelete = message.userId === userId || (membership && (membership.role === 'admin' || membership.role === 'moderator'));
  if (!canDelete) throw new ForbiddenError('Not authorized to delete this message');

  await prisma.groupMessage.delete({ where: { id } });
  res.json({ message: 'Deleted' });
});

export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const userId = req.user!.id;

  // Verify caller is a member of the group before exposing chat history
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { id: true }
  });
  if (!membership) {
    throw new ForbiddenError('You are not a member of this group');
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = req.query.before as string | undefined; // cursor: createdAt ISO string

  const messages = await prisma.groupMessage.findMany({
    where: {
      groupId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {})
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { id: true, name: true, profilePicture: true, email: true } } }
  });

  // Return in ascending order so the client can append directly
  res.json(messages.reverse());
});

// Event Attendance (late)
export const markLate = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.body;
  const userId = req.user!.id;

  // Get session to find the organizer
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { creatorId: true }
  });

  if (!session) {
    throw new NotFoundError('Event not found');
  }

  // Check if user is already marked as late
  const existingAttendance = await prisma.sessionAttendance.findUnique({
    where: { sessionId_userId: { sessionId, userId } }
  });

  if (existingAttendance && existingAttendance.status === 'late') {
    throw new BadRequestError('You are already marked as late');
  }

  const attendance = await prisma.sessionAttendance.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    update: { status: 'late' },
    create: { sessionId, userId, status: 'late' }
  });

  // Log 'late' activity for the acting user
  // Get session details
  const eventDetails = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { title: true }
  });

  if (eventDetails) {
    await NotificationFactory.createSessionNotifications({
      sessionId,
      type: SessionNotificationType.late,
      userIds: [userId],
      params: {
        name: req.user!.name,
        eventTitle: eventDetails.title,
      },
      checkMutePreference: false,
    });
  }

  res.json(attendance);
});

export const markNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  // Check if there are unread notifications first
  const [unreadEventCount, unreadGroupCount] = await Promise.all([
    prisma.sessionNotification.count({
      where: { userId, read: false }
    }),
    prisma.groupNotification.count({
      where: { userId, read: false }
    })
  ]);
  
  // Only update if there are unread notifications
  if (unreadEventCount > 0 || unreadGroupCount > 0) {
    await Promise.all([
      unreadEventCount > 0 ? prisma.sessionNotification.updateMany({
        where: { userId, read: false },
        data: { read: true }
      }) : Promise.resolve(),
      unreadGroupCount > 0 ? prisma.groupNotification.updateMany({
        where: { userId, read: false },
        data: { read: true }
      }) : Promise.resolve()
    ]);
  }
  
  res.json({ message: 'Notifications marked as read' });
});
