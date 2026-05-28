import prisma from '../config/database';
import { validateVoteThreshold, validateVoteDeadline } from '../services/sessionValidation';
import { Request, Response } from 'express';
import * as sessionService from '../services/sessionService';
import { SportType } from '../../shared/types/event.types';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';

// Create session request (any group member can create, admins approve)
export const createEventRequest = async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const { 
    groupId, title, description, sessionType, location, startTime, endTime, maxPlayers,
    voteDeadline, voteThreshold 
  } = req.body;

  if (!groupId || !title || !sessionType || !startTime) {
    throw new BadRequestError('groupId, title, sessionType, and startTime are required');
  }

  // Sanitize text inputs
  const sanitized = sessionService.sanitizeSessionData({
    title,
    description,
    sessionType,
    location
  });

  // Validate sanitized required fields are not empty
  if (!sanitized.title || !sanitized.sessionType) {
    throw new BadRequestError('Title and session type cannot be empty or whitespace-only');
  }

  // Validate description length
  if (sanitized.description && sanitized.description.length > 2000) {
    throw new BadRequestError('description must not exceed 2000 characters', 'MAX_LENGTH_EXCEEDED', 'description');
  }

  // Validate dates
  const startDate = new Date(startTime);
  if (isNaN(startDate.getTime())) {
    throw new BadRequestError('Invalid startTime format');
  }

  let endDate = null;
  if (endTime) {
    endDate = new Date(endTime);
    if (isNaN(endDate.getTime())) {
      throw new BadRequestError('Invalid endTime format');
    }
    if (endDate <= startDate) {
      throw new BadRequestError('endTime must be after startTime');
    }
  }

  // Validate vote deadline if provided
  let deadlineDate = null;
  if (voteDeadline) {
    const deadlineValidation = validateVoteDeadline(voteDeadline, startTime);
    if (!deadlineValidation.isValid) {
      throw new BadRequestError(deadlineValidation.error);
    }
    // Ensure voteDeadline is at least 15 minutes in the future
    const deadlineParsed = new Date(voteDeadline);
    const minDeadline = new Date(Date.now() + 15 * 60 * 1000);
    if (deadlineParsed < minDeadline) {
      throw new BadRequestError(
        'voteDeadline must be at least 15 minutes in the future',
        'VOTE_DEADLINE_TOO_SOON',
        'voteDeadline'
      );
    }
    deadlineDate = deadlineParsed;
  }

  // Validate vote threshold if provided
  let threshold = 0.5; // Default 50%
  if (voteThreshold !== undefined) {
    const numericThreshold = Number(voteThreshold);
    if (isNaN(numericThreshold)) {
      throw new BadRequestError('voteThreshold must be a number', 'INVALID_TYPE', 'voteThreshold');
    }
    const thresholdValidation = validateVoteThreshold(numericThreshold);
    if (!thresholdValidation.isValid) {
      throw new BadRequestError(thresholdValidation.error);
    }
    threshold = numericThreshold;
  }

  // Check if user is a member of the group
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: groupId,
      userId: req.user!.id
    }
  });

  if (!membership) {
    throw new ForbiddenError('Only group members can create session requests');
  }

  const eventRequest = await prisma.sessionRequest.create({
    data: {
      groupId,
      creatorId: req.user!.id,
      title: sanitized.title!,
      description: sanitized.description,
      eventType: sanitized.sessionType!,
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
};

// Get session requests for a group
export const getEventRequests = async (req: Request, res: Response) => {
  const { groupId } = req.params;

  // Check if user is member of the group
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: groupId,
      userId: req.user!.id
    }
  });

  if (!membership) {
    throw new ForbiddenError('Only group members can view session requests');
  }

  const eventRequests = await prisma.sessionRequest.findMany({
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
};

// Get a specific session request
export const getEventRequest = async (req: Request, res: Response) => {
  const { id } = req.params;

  const eventRequest = await prisma.sessionRequest.findUnique({
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
    throw new NotFoundError('Event request not found');
  }

  // Check if user is member of the group
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: eventRequest.groupId,
      userId: req.user!.id
    }
  });

  if (!membership) {
    throw new ForbiddenError('Only group members can view this session request');
  }

  res.json(eventRequest);
};

