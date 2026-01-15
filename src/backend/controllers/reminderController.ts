import prisma from '../config/database';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Create a reminder for an event
 * POST /api/events/:eventId/reminders
 */
export const createReminder = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
  const { eventId } = req.params;
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

  // Check if event exists and user is a participant
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
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

  if (!event) {
    throw new NotFoundError('Event not found or you are not a participant');
  }

  // Validate reminder is before event start time
  if (reminderDate >= new Date(event.startTime)) {
    throw new BadRequestError('Reminder time must be before event start time');
  }

  // Check if reminder already exists
  const existingReminder = await prisma.eventReminder.findUnique({
    where: {
      eventId_userId_remindAt: {
        eventId,
        userId,
        remindAt: reminderDate
      }
    }
  });

  if (existingReminder) {
    throw new BadRequestError('A reminder for this time already exists');
  }

  // Create the reminder
  const reminder = await prisma.eventReminder.create({
    data: {
      eventId,
      userId,
      remindAt: reminderDate,
      sent: false
    },
    include: {
      event: {
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
    eventId,
    userId,
    remindAt: reminderDate
  });

  res.status(201).json({
    message: 'Reminder created successfully',
    reminder
  });
});

/**
 * Get all reminders for an event (for current user)
 * GET /api/events/:eventId/reminders
 */
export const getEventReminders = asyncHandler(async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const userId = req.user!.id;

  // Check if user has access to the event
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
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

  if (!event) {
    throw new NotFoundError('Event not found or you are not a participant');
  }

  // Get reminders for this user and event
  const reminders = await prisma.eventReminder.findMany({
    where: {
      eventId,
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

  const whereClause: any = {
    userId,
    event: {
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

  const reminders = await prisma.eventReminder.findMany({
    where: whereClause,
    include: {
      event: {
        select: {
          id: true,
          title: true,
          startTime: true,
          eventType: true,
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
  const reminder = await prisma.eventReminder.findUnique({
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
  await prisma.eventReminder.delete({
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
  const reminder = await prisma.eventReminder.findUnique({
    where: {
      id: reminderId
    },
    include: {
      event: true
    }
  });

  if (!reminder) {
    throw new NotFoundError('Reminder not found');
  }

  if (reminder.userId !== userId) {
    throw new ForbiddenError('You can only update your own reminders');
  }

  // Validate reminder is before event start time
  if (reminderDate >= new Date(reminder.event.startTime)) {
    throw new BadRequestError('Reminder time must be before event start time');
  }

  // Check if a reminder already exists for this new time
  const existingReminder = await prisma.eventReminder.findUnique({
    where: {
      eventId_userId_remindAt: {
        eventId: reminder.eventId,
        userId,
        remindAt: reminderDate
      }
    }
  });

  if (existingReminder && existingReminder.id !== reminderId) {
    throw new BadRequestError('A reminder for this time already exists');
  }

  // Delete old reminder and create new one (due to composite unique constraint on eventId, userId, remindAt)
  // Direct update is not possible when changing remindAt because it's part of the unique constraint
  const [, updatedReminder] = await prisma.$transaction([
    prisma.eventReminder.delete({
      where: { id: reminderId }
    }),
    prisma.eventReminder.create({
      data: {
        eventId: reminder.eventId,
        userId,
        remindAt: reminderDate,
        sent: false
      },
      include: {
        event: {
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
