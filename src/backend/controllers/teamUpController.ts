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
      select: { 
        status: true, 
        creatorId: true, 
        title: true,
        sportType: true,
        dateTime: true,
        creator: {
          select: {
            email: true,
            name: true
          }
        }
      }
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

    // Create notification for the request creator
    try {
      await prisma.notification.create({
        data: {
          userId: teamUpRequest.creatorId,
          type: 'teamup_response',
          title: 'New TeamUp Response',
          message: `${req.user.name} responded to your TeamUp request "${teamUpRequest.title}"`,
          relatedEntityId: id,
          relatedEntityType: 'teamup_request'
        }
      });

      // Send email notification
      const emailHtml = `
        <h2>New Response to Your TeamUp Request</h2>
        <p>Hi ${teamUpRequest.creator.name},</p>
        <p><strong>${req.user.name}</strong> has responded to your TeamUp request:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="margin-top: 0;">${teamUpRequest.title}</h3>
          <p><strong>Sport:</strong> ${teamUpRequest.sportType}</p>
          <p><strong>Date:</strong> ${new Date(teamUpRequest.dateTime).toLocaleString()}</p>
          ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
        </div>
        <p>Log in to your account to accept or decline this response.</p>
      `;

      await prisma.emailQueue.create({
        data: {
          recipient: teamUpRequest.creator.email,
          subject: `New Response to "${teamUpRequest.title}"`,
          htmlContent: emailHtml,
          templateType: 'teamup_response',
          status: 'pending',
          scheduledAt: new Date()
        }
      });
    } catch (notifError) {
      logger.error('Failed to create TeamUp response notification:', 'teamUpController', { error: notifError });
      // Don't fail the response if notification fails
    }

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
      select: { 
        creatorId: true, 
        playersNeeded: true, 
        title: true,
        sportType: true,
        dateTime: true,
        location: true
      }
    });

    if (!teamUpRequest) {
      return res.status(404).json({ error: 'TeamUp request not found' });
    }

    if (teamUpRequest.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator can manage responses' });
    }

    const response = await prisma.teamUpResponse.findUnique({
      where: { id: responseId },
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

    // Create notification for the responder
    try {
      await prisma.notification.create({
        data: {
          userId: response.userId,
          type: action === 'accept' ? 'teamup_accepted' : 'teamup_declined',
          title: action === 'accept' ? 'Response Accepted' : 'Response Declined',
          message: action === 'accept' 
            ? `Your response to "${teamUpRequest.title}" was accepted!`
            : `Your response to "${teamUpRequest.title}" was declined.`,
          relatedEntityId: id,
          relatedEntityType: 'teamup_request'
        }
      });

      // Send email notification
      const emailHtml = action === 'accept' 
        ? `
          <h2>Your Response Was Accepted! 🎉</h2>
          <p>Hi ${response.user.name},</p>
          <p>Great news! Your response to the following TeamUp request has been accepted:</p>
          <div style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #3b82f6;">
            <h3 style="margin-top: 0; color: #1e40af;">${teamUpRequest.title}</h3>
            <p><strong>Sport:</strong> ${teamUpRequest.sportType}</p>
            <p><strong>Date:</strong> ${new Date(teamUpRequest.dateTime).toLocaleString()}</p>
            ${teamUpRequest.location ? `<p><strong>Location:</strong> ${teamUpRequest.location}</p>` : ''}
          </div>
          <p>Get ready for the game! Make sure to arrive on time.</p>
        `
        : `
          <h2>Response Status Update</h2>
          <p>Hi ${response.user.name},</p>
          <p>Thank you for your interest. Unfortunately, your response to the following TeamUp request was not accepted:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3 style="margin-top: 0;">${teamUpRequest.title}</h3>
            <p><strong>Sport:</strong> ${teamUpRequest.sportType}</p>
            <p><strong>Date:</strong> ${new Date(teamUpRequest.dateTime).toLocaleString()}</p>
          </div>
          <p>Keep looking for other opportunities on TeamUp!</p>
        `;

      await prisma.emailQueue.create({
        data: {
          recipient: response.user.email,
          subject: action === 'accept' 
            ? `You're In! Response Accepted for "${teamUpRequest.title}"`
            : `Response Update for "${teamUpRequest.title}"`,
          htmlContent: emailHtml,
          templateType: action === 'accept' ? 'teamup_accepted' : 'teamup_declined',
          status: 'pending',
          scheduledAt: new Date()
        }
      });
    } catch (notifError) {
      logger.error('Failed to create TeamUp action notification:', 'teamUpController', { error: notifError });
      // Don't fail the response if notification fails
    }

    // Check if request should be auto-filled
    if (action === 'accept') {
      const acceptedCount = await prisma.teamUpResponse.count({
        where: {
          teamUpRequestId: id,
          status: 'accepted'
        }
      });

      // Auto-update status to 'filled' if enough players have been accepted
      if (acceptedCount >= teamUpRequest.playersNeeded) {
        await prisma.teamUpRequest.update({
          where: { id },
          data: { status: 'filled' }
        });
      }
    }

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
