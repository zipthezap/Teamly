import prisma from '../config/database';
import { sanitizeUserInput } from '../utils/validation';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { BadRequestError, NotFoundError } from '../utils/errors';

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
  
  // Sanitize content to prevent XSS
  const sanitizedContent = sanitizeUserInput(content);
  
  const message = await prisma.groupMessage.create({
    data: { groupId, userId, content: sanitizedContent },
    include: { user: { select: { id: true, name: true, profilePicture: true, email: true } } }
  });
  res.status(201).json(message);
});

export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const messages = await prisma.groupMessage.findMany({
    where: { groupId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, name: true, profilePicture: true, email: true } } }
  });
  res.json(messages);
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
    await prisma.sessionNotification.create({
      data: {
        sessionId,
        userId,
        type: 'late',
        params: {
          name: req.user!.name,
          eventTitle: eventDetails.title
        }
      }
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
