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
    const attendance = await prisma.eventAttendance.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { status: 'late' },
      create: { eventId, userId, status: 'late' }
    });
    res.json(attendance);
  } catch (e) {
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
    const notifications = await prisma.eventNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notifications);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};
