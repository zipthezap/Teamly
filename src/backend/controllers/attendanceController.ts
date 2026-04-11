import prisma from '../config/database';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';

const ATTENDANCE_STATUS_MAP = {
  'on-time': 'on_time',
  late: 'late'
} as const;

type AttendanceStatusInput = keyof typeof ATTENDANCE_STATUS_MAP;

function isAttendanceStatusInput(status: unknown): status is AttendanceStatusInput {
  return typeof status === 'string' && status in ATTENDANCE_STATUS_MAP;
}

/**
 * Mark attendance for an session participant
 * POST /api/events/:sessionId/attendance
 */
export const markAttendance = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
  const { sessionId } = req.params;
  const { userId, status } = req.body;
  const currentUserId = req.user!.id;

  if (!isAttendanceStatusInput(status)) {
    throw new BadRequestError('Status must be either "on-time" or "late"');
  }

  const prismaStatus = ATTENDANCE_STATUS_MAP[status];

  // If userId is not provided, mark attendance for current user
  const targetUserId = userId || currentUserId;

  // Check if session exists
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      title: true,
      creatorId: true,
      startTime: true,
      participants: {
        where: { userId: targetUserId }
      }
    }
  });

  if (!session) {
    throw new NotFoundError('Event not found');
  }

  // Check if target user is a participant
  if (session.participants.length === 0) {
    throw new BadRequestError('User is not a participant of this session');
  }

  // Only session creator or the participant themselves can mark attendance
  const isCreator = session.creatorId === currentUserId;
  const isSelf = targetUserId === currentUserId;

  if (!isCreator && !isSelf) {
    throw new ForbiddenError('Only session creator or the participant can mark attendance');
  }

  // Check if session has started (can only mark attendance for ongoing or completed events)
  const now = new Date();
  const eventStartTime = new Date(session.startTime);

  if (eventStartTime > now) {
    throw new BadRequestError('Cannot mark attendance for events that have not started yet');
  }

  // Create or update attendance record
  const attendance = await prisma.sessionAttendance.upsert({
    where: {
      eventId_userId: {
        sessionId,
        userId: targetUserId
      }
    },
    create: {
      sessionId,
      userId: targetUserId,
      status: prismaStatus
    },
    update: {
      status: prismaStatus
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
  if (prismaStatus === 'late') {
    await prisma.sessionNotification.create({
      data: {
        sessionId,
        userId: targetUserId,
        type: 'late',
        params: {
          name: attendance.user.name,
          eventTitle: session.title
        }
      }
    });
  }

  logger.info('Event attendance marked', 'AttendanceController', {
    attendanceId: attendance.id,
    sessionId,
    userId: targetUserId,
    status: prismaStatus,
    markedBy: currentUserId
  });

  res.json({
    message: 'Attendance marked successfully',
    attendance
  });
});

/**
 * Get attendance records for an session
 * GET /api/events/:sessionId/attendance
 */
export const getEventAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const userId = req.user!.id;

  // Check if user has access to the session
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      group: {
        members: {
          some: {
            userId: userId
          }
        }
      }
    }
  });

  if (!session) {
    throw new NotFoundError('Event not found or access denied');
  }

  // Get all attendance records for the session
  const attendanceRecords = await prisma.sessionAttendance.findMany({
    where: {
      sessionId
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
 * Get attendance statistics for an session
 * GET /api/events/:sessionId/attendance/stats
 */
export const getAttendanceStats = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const userId = req.user!.id;

  // Check if user has access to the session
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
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

  if (!session) {
    throw new NotFoundError('Event not found or access denied');
  }

  // Get attendance counts
  const onTimeCount = await prisma.sessionAttendance.count({
    where: {
      sessionId,
      status: 'on_time'
    }
  });

  const lateCount = await prisma.sessionAttendance.count({
    where: {
      sessionId,
      status: 'late'
    }
  });

  const totalParticipants = session._count.participants;
  const noShowCount = totalParticipants - onTimeCount - lateCount;

  res.json({
    stats: {
      totalParticipants,
      onTime: onTimeCount,
      late: lateCount,
      noShow: noShowCount,
      attendanceRate: totalParticipants > 0 ? parseFloat(((onTimeCount + lateCount) / totalParticipants * 100).toFixed(1)) : 0
    }
  });
});

/**
 * Delete attendance record
 * DELETE /api/events/:sessionId/attendance/:userId
 */
export const deleteAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, userId: targetUserId } = req.params;
  const currentUserId = req.user!.id;

  // Find the session
  const session = await prisma.session.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new NotFoundError('Event not found');
  }

  // Only session creator can delete attendance records
  if (session.creatorId !== currentUserId) {
    throw new ForbiddenError('Only session creator can delete attendance records');
  }

  // Find and delete the attendance record
  const attendance = await prisma.sessionAttendance.findUnique({
    where: {
      eventId_userId: {
        sessionId,
        userId: targetUserId
      }
    }
  });

  if (!attendance) {
    throw new NotFoundError('Attendance record not found');
  }

  await prisma.sessionAttendance.delete({
    where: {
      eventId_userId: {
        sessionId,
        userId: targetUserId
      }
    }
  });

  logger.info('Event attendance deleted', 'AttendanceController', {
    sessionId,
    userId: targetUserId,
    deletedBy: currentUserId
  });

  res.json({
    message: 'Attendance record deleted successfully'
  });
});
