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
import { logger } from '../utils/logger';
import { Request, Response } from 'express';
import * as sessionService from '../services/sessionService';

export const getRecurringEventInstances = async (req: Request, res: Response) => {
  try {
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
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!session.isRecurring || !session.recurrenceRule) {
      return res.status(400).json({ error: 'Event is not recurring' });
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
  } catch (error) {
    logger.error('Failed to get recurring session instances', 'EventController', { error });
    return res.status(500).json({ error: 'Failed to get recurring session instances' });
  }
};

// Add exception date to recurring session
export const addRecurringEventException = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { exceptionDate } = req.body;

    if (!exceptionDate) {
      return res.status(400).json({ error: 'Exception date is required' });
    }

    // Check if user is the creator of the session or a group admin
    const session = await prisma.session.findUnique({
      where: { id }
    });

    if (!session) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user has permission to manage this session
    const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the session creator or group admins can add exceptions' });
    }

    if (!session.isRecurring) {
      return res.status(400).json({ error: 'Event is not recurring' });
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
  } catch (error) {
    logger.error('Add recurring session exception error', 'EventController', { error });
    return res.status(500).json({ error: 'Failed to add exception' });
  }
};

// Remove exception date from recurring session
export const removeRecurringEventException = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { exceptionDate } = req.body;

    if (!exceptionDate) {
      return res.status(400).json({ error: 'Exception date is required' });
    }

    // Check if user is the creator of the session or a group admin
    const session = await prisma.session.findUnique({
      where: { id }
    });

    if (!session) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user has permission to manage this session
    const { isAuthorized } = await sessionService.checkSessionManagementPermission(session, req.user!.id);
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Only the session creator or group admins can remove exceptions' });
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
  } catch (error) {
    logger.error('Failed to remove recurring session exception', 'EventController', { error });
    return res.status(500).json({ error: 'Failed to remove exception' });
  }
};

// ==================== EVENT QUERIES & ANALYTICS ====================

// Get user session statistics
