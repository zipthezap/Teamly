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
import { logger } from '../utils/logger';
import { Request, Response } from 'express';
import { TRANSACTION } from '../config/security';
import { SessionParticipantStatus, GuestParticipantStatus, SessionNotificationType } from '../../shared/types/event.types';
import { isPrismaUniqueError } from '../utils/typeGuards';
import { CacheService } from '../services/cacheService';
import { NotificationFactory } from '../services/notificationFactory';

export const joinEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Use a transaction with serializable isolation to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Lock the session row for update to prevent concurrent modifications
      const session = await tx.session.findFirst({
        where: {
          id,
          group: {
            members: {
              some: {
                userId: req.user!.id
              }
            }
          }
        },
        include: {
          participants: {
            where: { status: 'confirmed' }
          }
        }
      });

      if (!session) {
        throw new Error('EVENT_NOT_FOUND');
      }

      // Check if already joined (database constraint will also catch this)
      const existingParticipant = await tx.sessionParticipant.findUnique({
        where: {
          sessionId_userId: {
            sessionId: id,
            userId: req.user!.id
          }
        }
      });

      if (existingParticipant) {
        throw new Error('ALREADY_JOINED');
      }

      // Check max players with accurate count
      if (session.maxPlayers) {
        const confirmedCount = session.participants.length;
        
        // Also count confirmed guest participants
        const guestCount = await tx.guestParticipant.count({
          where: {
            sessionId: id,
            status: GuestParticipantStatus.confirmed
          }
        });

        const totalConfirmed = confirmedCount + guestCount;
        
        if (totalConfirmed >= session.maxPlayers) {
          // Add to waitlist instead of rejecting
          const waitlistParticipant = await tx.sessionParticipant.create({
            data: {
              sessionId: id,
              userId: req.user!.id,
              status: 'waitlisted'
            }
          });
          return { participant: waitlistParticipant, eventTitle: session.title, groupId: session.groupId, waitlisted: true };
        }
      }

      // Create participant
      const participant = await tx.sessionParticipant.create({
        data: {
          sessionId: id,
          userId: req.user!.id,
          status: 'confirmed'
        }
      });

      // Log activity for the user who joined using NotificationFactory
      await NotificationFactory.createSessionNotifications(
        {
          sessionId: id,
          type: SessionNotificationType.join,
          userIds: [req.user!.id],
          params: {
            name: req.user!.name,
            eventTitle: session.title
          },
          metadata: {
            sessionType: session.sessionType,
            eventStartTime: session.startTime,
            groupId: session.groupId,
            participantCount: await tx.sessionParticipant.count({
              where: { sessionId: id, status: 'confirmed' }
            }),
            maxPlayers: session.maxPlayers
          },
          checkMutePreference: false // User joining their own session
        },
        tx
      );

      return { participant, eventTitle: session.title, groupId: session.groupId, waitlisted: false };
    }, {
      isolationLevel: 'Serializable', // Highest isolation level to prevent race conditions
      maxWait: TRANSACTION.MAX_WAIT_MS,
      timeout: TRANSACTION.TIMEOUT_MS
    });

    // Invalidate events cache for all group members
    await CacheService.deletePattern(`sessions:user:*:group:${result.groupId}:*`);
    await CacheService.deletePattern(`sessions:user:*:group:all:*`);

    const status = result.waitlisted ? 202 : 201;
    res.status(status).json({
      ...result.participant,
      waitlisted: result.waitlisted,
      message: result.waitlisted
        ? 'Event is full. You have been added to the waitlist.'
        : 'Successfully joined the session.',
    });
  } catch (error: unknown) {
    logger.error('Join session error', 'EventController', { error });
    
    // Handle specific error cases
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage === 'EVENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (errorMessage === 'ALREADY_JOINED') {
      return res.status(400).json({ error: 'Already joined this session' });
    }
    
    // Handle unique constraint violations
    if (isPrismaUniqueError(error)) {
      return res.status(400).json({ error: 'Already joined this session' });
    }
    
    return res.status(500).json({ error: 'Failed to join session' });
  }
};
export const leaveEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Use a transaction with serializable isolation to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Get session details
      const session = await tx.session.findUnique({
        where: { id },
        select: { 
          creatorId: true,
          title: true, 
          sessionType: true, 
          startTime: true,
          groupId: true 
        }
      });

      if (!session) {
        throw new Error('EVENT_NOT_FOUND');
      }

      const participant = await tx.sessionParticipant.findFirst({
        where: {
          sessionId: id,
          userId: req.user!.id
        }
      });

      if (!participant) {
        throw new Error('NOT_PARTICIPATING');
      }

      // Delete participant and attendance records sequentially for proper transaction handling
      await tx.sessionParticipant.delete({
        where: { id: participant.id }
      });
      
      // Also delete the attendance record (late status) when leaving
      await tx.sessionAttendance.deleteMany({
        where: {
          sessionId: id,
          userId: req.user!.id
        }
      });

      // Promote first waitlisted participant if a spot opened up
      let promotedUserId: string | undefined;
      const eventWithMax = await tx.session.findUnique({
        where: { id },
        select: { maxPlayers: true, title: true }
      });
      if (eventWithMax?.maxPlayers && participant.status === 'confirmed') {
        const firstWaitlisted = await tx.sessionParticipant.findFirst({
          where: { sessionId: id, status: 'waitlisted' },
          orderBy: { joinedAt: 'asc' },
        });
        if (firstWaitlisted) {
          await tx.sessionParticipant.update({
            where: { id: firstWaitlisted.id },
            data: { status: 'confirmed' },
          });
          promotedUserId = firstWaitlisted.userId;
        }
      }

      // Log activity for the user who left using NotificationFactory
      await NotificationFactory.createSessionNotifications(
        {
          sessionId: id,
          type: SessionNotificationType.leave,
          userIds: [req.user!.id],
          params: {
            name: req.user!.name,
            eventTitle: session.title
          },
          metadata: {
            sessionType: session.sessionType,
            eventStartTime: session.startTime,
            groupId: session.groupId
          },
          checkMutePreference: false // User leaving their own session
        },
        tx
      );

      return { groupId: session.groupId, promotedUserId, eventTitle: session.title };
    }, {
      isolationLevel: 'Serializable',
      maxWait: TRANSACTION.MAX_WAIT_MS,
      timeout: TRANSACTION.TIMEOUT_MS
    });

    // Invalidate events cache for all group members
    await CacheService.deletePattern(`sessions:user:*:group:${result.groupId}:*`);
    await CacheService.deletePattern(`sessions:user:*:group:all:*`);

    // Notify the promoted waitlisted user (non-blocking)
    if (result.promotedUserId) {
      NotificationFactory.createSessionNotifications({
        sessionId: id,
        type: SessionNotificationType.confirmed,
        userIds: [result.promotedUserId],
        params: { eventTitle: result.eventTitle },
        metadata: { promotedFromWaitlist: true },
        checkMutePreference: true,
      }).catch(err => logger.error('Failed to notify promoted waitlist user', 'EventController', { error: err }));
    }

    res.json({ message: 'Left session successfully' });
  } catch (error: unknown) {
    logger.error('Failed to leave session', 'EventController', { error });
    
    // Handle specific error cases
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage === 'EVENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (errorMessage === 'NOT_PARTICIPATING') {
      return res.status(404).json({ error: 'Not participating in this session' });
    }
    
    return res.status(500).json({ error: 'Failed to leave session' });
  }
};
export const updateParticipationStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status using enum – only statuses a participant may set themselves
    const selfAssignableStatuses: SessionParticipantStatus[] = [
      SessionParticipantStatus.confirmed,
      SessionParticipantStatus.declined,
      SessionParticipantStatus.pending,
    ];
    if (!status || !selfAssignableStatuses.includes(status as SessionParticipantStatus)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${selfAssignableStatuses.join(', ')}` 
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const participant = await tx.sessionParticipant.findFirst({
        where: {
          sessionId: id,
          userId: req.user!.id
        }
      });

      if (!participant) {
        return null;
      }

      const updated = await tx.sessionParticipant.update({
        where: { id: participant.id },
        data: { status }
      });

      return { updated, previousStatus: participant.status };
    });

    if (!result) {
      return res.status(404).json({ error: 'Not participating in this session' });
    }

    const { updated: updatedParticipant, previousStatus } = result;

    // Log activity for the user who updated their status (only for confirmed/declined)
    if (status === 'confirmed' || status === 'declined') {
      // Get the session details
      const statusEvent = await prisma.session.findUnique({
        where: { id },
        select: { 
          title: true,
          sessionType: true,
          startTime: true,
          groupId: true
        }
      });

      if (statusEvent) {
        await NotificationFactory.createSessionNotifications({
          sessionId: id,
          type: status,
          userIds: [req.user!.id],
          params: {
            name: req.user!.name,
            eventTitle: statusEvent.title
          },
          metadata: {
            sessionType: statusEvent.sessionType,
            eventStartTime: statusEvent.startTime,
            groupId: statusEvent.groupId,
            previousStatus: previousStatus
          },
          checkMutePreference: false // User updating their own status
        });

        // Invalidate events cache when status changes
        await CacheService.deletePattern(`sessions:user:*:group:${statusEvent.groupId}:*`);
        await CacheService.deletePattern(`sessions:user:*:group:all:*`);
      }
    }

    res.json(updatedParticipant);
  } catch (error) {
    logger.error('Update participation status error', 'EventController', { error });
    return res.status(500).json({ error: 'Failed to update participation status' });
  }
};

// ==================== RECURRING EVENTS MANAGEMENT ====================

// Get recurring session instances
