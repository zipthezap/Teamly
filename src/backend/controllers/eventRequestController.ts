import prisma from '../config/database';
import { logger } from '../utils/logger';
import { validateVoteThreshold, validateVoteDeadline } from '../services/eventValidation';
import { Request, Response } from 'express';
import * as eventService from '../services/eventService';
import { SportType } from '../../shared/types/event.types';

// Create event request (any group member can create, admins approve)
export const createEventRequest = async (req: Request, res: Response) => {
  try {
    const { 
      groupId, title, description, eventType, location, startTime, endTime, maxPlayers,
      voteDeadline, voteThreshold 
    } = req.body;

    if (!groupId || !title || !eventType || !startTime) {
      return res.status(400).json({ 
        error: 'groupId, title, eventType, and startTime are required' 
      });
    }

    // Sanitize text inputs
    const sanitized = eventService.sanitizeEventData({
      title,
      description,
      eventType,
      location
    });

    // Validate sanitized required fields are not empty
    if (!sanitized.title || !sanitized.eventType) {
      return res.status(400).json({ error: 'Title and event type cannot be empty or whitespace-only' });
    }

    // Validate dates
    const startDate = new Date(startTime);
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'Invalid startTime format' });
    }

    let endDate = null;
    if (endTime) {
      endDate = new Date(endTime);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Invalid endTime format' });
      }
      if (endDate <= startDate) {
        return res.status(400).json({ error: 'endTime must be after startTime' });
      }
    }

    // Validate vote deadline if provided
    let deadlineDate = null;
    if (voteDeadline) {
      const deadlineValidation = validateVoteDeadline(voteDeadline, startTime);
      if (!deadlineValidation.isValid) {
        return res.status(400).json({ error: deadlineValidation.error });
      }
      deadlineDate = new Date(voteDeadline);
    }

    // Validate vote threshold if provided
    let threshold = 0.5; // Default 50%
    if (voteThreshold !== undefined) {
      const thresholdValidation = validateVoteThreshold(voteThreshold);
      if (!thresholdValidation.isValid) {
        return res.status(400).json({ error: thresholdValidation.error });
      }
      threshold = parseFloat(voteThreshold);
    }

    // Check if user is a member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: groupId,
        userId: (req.user as any).id
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only group members can create event requests' });
    }

    const eventRequest = await prisma.eventRequest.create({
      data: {
        groupId,
        creatorId: (req.user as any).id,
        title: sanitized.title!,
        description: sanitized.description,
        eventType: sanitized.eventType!,
        location: sanitized.location,
        startTime: startDate,
        endTime: endDate,
        maxPlayers,
        status: 'voting',
        voteDeadline: deadlineDate,
        voteThreshold: threshold
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        votes: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    res.status(201).json(eventRequest);
  } catch (error) {
    logger.error('Create event request error:', 'eventRequestControllerController', { error });
    res.status(500).json({ error: 'Failed to create event request' });
  }
};

// Get event requests for a group
export const getEventRequests = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;

    // Check if user is member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: groupId,
        userId: (req.user as any).id
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only group members can view event requests' });
    }

    const eventRequests = await prisma.eventRequest.findMany({
      where: {
        groupId: groupId,
        status: 'voting'
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        votes: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        _count: {
          select: { votes: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(eventRequests);
  } catch (error) {
    logger.error('Get event requests error:', 'eventRequestControllerController', { error });
    res.status(500).json({ error: 'Failed to get event requests' });
  }
};

// Get a specific event request
export const getEventRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const eventRequest = await prisma.eventRequest.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        group: {
          select: { id: true, name: true }
        },
        votes: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        _count: {
          select: { votes: true }
        }
      }
    });

    if (!eventRequest) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Check if user is member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: eventRequest.groupId,
        userId: (req.user as any).id
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only group members can view this event request' });
    }

    res.json(eventRequest);
  } catch (error) {
    logger.error('Get event request error:', 'eventRequestControllerController', { error });
    res.status(500).json({ error: 'Failed to get event request' });
  }
};

