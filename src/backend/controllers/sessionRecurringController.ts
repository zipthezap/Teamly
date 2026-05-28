/**
 * Event Controller
 * 
 * This controller manages all session-related operations including:
 * - Event CRUD operations (create, read, update, delete, archive, status)
 * - Event participation (join, leave, update status)
 * - Guest participant management
 * - Recurring events management
 * - Event queries (nearby, statistics, activity feed)
 * - Event export functionality
 */

import prisma from '../config/database';
import { generateRecurrenceInstances, calculateDuration, applyDuration } from '../utils/recurrenceService';
import { Request, Response } from 'express';
import * as sessionService from '../services/sessionService';
import { NotFoundError, BadRequestError } from '../utils/errors';

export const getRecurringEventInstances = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { startDate, endDate, limit } = req.query;

  // Get the parent session
  const session = await prisma.session.findFirst({
    where: {
      id,
      group: {
        members: {
          some: {
            userId: req.user!.id
          }
        }
      }
    }
  });

  if (!session) {
    throw new NotFoundError(`Session ${id} not found`);
  }

  if (!session.isRecurring || !session.recurrenceRule) {
    throw new BadRequestError('Session is not recurring');
  }

    // Generate instances
    let start: Date;
    if (startDate instanceof Date) {
      start = startDate;
    } else if (typeof startDate === 'string') {
      start = new Date(startDate);
    } else {
      start = session.startTime;
    }
    // Ensure exceptionDates is defined and parsed
    let exceptionDates: string[] = [];
    if (session.exceptionDates) {
      exceptionDates = Array.isArray(session.exceptionDates)
        ? session.exceptionDates
        : JSON.parse(JSON.stringify(session.exceptionDates));
    }
    // Ensure endDate is a Date
    let end: Date;
    if (endDate instanceof Date) {
      end = endDate;
    } else if (typeof endDate === 'string') {
      end = new Date(endDate);
    } else {
      end = session.recurrenceEnd;
    }
    const instances = generateRecurrenceInstances(
      start,
      session.recurrenceRule,
      end,
      exceptionDates,
      limit ? parseInt(limit as string) : 100
    );

    // Calculate duration if endTime exists
    const duration = calculateDuration(session.startTime, session.endTime);

    // Map instances to session objects
    const eventInstances = instances.map(instanceDate => ({
      ...session,
      id: `${session.id}-${instanceDate.toISOString()}`,
      startTime: instanceDate,
      endTime: duration ? applyDuration(instanceDate, duration) : null,
      parentSessionId: session.id,
      isInstance: true
    }));

    res.json(eventInstances);
};

// Add exception date to recurring session
export const addRecurringEventException = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { exceptionDate } = req.body;

  if (!exceptionDate) {
    throw new BadRequestError('Exception date is required');
  }

  // Check if user is the creator of the session or a group admin
  const session = await prisma.session.findUnique({
    where: { id }
  });

  if (!session) {
    throw new NotFoundError(`Session ${id} not found`);
  }

  // Check if user has permission to manage this session
  const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
  if (!isAuthorized) {
    throw new BadRequestError('Only the session creator or group admins can add exceptions');
  }

  if (!session.isRecurring) {
    throw new BadRequestError('Session is not recurring');
  }

  // Get existing exceptions
  const existingExceptions = Array.isArray(session.exceptionDates) 
    ? [...session.exceptionDates] 
    : [];

  // Add new exception if not already present
  const exceptionDateISO = new Date(exceptionDate).toISOString();
  if (!existingExceptions.some((d: string) => new Date(d).toISOString() === exceptionDateISO)) {
    existingExceptions.push(exceptionDateISO);
  }

  // Update session with new exceptions
  const updatedSession = await prisma.session.update({
    where: { id },
    data: {
      exceptionDates: existingExceptions
    }
  });

  res.json(updatedSession);
};

// Remove exception date from recurring session
export const removeRecurringEventException = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { exceptionDate } = req.body;

  if (!exceptionDate) {
    throw new BadRequestError('Exception date is required');
  }

  // Check if user is the creator of the session or a group admin
  const session = await prisma.session.findUnique({
    where: { id }
  });

  if (!session) {
    throw new NotFoundError(`Session ${id} not found`);
  }

  // Check if user has permission to manage this session
  const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
  if (!isAuthorized) {
    throw new BadRequestError('Only the session creator or group admins can remove exceptions');
  }

  // Get existing exceptions
  const existingExceptions = session.exceptionDates 
    ? JSON.parse(JSON.stringify(session.exceptionDates))
    : [];

  // Remove exception
  const updatedExceptions = existingExceptions.filter(
    (d: string | Date) => new Date(d).toISOString() !== new Date(exceptionDate).toISOString()
  );

  const updatedSession = await prisma.session.update({
    where: { id },
    data: {
      exceptionDates: updatedExceptions
    }
  });

  res.json(updatedSession);
};

// ==================== EVENT QUERIES & ANALYTICS ====================

// Get user session statistics
