import prisma from '../config/database';
import { sendEmail, sendBatchEmails } from '../utils/emailService';
import { batchShouldSendEmailNotification } from '../utils/notificationHelper';
import { Request, Response } from 'express';

// Create event request (admin only)
export const createEventRequest = async (req: Request, res: Response) => {
  try {
    const { groupId, title, description, eventType, location, startTime, endTime, maxPlayers } = req.body;

    if (!groupId || !title || !eventType || !startTime) {
      return res.status(400).json({ 
        error: 'groupId, title, eventType, and startTime are required' 
      });
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

    // Check if user is admin of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: groupId,
        userId: req.user.id,
        role: 'admin'
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only admins can create event requests' });
    }

    const eventRequest = await prisma.eventRequest.create({
      data: {
        groupId,
        creatorId: req.user.id,
        title,
        description,
        eventType,
        location,
        startTime: startDate,
        endTime: endDate,
        maxPlayers,
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
        }
      }
    });

    res.status(201).json(eventRequest);
  } catch (error) {
    console.error('Create event request error:', error);
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
        userId: req.user.id
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
    console.error('Get event requests error:', error);
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
        userId: req.user.id
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only group members can view this event request' });
    }

    res.json(eventRequest);
  } catch (error) {
    console.error('Get event request error:', error);
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
      select: { groupId: true, status: true }
    });

    if (!eventRequest) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    if (eventRequest.status !== 'voting') {
      return res.status(400).json({ error: 'This event request is no longer accepting votes' });
    }

    // Check if user is member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: eventRequest.groupId,
        userId: req.user.id
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only group members can vote' });
    }

    // Check if user has already voted
    const existingVote = await prisma.eventVote.findFirst({
      where: {
        eventRequestId: id,
        userId: req.user.id
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
        userId: req.user.id,
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
    console.error('Vote on event request error:', error);
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
        group: true
      }
    });

    if (!eventRequest) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Check if user is admin of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: eventRequest.groupId,
        userId: req.user.id,
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

    // Event is created only if yes votes strictly outnumber no votes
    // Ties and cases where no votes equal or exceed yes votes result in cancellation
    if (yesVotes <= noVotes) {
      // Not enough support or tie, cancel the request
      await prisma.eventRequest.update({
        where: { id },
        data: { status: 'cancelled' }
      });
      
      const reason = yesVotes === noVotes 
        ? 'Event request cancelled due to tie vote' 
        : 'Event request cancelled due to insufficient support';
      
      return res.json({ 
        message: reason,
        yesVotes,
        noVotes
      });
    }

    // Create the actual event
    const event = await prisma.event.create({
      data: {
        groupId: eventRequest.groupId,
        creatorId: eventRequest.creatorId,
        title: eventRequest.title,
        description: eventRequest.description,
        eventType: eventRequest.eventType,
        location: eventRequest.location,
        startTime: eventRequest.startTime,
        endTime: eventRequest.endTime,
        maxPlayers: eventRequest.maxPlayers
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
      noVotes
    });
  } catch (error) {
    console.error('Finalize event request error:', error);
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
        userId: req.user.id,
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
    console.error('Cancel event request error:', error);
    res.status(500).json({ error: 'Failed to cancel event request' });
  }
};

