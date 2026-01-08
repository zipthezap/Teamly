// Get notifications for the current user (event and group notifications)
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    // Fetch both event and group notifications, ordered by createdAt desc
    const [eventNotifications, groupNotifications] = await Promise.all([
      prisma.eventNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.groupNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      })
    ]);
    res.json({ eventNotifications, groupNotifications });
  } catch (e) {
    logger.error('Get notifications error:', 'groupChatControllerController', { error: e });
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { Request, Response } from 'express';

// Undo Event Attendance (late)
export const unmarkLate = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.body;
    const userId = req.user.id;

    // Find the attendance record
    const attendance = await prisma.eventAttendance.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (!attendance || attendance.status !== 'late') {
      return res.status(400).json({ error: 'Not marked as late' });
    }

    // Set status back to 'confirmed' (or remove, depending on business logic)
    const updated = await prisma.eventAttendance.update({
      where: { eventId_userId: { eventId, userId } },
      data: { status: 'confirmed' },
    });


    // Remove the most recent 'late' activity log for this user/event
    const lastLate = await prisma.eventNotification.findFirst({
      where: {
        eventId,
        userId,
        type: 'late',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (lastLate) {
      await prisma.eventNotification.delete({ where: { id: lastLate.id } });
    }

    res.json(updated);
  } catch (e) {
    logger.error('Unmark late error:', 'groupChatControllerController', { error: e });
    res.status(500).json({ error: 'Failed to unmark late' });
  }
};

// Group Chat
export const createMessage = async (req: Request, res: Response) => {
  try {
    const { groupId, content } = req.body;
    const userId = req.user.id;
    const message = await prisma.groupMessage.create({
      data: { groupId, userId, content },
      include: { user: { select: { id: true, name: true } } }
    });
    res.status(201).json(message);
  } catch (e) {
    res.status(500).json({ error: 'Failed to send message' });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const messages = await prisma.groupMessage.findMany({
      where: { groupId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true } } }
    });
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// Event Attendance (late)
export const markLate = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.body;
    const userId = req.user.id;

    // Get event to find the organizer
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { creatorId: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const attendance = await prisma.eventAttendance.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { status: 'late' },
      create: { eventId, userId, status: 'late' }
    });

    // Log 'late' activity for the acting user
    // Get event details
    const eventDetails = await prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true }
    });

    if (eventDetails) {
      await prisma.eventNotification.create({
        data: {
          eventId,
          userId,
          type: 'late',
          params: {
            name: req.user.name,
            eventTitle: eventDetails.title
          }
        }
      });
    }

    res.json(attendance);
  } catch (e) {
    logger.error('Mark late error:', 'groupChatControllerController', { error: e });
    res.status(500).json({ error: 'Failed to mark as late' });
  }
};

export const markNotificationsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Check if there are unread notifications first
    const [unreadEventCount, unreadGroupCount] = await Promise.all([
      prisma.eventNotification.count({
        where: { userId, read: false }
      }),
      prisma.groupNotification.count({
        where: { userId, read: false }
      })
    ]);
    
    // Only update if there are unread notifications
    if (unreadEventCount > 0 || unreadGroupCount > 0) {
      await Promise.all([
        unreadEventCount > 0 ? prisma.eventNotification.updateMany({
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
  } catch (e) {
    logger.error('Mark notifications read error:', 'groupChatControllerController', { error: e });
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
};
