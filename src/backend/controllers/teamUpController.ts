import prisma from '../config/database';
import { logger } from '../utils/logger';
import { Request, Response } from 'express';

// Create a TeamUp request
export const createTeamUpRequest = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      sportType,
      location,
      latitude,
      longitude,
      locationName,
      city,
      country,
      dateTime,
      playersNeeded,
      skillLevel
    } = req.body;

    if (!title || !sportType || !dateTime) {
      return res.status(400).json({
        error: 'title, sportType, and dateTime are required'
      });
    }

    // Validate dateTime
    const eventDate = new Date(dateTime);
    if (isNaN(eventDate.getTime())) {
      return res.status(400).json({ error: 'Invalid dateTime format' });
    }

    // Check if dateTime is in the future
    if (eventDate <= new Date()) {
      return res.status(400).json({ error: 'dateTime must be in the future' });
    }

    // Validate playersNeeded if provided
    const players = playersNeeded ? parseInt(playersNeeded) : 1;
    if (players < 1) {
      return res.status(400).json({ error: 'playersNeeded must be at least 1' });
    }

    // Set expiration to 1 hour after the event time
    const expiresAt = new Date(eventDate.getTime() + 60 * 60 * 1000);

    const teamUpRequest = await prisma.teamUpRequest.create({
      data: {
        creatorId: req.user.id,
        title,
        description,
        sportType,
        location,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        locationName,
        city,
        country,
        dateTime: eventDate,
        playersNeeded: players,
        skillLevel,
        status: 'open',
        expiresAt
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            city: true,
            country: true,
            profilePicture: true
          }
        },
        _count: {
          select: { responses: true }
        }
      }
    });

    res.status(201).json(teamUpRequest);
  } catch (error) {
    logger.error('Create TeamUp request error:', 'teamUpController', { error });
    res.status(500).json({ error: 'Failed to create TeamUp request' });
  }
};

// Get all TeamUp requests (browse with filters)
export const getTeamUpRequests = async (req: Request, res: Response) => {
  try {
    const {
      sportType,
      city,
      country,
      skillLevel,
      status = 'open',
      limit = 50,
      offset = 0
    } = req.query;

    const where: any = {
      status: status as string
    };

    if (sportType) {
      where.sportType = sportType as string;
    }

    if (city) {
      where.city = city as string;
    }

    if (country) {
      where.country = country as string;
    }

    if (skillLevel) {
      where.skillLevel = skillLevel as string;
    }

    // Only show future events
    where.dateTime = {
      gte: new Date()
    };

    const teamUpRequests = await prisma.teamUpRequest.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            city: true,
            country: true,
            profilePicture: true
          }
        },
        responses: {
          where: {
            status: 'accepted'
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profilePicture: true
              }
            }
          }
        },
        _count: {
          select: { responses: true }
        }
      },
      orderBy: { dateTime: 'asc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    res.json(teamUpRequests);
  } catch (error) {
    logger.error('Get TeamUp requests error:', 'teamUpController', { error });
    res.status(500).json({ error: 'Failed to get TeamUp requests' });
  }
};

// Get user's own TeamUp requests
export const getMyTeamUpRequests = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    const where: any = {
      creatorId: req.user.id
    };

    if (status) {
      where.status = status as string;
    }

    const teamUpRequests = await prisma.teamUpRequest.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            city: true,
            country: true,
            profilePicture: true
          }
        },
        responses: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profilePicture: true
              }
            }
          }
        },
        _count: {
          select: { responses: true }
        }
      },
      orderBy: { dateTime: 'asc' }
    });

    res.json(teamUpRequests);
  } catch (error) {
    logger.error('Get my TeamUp requests error:', 'teamUpController', { error });
    res.status(500).json({ error: 'Failed to get TeamUp requests' });
  }
};

// Get a specific TeamUp request
export const getTeamUpRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const teamUpRequest = await prisma.teamUpRequest.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            city: true,
            country: true,
            profilePicture: true
          }
        },
        responses: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profilePicture: true
              }
            }
          }
        },
        _count: {
          select: { responses: true }
        }
      }
    });

    if (!teamUpRequest) {
      return res.status(404).json({ error: 'TeamUp request not found' });
    }

    res.json(teamUpRequest);
  } catch (error) {
    logger.error('Get TeamUp request error:', 'teamUpController', { error });
    res.status(500).json({ error: 'Failed to get TeamUp request' });
  }
};