// Vote on an event request
export const voteOnEventRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vote } = req.body;

    if (!vote || !['yes', 'no'].includes(vote)) {
      return res.status(400).json({ error: 'Vote must be "yes" or "no"' });
    }

    const eventRequest = await prisma.eventRequest.findUnique({
      where: { id },
      select: { 
        groupId: true, 
        status: true,
        voteDeadline: true
      }
    });

    if (!eventRequest) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    if (eventRequest.status !== 'voting') {
      return res.status(400).json({ error: 'This event request is no longer accepting votes' });
    }

    // Check if vote deadline has passed
    if (eventRequest.voteDeadline && new Date() > eventRequest.voteDeadline) {
      return res.status(400).json({ error: 'Vote deadline has passed' });
    }

    // Check if user is member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: eventRequest.groupId,
        userId: (req.user as any).id
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only group members can vote' });
    }

    // Check if user has already voted
    const existingVote = await prisma.eventVote.findFirst({
      where: {
        eventRequestId: id,
        userId: (req.user as any).id
      }
    });

    if (existingVote) {
      // Update existing vote
      const updatedVote = await prisma.eventVote.update({
        where: { id: existingVote.id },
        data: { vote },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      });
      return res.json({ message: 'Vote updated', vote: updatedVote });
    }

    // Create new vote
    const newVote = await prisma.eventVote.create({
      data: {
        eventRequestId: id,
        userId: (req.user as any).id,
        vote
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.status(201).json({ message: 'Vote recorded', vote: newVote });
  } catch (error) {
    logger.error('Vote on event request error:', 'eventRequestControllerController', { error });
    res.status(500).json({ error: 'Failed to vote on event request' });
  }
};

// Finalize event request (admin only) - create actual event
export const finalizeEventRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const eventRequest = await prisma.eventRequest.findUnique({
      where: { id },
      include: {
        votes: true,
        group: {
          include: {
            members: true
          }
        }
      }
    });

    if (!eventRequest) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Check if user is admin of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: eventRequest.groupId,
        userId: (req.user as any).id,
        role: 'admin'
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only admins can finalize event requests' });
    }

    if (eventRequest.status !== 'voting') {
      return res.status(400).json({ error: 'This event request has already been processed' });
    }

    // Count votes
    const yesVotes = eventRequest.votes.filter(v => v.vote === 'yes').length;
    const noVotes = eventRequest.votes.filter(v => v.vote === 'no').length;
    const totalVotes = yesVotes + noVotes;
    
    // Get the vote threshold (default 0.5 = 50%)
    const threshold = eventRequest.voteThreshold || 0.5;
    
    // Calculate required yes votes based on total group members (not just voters)
    // This ensures that a minimum participation is required
    const totalMembers = eventRequest.group.members.length;
    const requiredYesVotes = Math.ceil(totalMembers * threshold);
    
    // Check if there are enough votes and if they meet the threshold
    if (totalVotes === 0) {
      return res.status(400).json({ 
        error: 'Cannot finalize event request with no votes',
        yesVotes,
        noVotes,
        totalVotes,
        totalMembers,
        threshold: threshold * 100,
        requiredYesVotes
      });
    }

    // Event is created only if yes votes meet the threshold
    // Threshold is based on total group members to ensure meaningful participation
    if (yesVotes < requiredYesVotes) {
      // Not enough support, cancel the request
      await prisma.eventRequest.update({
        where: { id },
        data: { status: 'cancelled' }
      });
      
      return res.json({ 
        message: `Event request cancelled: Insufficient support. Required ${requiredYesVotes} yes votes (${(threshold * 100).toFixed(0)}% of ${totalMembers} members), received ${yesVotes} yes votes.`,
        yesVotes,
        noVotes,
        totalVotes,
        totalMembers,
        threshold: threshold * 100,
        requiredYesVotes,
        cancelled: true
      });
    }

    // Create the actual event
    const event = await prisma.event.create({
      data: {
        groupId: eventRequest.groupId,
        creatorId: eventRequest.creatorId,
        title: eventRequest.title,
        description: eventRequest.description,
        eventType: eventRequest.eventType as SportType,
        location: eventRequest.location,
        startTime: eventRequest.startTime,
        endTime: eventRequest.endTime,
        maxPlayers: eventRequest.maxPlayers,
        status: 'upcoming',
        isPublic: false // Events from requests are private to the group
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Update event request status and link to created event
    await prisma.eventRequest.update({
      where: { id },
      data: { 
        status: 'finalized',
        finalizedEventId: event.id
      }
    });

    res.json({ 
      message: 'Event request finalized and event created',
      event,
      yesVotes,
      noVotes,
      totalVotes,
      totalMembers,
      threshold: threshold * 100,
      requiredYesVotes
    });
  } catch (error) {
    logger.error('Finalize event request error:', 'eventRequestControllerController', { error });
    res.status(500).json({ error: 'Failed to finalize event request' });
  }
};

// Cancel event request (admin only)
export const cancelEventRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const eventRequest = await prisma.eventRequest.findUnique({
      where: { id },
      select: { groupId: true, status: true }
    });

    if (!eventRequest) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Check if user is admin of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: eventRequest.groupId,
        userId: (req.user as any).id,
        role: 'admin'
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only admins can cancel event requests' });
    }

    if (eventRequest.status !== 'voting') {
      return res.status(400).json({ error: 'This event request has already been processed' });
    }

    await prisma.eventRequest.update({
      where: { id },
      data: { status: 'cancelled' }
    });

    res.json({ message: 'Event request cancelled' });
  } catch (error) {
    logger.error('Cancel event request error:', 'eventRequestControllerController', { error });
    res.status(500).json({ error: 'Failed to cancel event request' });
  }
};

