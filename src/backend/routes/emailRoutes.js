const express = require('express');
const router = express.Router();

const {
  getEmailPreferences,
  updateEmailPreferences,
  sendVerificationEmail,
  verifyEmail,
  toggleEmailNotifications
} = require('../controllers/emailController');
const authMiddleware = require('../middleware/auth');


// Get email preferences
router.get('/preferences', authMiddleware, getEmailPreferences);

// Update email preferences
router.put('/preferences', authMiddleware, updateEmailPreferences);

// Toggle email notifications on/off
router.put('/notifications/toggle', authMiddleware, toggleEmailNotifications);

// Send verification email
router.post('/verify/send', authMiddleware, sendVerificationEmail);

// Verify email with token
router.get('/verify/:token', verifyEmail);

module.exports = router;
