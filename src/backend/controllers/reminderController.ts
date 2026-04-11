import prisma from '../config/database';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Create a reminder for an session
 * POST /api/events/:sessionId/reminders
 */
export const createReminder = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
  const { sessionId } = req.params;
  const { remindAt } = req.body;
  const userId = req.user!.id;

  if (!remindAt) {
    throw new BadRequestError('Reminder time is required');
  }

  const reminderDate = new Date(remindAt);

  if (isNaN(reminderDate.getTime())) {
    throw new BadRequestError('Invalid reminder time format');
  }

  // Validate reminder date is in the future
  if (reminderDate <= new Date()) {
    throw new BadRequestError('Reminder time must be in the future');
  }

  // Check if session exists and user is a participant
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      OR: [
        {
          participants: {
            some: {
              userId: userId
            }
          }
        },
        {
          creatorId: userId
        }
      ]
    }
  });

  if (!session) {
    throw new NotFoundError('Event not found or you are not a participant');
  }

  // Validate reminder is before session start time
  if (reminderDate >= new Date(session.startTime)) {
    throw new BadRequestError('Reminder time must be before session start time');
  }

  // Check if reminder already exists
  const existingReminder = await prisma.sessionReminder.findUnique({
    where: {
      eventId_userId_remindAt: {
        sessionId,
        userId,
        remindAt: reminderDate
      }
    }
  });

  if (existingReminder) {
    throw new BadRequestError('A reminder for this time already exists');
  }

  // Create the reminder
  const reminder = await prisma.sessionReminder.create({
    data: {
      sessionId,
      userId,
      remindAt: reminderDate,
      sent: false
    },
    include: {
      session: {
        select: {
          id: true,
          title: true,
          startTime: true
        }
      }
    }
  });

  logger.info('Event reminder created', 'ReminderController', {
    reminderId: reminder.id,
    sessionId,
    userId,
    remindAt: reminderDate
  });

  res.status(201).json({
    message: 'Reminder created successfully',
    reminder
  });
});

/**
 * Get all reminders for an session (for current user)
 * GET /api/events/:sessionId/reminders
 */
export const getEventReminders = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const userId = req.user!.id;

  // Check if user has access to the session
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      OR: [
        {
          participants: {
            some: {
              userId: userId
            }
          }
        },
        {
          creatorId: userId
        }
      ]
    }
  });

  if (!session) {
    throw new NotFoundError('Event not found or you are not a participant');
  }

  // Get reminders for this user and session
  const reminders = await prisma.sessionReminder.findMany({
    where: {
      sessionId,
      userId
    },
    orderBy: {
      remindAt: 'asc'
    }
  });

  res.json({
    reminders
  });
});

/**
 * Get all reminders for the current user across all events
 * GET /api/reminders
 */
export const getUserReminders = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { upcoming } = req.query;

  const whereClause: Record<string, unknown> = {
    userId,
    session: {
      status: {
        in: ['upcoming', 'ongoing']
      }
    }
  };

  // Filter to only upcoming reminders if requested
  if (upcoming === 'true') {
    whereClause.remindAt = {
      gte: new Date()
    };
    whereClause.sent = false;
  }

  const reminders = await prisma.sessionReminder.findMany({
    where: whereClause,
    include: {
      session: {
        select: {
          id: true,
          title: true,
          startTime: true,
          sessionType: true,
          location: true
        }
      }
    },
    orderBy: {
      remindAt: 'asc'
    }
  });

  res.json({
    reminders
  });
});

/**
 * Delete a reminder
 * DELETE /api/reminders/:reminderId
 */
export const deleteReminder = asyncHandler(async (req: Request, res: Response) => {
  const { reminderId } = req.params;
  const userId = req.user!.id;

  // Find the reminder and verify ownership
  const reminder = await prisma.sessionReminder.findUnique({
    where: {
      id: reminderId
    }
  });

  if (!reminder) {
    throw new NotFoundError('Reminder not found');
  }

  if (reminder.userId !== userId) {
    throw new ForbiddenError('You can only delete your own reminders');
  }

  // Delete the reminder
  await prisma.sessionReminder.delete({
    where: {
      id: reminderId
    }
  });

  logger.info('Event reminder deleted', 'ReminderController', {
    reminderId,
    userId
  });

  res.json({
    message: 'Reminder deleted successfully'
  });
});

/**
 * Update a reminder time
 * PUT /api/reminders/:reminderId
 */
export const updateReminder = asyncHandler(async (req: Request, res: Response) => {
  const { reminderId } = req.params;
  const { remindAt } = req.body;
  const userId = req.user!.id;

  if (!remindAt) {
    throw new BadRequestError('Reminder time is required');
  }

  const reminderDate = new Date(remindAt);

  // Validate reminder date is in the future
  if (reminderDate <= new Date()) {
    throw new BadRequestError('Reminder time must be in the future');
  }

  // Find the reminder and verify ownership
  const reminder = await prisma.sessionReminder.findUnique({
    where: {
      id: reminderId
    },
    include: {
      session: true
    }
  });

  if (!reminder) {
    throw new NotFoundError('Reminder not found');
  }

  if (reminder.userId !== userId) {
    throw new ForbiddenError('You can only update your own reminders');
  }

  // Validate reminder is before session start time
  if (reminderDate >= new Date(reminder.session.startTime)) {
    throw new BadRequestError('Reminder time must be before session start time');
  }

  // Check if a reminder already exists for this new time
  const existingReminder = await prisma.sessionReminder.findUnique({
    where: {
      eventId_userId_remindAt: {
        sessionId: reminder.sessionId,
        userId,
        remindAt: reminderDate
      }
    }
  });

  if (existingReminder && existingReminder.id !== reminderId) {
    throw new BadRequestError('A reminder for this time already exists');
  }

  // Delete old reminder and create new one (due to composite unique constraint on sessionId, userId, remindAt)
  // Direct update is not possible when changing remindAt because it's part of the unique constraint
  const [, updatedReminder] = await prisma.$transaction([
    prisma.sessionReminder.delete({
      where: { id: reminderId }
    }),
    prisma.sessionReminder.create({
      data: {
        sessionId: reminder.sessionId,
        userId,
        remindAt: reminderDate,
        sent: false
      },
      include: {
        session: {
          select: {
            id: true,
            title: true,
            startTime: true
          }
        }
      }
    })
  ]);

  logger.info('Event reminder updated', 'ReminderController', {
    oldReminderId: reminderId,
    newReminderId: updatedReminder.id,
    userId,
    remindAt: reminderDate
  });

  res.json({
    message: 'Reminder updated successfully',
    reminder: updatedReminder
  });
});
