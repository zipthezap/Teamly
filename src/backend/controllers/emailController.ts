const prisma = require('../config/database');
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailService');

// Get user email preferences
const getEmailPreferences = async (req, res) => {
  try {
    let preferences = await prisma.emailPreference.findUnique({
      where: { userId: req.user.id }
    });

    // Create default preferences if they don't exist
    if (!preferences) {
      preferences = await prisma.emailPreference.create({
        data: { userId: req.user.id }
      });
    }

    res.json(preferences);
  } catch (error) {
    console.error('Get email preferences error:', error);
    res.status(500).json({ error: 'Failed to get email preferences' });
  }
};

// Update user email preferences
const updateEmailPreferences = async (req, res) => {
  try {
    const {
      eventInvites,
      eventReminders,
      eventUpdates,
      eventCancellations,
      groupInvites,
      commentMentions
    } = req.body;

    const preferences = await prisma.emailPreference.upsert({
      where: { userId: req.user.id },
      update: {
        eventInvites: eventInvites !== undefined ? eventInvites : undefined,
        eventReminders: eventReminders !== undefined ? eventReminders : undefined,
        eventUpdates: eventUpdates !== undefined ? eventUpdates : undefined,
        eventCancellations: eventCancellations !== undefined ? eventCancellations : undefined,
        groupInvites: groupInvites !== undefined ? groupInvites : undefined,
        commentMentions: commentMentions !== undefined ? commentMentions : undefined
      },
      create: {
        userId: req.user.id,
        eventInvites: eventInvites !== undefined ? eventInvites : true,
        eventReminders: eventReminders !== undefined ? eventReminders : true,
        eventUpdates: eventUpdates !== undefined ? eventUpdates : true,
        eventCancellations: eventCancellations !== undefined ? eventCancellations : true,
        groupInvites: groupInvites !== undefined ? groupInvites : true,
        commentMentions: commentMentions !== undefined ? commentMentions : true
      }
    });

    res.json(preferences);
  } catch (error) {
    console.error('Update email preferences error:', error);
    res.status(500).json({ error: 'Failed to update email preferences' });
  }
};

// Send email verification
const sendVerificationEmail = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');

    // Update user with token
    await prisma.user.update({
      where: { id: req.user.id },
      data: { emailVerificationToken: token }
    });

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email/${token}`;
    await sendEmail(user.email, 'emailVerification', user.name, verificationUrl);

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Send verification email error:', error);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
};

// Verify email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null
      }
    });

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
};

// Toggle email notifications on/off
const toggleEmailNotifications = async (req, res) => {
  try {
    const { enabled } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { emailNotifications: enabled }
    });

    res.json({ emailNotifications: user.emailNotifications });
  } catch (error) {
    console.error('Toggle email notifications error:', error);
    res.status(500).json({ error: 'Failed to toggle email notifications' });
  }
};

module.exports = {
  getEmailPreferences,
  updateEmailPreferences,
  sendVerificationEmail,
  verifyEmail,
  toggleEmailNotifications
};