// Vote on an session request
export const voteOnEventRequest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { vote } = req.body;

  if (!vote || !['yes', 'no'].includes(vote)) {
    throw new BadRequestError('Vote must be "yes" or "no"');
  }

  const eventRequest = await prisma.sessionRequest.findUnique({
    where: { id },
    select: { 
      groupId: true, 
      status: true,
      voteDeadline: true
    }
  });

  if (!eventRequest) {
    throw new NotFoundError('Event request not found');
  }

  if (eventRequest.status !== 'voting') {
    throw new BadRequestError('This session request is no longer accepting votes');
  }

  // Check if vote deadline has passed
  if (eventRequest.voteDeadline && new Date() > eventRequest.voteDeadline) {
    throw new BadRequestError('Vote deadline has passed');
  }

  // Check if user is member of the group
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: eventRequest.groupId,
      userId: req.user!.id
    }
  });

  if (!membership) {
    throw new ForbiddenError('Only group members can vote');
  }

  // Check if user has already voted
  const existingVote = await prisma.sessionVote.findFirst({
    where: {
      sessionRequestId: id,
      userId: req.user!.id
    }
  });

  if (existingVote) {
    // Update existing vote
    const updatedVote = await prisma.sessionVote.update({
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
  const newVote = await prisma.sessionVote.create({
    data: {
      sessionRequestId: id,
      userId: req.user!.id,
      vote
    },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      }
    }
  });

  res.status(201).json({ message: 'Vote recorded', vote: newVote });
};

// Finalize session request (admin only) - create actual session
export const finalizeEventRequest = async (req: Request, res: Response) => {
  const { id } = req.params;

  const eventRequest = await prisma.sessionRequest.findUnique({
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
    throw new NotFoundError('Event request not found');
  }

  // Check if user is admin of the group
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: eventRequest.groupId,
      userId: req.user!.id,
      role: 'admin'
    }
  });

  if (!membership) {
    throw new ForbiddenError('Only admins can finalize session requests');
  }

  if (eventRequest.status !== 'voting') {
    throw new BadRequestError('This session request has already been processed');
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
    throw new BadRequestError(
      `Cannot finalize session request with no votes. Yes: ${yesVotes}, No: ${noVotes}, Total: ${totalVotes}, Members: ${totalMembers}, Threshold: ${threshold * 100}%, Required: ${requiredYesVotes}`
    );
  }

  // Event is created only if yes votes meet the threshold
  // Threshold is based on total group members to ensure meaningful participation
  if (yesVotes < requiredYesVotes) {
    // Not enough support, cancel the request
    await prisma.sessionRequest.update({
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

  // Create the actual session
  const session = await prisma.session.create({
    data: {
      groupId: eventRequest.groupId,
      creatorId: eventRequest.creatorId,
      title: eventRequest.title,
      description: eventRequest.description,
      sessionType: eventRequest.eventType as SportType,
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

  // Update session request status and link to created session
  await prisma.sessionRequest.update({
    where: { id },
    data: { 
      status: 'finalized',
      finalizedSessionId: session.id
    }
  });

  res.json({ 
    message: 'Event request finalized and session created',
    session,
    yesVotes,
    noVotes,
    totalVotes,
    totalMembers,
    threshold: threshold * 100,
    requiredYesVotes
  });
};

// Cancel session request (admin only)
export const cancelEventRequest = async (req: Request, res: Response) => {
  const { id } = req.params;

  const eventRequest = await prisma.sessionRequest.findUnique({
    where: { id },
    select: { groupId: true, status: true }
  });

  if (!eventRequest) {
    throw new NotFoundError('Event request not found');
  }

  // Check if user is admin of the group
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: eventRequest.groupId,
      userId: req.user!.id,
      role: 'admin'
    }
  });

  if (!membership) {
    throw new ForbiddenError('Only admins can cancel session requests');
  }

  if (eventRequest.status !== 'voting') {
    throw new BadRequestError('This session request has already been processed');
  }

  await prisma.sessionRequest.update({
    where: { id },
    data: { status: 'cancelled' }
  });

  res.json({ message: 'Event request cancelled' });
};

// Get voting statistics for an session request
export const getEventRequestStatistics = async (req: Request, res: Response) => {
  const { id } = req.params;

  const eventRequest = await prisma.sessionRequest.findUnique({
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
    throw new NotFoundError('Event request not found');
  }

  // Check if user is member of the group
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId: eventRequest.groupId,
      userId: req.user!.id
    }
  });

  if (!membership) {
    throw new ForbiddenError('Only group members can view statistics');
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
    sessionRequestId: id,
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
};