// Get voting statistics for an event request
export const getEventRequestStatistics = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const eventRequest = await prisma.eventRequest.findUnique({
      where: { id },
      include: {
        votes: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        group: {
          include: {
            members: true
          }
        }
      }
    });

    if (!eventRequest) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Check if user is member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: eventRequest.groupId,
        userId: (req.user as any).id
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only group members can view statistics' });
    }

    const yesVotes = eventRequest.votes.filter(v => v.vote === 'yes').length;
    const noVotes = eventRequest.votes.filter(v => v.vote === 'no').length;
    const totalVotes = yesVotes + noVotes;
    const totalMembers = eventRequest.group.members.length;
    const votedMembers = new Set(eventRequest.votes.map(v => v.userId)).size;
    const notVotedCount = totalMembers - votedMembers;
    
    const threshold = eventRequest.voteThreshold || 0.5;
    // Calculate based on total group members (consistent with finalize logic)
    const requiredYesVotes = Math.ceil(totalMembers * threshold);
    
    const yesPercentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;
    const noPercentage = totalVotes > 0 ? (noVotes / totalVotes) * 100 : 0;
    const participationRate = totalMembers > 0 ? (votedMembers / totalMembers) * 100 : 0;
    
    const meetsThreshold = yesVotes >= requiredYesVotes;
    const isExpired = eventRequest.voteDeadline && new Date() > eventRequest.voteDeadline;
    
    const statistics = {
      eventRequestId: id,
      status: eventRequest.status,
      votes: {
        yes: yesVotes,
        no: noVotes,
        total: totalVotes
      },
      percentages: {
        yes: yesPercentage.toFixed(1),
        no: noPercentage.toFixed(1)
      },
      threshold: {
        value: threshold * 100,
        requiredYesVotes,
        meetsThreshold
      },
      participation: {
        voted: votedMembers,
        notVoted: notVotedCount,
        total: totalMembers,
        rate: participationRate.toFixed(1)
      },
      deadline: {
        date: eventRequest.voteDeadline,
        isExpired
      },
      recentVotes: eventRequest.votes
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map(v => ({
          userId: v.userId,
          userName: v.user.name,
          vote: v.vote,
          timestamp: v.createdAt
        }))
    };

    res.json(statistics);
  } catch (error) {
    logger.error('Get event request statistics error:', 'eventRequestControllerController', { error });
    res.status(500).json({ error: 'Failed to get statistics' });
  }
};

