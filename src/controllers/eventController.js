const prisma = require('../config/database');

const createEvent = async (req, res) => {
  try {
    const { groupId, title, description, eventType, location, startTime, endTime, maxPlayers } = req.body;

    if (!groupId || !title || !eventType || !startTime) {
      return res.status(400).json({ error: 'Group ID, title, event type, and start time are required' });
    }

    // Check if user is member of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: req.user.id
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only group members can create events' });
    }

    const event = await prisma.event.create({
      data: {
        groupId,
        creatorId: req.user.id,
        title,
        description,
        eventType,
        location,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        maxPlayers: maxPlayers ? parseInt(maxPlayers) : null,
        participants: {
          create: {
            userId: req.user.id,
            status: 'confirmed'
          }
        }
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        group: {
          select: { id: true, name: true }
        },
        participants: {
          select: {
            id: true,
            userId: true,
            status: true,
            joinedAt: true
          }
        }
      }
    });

    res.status(201).json(event);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
};

const getEvents = async (req, res) => {
  try {
    const { groupId } = req.query;

    const where = {
      group: {
        members: {
          some: {
            userId: req.user.id
          }
        }
      }
    };

    if (groupId) {
      where.groupId = groupId;
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        group: {
          select: { id: true, name: true }
        },
        participants: {
          select: {
            id: true,
            userId: true,
            status: true,
            joinedAt: true
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
};

const getEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findFirst({
      where: {
        id,
        group: {
          members: {
            some: {
              userId: req.user.id
            }
          }
        }
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        group: {
          select: { id: true, name: true }
        },
        participants: {
          select: {
            id: true,
            userId: true,
            status: true,
            joinedAt: true
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to get event' });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, eventType, location, startTime, endTime, maxPlayers } = req.body;

    // Check if user is the creator of the event
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event || event.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only the event creator can update it' });
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(eventType && { eventType }),
        ...(location !== undefined && { location }),
        ...(startTime && { startTime: new Date(startTime) }),
        ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
        ...(maxPlayers !== undefined && { maxPlayers: maxPlayers ? parseInt(maxPlayers) : null })
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        group: {
          select: { id: true, name: true }
        },
        participants: {
          select: {
            id: true,
            userId: true,
            status: true,
            joinedAt: true
          }
        }
      }
    });

    res.json(updatedEvent);
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is the creator of the event
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event || event.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Only the event creator can delete it' });
    }

    await prisma.event.delete({
      where: { id }
    });

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
};

const joinEvent = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is member of the group
    const event = await prisma.event.findFirst({
      where: {
        id,
        group: {
          members: {
            some: {
              userId: req.user.id
            }
          }
        }
      },
      include: {
        participants: true
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if already joined
    const existingParticipant = event.participants.find(p => p.userId === req.user.id);
    if (existingParticipant) {
      return res.status(400).json({ error: 'Already joined this event' });
    }

    // Check max players
    if (event.maxPlayers) {
      const confirmedCount = event.participants.filter(p => p.status === 'confirmed').length;
      if (confirmedCount >= event.maxPlayers) {
        return res.status(400).json({ error: 'Event is full' });
      }
    }

    const participant = await prisma.eventParticipant.create({
      data: {
        eventId: id,
        userId: req.user.id,
        status: 'confirmed'
      }
    });

    res.status(201).json(participant);
  } catch (error) {
    console.error('Join event error:', error);
    res.status(500).json({ error: 'Failed to join event' });
  }
};

const leaveEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const participant = await prisma.eventParticipant.findFirst({
      where: {
        eventId: id,
        userId: req.user.id
      }
    });

    if (!participant) {
      return res.status(404).json({ error: 'Not participating in this event' });
    }

    await prisma.eventParticipant.delete({
      where: { id: participant.id }
    });

    res.json({ message: 'Left event successfully' });
  } catch (error) {
    console.error('Leave event error:', error);
    res.status(500).json({ error: 'Failed to leave event' });
  }
};

const updateParticipationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'confirmed', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const participant = await prisma.eventParticipant.findFirst({
      where: {
        eventId: id,
        userId: req.user.id
      }
    });

    if (!participant) {
      return res.status(404).json({ error: 'Not participating in this event' });
    }

    const updatedParticipant = await prisma.eventParticipant.update({
      where: { id: participant.id },
      data: { status }
    });

    res.json(updatedParticipant);
  } catch (error) {
    console.error('Update participation status error:', error);
    res.status(500).json({ error: 'Failed to update participation status' });
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  joinEvent,
  leaveEvent,
  updateParticipationStatus
};
