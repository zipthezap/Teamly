const express = require('express');
const router = express.Router();
const {
  getEmailPreferences,
  updateEmailPreferences,
  sendVerificationEmail,
  verifyEmail,
  toggleEmailNotifications
} = require('../controllers/emailController');
const { authenticate } = require('../middleware/auth');

// Get email preferences
router.get('/preferences', authenticate, getEmailPreferences);

// Update email preferences
router.put('/preferences', authenticate, updateEmailPreferences);

// Toggle email notifications on/off
router.put('/notifications/toggle', authenticate, toggleEmailNotifications);

// Send verification email
router.post('/verify/send', authenticate, sendVerificationEmail);

// Verify email with token
router.get('/verify/:token', verifyEmail);

module.exports = router;