// Update a TeamUp request
export const updateTeamUpRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      sportType,
      location,
      latitude,
      longitude,
      locationName,
      city,
      country,
      dateTime,
      playersNeeded,
      skillLevel,
      status
    } = req.body;

    const teamUpRequest = await prisma.teamUpRequest.findUnique({
      where: { id },
      select: { creatorId: true }
    });

    if (!teamUpRequest) {
      return res.status(404).json({ error: 'TeamUp request not found' });
    }

    if (teamUpRequest.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator can update this request' });
    }

    const updateData: any = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (sportType !== undefined) updateData.sportType = sportType;
    if (location !== undefined) updateData.location = location;
    if (latitude !== undefined) updateData.latitude = parseFloat(latitude);
    if (longitude !== undefined) updateData.longitude = parseFloat(longitude);
    if (locationName !== undefined) updateData.locationName = locationName;
    if (city !== undefined) updateData.city = city;
    if (country !== undefined) updateData.country = country;
    if (skillLevel !== undefined) updateData.skillLevel = skillLevel;
    if (status !== undefined) updateData.status = status;

    if (dateTime !== undefined) {
      const eventDate = new Date(dateTime);
      if (isNaN(eventDate.getTime())) {
        return res.status(400).json({ error: 'Invalid dateTime format' });
      }
      if (eventDate <= new Date()) {
        return res.status(400).json({ error: 'dateTime must be in the future' });
      }
      updateData.dateTime = eventDate;
      updateData.expiresAt = new Date(eventDate.getTime() + 60 * 60 * 1000);
    }

    if (playersNeeded !== undefined) {
      const players = parseInt(playersNeeded);
      if (players < 1) {
        return res.status(400).json({ error: 'playersNeeded must be at least 1' });
      }
      updateData.playersNeeded = players;
    }

    const updated = await prisma.teamUpRequest.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            city: true,
            country: true,
            profilePicture: true
          }
        },
        responses: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profilePicture: true
              }
            }
          }
        },
        _count: {
          select: { responses: true }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    logger.error('Update TeamUp request error:', 'teamUpController', { error });
    res.status(500).json({ error: 'Failed to update TeamUp request' });
  }
};

// Delete a TeamUp request
export const deleteTeamUpRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const teamUpRequest = await prisma.teamUpRequest.findUnique({
      where: { id },
      select: { creatorId: true }
    });

    if (!teamUpRequest) {
      return res.status(404).json({ error: 'TeamUp request not found' });
    }

    if (teamUpRequest.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator can delete this request' });
    }

    await prisma.teamUpRequest.delete({
      where: { id }
    });

    res.json({ message: 'TeamUp request deleted' });
  } catch (error) {
    logger.error('Delete TeamUp request error:', 'teamUpController', { error });
    res.status(500).json({ error: 'Failed to delete TeamUp request' });
  }
};

// Respond to a TeamUp request
export const respondToTeamUpRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const teamUpRequest = await prisma.teamUpRequest.findUnique({
      where: { id },
      select: { status: true, creatorId: true }
    });

    if (!teamUpRequest) {
      return res.status(404).json({ error: 'TeamUp request not found' });
    }

    if (teamUpRequest.status !== 'open') {
      return res.status(400).json({ error: 'This TeamUp request is no longer accepting responses' });
    }

    if (teamUpRequest.creatorId === req.user.id) {
      return res.status(400).json({ error: 'You cannot respond to your own TeamUp request' });
    }

    // Check if user has already responded
    const existingResponse = await prisma.teamUpResponse.findFirst({
      where: {
        teamUpRequestId: id,
        userId: req.user.id
      }
    });

    if (existingResponse) {
      return res.status(400).json({ error: 'You have already responded to this request' });
    }

    const response = await prisma.teamUpResponse.create({
      data: {
        teamUpRequestId: id,
        userId: req.user.id,
        message,
        status: 'pending'
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
      }
    });

    res.status(201).json({ message: 'Response submitted', response });
  } catch (error) {
    logger.error('Respond to TeamUp request error:', 'teamUpController', { error });
    res.status(500).json({ error: 'Failed to respond to TeamUp request' });
  }
};

// Accept or decline a response (creator only)
export const handleTeamUpResponse = async (req: Request, res: Response) => {
  try {
    const { id, responseId } = req.params;
    const { action } = req.body;

    if (!action || !['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "accept" or "decline"' });
    }

    const teamUpRequest = await prisma.teamUpRequest.findUnique({
      where: { id },
      select: { creatorId: true }
    });

    if (!teamUpRequest) {
      return res.status(404).json({ error: 'TeamUp request not found' });
    }

    if (teamUpRequest.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator can manage responses' });
    }

    const response = await prisma.teamUpResponse.findUnique({
      where: { id: responseId }
    });

    if (!response) {
      return res.status(404).json({ error: 'Response not found' });
    }

    if (response.teamUpRequestId !== id) {
      return res.status(400).json({ error: 'Response does not belong to this TeamUp request' });
    }

    const updated = await prisma.teamUpResponse.update({
      where: { id: responseId },
      data: { status: action === 'accept' ? 'accepted' : 'declined' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePicture: true
          }
        }
      }
    });

    res.json({ message: `Response ${action}ed`, response: updated });
  } catch (error) {
    logger.error('Handle TeamUp response error:', 'teamUpController', { error });
    res.status(500).json({ error: 'Failed to handle response' });
  }
};

// Get responses for user's TeamUp requests
export const getMyTeamUpResponses = async (req: Request, res: Response) => {
  try {
    const responses = await prisma.teamUpResponse.findMany({
      where: {
        teamUpRequest: {
          creatorId: req.user.id
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePicture: true
          }
        },
        teamUpRequest: {
          select: {
            id: true,
            title: true,
            sportType: true,
            dateTime: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(responses);
  } catch (error) {
    logger.error('Get my TeamUp responses error:', 'teamUpController', { error });
    res.status(500).json({ error: 'Failed to get responses' });
  }
};
