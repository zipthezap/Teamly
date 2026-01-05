const prisma = require('../config/database');

// Group Chat
exports.createMessage = async (req, res) => {
  try {
    const { groupId, content } = req.body;
    const userId = req.user.id;
    const message = await prisma.groupMessage.create({
      data: { groupId, userId, content },
      include: { user: { select: { id: true, name: true } } }
    });
    res.status(201).json(message);
  } catch (e) {
    res.status(500).json({ error: 'Failed to send message' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const messages = await prisma.groupMessage.findMany({
      where: { groupId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true } } }
    });
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// Event Attendance (late)
exports.markLate = async (req, res) => {
  try {
    const { eventId } = req.body;
    const userId = req.user.id;

    // Get event to find the organizer
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { creatorId: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const attendance = await prisma.eventAttendance.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { status: 'late' },
      create: { eventId, userId, status: 'late' }
    });

    // Notify event organizer if the user marking late is not the organizer
    if (event.creatorId !== userId) {
      await prisma.eventNotification.create({
        data: {
          eventId,
          userId: event.creatorId,
          type: 'late'
        }
      });
    }

    res.json(attendance);
  } catch (e) {
    console.error('Mark late error:', e);
    res.status(500).json({ error: 'Failed to mark as late' });
  }
};

// Event Notifications (organizer)
exports.notifyJoinLeave = async (eventId, userId, type) => {
  await prisma.eventNotification.create({
    data: { eventId, userId, type }
  });
};

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    // Only fetch unread notifications
    const [eventNotifications, groupNotifications] = await Promise.all([
      prisma.eventNotification.findMany({
        where: { userId, read: false },
        include: {
          event: { select: { id: true, title: true } },
          user: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.groupNotification.findMany({
        where: { userId, read: false },
        include: {
          group: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);
    // Tag type for frontend
    const all = [
      ...eventNotifications.map(n => ({ ...n, notificationType: 'event' })),
      ...groupNotifications.map(n => ({ ...n, notificationType: 'group' })),
    ];
    // Sort by createdAt desc
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(all);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

exports.markNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if there are unread notifications first
    const [unreadEventCount, unreadGroupCount] = await Promise.all([
      prisma.eventNotification.count({
        where: { userId, read: false }
      }),
      prisma.groupNotification.count({
        where: { userId, read: false }
      })
    ]);
    
    // Only update if there are unread notifications
    if (unreadEventCount > 0 || unreadGroupCount > 0) {
      await Promise.all([
        unreadEventCount > 0 ? prisma.eventNotification.updateMany({
          where: { userId, read: false },
          data: { read: true }
        }) : Promise.resolve(),
        unreadGroupCount > 0 ? prisma.groupNotification.updateMany({
          where: { userId, read: false },
          data: { read: true }
        }) : Promise.resolve()
      ]);
    }
    
    res.json({ message: 'Notifications marked as read' });
  } catch (e) {
    console.error('Mark notifications read error:', e);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
};
