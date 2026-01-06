const prisma = require('../config/database');

exports.getNotificationPreferences = async (req, res) => {
  try {
    let prefs = await prisma.emailPreference.findUnique({
      where: { userId: req.user.id },
    });
    if (!prefs) {
      prefs = await prisma.emailPreference.create({ data: { userId: req.user.id } });
    }
    res.json(prefs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
};

exports.updateNotificationPreferences = async (req, res) => {
  try {
    const prefs = await prisma.emailPreference.update({
      where: { userId: req.user.id },
      data: req.body,
    });
    res.json(prefs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
};
