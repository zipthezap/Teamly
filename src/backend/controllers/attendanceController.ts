import prisma from '../config/database';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Mark attendance for an event participant
 * POST /api/events/:eventId/attendance
 */
export const markAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const { userId, status } = req.body;
  const currentUserId = (req.user as any).id;

  if (!status || !['on-time', 'late'].includes(status)) {
    throw new BadRequestError('Status must be either "on-time" or "late"');
  }

  // If userId is not provided, mark attendance for current user
  const targetUserId = userId || currentUserId;

  // Check if event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      participants: {
        where: { userId: targetUserId }
      }
    }
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Check if target user is a participant
  if (event.participants.length === 0) {
    throw new BadRequestError('User is not a participant of this event');
  }

  // Only event creator or the participant themselves can mark attendance
  const isCreator = event.creatorId === currentUserId;
  const isSelf = targetUserId === currentUserId;

  if (!isCreator && !isSelf) {
    throw new ForbiddenError('Only event creator or the participant can mark attendance');
  }

  // Check if event has started (can only mark attendance for ongoing or completed events)
  const now = new Date();
  const eventStartTime = new Date(event.startTime);

  if (eventStartTime > now) {
    throw new BadRequestError('Cannot mark attendance for events that have not started yet');
  }

  // Create or update attendance record
  const attendance = await prisma.eventAttendance.upsert({
    where: {
      eventId_userId: {
        eventId,
        userId: targetUserId
      }
    },
    create: {
      eventId,
      userId: targetUserId,
      status
    },
    update: {
      status
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  // Create notification if marked as late
  if (status === 'late') {
    await prisma.eventNotification.create({
      data: {
        eventId,
        userId: targetUserId,
        type: 'late',
        params: {
          name: attendance.user.name,
          eventTitle: event.title
        }
      }
    });
  }

  logger.info('Event attendance marked', 'AttendanceController', {
    attendanceId: attendance.id,
    eventId,
    userId: targetUserId,
    status,
    markedBy: currentUserId
  });

  res.json({
    message: 'Attendance marked successfully',
    attendance
  });
});

/**
 * Get attendance records for an event
 * GET /api/events/:eventId/attendance
 */
export const getEventAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const userId = (req.user as any).id;

  // Check if user has access to the event
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      group: {
        members: {
          some: {
            userId: userId
          }
        }
      }
    }
  });

  if (!event) {
    throw new NotFoundError('Event not found or access denied');
  }

  // Get all attendance records for the event
  const attendanceRecords = await prisma.eventAttendance.findMany({
    where: {
      eventId
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
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  res.json({
    attendance: attendanceRecords
  });
});

/**
 * Get attendance statistics for an event
 * GET /api/events/:eventId/attendance/stats
 */
export const getAttendanceStats = asyncHandler(async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const userId = (req.user as any).id;

  // Check if user has access to the event
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      group: {
        members: {
          some: {
            userId: userId
          }
        }
      }
    },
    include: {
      _count: {
        select: {
          participants: true
        }
      }
    }
  });

  if (!event) {
    throw new NotFoundError('Event not found or access denied');
  }

  // Get attendance counts
  const onTimeCount = await prisma.eventAttendance.count({
    where: {
      eventId,
      status: 'on-time'
    }
  });

  const lateCount = await prisma.eventAttendance.count({
    where: {
      eventId,
      status: 'late'
    }
  });

  const totalParticipants = event._count.participants;
  const noShowCount = totalParticipants - onTimeCount - lateCount;

  res.json({
    stats: {
      totalParticipants,
      onTime: onTimeCount,
      late: lateCount,
      noShow: noShowCount,
      attendanceRate: totalParticipants > 0 ? ((onTimeCount + lateCount) / totalParticipants * 100).toFixed(1) : '0.0'
    }
  });
});

/**
 * Delete attendance record
 * DELETE /api/events/:eventId/attendance/:userId
 */
export const deleteAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { eventId, userId: targetUserId } = req.params;
  const currentUserId = (req.user as any).id;

  // Find the event
  const event = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Only event creator can delete attendance records
  if (event.creatorId !== currentUserId) {
    throw new ForbiddenError('Only event creator can delete attendance records');
  }

  // Find and delete the attendance record
  const attendance = await prisma.eventAttendance.findUnique({
    where: {
      eventId_userId: {
        eventId,
        userId: targetUserId
      }
    }
  });

  if (!attendance) {
    throw new NotFoundError('Attendance record not found');
  }

  await prisma.eventAttendance.delete({
    where: {
      eventId_userId: {
        eventId,
        userId: targetUserId
      }
    }
  });

  logger.info('Event attendance deleted', 'AttendanceController', {
    eventId,
    userId: targetUserId,
    deletedBy: currentUserId
  });

  res.json({
    message: 'Attendance record deleted successfully'
  });
});
